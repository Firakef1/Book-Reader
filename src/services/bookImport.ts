import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { Book, FileType } from '../types';
import { coverPalette } from '../theme/colors';
import { charsPerPage } from '../theme/typography';
import { createId, paginateText, stripHtml } from '../utils/helpers';
import { ensureReadPermission } from './permissions';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function detectType(name: string, mimeType?: string | null): FileType | null {
  const lower = name.toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  if (lower.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (lower.endsWith('.txt') || mime.includes('text/plain')) return 'txt';
  if (lower.endsWith('.epub') || mime.includes('epub')) return 'epub';
  return null;
}

function decodeUriComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** True for Android SAF / picker placeholders like "document_1000", "1000", "document:42". */
function isGenericPickerName(name: string): boolean {
  const base = name
    .replace(/\.(txt|epub|pdf)$/i, '')
    .replace(/^document:/i, '')
    .trim();
  if (!base) return true;
  if (/^\d+$/.test(base)) return true;
  if (/^document([:_\s-]?\d+)?$/i.test(base)) return true;
  if (/^(image|video|audio|file|download|octet-stream)([:_\s-]?\d+)?$/i.test(base)) {
    return true;
  }
  return false;
}

/**
 * Recover a real filename from content:// URIs that embed a path
 * (e.g. .../document/raw%3A%2Fstorage%2F...%2FMyBook.pdf).
 */
function filenameFromUri(uri?: string | null): string | null {
  if (!uri) return null;
  const decoded = decodeUriComponentSafe(uri);

  const rawMatch = decoded.match(/(?:^|[?&#/])raw:([^?#]+)/i);
  if (rawMatch?.[1]) {
    const fromRaw = rawMatch[1].split('/').filter(Boolean).pop();
    if (fromRaw && !isGenericPickerName(fromRaw)) return fromRaw;
  }

  const primaryMatch = decoded.match(/primary:([^?#]+)/i);
  if (primaryMatch?.[1]) {
    const fromPrimary = primaryMatch[1].split('/').filter(Boolean).pop();
    if (fromPrimary && !isGenericPickerName(fromPrimary)) return fromPrimary;
  }

  const pathPart = decoded.split('?')[0] ?? decoded;
  const last = pathPart.split('/').filter(Boolean).pop();
  if (!last) return null;

  const afterColon = last.includes(':') ? last.slice(last.lastIndexOf(':') + 1) : last;
  const candidate = afterColon.split('/').filter(Boolean).pop() ?? afterColon;
  if (candidate && !isGenericPickerName(candidate)) return candidate;
  return null;
}

function ensureExtension(name: string, ext: string): string {
  if (/\.(txt|epub|pdf)$/i.test(name)) return name;
  return `${name}.${ext}`;
}

/**
 * Prefer the picker display name; fall back to a filename recovered from the URI.
 * Avoids Android content-URI basenames like "document_1000".
 */
function resolveImportFileName(input: {
  name?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  fallbackId: string;
}): string {
  const guessedType =
    detectType(input.name ?? '', input.mimeType) ??
    detectType(filenameFromUri(input.uri) ?? '', input.mimeType) ??
    detectType(input.uri ?? '', input.mimeType) ??
    'pdf';

  const candidates = [input.name, filenameFromUri(input.uri)].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

  for (const candidate of candidates) {
    const cleaned = decodeUriComponentSafe(candidate).trim();
    if (!cleaned || isGenericPickerName(cleaned)) continue;
    return ensureExtension(cleaned, guessedType);
  }

  return `book-${input.fallbackId}.${guessedType}`;
}

function titleFromFilename(name: string): string {
  return (
    name
      .replace(/\.(txt|epub|pdf)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled'
  );
}

function ensureBooksDirectory(): Directory {
  const dir = new Directory(Paths.document, 'books');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/**
 * Save a picked Expo File into app document storage.
 * Uses the new File API (bytes/copy) — works when legacy ReadAsStringAsync
 * cannot read DocumentPicker cache paths on Android/Expo Go.
 */
async function persistExpoFile(
  source: File,
  id: string,
  ext: string,
): Promise<string> {
  const booksDir = ensureBooksDirectory();
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const dest = new File(booksDir, `${safeId}.${ext}`);

  if (dest.exists) {
    dest.delete();
  }

  const errors: string[] = [];

  // 1) Preferred: copy handle → app storage
  try {
    await source.copy(dest, { overwrite: true });
    if (dest.exists && (dest.size ?? 0) > 0) {
      return dest.uri;
    }
    errors.push('copy produced empty file');
  } catch (e) {
    errors.push(`copy: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2) Read bytes from picker handle, write into app storage
  try {
    const bytes = await source.bytes();
    if (!bytes || bytes.byteLength === 0) {
      throw new Error('empty bytes');
    }
    if (!dest.exists) {
      dest.create({ intermediates: true, overwrite: true });
    }
    dest.write(bytes);
    if (dest.exists && (dest.size ?? 0) > 0) {
      return dest.uri;
    }
    errors.push('bytes write produced empty file');
  } catch (e) {
    errors.push(`bytes: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 3) fetch(uri) → arrayBuffer → write (helps some Android/Expo Go URIs)
  try {
    const response = await fetch(source.uri);
    if (!response.ok) {
      throw new Error(`fetch status ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength === 0) throw new Error('empty fetch body');
    if (!dest.exists) {
      dest.create({ intermediates: true, overwrite: true });
    }
    dest.write(bytes);
    if (dest.exists && (dest.size ?? 0) > 0) {
      return dest.uri;
    }
    errors.push('fetch write produced empty file');
  } catch (e) {
    errors.push(`fetch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 4) Legacy FS as last resort
  try {
    const base64 = await LegacyFS.readAsStringAsync(source.uri, {
      encoding: LegacyFS.EncodingType.Base64,
    });
    await LegacyFS.writeAsStringAsync(dest.uri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    });
    return dest.uri;
  } catch (e) {
    errors.push(`legacy: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(
    `Could not save the selected file. Details: ${errors.join(' | ')}`,
  );
}

/**
 * Persist a raw URI (DocumentPicker fallback).
 */
async function persistUri(
  sourceUri: string,
  id: string,
  ext: string,
): Promise<string> {
  // Wrap URI as File and reuse the same strategies
  try {
    const source = new File(sourceUri);
    return await persistExpoFile(source, id, ext);
  } catch {
    // continue
  }

  const booksDir = ensureBooksDirectory();
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  const dest = new File(booksDir, `${safeId}.${ext}`);
  if (dest.exists) dest.delete();

  // Direct fetch of picker URI
  const response = await fetch(sourceUri);
  if (!response.ok) {
    throw new Error(
      'Android could not open that file. Pick it again from Files or Downloads.',
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('Selected file is empty.');
  }
  dest.create({ intermediates: true, overwrite: true });
  dest.write(bytes);
  return dest.uri;
}

async function readLocalText(uri: string): Promise<string> {
  try {
    const file = new File(uri);
    return await file.text();
  } catch {
    return LegacyFS.readAsStringAsync(uri);
  }
}

async function readLocalBytes(uri: string): Promise<Uint8Array> {
  try {
    const file = new File(uri);
    return await file.bytes();
  } catch {
    const base64 = await LegacyFS.readAsStringAsync(uri, {
      encoding: LegacyFS.EncodingType.Base64,
    });
    return new Uint8Array(base64ToArrayBuffer(base64));
  }
}

async function parseEpub(uri: string): Promise<{
  title: string;
  author: string;
  content: string;
}> {
  const bytes = await readLocalBytes(uri);
  const zip = await JSZip.loadAsync(bytes);

  let title = 'Untitled EPUB';
  let author = 'Unknown Author';

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: missing container.xml');
  }

  const containerXml = await containerFile.async('text');
  const rootMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
  if (!rootMatch) {
    throw new Error('Invalid EPUB: cannot find package document');
  }

  const opfPath = rootMatch[1];
  const opfDir = opfPath.includes('/')
    ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1)
    : '';
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('Invalid EPUB: package document missing');
  }

  const opf = await opfFile.async('text');
  const titleMatch = opf.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const authorMatch = opf.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
  if (titleMatch) title = titleMatch[1].trim();
  if (authorMatch) author = authorMatch[1].trim();

  const idToHref = new Map<string, string>();
  const allItems = [...opf.matchAll(/<item\b([^>]+)>/gi)];
  for (const item of allItems) {
    const attrs = item[1];
    const idAttr = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (idAttr && href) idToHref.set(idAttr, href);
  }

  const spineIds = [
    ...opf.matchAll(/<itemref[^>]+idref=["']([^"']+)["']/gi),
  ].map((m) => m[1]);

  const chapters: string[] = [];
  for (const spineId of spineIds) {
    const href = idToHref.get(spineId);
    if (!href) continue;
    const fullPath = opfDir + href;
    const chapterFile =
      zip.file(fullPath) || zip.file(decodeURIComponent(fullPath));
    if (!chapterFile) continue;
    const html = await chapterFile.async('text');
    const text = stripHtml(html);
    if (text) chapters.push(text);
  }

  const content = chapters.join('\n\n');
  if (!content.trim()) {
    throw new Error('Could not extract text from this EPUB');
  }

  return { title, author, content };
}

async function buildBookFromSavedFile(input: {
  id: string;
  name: string;
  mimeType?: string | null;
  filePath: string;
  fileType: FileType;
}): Promise<Book> {
  const color = coverPalette[Math.floor(Math.random() * coverPalette.length)];
  const title = titleFromFilename(input.name);

  if (input.fileType === 'pdf') {
    return {
      id: input.id,
      title,
      author: 'PDF Document',
      coverColor: color,
      filePath: input.filePath,
      fileType: 'pdf',
      content: '',
      totalPages: 1,
      addedDate: new Date().toISOString(),
      status: 'toRead',
    };
  }

  let author = 'Unknown Author';
  let content = '';
  let resolvedTitle = title;

  if (input.fileType === 'txt') {
    content = await readLocalText(input.filePath);
  } else {
    const parsed = await parseEpub(input.filePath);
    resolvedTitle = parsed.title || title;
    author = parsed.author;
    content = parsed.content;
  }

  if (!content.trim()) {
    throw new Error('The selected file appears to be empty.');
  }

  const pages = paginateText(content, charsPerPage(18));

  return {
    id: input.id,
    title: resolvedTitle,
    author,
    coverColor: color,
    filePath: input.filePath,
    fileType: input.fileType,
    content,
    totalPages: Math.max(1, pages.length),
    addedDate: new Date().toISOString(),
    status: 'toRead',
  };
}

/**
 * Pick and import a book.
 * Primary path: expo-document-picker (returns the real display name via Android
 * OpenableColumns.DISPLAY_NAME / iOS).
 * Fallback: expo-file-system File.pickFileAsync when DocumentPicker is unavailable.
 */
export async function pickAndImportBook(): Promise<Book | null> {
  const allowed = await ensureReadPermission();
  if (!allowed) {
    throw new Error(
      'Storage permission was denied. Allow file access when prompted, then try again.',
    );
  }

  const id = createId();
  let pickedFile: File | null = null;
  let name = '';
  let mimeType: string | null | undefined;
  let sourceUri: string | null = null;

  // --- Primary: DocumentPicker (preserves original filename) ---
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/plain',
        'application/epub+zip',
        '*/*',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    mimeType = asset.mimeType;
    sourceUri = asset.uri;
    name = resolveImportFileName({
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType,
      fallbackId: id,
    });
    // Expo may need a moment before the cache copy is visible
    await new Promise((r) => setTimeout(r, 200));
  } catch (pickerError) {
    const msg =
      pickerError instanceof Error ? pickerError.message : String(pickerError);
    if (/cancel/i.test(msg)) return null;

    // --- Fallback: File.pickFileAsync ---
    const picked = await File.pickFileAsync({
      mimeTypes: [
        'application/pdf',
        'text/plain',
        'application/epub+zip',
        '*/*',
      ],
    });
    if (picked.canceled || !picked.result) return null;
    pickedFile = picked.result;
    mimeType = pickedFile.type;
    sourceUri = pickedFile.uri;
    name = resolveImportFileName({
      name: pickedFile.name,
      uri: pickedFile.uri,
      mimeType: pickedFile.type,
      fallbackId: id,
    });
  }

  const fileType = detectType(name, mimeType);
  if (!fileType) {
    throw new Error(
      'Unsupported file type. Please import .pdf, .epub, or .txt files.',
    );
  }

  let filePath: string;
  try {
    if (pickedFile) {
      filePath = await persistExpoFile(pickedFile, id, fileType);
    } else if (sourceUri) {
      filePath = await persistUri(sourceUri, id, fileType);
    } else {
      throw new Error('No file was selected.');
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not save the file into the app. ${detail}`,
    );
  }

  return buildBookFromSavedFile({
    id,
    name,
    mimeType,
    filePath,
    fileType,
  });
}

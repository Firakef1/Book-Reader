import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { saveBookCoverBytes } from './bookContent';
import { Book, BookChapter, FileType } from '../types';
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
  chapters: BookChapter[];
  coverBytes?: Uint8Array;
  coverExt?: 'jpg' | 'png' | 'webp';
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
  const idToMedia = new Map<string, string>();
  const idToTitle = new Map<string, string>();
  const allItems = [...opf.matchAll(/<item\b([^>]+)>/gi)];
  for (const item of allItems) {
    const attrs = item[1];
    const idAttr = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const media = attrs.match(/\bmedia-type=["']([^"']+)["']/i)?.[1];
    const props = attrs.match(/\bproperties=["']([^"']+)["']/i)?.[1] ?? '';
    if (idAttr && href) {
      idToHref.set(idAttr, href);
      if (media) idToMedia.set(idAttr, media);
      if (/cover-image/i.test(props)) {
        idToHref.set('__cover__', href);
        if (media) idToMedia.set('__cover__', media);
      }
    }
  }

  const metaCover =
    opf.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    opf.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']cover["']/i)?.[1];
  if (metaCover && idToHref.has(metaCover)) {
    idToHref.set('__cover__', idToHref.get(metaCover)!);
    const media = idToMedia.get(metaCover);
    if (media) idToMedia.set('__cover__', media);
  }

  let coverBytes: Uint8Array | undefined;
  let coverExt: 'jpg' | 'png' | 'webp' | undefined;
  const coverHref = idToHref.get('__cover__');
  if (coverHref) {
    const coverPath = opfDir + coverHref;
    const coverFile =
      zip.file(coverPath) || zip.file(decodeURIComponent(coverPath));
    if (coverFile) {
      const buf = await coverFile.async('uint8array');
      coverBytes = buf;
      const media = (idToMedia.get('__cover__') ?? '').toLowerCase();
      if (media.includes('png') || coverHref.toLowerCase().endsWith('.png')) {
        coverExt = 'png';
      } else if (
        media.includes('webp') ||
        coverHref.toLowerCase().endsWith('.webp')
      ) {
        coverExt = 'webp';
      } else {
        coverExt = 'jpg';
      }
    }
  }

  // Optional nav map titles (EPUB2)
  const navMap = [...opf.matchAll(/<navPoint[\s\S]*?<\/navPoint>/gi)];
  for (const nav of navMap) {
    const label =
      nav[0].match(/<n(?:avLabel)?[^>]*>[\s\S]*?<text[^>]*>([^<]+)<\/text>/i)?.[1] ??
      nav[0].match(/<text[^>]*>([^<]+)<\/text>/i)?.[1];
    const src = nav[0].match(/<content[^>]+src=["']([^"'#]+)/i)?.[1];
    if (label && src) {
      const normalized = decodeURIComponent(src.replace(/^\.\//, ''));
      idToTitle.set(normalized, label.trim());
      idToTitle.set(opfDir + normalized, label.trim());
    }
  }

  const spineIds = [
    ...opf.matchAll(/<itemref[^>]+idref=["']([^"']+)["']/gi),
  ].map((m) => m[1]);

  const chapterTexts: string[] = [];
  const chapters: BookChapter[] = [];

  for (let i = 0; i < spineIds.length; i++) {
    const spineId = spineIds[i];
    const href = idToHref.get(spineId);
    if (!href) continue;
    const fullPath = opfDir + href;
    const chapterFile =
      zip.file(fullPath) || zip.file(decodeURIComponent(fullPath));
    if (!chapterFile) continue;
    const html = await chapterFile.async('text');
    const text = stripHtml(html);
    if (!text) continue;

    const heading =
      html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const fromNav =
      idToTitle.get(href) ||
      idToTitle.get(fullPath) ||
      idToTitle.get(decodeURIComponent(href));
    const chapterTitle = stripHtml(fromNav || heading || `Chapter ${i + 1}`)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    chapters.push({
      title: chapterTitle || `Chapter ${i + 1}`,
      startOffset: 0,
    });
    chapterTexts.push(text);
  }

  const content = chapterTexts.join('\n\n');
  if (!content.trim()) {
    throw new Error('Could not extract text from this EPUB');
  }

  let cursor = 0;
  for (let i = 0; i < chapterTexts.length; i++) {
    chapters[i].startOffset = cursor;
    cursor += chapterTexts[i].length;
    if (i < chapterTexts.length - 1) cursor += 2;
  }

  return { title, author, content, chapters, coverBytes, coverExt };
}

async function buildBookFromSavedFile(input: {
  id: string;
  name: string;
  mimeType?: string | null;
  filePath: string;
  fileType: FileType;
  sourceSize?: number;
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
      sourceName: input.name,
      sourceSize: input.sourceSize,
    };
  }

  let author = 'Unknown Author';
  let content = '';
  let resolvedTitle = title;
  let chapters: BookChapter[] | undefined;
  let coverImage: string | undefined;

  if (input.fileType === 'txt') {
    content = await readLocalText(input.filePath);
  } else {
    const parsed = await parseEpub(input.filePath);
    resolvedTitle = parsed.title || title;
    author = parsed.author;
    content = parsed.content;
    chapters = parsed.chapters.length > 1 ? parsed.chapters : undefined;
    if (parsed.coverBytes && parsed.coverExt) {
      try {
        coverImage = await saveBookCoverBytes(
          input.id,
          parsed.coverBytes,
          parsed.coverExt,
        );
      } catch {
        // optional
      }
    }
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
    coverImage,
    filePath: input.filePath,
    fileType: input.fileType,
    content,
    totalPages: Math.max(1, pages.length),
    addedDate: new Date().toISOString(),
    status: 'toRead',
    chapters,
    sourceName: input.name,
    sourceSize: input.sourceSize,
  };
}

async function importPickedAsset(input: {
  name: string;
  mimeType?: string | null;
  uri: string;
  pickedFile?: File | null;
  size?: number | null;
}): Promise<Book> {
  const id = createId();
  const name = resolveImportFileName({
    name: input.name,
    uri: input.uri,
    mimeType: input.mimeType,
    fallbackId: id,
  });
  const fileType = detectType(name, input.mimeType);
  if (!fileType) {
    throw new Error(
      'Unsupported file type. Please import .pdf, .epub, or .txt files.',
    );
  }

  let filePath: string;
  if (input.pickedFile) {
    filePath = await persistExpoFile(input.pickedFile, id, fileType);
  } else {
    filePath = await persistUri(input.uri, id, fileType);
  }

  let sourceSize = input.size ?? undefined;
  try {
    const saved = new File(filePath);
    if (typeof saved.size === 'number' && saved.size > 0) {
      sourceSize = saved.size;
    }
  } catch {
    // ignore
  }

  return buildBookFromSavedFile({
    id,
    name,
    mimeType: input.mimeType,
    filePath,
    fileType,
    sourceSize,
  });
}

export type ImportBooksResult = {
  books: Book[];
  skippedDuplicates: string[];
  errors: string[];
};

/**
 * Pick and import one or more books.
 * Primary: DocumentPicker with multi-select (keeps display names).
 * Fallback: single-file File.pickFileAsync.
 */
export async function pickAndImportBooks(options?: {
  isDuplicate?: (book: Book) => Book | undefined;
  onDuplicate?: (existing: Book, incoming: Book) => 'skip' | 'keep';
}): Promise<ImportBooksResult> {
  const allowed = await ensureReadPermission();
  if (!allowed) {
    throw new Error(
      'Storage permission was denied. Allow file access when prompted, then try again.',
    );
  }

  let assets: {
    name: string;
    mimeType?: string | null;
    uri: string;
    pickedFile?: File | null;
    size?: number | null;
  }[] = [];

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/plain',
        'application/epub+zip',
        '*/*',
      ],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) {
      return { books: [], skippedDuplicates: [], errors: [] };
    }
    await new Promise((r) => setTimeout(r, 200));
    assets = result.assets.map((asset) => ({
      name: asset.name,
      mimeType: asset.mimeType,
      uri: asset.uri,
      size: asset.size,
    }));
  } catch (pickerError) {
    const msg =
      pickerError instanceof Error ? pickerError.message : String(pickerError);
    if (/cancel/i.test(msg)) {
      return { books: [], skippedDuplicates: [], errors: [] };
    }

    const picked = await File.pickFileAsync({
      mimeTypes: [
        'application/pdf',
        'text/plain',
        'application/epub+zip',
        '*/*',
      ],
    });
    if (picked.canceled || !picked.result) {
      return { books: [], skippedDuplicates: [], errors: [] };
    }
    const file = picked.result;
    assets = [
      {
        name: file.name,
        mimeType: file.type,
        uri: file.uri,
        pickedFile: file,
        size: file.size,
      },
    ];
  }

  const books: Book[] = [];
  const skippedDuplicates: string[] = [];
  const errors: string[] = [];
  for (const asset of assets) {
    try {
      const book = await importPickedAsset(asset);
      const existing = options?.isDuplicate?.(book);
      if (existing) {
        const action = options?.onDuplicate?.(existing, book) ?? 'skip';
        if (action === 'skip') {
          skippedDuplicates.push(book.title);
          continue;
        }
      }
      books.push(book);
    } catch (e) {
      errors.push(
        `${asset.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (books.length === 0 && errors.length > 0 && skippedDuplicates.length === 0) {
    throw new Error(errors[0]);
  }
  return { books, skippedDuplicates, errors };
}

/** @deprecated Prefer pickAndImportBooks — kept for call sites expecting one book. */
export async function pickAndImportBook(): Promise<Book | null> {
  const { books } = await pickAndImportBooks();
  return books[0] ?? null;
}

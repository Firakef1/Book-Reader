import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';

function ensureContentDirectory(): Directory {
  const dir = new Directory(Paths.document, 'book-content');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function contentFile(bookId: string): File {
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, '');
  return new File(ensureContentDirectory(), `${safe}.txt`);
}

export async function saveBookTextContent(
  bookId: string,
  content: string,
): Promise<string> {
  const dest = contentFile(bookId);
  if (dest.exists) dest.delete();
  dest.create({ intermediates: true, overwrite: true });
  dest.write(content);
  return dest.uri;
}

export async function loadBookTextContent(bookId: string): Promise<string | null> {
  try {
    const dest = contentFile(bookId);
    if (!dest.exists) return null;
    return await dest.text();
  } catch {
    try {
      const dest = contentFile(bookId);
      return await LegacyFS.readAsStringAsync(dest.uri);
    } catch {
      return null;
    }
  }
}

export function deleteBookTextContent(bookId: string) {
  try {
    const dest = contentFile(bookId);
    if (dest.exists) dest.delete();
  } catch {
    // ignore
  }
}

export async function saveBookCoverBytes(
  bookId: string,
  bytes: Uint8Array,
  ext: 'jpg' | 'png' | 'webp' = 'jpg',
): Promise<string> {
  const dir = new Directory(Paths.document, 'book-covers');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, '');
  const dest = new File(dir, `${safe}.${ext}`);
  if (dest.exists) dest.delete();
  dest.create({ intermediates: true, overwrite: true });
  dest.write(bytes);
  return dest.uri;
}

export function deleteBookCover(coverImage?: string | null) {
  if (!coverImage) return;
  try {
    const file = new File(coverImage);
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}

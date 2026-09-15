import { BookStatus } from '../types';

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatRelativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function estimateMinutesRemaining(
  pagesLeft: number,
  totalTimeRead: number,
  pagesRead: number,
): number | null {
  if (pagesRead < 3 || totalTimeRead < 1) return null;
  const minutesPerPage = totalTimeRead / pagesRead;
  return Math.max(1, Math.round(pagesLeft * minutesPerPage));
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function paginateText(content: string, charsPerPage: number): string[] {
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return [content || ''];

  const pages: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > charsPerPage && current) {
      pages.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) pages.push(current);
  return pages.length > 0 ? pages : [''];
}

export function getPageParagraphs(pageContent: string): string[] {
  return pageContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
}

/** Resolve shelf category from progress — avoids PDF totalPages=1 false "Done". */
export function deriveBookStatus(
  book: { status: BookStatus; totalPages: number },
  progress?: { currentPage: number; totalTimeRead: number } | null,
): BookStatus {
  const page = progress?.currentPage ?? 0;
  const total = Math.max(1, book.totalPages);
  const atEnd = total > 1 && page >= total - 1;
  if (atEnd) return 'completed';

  const started =
    book.status === 'reading' ||
    book.status === 'completed' ||
    page > 0 ||
    (progress?.totalTimeRead ?? 0) > 0;

  if (started) return 'reading';
  return 'toRead';
}

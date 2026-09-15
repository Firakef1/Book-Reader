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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local calendar day N days before today (for streak walking). */
export function localDayKeyOffset(daysBack: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Map a stable character offset into a page index for the current pagination.
 */
export function pageIndexFromContentOffset(
  content: string,
  offset: number,
  charsPerPageValue: number,
): number {
  const pages = paginateText(content, charsPerPageValue);
  if (pages.length === 0) return 0;
  const target = Math.max(0, Math.min(content.length, offset));
  let start = 0;
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const idx = content.indexOf(pageText, start);
    const pageStart = idx >= 0 ? idx : start;
    const pageEnd = pageStart + pageText.length;
    if (target >= pageStart && target <= pageEnd) return i;
    if (target < pageStart) return Math.max(0, i - 1);
    start = pageEnd;
  }
  return Math.max(0, pages.length - 1);
}

export function contentOffsetFromPageIndex(
  content: string,
  pageIndex: number,
  charsPerPageValue: number,
): number {
  const pages = paginateText(content, charsPerPageValue);
  if (pages.length === 0) return 0;
  const safe = Math.max(0, Math.min(pages.length - 1, pageIndex));
  let start = 0;
  for (let i = 0; i <= safe; i++) {
    const pageText = pages[i];
    const idx = content.indexOf(pageText, start);
    if (i === safe) return Math.max(0, idx >= 0 ? idx : start);
    start = (idx >= 0 ? idx : start) + pageText.length;
  }
  return 0;
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
  book: { status: BookStatus; totalPages: number; statusLocked?: boolean },
  progress?: { currentPage: number; totalTimeRead: number } | null,
): BookStatus {
  if (book.statusLocked) return book.status;

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

/** Find search hits in flattened text content; returns page + snippet. */
export function searchInPages(
  pages: string[],
  query: string,
  limit = 40,
): { page: number; snippet: string }[] {
  const q = query.trim().toLowerCase();
  if (!q || pages.length === 0) return [];
  const hits: { page: number; snippet: string }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const lower = pages[i].toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(q, from);
      if (idx < 0) break;
      const start = Math.max(0, idx - 42);
      const end = Math.min(pages[i].length, idx + q.length + 42);
      const snippet = pages[i].slice(start, end).replace(/\s+/g, ' ').trim();
      hits.push({ page: i, snippet });
      if (hits.length >= limit) return hits;
      from = idx + q.length;
    }
  }
  return hits;
}

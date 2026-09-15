export type FileType = 'epub' | 'txt' | 'pdf';
export type BookStatus = 'reading' | 'toRead' | 'completed';
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
export type ThemeId = 'light' | 'dark' | 'sepia' | 'darkSepia';
export type FontFamily = 'serif' | 'sans' | 'mono';
export type LineHeight = 'compact' | 'normal' | 'spacious';
export type TextAlign = 'left' | 'justify';
export type PageTurnMode = 'scroll' | 'flip';
export type LibrarySort =
  | 'recentlyRead'
  | 'alphabetical'
  | 'recentlyAdded'
  | 'progress';
export type LibraryStatusFilter = 'all' | BookStatus;
export type LibraryFormatFilter = 'all' | FileType;

export interface BookChapter {
  title: string;
  /** Character offset into the flattened book content. */
  startOffset: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  coverImage?: string;
  filePath: string;
  fileType: FileType;
  /** In-memory text; persisted separately on disk for EPUB/TXT. */
  content: string;
  totalPages: number;
  addedDate: string;
  status: BookStatus;
  /** When true, auto status derivation will not overwrite user choice. */
  statusLocked?: boolean;
  collection?: string;
  chapters?: BookChapter[];
  /** Original filename used for duplicate detection. */
  sourceName?: string;
  /** Byte size when known — duplicate detection. */
  sourceSize?: number;
}

export interface ReadingSession {
  startTime: string;
  endTime: string;
  pagesRead: number;
}

export interface ReadingProgress {
  id: string;
  bookId: string;
  currentPage: number;
  scrollPosition: number;
  /** Stable resume anchor for text books (character index into content). */
  contentOffset?: number;
  lastReadDate: string;
  totalTimeRead: number;
  readingSessions: ReadingSession[];
}

export interface Highlight {
  id: string;
  bookId: string;
  page: number;
  paragraphIndex: number;
  text: string;
  color: HighlightColor;
  createdDate: string;
  note?: string;
}

export interface TextPreferences {
  fontSize: number;
  fontFamily: FontFamily;
  lineHeight: LineHeight;
  textAlign: TextAlign;
  letterSpacing: number;
}

export interface AppPreferences {
  themeId: ThemeId;
  followSystemTheme: boolean;
  text: TextPreferences;
  /** Continuous vertical scroll vs swipe/flip between pages */
  pageTurnMode: PageTurnMode;
  hasCompletedOnboarding: boolean;
  lastOpenedBookId: string | null;
  /** Resume the last book automatically when the app opens. */
  openLastBookOnLaunch: boolean;
  /** Prevent the screen from sleeping while reading. */
  keepScreenAwake: boolean;
  librarySort: LibrarySort;
  libraryStatusFilter: LibraryStatusFilter;
  libraryFormatFilter: LibraryFormatFilter;
}

export interface DailyStat {
  date: string;
  pagesRead: number;
  minutesRead: number;
}

export interface LibraryBackup {
  version: 1;
  exportedAt: string;
  /** Books without full text bodies (content stripped). */
  books: Book[];
  progress: Record<string, ReadingProgress>;
  highlights: Highlight[];
  preferences: AppPreferences;
  dailyStats: DailyStat[];
}

export interface PdfOutlineItem {
  title: string;
  pageIndex: number;
}

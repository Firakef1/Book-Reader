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

export interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  coverImage?: string;
  filePath: string;
  fileType: FileType;
  content: string;
  totalPages: number;
  addedDate: string;
  status: BookStatus;
  collection?: string;
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
}

export interface DailyStat {
  date: string;
  pagesRead: number;
  minutesRead: number;
}

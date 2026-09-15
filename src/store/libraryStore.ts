import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultTextPreferences } from '../theme/typography';
import {
  AppPreferences,
  Book,
  BookStatus,
  DailyStat,
  Highlight,
  HighlightColor,
  LibrarySort,
  PageTurnMode,
  ReadingProgress,
  TextPreferences,
  ThemeId,
} from '../types';
import { createId, deriveBookStatus, todayKey } from '../utils/helpers';

interface LibraryState {
  books: Book[];
  progress: Record<string, ReadingProgress>;
  highlights: Highlight[];
  preferences: AppPreferences;
  dailyStats: DailyStat[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;

  addBook: (book: Book) => void;
  updateBook: (id: string, patch: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  setBookStatus: (id: string, status: BookStatus) => void;

  getProgress: (bookId: string) => ReadingProgress | undefined;
  ensureProgress: (bookId: string) => ReadingProgress;
  updateReadingPosition: (
    bookId: string,
    currentPage: number,
    scrollPosition: number,
  ) => void;
  recordSessionChunk: (
    bookId: string,
    pagesRead: number,
    minutes: number,
  ) => void;
  setLastOpenedBook: (bookId: string | null) => void;

  addHighlight: (input: {
    bookId: string;
    page: number;
    paragraphIndex: number;
    text: string;
    color: HighlightColor;
  }) => void;
  removeHighlight: (id: string) => void;
  getHighlightsForBook: (bookId: string) => Highlight[];

  setTheme: (themeId: ThemeId) => void;
  setFollowSystemTheme: (follow: boolean) => void;
  setTextPreferences: (patch: Partial<TextPreferences>) => void;
  setPageTurnMode: (mode: PageTurnMode) => void;
  completeOnboarding: () => void;

  getSortedBooks: (sort: LibrarySort) => Book[];
  getRecentlyRead: (limit?: number) => Book[];
  getLastReadBook: () => Book | null;
  getStatsSummary: () => {
    pagesToday: number;
    booksCompleted: number;
    avgSessionMinutes: number;
    streak: number;
    totalMinutes: number;
  };
}

const defaultPreferences: AppPreferences = {
  themeId: 'dark',
  followSystemTheme: false,
  text: defaultTextPreferences,
  pageTurnMode: 'scroll',
  hasCompletedOnboarding: false,
  lastOpenedBookId: null,
};

function emptyProgress(bookId: string): ReadingProgress {
  return {
    id: createId(),
    bookId,
    currentPage: 0,
    scrollPosition: 0,
    lastReadDate: new Date().toISOString(),
    totalTimeRead: 0,
    readingSessions: [],
  };
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      progress: {},
      highlights: [],
      preferences: defaultPreferences,
      dailyStats: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),

      addBook: (book) =>
        set((state) => ({
          books: [book, ...state.books],
          progress: {
            ...state.progress,
            [book.id]: emptyProgress(book.id),
          },
        })),

      updateBook: (id, patch) =>
        set((state) => ({
          books: state.books.map((b) => {
            if (b.id !== id) return b;
            const next = { ...b, ...patch };
            const p = state.progress[id];
            return {
              ...next,
              status: deriveBookStatus(next, p),
            };
          }),
        })),

      deleteBook: (id) =>
        set((state) => {
          const { [id]: _, ...restProgress } = state.progress;
          return {
            books: state.books.filter((b) => b.id !== id),
            progress: restProgress,
            highlights: state.highlights.filter((h) => h.bookId !== id),
            preferences: {
              ...state.preferences,
              lastOpenedBookId:
                state.preferences.lastOpenedBookId === id
                  ? null
                  : state.preferences.lastOpenedBookId,
            },
          };
        }),

      setBookStatus: (id, status) =>
        set((state) => ({
          books: state.books.map((b) => (b.id === id ? { ...b, status } : b)),
        })),

      getProgress: (bookId) => get().progress[bookId],

      ensureProgress: (bookId) => {
        const existing = get().progress[bookId];
        if (existing) return existing;
        const created = emptyProgress(bookId);
        set((state) => ({
          progress: { ...state.progress, [bookId]: created },
        }));
        return created;
      },

      updateReadingPosition: (bookId, currentPage, scrollPosition) => {
        const now = new Date().toISOString();
        const state = get();
        const prev = state.progress[bookId] ?? emptyProgress(bookId);

        // Avoid no-op updates that recreate objects and infinite-loop React subscribers
        if (
          prev.currentPage === currentPage &&
          prev.scrollPosition === scrollPosition &&
          state.preferences.lastOpenedBookId === bookId
        ) {
          const last = new Date(prev.lastReadDate).getTime();
          if (Date.now() - last < 2000) {
            return;
          }
        }

        let booksChanged = false;
        const books = state.books.map((b) => {
          if (b.id !== bookId) return b;
          // Any progress update means the book is being read (unless finished)
          const status = deriveBookStatus(
            { ...b, status: 'reading' },
            { currentPage, totalTimeRead: prev.totalTimeRead },
          );
          if (status === b.status) return b;
          booksChanged = true;
          return { ...b, status };
        });

        set({
          books: booksChanged ? books : state.books,
          progress: {
            ...state.progress,
            [bookId]: {
              ...prev,
              currentPage,
              scrollPosition,
              lastReadDate: now,
            },
          },
          preferences: {
            ...state.preferences,
            lastOpenedBookId: bookId,
          },
        });
      },

      recordSessionChunk: (bookId, pagesRead, minutes) => {
        if (pagesRead <= 0 && minutes <= 0) return;
        const now = new Date().toISOString();
        const day = todayKey();
        set((state) => {
          const prev = state.progress[bookId] ?? emptyProgress(bookId);
          const session = {
            startTime: new Date(Date.now() - minutes * 60000).toISOString(),
            endTime: now,
            pagesRead: Math.max(0, pagesRead),
          };
          const daily = [...state.dailyStats];
          const idx = daily.findIndex((d) => d.date === day);
          if (idx >= 0) {
            daily[idx] = {
              ...daily[idx],
              pagesRead: daily[idx].pagesRead + Math.max(0, pagesRead),
              minutesRead: daily[idx].minutesRead + Math.max(0, minutes),
            };
          } else {
            daily.push({
              date: day,
              pagesRead: Math.max(0, pagesRead),
              minutesRead: Math.max(0, minutes),
            });
          }
          return {
            progress: {
              ...state.progress,
              [bookId]: {
                ...prev,
                totalTimeRead: prev.totalTimeRead + Math.max(0, minutes),
                readingSessions: [...prev.readingSessions, session].slice(-100),
                lastReadDate: now,
              },
            },
            dailyStats: daily.slice(-120),
          };
        });
      },

      setLastOpenedBook: (bookId) =>
        set((state) => ({
          preferences: { ...state.preferences, lastOpenedBookId: bookId },
        })),

      addHighlight: ({ bookId, page, paragraphIndex, text, color }) =>
        set((state) => ({
          highlights: [
            {
              id: createId(),
              bookId,
              page,
              paragraphIndex,
              text,
              color,
              createdDate: new Date().toISOString(),
            },
            ...state.highlights,
          ],
        })),

      removeHighlight: (id) =>
        set((state) => ({
          highlights: state.highlights.filter((h) => h.id !== id),
        })),

      getHighlightsForBook: (bookId) =>
        get().highlights.filter((h) => h.bookId === bookId),

      setTheme: (themeId) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            themeId,
            followSystemTheme: false,
          },
        })),

      setFollowSystemTheme: (follow) =>
        set((state) => ({
          preferences: { ...state.preferences, followSystemTheme: follow },
        })),

      setTextPreferences: (patch) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            text: { ...state.preferences.text, ...patch },
          },
        })),

      setPageTurnMode: (mode) =>
        set((state) => ({
          preferences: { ...state.preferences, pageTurnMode: mode },
        })),

      completeOnboarding: () =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            hasCompletedOnboarding: true,
          },
        })),

      getSortedBooks: (sort) => {
        const { books, progress } = get();
        const list = [...books];
        switch (sort) {
          case 'alphabetical':
            return list.sort((a, b) => a.title.localeCompare(b.title));
          case 'recentlyAdded':
            return list.sort(
              (a, b) =>
                new Date(b.addedDate).getTime() -
                new Date(a.addedDate).getTime(),
            );
          case 'progress':
            return list.sort((a, b) => {
              const pa =
                ((progress[a.id]?.currentPage ?? 0) + 1) / a.totalPages;
              const pb =
                ((progress[b.id]?.currentPage ?? 0) + 1) / b.totalPages;
              return pb - pa;
            });
          case 'recentlyRead':
          default:
            return list.sort((a, b) => {
              const da = progress[a.id]?.lastReadDate
                ? new Date(progress[a.id].lastReadDate).getTime()
                : 0;
              const db = progress[b.id]?.lastReadDate
                ? new Date(progress[b.id].lastReadDate).getTime()
                : 0;
              return db - da;
            });
        }
      },

      getRecentlyRead: (limit = 8) => {
        return get()
          .getSortedBooks('recentlyRead')
          .filter((b) => {
            const p = get().progress[b.id];
            return p?.lastReadDate && (p.currentPage > 0 || p.totalTimeRead > 0);
          })
          .slice(0, limit);
      },

      getLastReadBook: () => {
        const { preferences, books, progress } = get();
        if (preferences.lastOpenedBookId) {
          const found = books.find((b) => b.id === preferences.lastOpenedBookId);
          if (found) return found;
        }
        const sorted = get().getSortedBooks('recentlyRead');
        return (
          sorted.find((b) => {
            const p = progress[b.id];
            return p?.lastReadDate && (p.currentPage > 0 || p.totalTimeRead > 0);
          }) ?? null
        );
      },

      getStatsSummary: () => {
        const { books, progress, dailyStats } = get();
        const today = todayKey();
        const todayStat = dailyStats.find((d) => d.date === today);
        const booksCompleted = books.filter(
          (b) => deriveBookStatus(b, progress[b.id]) === 'completed',
        ).length;
        const allSessions = Object.values(progress).flatMap(
          (p) => p.readingSessions,
        );
        const avgSessionMinutes =
          allSessions.length === 0
            ? 0
            : allSessions.reduce((sum, s) => {
                const mins =
                  (new Date(s.endTime).getTime() -
                    new Date(s.startTime).getTime()) /
                  60000;
                return sum + mins;
              }, 0) / allSessions.length;

        const days = new Set(
          dailyStats.filter((d) => d.pagesRead > 0).map((d) => d.date),
        );
        let streak = 0;
        const cursor = new Date();
        for (;;) {
          const key = cursor.toISOString().slice(0, 10);
          if (!days.has(key)) break;
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        }

        const totalMinutes = Object.values(progress).reduce(
          (sum, p) => sum + p.totalTimeRead,
          0,
        );

        return {
          pagesToday: todayStat?.pagesRead ?? 0,
          booksCompleted,
          avgSessionMinutes: Math.round(avgSessionMinutes),
          streak,
          totalMinutes: Math.round(totalMinutes),
        };
      },
    }),
    {
      name: 'bookreader-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        books: state.books,
        progress: state.progress,
        highlights: state.highlights,
        preferences: state.preferences,
        dailyStats: state.dailyStats,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        let preferences = state.preferences;
        if (!preferences.pageTurnMode) {
          preferences = { ...preferences, pageTurnMode: 'scroll' };
        }
        // Legacy default was light + follow system; move to Ink editorial look
        if (preferences.followSystemTheme) {
          preferences = {
            ...preferences,
            followSystemTheme: false,
            themeId: 'dark',
          };
        }
        state.preferences = preferences;
        // Repair false "Done" tags from PDF totalPages=1 race
        state.books = state.books.map((b) => ({
          ...b,
          status: deriveBookStatus(b, state.progress[b.id]),
        }));
        state.setHydrated(true);
      },
    },
  ),
);

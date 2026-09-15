import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HighlightPicker } from '../../src/components/HighlightPicker';
import { PdfReader } from '../../src/components/PdfReader';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useLibraryStore } from '../../src/store/libraryStore';
import { FontFamily, HighlightColor, PdfOutlineItem } from '../../src/types';
import {
  contentOffsetFromPageIndex,
  estimateMinutesRemaining,
  formatMinutes,
  getPageParagraphs,
  pageIndexFromContentOffset,
  paginateText,
  searchInPages,
} from '../../src/utils/helpers';
import {
  charsPerPage,
  getFontFamilyName,
  getLineHeightMultiplier,
} from '../../src/theme/typography';

const AUTO_SAVE_MS = 8_000;
const KEEP_AWAKE_TAG = 'bookreader-reader';

export default function ReaderScreen() {
  const { id, page: pageParam } = useLocalSearchParams<{
    id: string;
    page?: string;
  }>();
  const bookId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const book = useLibraryStore((s) => s.books.find((b) => b.id === bookId));
  const preferences = useLibraryStore((s) => s.preferences);
  const allHighlights = useLibraryStore((s) => s.highlights);
  const progressEntry = useLibraryStore((s) =>
    bookId ? s.progress[bookId] : undefined,
  );
  const updateReadingPosition = useLibraryStore((s) => s.updateReadingPosition);
  const recordSessionChunk = useLibraryStore((s) => s.recordSessionChunk);
  const addHighlight = useLibraryStore((s) => s.addHighlight);
  const ensureProgress = useLibraryStore((s) => s.ensureProgress);
  const updateBook = useLibraryStore((s) => s.updateBook);
  const setTextPreferences = useLibraryStore((s) => s.setTextPreferences);
  const setPageTurnMode = useLibraryStore((s) => s.setPageTurnMode);

  const pageTurnMode = preferences.pageTurnMode ?? 'scroll';
  const keepAwake = preferences.keepScreenAwake !== false;
  const highlights = useMemo(
    () => allHighlights.filter((h) => h.bookId === bookId),
    [allHighlights, bookId],
  );

  const [pendingHighlight, setPendingHighlight] = useState<{
    page: number;
    index: number;
    text: string;
  } | null>(null);
  const [textZoom, setTextZoom] = useState(1);
  const [bootPage, setBootPage] = useState<number | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);
  const [savedScrollY, setSavedScrollY] = useState(0);

  const sessionStart = useRef(Date.now());
  const startPage = useRef(0);
  const pageRef = useRef(0);
  const scrollYRef = useRef(0);
  const listRef = useRef<FlatList<string>>(null);
  const pdfGoToPage = useRef<((page: number) => void) | null>(null);
  const pdfZoom = useRef<((delta: number) => void) | null>(null);
  const ignoreViewability = useRef(true);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPdf = book?.fileType === 'pdf';
  const cpp = charsPerPage(preferences.text.fontSize);

  const pages = useMemo(() => {
    if (!book || isPdf) return [''];
    return paginateText(book.content, cpp);
  }, [book, cpp, isPdf]);

  const totalPages = isPdf
    ? Math.max(1, book?.totalPages ?? 1)
    : Math.max(1, pages.length);

  const etaMinutes = useMemo(() => {
    if (!progressEntry || !book) return null;
    const pagesLeft = Math.max(0, totalPages - (pageIndex + 1));
    const pagesRead = Math.max(1, pageIndex + 1);
    return estimateMinutesRemaining(
      pagesLeft,
      progressEntry.totalTimeRead,
      pagesRead,
    );
  }, [book, pageIndex, progressEntry, totalPages]);

  const persistPosition = useCallback(
    (page: number, scrollY = scrollYRef.current) => {
      if (!bookId || !book) return;
      const safe = Math.max(0, page);
      pageRef.current = safe;
      setPageIndex(safe);
      const offset = isPdf
        ? undefined
        : contentOffsetFromPageIndex(book.content, safe, cpp);
      updateReadingPosition(bookId, safe, Math.max(0, scrollY), offset);
    },
    [book, bookId, cpp, isPdf, updateReadingPosition],
  );

  const commitPage = useCallback(
    (page: number) => {
      persistPosition(page, scrollYRef.current);
    },
    [persistPosition],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [router]);

  const showChromeTemporarily = useCallback(() => {
    setChromeVisible(true);
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeVisible(false), 3200);
  }, []);

  useEffect(() => {
    showChromeTemporarily();
    return () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
  }, [showChromeTemporarily]);

  useEffect(() => {
    if (!keepAwake) {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
      return;
    }
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [keepAwake]);

  // Open exactly where we left off — freeze once per book open
  useEffect(() => {
    if (!bookId) return;
    ignoreViewability.current = true;
    ensureProgress(bookId);

    const state = useLibraryStore.getState();
    const savedProgress = state.progress[bookId];
    const currentBook = state.books.find((b) => b.id === bookId);
    let page = Math.max(0, savedProgress?.currentPage ?? 0);

    if (
      currentBook &&
      currentBook.fileType !== 'pdf' &&
      typeof savedProgress?.contentOffset === 'number' &&
      savedProgress.contentOffset > 0
    ) {
      page = pageIndexFromContentOffset(
        currentBook.content,
        savedProgress.contentOffset,
        charsPerPage(state.preferences.text.fontSize),
      );
    }

    if (pageParam != null) {
      const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam;
      page = Math.max(0, Number(raw) || 0);
    }

    if (currentBook?.fileType === 'pdf') {
      const total = currentBook.totalPages ?? 1;
      if (total > 1) page = Math.min(page, total - 1);
    } else if (currentBook) {
      const textPages = paginateText(
        currentBook.content,
        charsPerPage(state.preferences.text.fontSize),
      );
      page = Math.min(page, Math.max(0, textPages.length - 1));
    }

    pageRef.current = page;
    startPage.current = page;
    sessionStart.current = Date.now();
    scrollYRef.current = savedProgress?.scrollPosition ?? 0;
    setSavedScrollY(savedProgress?.scrollPosition ?? 0);
    setPageIndex(page);
    setBootPage(page);

    const unlock = setTimeout(() => {
      ignoreViewability.current = false;
      // PDF deep-link from Highlights
      if (currentBook?.fileType === 'pdf' && page > 0) {
        pdfGoToPage.current?.(page);
      }
    }, 900);

    return () => {
      clearTimeout(unlock);
      const offset =
        currentBook && currentBook.fileType !== 'pdf'
          ? contentOffsetFromPageIndex(
              currentBook.content,
              pageRef.current,
              charsPerPage(useLibraryStore.getState().preferences.text.fontSize),
            )
          : undefined;
      updateReadingPosition(
        bookId,
        pageRef.current,
        scrollYRef.current,
        offset,
      );
      setBootPage(null);
    };
  }, [bookId, pageParam, ensureProgress, updateReadingPosition]);

  useEffect(() => {
    if (!bookId) return;
    const timer = setInterval(() => {
      const elapsedMin = (Date.now() - sessionStart.current) / 60000;
      const pagesRead = Math.max(0, pageRef.current - startPage.current);
      if (elapsedMin >= 0.1 || pagesRead > 0) {
        recordSessionChunk(bookId, pagesRead, elapsedMin);
        sessionStart.current = Date.now();
        startPage.current = pageRef.current;
      }
      persistPosition(pageRef.current, scrollYRef.current);
    }, AUTO_SAVE_MS);
    return () => clearInterval(timer);
  }, [bookId, persistPosition, recordSessionChunk]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!bookId) return;
      if (state === 'background' || state === 'inactive') {
        persistPosition(pageRef.current, scrollYRef.current);
      }
    });
    return () => sub.remove();
  }, [bookId, persistPosition]);

  const onPdfPageChange = useCallback(
    (page: number) => {
      commitPage(page);
    },
    [commitPage],
  );

  const onPdfDocumentLoad = useCallback(
    (num: number) => {
      if (!bookId) return;
      const current = useLibraryStore
        .getState()
        .books.find((b) => b.id === bookId);
      if (current && num !== current.totalPages) {
        updateBook(bookId, { totalPages: num });
      }
      // Ensure highlight deep-links land after the engine is ready
      const target = pageRef.current;
      if (target > 0) {
        setTimeout(() => pdfGoToPage.current?.(target), 120);
      }
    },
    [bookId, updateBook],
  );

  const onPdfHighlightRequest = useCallback(
    (payload: { page: number; paragraphIndex: number; text: string }) => {
      setPendingHighlight({
        page: payload.page,
        index: payload.paragraphIndex,
        text: payload.text.startsWith('Page ')
          ? payload.text
          : `Page bookmark · p.${payload.page + 1}`,
      });
      showChromeTemporarily();
    },
    [showChromeTemporarily],
  );

  const jumpToChapter = useCallback(
    (startOffset: number) => {
      if (!book || isPdf) return;
      const page = pageIndexFromContentOffset(book.content, startOffset, cpp);
      setTocOpen(false);
      commitPage(page);
      setBootPage(page);
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index: page, animated: true });
        } catch {
          // ignore
        }
      });
    },
    [book, commitPage, cpp, isPdf],
  );

  const goToPageIndex = useCallback(
    (page: number, animated = true) => {
      const safe = Math.max(0, Math.min(totalPages - 1, page));
      commitPage(safe);
      setJumpOpen(false);
      setSearchOpen(false);
      setTocOpen(false);
      showChromeTemporarily();
      if (isPdf) {
        pdfGoToPage.current?.(safe);
        return;
      }
      setBootPage(safe);
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index: safe, animated });
        } catch {
          // ignore
        }
      });
    },
    [commitPage, isPdf, showChromeTemporarily, totalPages],
  );

  const searchHits = useMemo(() => {
    if (isPdf || !searchQuery.trim()) return [];
    return searchInPages(pages, searchQuery);
  }, [isPdf, pages, searchQuery]);

  const tocItems = useMemo(() => {
    if (isPdf) return pdfOutline;
    return (book?.chapters ?? []).map((c) => ({
      title: c.title,
      pageIndex: pageIndexFromContentOffset(book?.content ?? '', c.startOffset, cpp),
    }));
  }, [book, cpp, isPdf, pdfOutline]);

  const fontFamily = getFontFamilyName(
    preferences.text.fontFamily,
    true,
    true,
  );
  const displayFontSize = preferences.text.fontSize * textZoom;
  const lineHeight =
    displayFontSize * getLineHeightMultiplier(preferences.text.lineHeight);

  const commitRef = useRef(commitPage);
  commitRef.current = commitPage;
  const stableViewable = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (ignoreViewability.current) return;
      const first = viewableItems.find((v) => v.isViewable && v.index != null);
      if (first?.index != null) {
        commitRef.current(first.index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 55,
  }).current;

  const renderTextPage = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const rawParagraphs = getPageParagraphs(item);
      const paragraphs =
        rawParagraphs.length > 0
          ? rawParagraphs
          : [item.trim() || 'Empty page'];
      const pageHighlights = highlights.filter((h) => h.page === index);
      const densityMarks = paragraphs.map((_, idx) =>
        pageHighlights.some((h) => h.paragraphIndex === idx),
      );

      return (
        <View
          style={[
            styles.pagePad,
            pageTurnMode === 'flip' ? { width: windowWidth } : null,
          ]}
        >
          <View style={styles.density}>
            {densityMarks.map((active, i) => (
              <View
                key={i}
                style={[
                  styles.densityTick,
                  {
                    backgroundColor: active
                      ? theme.warm
                      : theme.progressTrack,
                  },
                ]}
              />
            ))}
          </View>

          {paragraphs.map((paragraph, pIndex) => {
            const hl = pageHighlights.find((h) => h.paragraphIndex === pIndex);
            const body = paragraph.trim();
            return (
              <Pressable
                key={`${index}-${pIndex}`}
                onPress={showChromeTemporarily}
                onLongPress={() =>
                  setPendingHighlight({
                    page: index,
                    index: pIndex,
                    text: body,
                  })
                }
                delayLongPress={350}
              >
                <Text
                  selectable={false}
                  style={{
                    color: theme.text,
                    fontSize: displayFontSize,
                    fontFamily,
                    lineHeight,
                    letterSpacing: preferences.text.letterSpacing,
                    textAlign: preferences.text.textAlign,
                    marginBottom: 18,
                    paddingVertical: 4,
                    backgroundColor: hl
                      ? theme.highlightOverlay[hl.color]
                      : 'transparent',
                  }}
                >
                  {body}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    },
    [
      displayFontSize,
      fontFamily,
      highlights,
      lineHeight,
      pageTurnMode,
      preferences.text.letterSpacing,
      preferences.text.textAlign,
      showChromeTemporarily,
      theme.highlightOverlay,
      theme.progressTrack,
      theme.text,
      theme.warm,
      windowWidth,
    ],
  );

  const chrome = book ? (
    <View
      pointerEvents={chromeVisible ? 'box-none' : 'none'}
      style={[styles.chromeWrap, { opacity: chromeVisible ? 1 : 0 }]}
    >
      <SafeAreaView edges={['top']} style={styles.chromeTopSafe}>
        <View
          style={[
            styles.chromeBar,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
            },
          ]}
        >
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.chromeBtn}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18 }}>
              ←
            </Text>
          </Pressable>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.text,
                fontFamily: 'Literata_700Bold',
                fontSize: 15,
              }}
            >
              {book.title}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}
            >
              {pageIndex + 1} / {totalPages}
              {etaMinutes != null ? ` · ~${formatMinutes(etaMinutes)} left` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setJumpInput(String(pageIndex + 1));
              setJumpOpen(true);
            }}
            hitSlop={8}
            style={styles.chromeBtn}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>Go</Text>
          </Pressable>
          {tocItems.length > 0 ? (
            <Pressable
              onPress={() => setTocOpen(true)}
              hitSlop={8}
              style={styles.chromeBtn}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
                TOC
              </Text>
            </Pressable>
          ) : null}
          {!isPdf ? (
            <Pressable
              onPress={() => setSearchOpen(true)}
              hitSlop={8}
              style={styles.chromeBtn}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
                Find
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setTypeOpen(true)}
            hitSlop={8}
            style={styles.chromeBtn}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>Aa</Text>
          </Pressable>
        </View>
        <View
          style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}
        >
          <View
            style={{
              width: `${Math.min(100, ((pageIndex + 1) / totalPages) * 100)}%`,
              height: '100%',
              backgroundColor: theme.progressFill,
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  ) : null;

  const zoomControls =
    chromeVisible && !isPdf ? (
      <View style={styles.zoomStack}>
        <Pressable
          onPress={() =>
            setTextZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))
          }
          style={[styles.zoomBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.zoomText, { color: theme.onAccent }]}>+</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            setTextZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))
          }
          style={[styles.zoomBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.zoomText, { color: theme.onAccent }]}>−</Text>
        </Pressable>
      </View>
    ) : null;

  const highlightModal = (
    <HighlightPicker
      visible={!!pendingHighlight}
      selectedText={pendingHighlight?.text ?? ''}
      onClose={() => setPendingHighlight(null)}
      onPick={(color: HighlightColor) => {
        if (!pendingHighlight || !book) return;
        addHighlight({
          bookId: book.id,
          page: pendingHighlight.page,
          paragraphIndex: pendingHighlight.index,
          text: pendingHighlight.text,
          color,
        });
        setPendingHighlight(null);
      }}
    />
  );

  const tocModal = (
    <Modal
      visible={tocOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setTocOpen(false)}
    >
      <Pressable style={styles.tocBackdrop} onPress={() => setTocOpen(false)}>
        <Pressable
          style={[styles.tocSheet, { backgroundColor: theme.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              color: theme.text,
              fontFamily: 'Literata_700Bold',
              fontSize: 20,
              marginBottom: 12,
            }}
          >
            {isPdf ? 'Contents' : 'Chapters'}
          </Text>
          <FlatList
            data={tocItems}
            keyExtractor={(item, index) => `${item.pageIndex}-${index}`}
            ListEmptyComponent={
              <Text style={{ color: theme.textMuted }}>No outline available.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => goToPageIndex(item.pageIndex)}
                style={[styles.tocRow, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>
                  {item.title}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  p.{item.pageIndex + 1}
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  const jumpModal = (
    <Modal visible={jumpOpen} transparent animationType="fade" onRequestClose={() => setJumpOpen(false)}>
      <Pressable style={styles.tocBackdrop} onPress={() => setJumpOpen(false)}>
        <Pressable
          style={[styles.jumpSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ color: theme.text, fontFamily: 'Literata_700Bold', fontSize: 18, marginBottom: 10 }}>
            Jump to page
          </Text>
          <TextInput
            value={jumpInput}
            onChangeText={setJumpInput}
            keyboardType="number-pad"
            placeholder={`1 – ${totalPages}`}
            placeholderTextColor={theme.textMuted}
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.text,
              marginBottom: 12,
            }}
          />
          <Pressable
            onPress={() => {
              const n = Number(jumpInput);
              if (!Number.isFinite(n) || n < 1 || n > totalPages) {
                Alert.alert('Invalid page', `Enter a number between 1 and ${totalPages}.`);
                return;
              }
              goToPageIndex(n - 1);
            }}
            style={[styles.jumpGo, { backgroundColor: theme.accent }]}
          >
            <Text style={{ color: theme.onAccent, fontWeight: '700' }}>Go</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const searchModal = (
    <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
      <Pressable style={styles.tocBackdrop} onPress={() => setSearchOpen(false)}>
        <Pressable
          style={[styles.tocSheet, { backgroundColor: theme.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ color: theme.text, fontFamily: 'Literata_700Bold', fontSize: 20, marginBottom: 12 }}>
            Search in book
          </Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            placeholder="Find text…"
            placeholderTextColor={theme.textMuted}
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.text,
              marginBottom: 12,
            }}
          />
          <FlatList
            data={searchHits}
            keyExtractor={(item, index) => `${item.page}-${index}`}
            ListEmptyComponent={
              <Text style={{ color: theme.textMuted }}>
                {searchQuery.trim() ? 'No matches.' : 'Type to search this book.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => goToPageIndex(item.page)}
                style={[styles.tocRow, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4 }}>
                  Page {item.page + 1}
                </Text>
                <Text style={{ color: theme.text, fontSize: 14 }} numberOfLines={3}>
                  …{item.snippet}…
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  const typeModal = (
    <Modal visible={typeOpen} transparent animationType="slide" onRequestClose={() => setTypeOpen(false)}>
      <Pressable style={styles.tocBackdrop} onPress={() => setTypeOpen(false)}>
        <Pressable
          style={[styles.tocSheet, { backgroundColor: theme.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ color: theme.text, fontFamily: 'Literata_700Bold', fontSize: 20, marginBottom: 12 }}>
            Reading controls
          </Text>
          <Text style={{ color: theme.textSecondary, fontWeight: '600', marginBottom: 8 }}>
            Font size · {preferences.text.fontSize}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() =>
                setTextPreferences({
                  fontSize: Math.max(14, preferences.text.fontSize - 1),
                })
              }
              style={[styles.jumpGo, { flex: 1, backgroundColor: theme.accentSoft }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>A−</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setTextPreferences({
                  fontSize: Math.min(32, preferences.text.fontSize + 1),
                })
              }
              style={[styles.jumpGo, { flex: 1, backgroundColor: theme.accentSoft }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>A+</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {([
              ['serif', 'Serif'],
              ['sans', 'Sans'],
              ['mono', 'Mono'],
            ] as const).map(([value, label]) => {
              const active = preferences.text.fontFamily === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTextPreferences({ fontFamily: value as FontFamily })}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: active ? theme.accent : theme.border,
                    backgroundColor: active ? theme.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? theme.onAccent : theme.text, fontWeight: '600' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: theme.textSecondary, fontWeight: '600', marginBottom: 8 }}>
            Page turn
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['scroll', 'flip'] as const).map((mode) => {
              const active = pageTurnMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setPageTurnMode(mode)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: active ? theme.accent : theme.border,
                    backgroundColor: active ? theme.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? theme.onAccent : theme.text, fontWeight: '700' }}>
                    {mode === 'scroll' ? 'Scroll' : 'Flip'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (!book) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.background }]}
      >
        <Text style={{ color: theme.text, padding: 20 }}>Book not found.</Text>
        <Pressable onPress={goBack} style={{ padding: 20 }}>
          <Text style={{ color: theme.accent }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (bootPage == null) {
    return (
      <View style={[styles.safe, { backgroundColor: theme.background }]} />
    );
  }

  if (isPdf) {
    return (
      <View style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.pdfBody}>
          <PdfReader
            key={`${book.id}-${pageTurnMode}`}
            fileUri={book.filePath}
            initialPage={pageIndex}
            pageTurnMode={pageTurnMode}
            backgroundColor={theme.background}
            textColor={theme.text}
            accentColor={theme.accent}
            onAccentColor={theme.onAccent}
            goToPageRef={pdfGoToPage}
            zoomRef={pdfZoom}
            onPageChange={onPdfPageChange}
            onDocumentLoad={onPdfDocumentLoad}
            onHighlightRequest={onPdfHighlightRequest}
            onTap={showChromeTemporarily}
            onOutline={setPdfOutline}
          />
        </View>
        {chrome}
        {highlightModal}
        {tocModal}
        {jumpModal}
        {searchModal}
        {typeModal}
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.readerBody}>
        <FlatList
          key={`${book.id}-${pageTurnMode}-${bootPage}`}
          ref={listRef}
          data={pages}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderTextPage}
          horizontal={pageTurnMode === 'flip'}
          pagingEnabled={pageTurnMode === 'flip'}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.min(bootPage, Math.max(0, pages.length - 1))}
          getItemLayout={
            pageTurnMode === 'flip'
              ? (_, index) => ({
                  length: windowWidth,
                  offset: windowWidth * index,
                  index,
                })
              : undefined
          }
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 80);
          }}
          onLayout={() => {
            if (pageTurnMode === 'scroll' && savedScrollY > 0) {
              listRef.current?.scrollToOffset({
                offset: savedScrollY,
                animated: false,
              });
              return;
            }
            if (bootPage <= 0) return;
            try {
              listRef.current?.scrollToIndex({
                index: Math.min(bootPage, pages.length - 1),
                animated: false,
              });
            } catch {
              // ignore
            }
          }}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (pageTurnMode === 'scroll') {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }
          }}
          onScrollBeginDrag={() => {
            showChromeTemporarily();
          }}
          scrollEventThrottle={64}
          onViewableItemsChanged={stableViewable}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={(
            e: NativeSyntheticEvent<NativeScrollEvent>,
          ) => {
            if (pageTurnMode !== 'flip') return;
            const next = Math.round(
              e.nativeEvent.contentOffset.x / Math.max(1, windowWidth),
            );
            commitPage(Math.max(0, Math.min(pages.length - 1, next)));
          }}
          contentContainerStyle={
            pageTurnMode === 'scroll'
              ? [styles.scrollContent, { paddingTop: 88 }]
              : undefined
          }
          extraData={`${textZoom}-${chromeVisible}`}
        />
      </View>
      {chrome}
      {zoomControls}
      {highlightModal}
      {tocModal}
      {jumpModal}
      {searchModal}
      {typeModal}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pdfBody: { flex: 1 },
  readerBody: { flex: 1 },
  pagePad: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  scrollContent: { paddingBottom: 28, paddingTop: 8 },
  density: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  densityTick: { width: 10, height: 4, borderRadius: 2 },
  chromeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  chromeTopSafe: { backgroundColor: 'transparent' },
  chromeBar: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chromeBtn: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 99,
    overflow: 'hidden',
  },
  zoomStack: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    gap: 10,
    zIndex: 6,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  tocBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  tocSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  tocRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jumpSheet: {
    marginHorizontal: 28,
    marginTop: '40%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  jumpGo: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
});

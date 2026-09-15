import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HighlightPicker } from '../../src/components/HighlightPicker';
import { PdfReader } from '../../src/components/PdfReader';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useLibraryStore } from '../../src/store/libraryStore';
import { HighlightColor } from '../../src/types';
import { getPageParagraphs, paginateText } from '../../src/utils/helpers';
import {
  charsPerPage,
  getFontFamilyName,
  getLineHeightMultiplier,
} from '../../src/theme/typography';

const AUTO_SAVE_MS = 8_000;

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
  const updateReadingPosition = useLibraryStore((s) => s.updateReadingPosition);
  const recordSessionChunk = useLibraryStore((s) => s.recordSessionChunk);
  const addHighlight = useLibraryStore((s) => s.addHighlight);
  const ensureProgress = useLibraryStore((s) => s.ensureProgress);
  const updateBook = useLibraryStore((s) => s.updateBook);

  const pageTurnMode = preferences.pageTurnMode ?? 'scroll';
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

  const sessionStart = useRef(Date.now());
  const startPage = useRef(0);
  const pageRef = useRef(0);
  const listRef = useRef<FlatList<string>>(null);
  const pdfGoToPage = useRef<((page: number) => void) | null>(null);
  const pdfZoom = useRef<((delta: number) => void) | null>(null);
  const ignoreViewability = useRef(true);

  const isPdf = book?.fileType === 'pdf';

  const pages = useMemo(() => {
    if (!book || isPdf) return [''];
    return paginateText(
      book.content,
      charsPerPage(preferences.text.fontSize),
    );
  }, [book, preferences.text.fontSize, isPdf]);

  const commitPage = useCallback(
    (page: number) => {
      if (!bookId) return;
      const safe = Math.max(0, page);
      pageRef.current = safe;
      setPageIndex(safe);
      updateReadingPosition(bookId, safe, 0);
    },
    [bookId, updateReadingPosition],
  );

  // Open exactly where we left off — freeze once per book open
  useEffect(() => {
    if (!bookId) return;
    ignoreViewability.current = true;
    ensureProgress(bookId);

    const saved =
      useLibraryStore.getState().progress[bookId]?.currentPage ?? 0;
    let page = Math.max(0, saved);
    if (pageParam != null) {
      const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam;
      page = Math.max(0, Number(raw) || 0);
    }

    const currentBook = useLibraryStore
      .getState()
      .books.find((b) => b.id === bookId);
    if (currentBook?.fileType === 'pdf') {
      const total = currentBook.totalPages ?? 1;
      if (total > 1) page = Math.min(page, total - 1);
    } else if (currentBook) {
      const textPages = paginateText(
        currentBook.content,
        charsPerPage(
          useLibraryStore.getState().preferences.text.fontSize,
        ),
      );
      page = Math.min(page, Math.max(0, textPages.length - 1));
    }

    pageRef.current = page;
    startPage.current = page;
    sessionStart.current = Date.now();
    setPageIndex(page);
    setBootPage(page);

    const unlock = setTimeout(() => {
      ignoreViewability.current = false;
    }, 900);

    return () => {
      clearTimeout(unlock);
      updateReadingPosition(bookId, pageRef.current, 0);
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
      updateReadingPosition(bookId, pageRef.current, 0);
    }, AUTO_SAVE_MS);
    return () => clearInterval(timer);
  }, [bookId, recordSessionChunk, updateReadingPosition]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!bookId) return;
      if (state === 'background' || state === 'inactive') {
        updateReadingPosition(bookId, pageRef.current, 0);
      }
    });
    return () => sub.remove();
  }, [bookId, updateReadingPosition]);

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
    },
    [bookId, updateBook],
  );

  const onPdfHighlightRequest = useCallback(
    (payload: { page: number; paragraphIndex: number; text: string }) => {
      setPendingHighlight({
        page: payload.page,
        index: payload.paragraphIndex,
        text: payload.text,
      });
    },
    [],
  );

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
      theme.highlightOverlay,
      theme.progressTrack,
      theme.text,
      theme.warm,
      windowWidth,
    ],
  );

  const zoomControls = !isPdf ? (
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

  if (!book) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: theme.background }]}
      >
        <Text style={{ color: theme.text, padding: 20 }}>Book not found.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 20 }}>
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
          />
        </View>
        {highlightModal}
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
            pageTurnMode === 'scroll' ? styles.scrollContent : undefined
          }
          extraData={textZoom}
        />
      </View>
      {zoomControls}
      {highlightModal}
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
  scrollContent: { paddingBottom: 28 },
  density: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  densityTick: { width: 10, height: 4, borderRadius: 2 },
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
});

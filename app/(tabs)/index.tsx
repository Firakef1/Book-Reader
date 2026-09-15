import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCoverCard } from '../../src/components/BookCoverCard';
import { EditBookModal } from '../../src/components/EditBookModal';
import { MiniBookCard } from '../../src/components/MiniBookCard';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { pickAndImportBook } from '../../src/services/bookImport';
import { useLibraryStore } from '../../src/store/libraryStore';
import { Book, LibrarySort } from '../../src/types';
import { formatRelativeTime, deriveBookStatus } from '../../src/utils/helpers';

const sortOptions: { label: string; value: LibrarySort }[] = [
  { label: 'Recent', value: 'recentlyRead' },
  { label: 'A–Z', value: 'alphabetical' },
  { label: 'Added', value: 'recentlyAdded' },
  { label: 'Progress', value: 'progress' },
];

export default function LibraryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [sort, setSort] = useState<LibrarySort>('recentlyRead');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'reading' | 'toRead' | 'completed'
  >('all');
  const [importing, setImporting] = useState(false);

  const books = useLibraryStore((s) => s.books);
  const progress = useLibraryStore((s) => s.progress);
  const getSortedBooks = useLibraryStore((s) => s.getSortedBooks);
  const getRecentlyRead = useLibraryStore((s) => s.getRecentlyRead);
  const getLastReadBook = useLibraryStore((s) => s.getLastReadBook);
  const addBook = useLibraryStore((s) => s.addBook);
  const deleteBook = useLibraryStore((s) => s.deleteBook);
  const updateBook = useLibraryStore((s) => s.updateBook);

  const lastBook = getLastReadBook();
  const recent = getRecentlyRead(8);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const counts = useMemo(() => {
    const base = { all: books.length, reading: 0, toRead: 0, completed: 0 };
    for (const b of books) {
      const status = deriveBookStatus(b, progress[b.id]);
      base[status] += 1;
    }
    return base;
  }, [books, progress]);

  const filtered = useMemo(() => {
    let list = getSortedBooks(sort);
    if (statusFilter !== 'all') {
      list = list.filter(
        (b) => deriveBookStatus(b, progress[b.id]) === statusFilter,
      );
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q),
      );
    }
    return list;
  }, [books, progress, sort, statusFilter, query, getSortedBooks]);

  const openBook = (id: string) => router.push(`/reader/${id}`);

  const handleImport = async () => {
    try {
      setImporting(true);
      const book = await pickAndImportBook();
      if (!book) return;
      addBook(book);
      Alert.alert('Imported', `"${book.title}" was added to your library.`);
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Could not import that file.',
      );
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Remove book?', `Delete "${title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteBook(id),
      },
    ]);
  };

  const openBookActions = (book: Book) => {
    Alert.alert(book.title, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit name', onPress: () => setEditingBook(book) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(book.id, book.title),
      },
    ]);
  };

  const progressFor = (bookId: string, totalPages: number) => {
    const p = progress[bookId];
    if (!p || totalPages <= 0) return 0;
    return ((p.currentPage + 1) / totalPages) * 100;
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.brand,
                { color: theme.text, fontFamily: 'Literata_700Bold' },
              ]}
            >
              My Library
            </Text>
            <Text
              style={{
                color: theme.textMuted,
                marginTop: 6,
                fontFamily: 'SourceSans3_400Regular',
                letterSpacing: 1.2,
                fontSize: 11,
                textTransform: 'uppercase',
              }}
            >
              {counts.all} items · local shelf
            </Text>
          </View>
          <Pressable
            onPress={handleImport}
            style={[styles.importBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.importText, { color: theme.onAccent }]}>
              {importing ? '…' : 'Import'}
            </Text>
          </Pressable>
        </View>

        {lastBook ? (
          <View style={styles.section}>
            <BookCoverCard
              book={lastBook}
              featured
              progressPercent={progressFor(lastBook.id, lastBook.totalPages)}
              pageLabel={`Page ${(progress[lastBook.id]?.currentPage ?? 0) + 1} of ${lastBook.totalPages}`}
              lastReadLabel={
                progress[lastBook.id]?.lastReadDate
                  ? formatRelativeTime(progress[lastBook.id].lastReadDate)
                  : undefined
              }
              onPress={() => openBook(lastBook.id)}
              onMenuPress={() => openBookActions(lastBook)}
            />
          </View>
        ) : (
          <View
            style={[
              styles.emptyHero,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 24,
                fontFamily: 'Literata_700Bold',
              }}
            >
              Start your library
            </Text>
            <Text
              style={{
                color: theme.textSecondary,
                lineHeight: 22,
                fontFamily: 'SourceSans3_400Regular',
              }}
            >
              Import a PDF, EPUB, or TXT file from your phone to begin reading.
            </Text>
            <Pressable
              onPress={handleImport}
              style={[
                styles.importBtn,
                { backgroundColor: theme.accent, alignSelf: 'flex-start' },
              ]}
            >
              <Text style={[styles.importText, { color: theme.onAccent }]}>
                Import a book
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.categoryGrid}>
          {(
            [
              ['reading', 'Reading', counts.reading],
              ['toRead', 'To Read', counts.toRead],
              ['completed', 'Done', counts.completed],
              ['all', 'All Books', counts.all],
            ] as const
          ).map(([value, label, count]) => {
            const active = statusFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => setStatusFilter(value)}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: active ? theme.accent : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.rivetRow}>
                  <View
                    style={[
                      styles.rivet,
                      {
                        backgroundColor: active
                          ? theme.onAccent
                          : theme.textMuted,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.rivet,
                      {
                        backgroundColor: active
                          ? theme.onAccent
                          : theme.textMuted,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={{
                    color: active ? theme.onAccent : theme.textMuted,
                    fontFamily: 'SourceSans3_600SemiBold',
                    fontSize: 11,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </Text>
                <Text
                  style={{
                    color: active ? theme.onAccent : theme.text,
                    fontFamily: 'Literata_700Bold',
                    fontSize: 28,
                    marginTop: 8,
                  }}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {recent.length > 0 ? (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.text, fontFamily: 'Literata_700Bold' },
              ]}
            >
              Recently Read
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            >
              {recent.map((book) => (
                <MiniBookCard
                  key={book.id}
                  book={book}
                  progressPercent={progressFor(book.id, book.totalPages)}
                  onPress={() => openBook(book.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
          >
            Shelf
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search title or author"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.search,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
                fontFamily: 'SourceSans3_400Regular',
              },
            ]}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {(
              [
                ['all', 'All'],
                ['reading', 'Reading'],
                ['toRead', 'To Read'],
                ['completed', 'Done'],
              ] as const
            ).map(([value, label]) => {
              const active = statusFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setStatusFilter(value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? theme.accent
                        : 'transparent',
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? theme.onAccent : theme.textSecondary,
                      fontWeight: '600',
                      fontSize: 12,
                      letterSpacing: 0.6,
                      fontFamily: 'SourceSans3_600SemiBold',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.sortRow}>
            {sortOptions.map((opt) => (
              <Pressable key={opt.value} onPress={() => setSort(opt.value)}>
                <Text
                  style={{
                    color:
                      sort === opt.value ? theme.text : theme.textMuted,
                    fontWeight: sort === opt.value ? '700' : '500',
                    fontSize: 12,
                    letterSpacing: 0.4,
                    fontFamily: 'SourceSans3_600SemiBold',
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.list}>
            {filtered.map((book) => (
              <BookCoverCard
                key={book.id}
                book={book}
                progressPercent={progressFor(book.id, book.totalPages)}
                pageLabel={`Page ${(progress[book.id]?.currentPage ?? 0) + 1} / ${book.totalPages}`}
                onPress={() => openBook(book.id)}
                onMenuPress={() => openBookActions(book)}
              />
            ))}
            {filtered.length === 0 && books.length > 0 ? (
              <Text
                style={{
                  color: theme.textMuted,
                  textAlign: 'center',
                  fontFamily: 'SourceSans3_400Regular',
                }}
              >
                No books match your filters.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <EditBookModal
        visible={!!editingBook}
        initialTitle={editingBook?.title ?? ''}
        initialAuthor={editingBook?.author ?? ''}
        onCancel={() => setEditingBook(null)}
        onSave={(title, author) => {
          if (!editingBook) return;
          updateBook(editingBook.id, { title, author });
          setEditingBook(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 26 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  brand: { fontSize: 36 },
  importBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  importText: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.8,
    fontFamily: 'SourceSans3_700Bold',
  },
  emptyHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 22,
    gap: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    minHeight: 104,
  },
  rivetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rivet: {
    width: 3,
    height: 3,
    borderRadius: 99,
  },
  section: { gap: 14 },
  sectionTitle: { fontSize: 24 },
  carousel: { gap: 16, paddingRight: 8, paddingBottom: 8, paddingTop: 4 },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  list: { gap: 12 },
});

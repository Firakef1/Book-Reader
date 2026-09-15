import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { highlightColors } from '../../src/theme/colors';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useLibraryStore } from '../../src/store/libraryStore';
import { HighlightColor } from '../../src/types';
import { formatRelativeTime } from '../../src/utils/helpers';

export default function HighlightsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const highlights = useLibraryStore((s) => s.highlights);
  const books = useLibraryStore((s) => s.books);
  const removeHighlight = useLibraryStore((s) => s.removeHighlight);
  const [colorFilter, setColorFilter] = useState<HighlightColor | 'all'>('all');
  const [bookFilter, setBookFilter] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    return highlights.filter((h) => {
      if (colorFilter !== 'all' && h.color !== colorFilter) return false;
      if (bookFilter !== 'all' && h.bookId !== bookFilter) return false;
      return true;
    });
  }, [highlights, colorFilter, bookFilter]);

  const bookTitle = (id: string) =>
    books.find((b) => b.id === id)?.title ?? 'Unknown book';

  const exportAll = async () => {
    if (filtered.length === 0) {
      Alert.alert('Nothing to export', 'No highlights match the current filters.');
      return;
    }
    const text = filtered
      .map(
        (h) =>
          `"${h.text}"\n— ${bookTitle(h.bookId)}, p.${h.page + 1} (${h.color})`,
      )
      .join('\n\n');
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Highlights copied to clipboard.');
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
          >
            Highlights
          </Text>
          <Pressable onPress={exportAll}>
            <Text
              style={{
                color: theme.text,
                fontWeight: '700',
                fontFamily: 'SourceSans3_700Bold',
                letterSpacing: 0.6,
              }}
            >
              Export
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setColorFilter('all')}
            style={[
              styles.chip,
              {
                backgroundColor:
                  colorFilter === 'all' ? theme.accent : 'transparent',
                borderColor:
                  colorFilter === 'all' ? theme.accent : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color:
                  colorFilter === 'all' ? theme.onAccent : theme.textSecondary,
                fontWeight: '600',
                fontFamily: 'SourceSans3_600SemiBold',
              }}
            >
              All colors
            </Text>
          </Pressable>
          {highlightColors.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setColorFilter(c.id)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    colorFilter === c.id ? c.swatch : theme.accentSoft,
                },
              ]}
            >
              <Text style={{ fontWeight: '600', color: theme.text }}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            onPress={() => setBookFilter('all')}
            style={[
              styles.chip,
              {
                backgroundColor:
                  bookFilter === 'all' ? theme.accent : 'transparent',
                borderColor:
                  bookFilter === 'all' ? theme.accent : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color:
                  bookFilter === 'all' ? theme.onAccent : theme.textSecondary,
                fontWeight: '600',
                fontFamily: 'SourceSans3_600SemiBold',
              }}
            >
              All books
            </Text>
          </Pressable>
          {books.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBookFilter(b.id)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    bookFilter === b.id ? theme.accent : 'transparent',
                  borderColor:
                    bookFilter === b.id ? theme.accent : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    bookFilter === b.id ? theme.onAccent : theme.textSecondary,
                  fontWeight: '600',
                  fontFamily: 'SourceSans3_600SemiBold',
                }}
                numberOfLines={1}
              >
                {b.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {filtered.map((h) => (
            <Pressable
              key={h.id}
              onPress={() =>
                router.push({
                  pathname: '/reader/[id]',
                  params: { id: h.bookId, page: String(h.page) },
                })
              }
              onLongPress={() =>
                Alert.alert('Delete highlight?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => removeHighlight(h.id),
                  },
                ])
              }
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderLeftColor:
                    highlightColors.find((c) => c.id === h.color)?.swatch ??
                    theme.accent,
                },
              ]}
            >
              <Text style={[styles.quote, { color: theme.text }]}>
                “{h.text}”
              </Text>
              <Text style={{ color: theme.textMuted, marginTop: 8 }}>
                {bookTitle(h.bookId)} ·{' '}
                {books.find((b) => b.id === h.bookId)?.fileType === 'pdf'
                  ? 'bookmark'
                  : 'highlight'}{' '}
                · p.{h.page + 1} · {formatRelativeTime(h.createdDate)}
              </Text>
            </Pressable>
          ))}
          {filtered.length === 0 ? (
            <Text style={{ color: theme.textMuted, textAlign: 'center' }}>
              Long-press a paragraph while reading, or long-press a PDF page to
              save a page bookmark.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '700' },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 180,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 14,
    padding: 16,
  },
  quote: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
});

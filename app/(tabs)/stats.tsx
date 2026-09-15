import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useLibraryStore } from '../../src/store/libraryStore';
import { deriveBookStatus, formatMinutes } from '../../src/utils/helpers';

export default function StatsScreen() {
  const theme = useAppTheme();
  const books = useLibraryStore((s) => s.books);
  const progress = useLibraryStore((s) => s.progress);
  const dailyStats = useLibraryStore((s) => s.dailyStats);
  const summary = useLibraryStore((s) => s.getStatsSummary)();

  const reading = books.filter(
    (b) => deriveBookStatus(b, progress[b.id]) === 'reading',
  ).length;
  const insight =
    summary.avgSessionMinutes >= 20
      ? `Your average session is ${summary.avgSessionMinutes} minutes — strong focus.`
      : summary.streak >= 3
        ? `You're on a ${summary.streak}-day streak. Consistency beats intensity.`
        : summary.pagesToday > 0
          ? `You've already read ${summary.pagesToday} page${summary.pagesToday === 1 ? '' : 's'} today.`
          : 'Open a book for a few pages — momentum starts small.';

  const recentDays = [...dailyStats]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text
          style={[
            styles.title,
            { color: theme.text, fontFamily: 'Literata_700Bold' },
          ]}
        >
          Reading Stats
        </Text>
        <Text
          style={{
            color: theme.textMuted,
            fontFamily: 'SourceSans3_400Regular',
            lineHeight: 22,
          }}
        >
          {insight}
        </Text>

        <View style={styles.grid}>
          {[
            { label: 'Pages today', value: String(summary.pagesToday) },
            { label: 'Day streak', value: String(summary.streak) },
            {
              label: 'Books done',
              value: String(summary.booksCompleted),
            },
            {
              label: 'Avg session',
              value: formatMinutes(summary.avgSessionMinutes || 0),
            },
            {
              label: 'Total time',
              value: formatMinutes(summary.totalMinutes || 0),
            },
            { label: 'In progress', value: String(reading) },
          ].map((card) => (
            <View
              key={card.label}
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.value,
                  { color: theme.text, fontFamily: 'Literata_700Bold' },
                ]}
              >
                {card.value}
              </Text>
              <Text
                style={{
                  color: theme.textMuted,
                  fontFamily: 'SourceSans3_600SemiBold',
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {card.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>
          Recent activity
        </Text>
        <View style={styles.list}>
          {recentDays.length === 0 ? (
            <Text style={{ color: theme.textMuted }}>
              Start reading to see daily activity here.
            </Text>
          ) : (
            recentDays.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.dayRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>
                  {day.date}
                </Text>
                <Text style={{ color: theme.textSecondary }}>
                  {day.pagesRead} pages · {formatMinutes(day.minutesRead)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>
          Library progress
        </Text>
        <View style={styles.list}>
          {books.map((book) => {
            const p = progress[book.id];
            const percent =
              book.totalPages > 0
                ? Math.round(((p?.currentPage ?? 0) + 1) / book.totalPages * 100)
                : 0;
            return (
              <View key={book.id} style={styles.bookProgress}>
                <View style={styles.bookProgressHeader}>
                  <Text
                    style={{ color: theme.text, fontWeight: '600', flex: 1 }}
                    numberOfLines={1}
                  >
                    {book.title}
                  </Text>
                  <Text style={{ color: theme.textMuted }}>{percent}%</Text>
                </View>
                <View
                  style={[styles.track, { backgroundColor: theme.progressTrack }]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.min(100, percent)}%`,
                        backgroundColor: theme.progressFill,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  value: { fontSize: 28, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  list: { gap: 10 },
  dayRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bookProgress: { gap: 8 },
  bookProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%' },
});

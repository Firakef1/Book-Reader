import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  book: Book;
  progressPercent: number;
  pageLabel?: string;
  lastReadLabel?: string;
  onPress: () => void;
  onMenuPress?: () => void;
  featured?: boolean;
}

export function BookCoverCard({
  book,
  progressPercent,
  pageLabel,
  lastReadLabel,
  onPress,
  onMenuPress,
  featured,
}: Props) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        featured && styles.featured,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {onMenuPress ? (
        <Pressable
          onPress={onMenuPress}
          hitSlop={10}
          style={[styles.menuBtn, { backgroundColor: theme.accentSoft }]}
          accessibilityLabel="Book options"
        >
          <Text style={[styles.menuDots, { color: theme.text }]}>⋮</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <View style={styles.coverStack}>
          {featured ? (
            <>
              <View
                style={[
                  styles.stackGhost,
                  styles.stackGhostBack,
                  { backgroundColor: shade(book.coverColor, -18) },
                ]}
              />
              <View
                style={[
                  styles.stackGhost,
                  styles.stackGhostMid,
                  { backgroundColor: shade(book.coverColor, -8) },
                ]}
              />
            </>
          ) : null}
          <View style={styles.coverShell}>
            <View
              style={[
                styles.spine,
                { backgroundColor: shade(book.coverColor, -28) },
              ]}
            />
            <View
              style={[
                styles.cover,
                featured && styles.coverFeatured,
                { backgroundColor: book.coverColor },
              ]}
            >
              {book.coverImage ? (
                <Image
                  source={{ uri: book.coverImage }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : null}
              <View
                style={[
                  styles.coverScrim,
                  book.coverImage ? styles.coverScrimImage : null,
                ]}
              >
                <Text style={styles.format}>{book.fileType.toUpperCase()}</Text>
                <Text style={styles.coverTitle} numberOfLines={4}>
                  {book.title}
                </Text>
                <Text style={styles.coverAuthor} numberOfLines={2}>
                  {book.author}
                </Text>
              </View>
            </View>
          </View>
          {featured ? (
            <View
              style={[styles.glass, { borderColor: 'rgba(255,255,255,0.18)' }]}
            >
              <View style={[styles.rivet, { top: 6, left: 6 }]} />
              <View style={[styles.rivet, { top: 6, right: 6 }]} />
              <View style={[styles.rivet, { bottom: 6, left: 6 }]} />
              <View style={[styles.rivet, { bottom: 6, right: 6 }]} />
            </View>
          ) : null}
        </View>

        <View style={[styles.meta, onMenuPress ? styles.metaWithMenu : null]}>
          {featured ? (
            <Text
              style={[
                styles.kicker,
                { color: theme.warm, fontFamily: 'SourceSans3_600SemiBold' },
              ]}
            >
              Continue reading
            </Text>
          ) : null}
          <Text
            style={[
              styles.title,
              featured && styles.titleFeatured,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
            numberOfLines={2}
          >
            {book.title}
          </Text>
          <Text
            style={{
              color: theme.textMuted,
              fontFamily: 'SourceSans3_400Regular',
              fontSize: 13,
              letterSpacing: 0.3,
            }}
            numberOfLines={1}
          >
            {book.author}
          </Text>
          {pageLabel ? (
            <Text
              style={[
                styles.page,
                {
                  color: theme.textSecondary,
                  fontFamily: 'SourceSans3_400Regular',
                },
              ]}
            >
              {pageLabel}
            </Text>
          ) : null}
          {lastReadLabel ? (
            <Text style={[styles.lastRead, { color: theme.warm }]}>
              Last read {lastReadLabel}
            </Text>
          ) : null}
          <View style={[styles.track, { backgroundColor: theme.progressTrack }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                  backgroundColor: theme.progressFill,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.percent,
              {
                color: theme.textMuted,
                fontFamily: 'SourceSans3_400Regular',
              },
            ]}
          >
            {Math.round(progressPercent)}% complete
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    position: 'relative',
  },
  featured: {
    padding: 18,
  },
  body: {
    flexDirection: 'row',
    gap: 16,
  },
  menuBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDots: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -2,
  },
  coverStack: {
    width: 110,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackGhost: {
    position: 'absolute',
    width: 88,
    height: 128,
    borderRadius: 8,
  },
  stackGhostBack: {
    transform: [{ rotate: '-8deg' }, { translateX: -10 }],
    opacity: 0.55,
  },
  stackGhostMid: {
    transform: [{ rotate: '5deg' }, { translateX: 8 }],
    opacity: 0.7,
  },
  coverShell: {
    flexDirection: 'row',
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  spine: {
    width: 7,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  cover: {
    width: 78,
    height: 112,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  coverFeatured: {
    width: 92,
    height: 132,
  },
  coverScrim: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  coverScrimImage: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  glass: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 4,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 3,
  },
  rivet: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  format: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: 'SourceSans3_700Bold',
  },
  coverTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    fontFamily: 'Literata_700Bold',
  },
  coverAuthor: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
  },
  meta: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  metaWithMenu: {
    paddingRight: 28,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  titleFeatured: {
    fontSize: 22,
    lineHeight: 28,
  },
  page: {
    fontSize: 13,
    marginTop: 2,
  },
  lastRead: {
    fontSize: 12,
    fontWeight: '600',
  },
  track: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  percent: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

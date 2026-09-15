import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Book } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  book: Book;
  progressPercent: number;
  onPress: () => void;
}

export function MiniBookCard({ book, progressPercent, onPress }: Props) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={styles.shadow}>
        <View
          style={[
            styles.ghost,
            { backgroundColor: book.coverColor, opacity: 0.35 },
          ]}
        />
        <View style={styles.coverRow}>
          <View style={[styles.spine, { backgroundColor: '#00000055' }]} />
          <View style={[styles.cover, { backgroundColor: book.coverColor }]}>
            <Text style={styles.format}>{book.fileType.toUpperCase()}</Text>
            <Text style={styles.title} numberOfLines={4}>
              {book.title}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: theme.progressTrack }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, progressPercent)}%`,
              backgroundColor: theme.progressFill,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.meta,
          {
            color: theme.textMuted,
            fontFamily: 'SourceSans3_400Regular',
          },
        ]}
        numberOfLines={1}
      >
        {book.author}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 118,
  },
  shadow: {
    height: 172,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghost: {
    position: 'absolute',
    width: 96,
    height: 148,
    borderRadius: 10,
    transform: [{ rotate: '-6deg' }, { translateX: -6 }],
  },
  coverRow: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
    transform: [{ rotate: '2deg' }],
  },
  spine: {
    width: 7,
  },
  cover: {
    width: 100,
    height: 156,
    padding: 12,
    justifyContent: 'space-between',
  },
  format: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'SourceSans3_700Bold',
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'Literata_700Bold',
  },
  track: {
    height: 3,
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});

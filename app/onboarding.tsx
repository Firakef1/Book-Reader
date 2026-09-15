import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibraryStore } from '../src/store/libraryStore';
import { useAppTheme } from '../src/hooks/useAppTheme';

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const completeOnboarding = useLibraryStore((s) => s.completeOnboarding);

  const start = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.hero}>
        <View style={[styles.heroWash, { backgroundColor: theme.warm }]} />
        <View style={[styles.heroPaper, { backgroundColor: '#902808' }]} />
        <View style={[styles.heroBook, { backgroundColor: '#1A1410' }]}>
          <Text style={styles.heroLines}>
            {`A quiet page.\nA longer night.\nYour library, close.`}
          </Text>
        </View>
        <Pressable
          onPress={start}
          style={[styles.skip, { borderColor: theme.border }]}
        >
          <Text
            style={{
              color: theme.textSecondary,
              fontFamily: 'SourceSans3_600SemiBold',
              fontSize: 12,
              letterSpacing: 1,
            }}
          >
            SKIP
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.dashes}>
          <View style={[styles.dashActive, { backgroundColor: theme.accent }]} />
        </View>

        <Text
          style={[
            styles.brand,
            { color: theme.text, fontFamily: 'Literata_700Bold' },
          ]}
        >
          BookReader
        </Text>
        <Text
          style={[
            styles.eyebrow,
            {
              color: theme.textMuted,
              fontFamily: 'SourceSans3_600SemiBold',
            },
          ]}
        >
          ORGANIZE EBOOKS · HIGHLIGHT · RESUME
        </Text>
        <Text
          style={[
            styles.headline,
            { color: theme.text, fontFamily: 'Literata_700Bold' },
          ]}
        >
          Open the app. You’re already on the right page.
        </Text>
        <Text
          style={[
            styles.body,
            {
              color: theme.textSecondary,
              fontFamily: 'SourceSans3_400Regular',
            },
          ]}
        >
          Progress and highlights stay on this device. Import your own PDF,
          EPUB, or TXT files and read full screen.
        </Text>

        <Pressable
          onPress={start}
          style={[styles.cta, { backgroundColor: theme.accent }]}
        >
          <Text
            style={[
              styles.ctaText,
              {
                color: theme.onAccent,
                fontFamily: 'SourceSans3_700Bold',
              },
            ]}
          >
            GET STARTED
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  hero: {
    flex: 1.15,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#050405',
    justifyContent: 'flex-end',
    padding: 24,
  },
  heroWash: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    opacity: 0.35,
  },
  heroPaper: {
    position: 'absolute',
    top: 48,
    left: 28,
    width: 140,
    height: 190,
    borderRadius: 8,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.85,
  },
  heroBook: {
    position: 'absolute',
    top: 64,
    right: 36,
    width: 150,
    height: 210,
    borderRadius: 10,
    padding: 18,
    transform: [{ rotate: '4deg' }],
    justifyContent: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroLines: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: 'Literata_400Regular',
    fontSize: 15,
    lineHeight: 24,
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    zIndex: 2,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 36,
    gap: 12,
  },
  dashes: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  dashActive: {
    width: 28,
    height: 3,
    borderRadius: 99,
  },
  brand: { fontSize: 36 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: -4,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
    marginTop: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
  },
  cta: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 13,
    letterSpacing: 1.8,
  },
});

import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Literata_400Regular,
  Literata_700Bold,
} from '@expo-google-fonts/literata';
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import { useLibraryStore } from '../src/store/libraryStore';
import { useAppTheme } from '../src/hooks/useAppTheme';
import Constants from 'expo-constants';

const INK = '#0A0A0A';
const MIN_BRAND_MS = 900;

SplashScreen.preventAutoHideAsync().catch(() => {});
if (Constants.appOwnership !== 'expo') {
  SplashScreen.setOptions({ duration: 450, fade: true });
}

function BrandSplash() {
  return (
    <View style={styles.splash}>
      <Image
        source={require('../assets/splash-icon.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
      <Text style={styles.splashTitle}>BookReader</Text>
      <Text style={styles.splashTagline}>Your library, anywhere</Text>
    </View>
  );
}

export default function RootLayout() {
  const theme = useAppTheme();
  const hydrated = useLibraryStore((s) => s.hydrated);
  const hasOnboarded = useLibraryStore(
    (s) => s.preferences.hasCompletedOnboarding,
  );
  const openLastBookOnLaunch = useLibraryStore(
    (s) => s.preferences.openLastBookOnLaunch !== false,
  );
  const lastOpenedBookId = useLibraryStore(
    (s) => s.preferences.lastOpenedBookId,
  );
  const books = useLibraryStore((s) => s.books);
  const router = useRouter();
  const segments = useSegments();
  const brandShownAt = useRef<number | null>(null);
  const [brandDone, setBrandDone] = useState(false);
  const didAutoOpen = useRef(false);

  const [fontsLoaded] = useFonts({
    Literata_400Regular,
    Literata_700Bold,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    if (brandShownAt.current == null) {
      brandShownAt.current = Date.now();
    }
    SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded || !hydrated) return;
    const started = brandShownAt.current ?? Date.now();
    const remaining = Math.max(0, MIN_BRAND_MS - (Date.now() - started));
    const timer = setTimeout(() => setBrandDone(true), remaining);
    return () => clearTimeout(timer);
  }, [fontsLoaded, hydrated]);

  const ready = fontsLoaded && hydrated && brandDone;

  useEffect(() => {
    if (!ready) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!hasOnboarded && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }
    if (hasOnboarded && inOnboarding) {
      router.replace('/(tabs)');
      return;
    }

    if (
      hasOnboarded &&
      !didAutoOpen.current &&
      openLastBookOnLaunch &&
      lastOpenedBookId &&
      books.some((b) => b.id === lastOpenedBookId) &&
      segments[0] !== 'reader'
    ) {
      didAutoOpen.current = true;
      // Push (don't replace) so Library stays under the reader and Back works.
      router.push(`/reader/${lastOpenedBookId}`);
    }
  }, [
    ready,
    hasOnboarded,
    segments,
    router,
    openLastBookOnLaunch,
    lastOpenedBookId,
    books,
  ]);

  if (!ready) {
    if (!fontsLoaded) {
      return <View style={styles.splash} />;
    }
    return <BrandSplash />;
  }

  return (
    <>
      <StatusBar
        style={theme.id === 'light' || theme.id === 'sepia' ? 'dark' : 'light'}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="reader/[id]"
          options={{ animation: 'slide_from_right', gestureEnabled: true }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK,
    paddingHorizontal: 32,
  },
  splashLogo: {
    width: 148,
    height: 148,
    marginBottom: 28,
  },
  splashTitle: {
    fontFamily: 'Literata_700Bold',
    fontSize: 34,
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  splashTagline: {
    marginTop: 8,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.72)',
  },
});

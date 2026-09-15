import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedControl } from '../../src/components/SegmentedControl';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { themes } from '../../src/theme/colors';
import { useLibraryStore } from '../../src/store/libraryStore';
import {
  FontFamily,
  LibraryBackup,
  LineHeight,
  PageTurnMode,
  TextAlign,
  ThemeId,
} from '../../src/types';
import {
  getFontFamilyName,
  getLineHeightMultiplier,
} from '../../src/theme/typography';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const preferences = useLibraryStore((s) => s.preferences);
  const setTheme = useLibraryStore((s) => s.setTheme);
  const setFollowSystemTheme = useLibraryStore((s) => s.setFollowSystemTheme);
  const setTextPreferences = useLibraryStore((s) => s.setTextPreferences);
  const setPageTurnMode = useLibraryStore((s) => s.setPageTurnMode);
  const setOpenLastBookOnLaunch = useLibraryStore(
    (s) => s.setOpenLastBookOnLaunch,
  );
  const setKeepScreenAwake = useLibraryStore((s) => s.setKeepScreenAwake);
  const resetOnboarding = useLibraryStore((s) => s.resetOnboarding);
  const exportBackup = useLibraryStore((s) => s.exportBackup);
  const importBackupMeta = useLibraryStore((s) => s.importBackupMeta);
  const pageTurnMode = preferences.pageTurnMode ?? 'scroll';
  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const previewFont = getFontFamilyName(
    preferences.text.fontFamily,
    true,
    true,
  );

  const handleExport = async () => {
    try {
      const backup = exportBackup();
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) throw new Error('No writable directory available.');
      const path = `${dir}bookreader-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2));
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Backup saved', `Saved to:\n${path}`);
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Export BookReader backup',
      });
    } catch (e) {
      Alert.alert(
        'Export failed',
        e instanceof Error ? e.message : 'Could not export backup.',
      );
    }
  };

  const handleRestore = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const parsed = JSON.parse(raw) as LibraryBackup;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.books)) {
        throw new Error('This file is not a BookReader backup.');
      }
      Alert.alert(
        'Restore backup?',
        'This replaces library metadata, progress, and highlights on this device. Book files already on disk stay; missing files need re-import.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              importBackupMeta(parsed);
              Alert.alert('Restored', 'Backup data was applied.');
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        'Restore failed',
        e instanceof Error ? e.message : 'Could not read that backup.',
      );
    }
  };

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
          Settings
        </Text>

        <Text style={[styles.section, { color: theme.text }]}>Theme</Text>
        <View
          style={[
            styles.rowBetween,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.text, fontWeight: '600' }}>
            Match system
          </Text>
          <Switch
            value={preferences.followSystemTheme}
            onValueChange={setFollowSystemTheme}
            trackColor={{ true: theme.warm, false: theme.border }}
            thumbColor={theme.accent}
          />
        </View>

        <View style={styles.themeGrid}>
          {(Object.keys(themes) as ThemeId[]).map((id) => {
            const t = themes[id];
            const active =
              !preferences.followSystemTheme && preferences.themeId === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTheme(id)}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: t.background,
                    borderColor: active ? theme.accent : t.border,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
              >
                <Text style={{ color: t.text, fontWeight: '700' }}>
                  {t.name}
                </Text>
                <Text style={{ color: t.textSecondary, fontSize: 12 }}>
                  Aa Bb Cc
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Reading</Text>
        <SegmentedControl
          label="Page turn"
          value={pageTurnMode}
          options={[
            { label: 'Scroll', value: 'scroll' },
            { label: 'Flip', value: 'flip' },
          ]}
          onChange={(v) => setPageTurnMode(v as PageTurnMode)}
        />
        <Text style={{ color: theme.textMuted, lineHeight: 20, marginTop: -4 }}>
          Scroll continuously, or swipe/tap edges to flip one page at a time.
        </Text>

        <View
          style={[
            styles.rowBetween,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              Open last book on launch
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
              Jump straight back into what you were reading.
            </Text>
          </View>
          <Switch
            value={preferences.openLastBookOnLaunch !== false}
            onValueChange={setOpenLastBookOnLaunch}
            trackColor={{ true: theme.warm, false: theme.border }}
            thumbColor={theme.accent}
          />
        </View>

        <View
          style={[
            styles.rowBetween,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              Keep screen awake
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
              Prevent sleep while a book is open.
            </Text>
          </View>
          <Switch
            value={preferences.keepScreenAwake !== false}
            onValueChange={setKeepScreenAwake}
            trackColor={{ true: theme.warm, false: theme.border }}
            thumbColor={theme.accent}
          />
        </View>

        <Text style={[styles.section, { color: theme.text }]}>
          Text appearance
        </Text>
        <View
          style={[
            styles.preview,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: preferences.text.fontSize,
              fontFamily: previewFont,
              lineHeight:
                preferences.text.fontSize *
                getLineHeightMultiplier(preferences.text.lineHeight),
              letterSpacing: preferences.text.letterSpacing,
              textAlign: preferences.text.textAlign,
            }}
          >
            The quick brown fox jumps over the lazy dog. Live preview of your
            reading style.
          </Text>
        </View>

        <View style={styles.controls}>
          <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
            Font size · {preferences.text.fontSize}
          </Text>
          <View style={styles.sizeRow}>
            <Pressable
              onPress={() =>
                setTextPreferences({
                  fontSize: Math.max(14, preferences.text.fontSize - 1),
                })
              }
              style={[styles.sizeBtn, { backgroundColor: theme.accentSoft }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>A−</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setTextPreferences({
                  fontSize: Math.min(32, preferences.text.fontSize + 1),
                })
              }
              style={[styles.sizeBtn, { backgroundColor: theme.accentSoft }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>A+</Text>
            </Pressable>
          </View>

          <SegmentedControl
            label="Font family"
            value={preferences.text.fontFamily}
            options={[
              { label: 'Serif', value: 'serif' },
              { label: 'Sans', value: 'sans' },
              { label: 'Mono', value: 'mono' },
            ]}
            onChange={(v) =>
              setTextPreferences({ fontFamily: v as FontFamily })
            }
          />

          <SegmentedControl
            label="Line height"
            value={preferences.text.lineHeight}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Spacious', value: 'spacious' },
            ]}
            onChange={(v) =>
              setTextPreferences({ lineHeight: v as LineHeight })
            }
          />

          <SegmentedControl
            label="Alignment"
            value={preferences.text.textAlign}
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Justify', value: 'justify' },
            ]}
            onChange={(v) =>
              setTextPreferences({ textAlign: v as TextAlign })
            }
          />

          <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
            Letter spacing · {preferences.text.letterSpacing.toFixed(1)}
          </Text>
          <View style={styles.sizeRow}>
            <Pressable
              onPress={() =>
                setTextPreferences({
                  letterSpacing: Math.max(
                    -0.5,
                    Number((preferences.text.letterSpacing - 0.2).toFixed(1)),
                  ),
                })
              }
              style={[styles.sizeBtn, { backgroundColor: theme.accentSoft }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>−</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setTextPreferences({
                  letterSpacing: Math.min(
                    2,
                    Number((preferences.text.letterSpacing + 0.2).toFixed(1)),
                  ),
                })
              }
              style={[styles.sizeBtn, { backgroundColor: theme.accentSoft }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Data</Text>
        <Pressable
          onPress={handleExport}
          style={[
            styles.actionBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.text, fontWeight: '700' }}>
            Export backup
          </Text>
          <Text style={{ color: theme.textMuted, marginTop: 4, fontSize: 12 }}>
            Share progress, highlights, and library metadata (book text stays on
            device).
          </Text>
        </Pressable>
        <Pressable
          onPress={handleRestore}
          style={[
            styles.actionBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.text, fontWeight: '700' }}>
            Restore backup
          </Text>
          <Text style={{ color: theme.textMuted, marginTop: 4, fontSize: 12 }}>
            Pick a BookReader JSON backup to restore metadata.
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Replay onboarding?',
              'You’ll see the welcome screen next launch.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reset', onPress: () => resetOnboarding() },
              ],
            )
          }
          style={[
            styles.actionBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.text, fontWeight: '700' }}>
            Reset onboarding
          </Text>
        </Pressable>

        <Text style={[styles.section, { color: theme.text }]}>About</Text>
        <Text style={{ color: theme.textMuted, lineHeight: 22 }}>
          BookReader {appVersion} — local-first reading with progress tracking,
          highlights, and calm themes. Your library stays on this device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  title: { fontSize: 34, fontWeight: '700', marginBottom: 4 },
  section: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
    fontFamily: 'Literata_700Bold',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCard: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    minHeight: 88,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  controls: { gap: 14 },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
});

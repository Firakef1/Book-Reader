import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  visible: boolean;
  initialTitle: string;
  initialAuthor?: string;
  onCancel: () => void;
  onSave: (title: string, author: string) => void;
}

export function EditBookModal({
  visible,
  initialTitle,
  initialAuthor = '',
  onCancel,
  onSave,
}: Props) {
  const theme = useAppTheme();
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState(initialAuthor);

  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setAuthor(initialAuthor);
    }
  }, [visible, initialTitle, initialAuthor]);

  const canSave = title.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
        >
          <Text
            style={[
              styles.heading,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
          >
            Edit book
          </Text>

          <Text
            style={[
              styles.label,
              { color: theme.textMuted, fontFamily: 'SourceSans3_600SemiBold' },
            ]}
          >
            TITLE
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Book title"
            placeholderTextColor={theme.textMuted}
            autoFocus
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                fontFamily: 'SourceSans3_400Regular',
              },
            ]}
          />

          <Text
            style={[
              styles.label,
              { color: theme.textMuted, fontFamily: 'SourceSans3_600SemiBold' },
            ]}
          >
            AUTHOR
          </Text>
          <TextInput
            value={author}
            onChangeText={setAuthor}
            placeholder="Author"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                fontFamily: 'SourceSans3_400Regular',
              },
            ]}
          />

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.btnGhost}>
              <Text
                style={{
                  color: theme.textMuted,
                  fontFamily: 'SourceSans3_600SemiBold',
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={!canSave}
              onPress={() =>
                onSave(title.trim(), author.trim() || 'Unknown author')
              }
              style={[
                styles.btnPrimary,
                {
                  backgroundColor: theme.accent,
                  opacity: canSave ? 1 : 0.4,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.onAccent,
                  fontFamily: 'SourceSans3_700Bold',
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 10,
  },
  heading: { fontSize: 22, marginBottom: 4 },
  label: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  btnGhost: { paddingHorizontal: 14, paddingVertical: 12 },
  btnPrimary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
});

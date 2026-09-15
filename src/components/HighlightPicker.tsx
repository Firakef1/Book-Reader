import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { highlightColors } from '../theme/colors';
import { HighlightColor } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  visible: boolean;
  selectedText: string;
  onPick: (color: HighlightColor) => void;
  onClose: () => void;
}

export function HighlightPicker({
  visible,
  selectedText,
  onPick,
  onClose,
}: Props) {
  const theme = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[
              styles.heading,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
          >
            Highlight passage
          </Text>
          <Text
            style={[
              styles.preview,
              {
                color: theme.textSecondary,
                fontFamily: 'SourceSans3_400Regular',
              },
            ]}
            numberOfLines={4}
          >
            {selectedText || 'Selected text'}
          </Text>
          <View style={styles.row}>
            {highlightColors.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onPick(c.id)}
                style={[styles.swatch, { backgroundColor: c.swatch }]}
                accessibilityLabel={c.label}
              />
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text
              style={{
                color: theme.textMuted,
                fontWeight: '600',
                fontFamily: 'SourceSans3_600SemiBold',
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    gap: 12,
    paddingBottom: 28,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  preview: {
    fontSize: 14,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
});

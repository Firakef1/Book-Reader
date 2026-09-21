import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLibraryStore } from '../store/libraryStore';
import { Book, BookVault } from '../types';
import { getBookVault } from '../utils/helpers';

type Props = {
  visible: boolean;
  targetVault: BookVault;
  onClose: () => void;
};

export function MoveFromLibraryModal({
  visible,
  targetVault,
  onClose,
}: Props) {
  const theme = useAppTheme();
  const books = useLibraryStore((s) => s.books);
  const moveBookToVault = useLibraryStore((s) => s.moveBookToVault);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const publicBooks = useMemo(
    () => books.filter((b) => getBookVault(b) === 'public'),
    [books],
  );

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const moveSelected = () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) {
      Alert.alert('Nothing selected', 'Pick at least one book to move.');
      return;
    }
    for (const id of ids) moveBookToVault(id, targetVault);
    setSelected({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={[
              styles.title,
              { color: theme.text, fontFamily: 'Literata_700Bold' },
            ]}
          >
            Move from library
          </Text>
          <Text
            style={{
              color: theme.textSecondary,
              fontFamily: 'SourceSans3_400Regular',
              marginBottom: 8,
            }}
          >
            Selected books leave your public shelf until you move them back.
          </Text>
          {publicBooks.length === 0 ? (
            <Text
              style={{
                color: theme.textMuted,
                fontFamily: 'SourceSans3_400Regular',
                textAlign: 'center',
                paddingVertical: 24,
              }}
            >
              No books on your public shelf.
            </Text>
          ) : (
            <FlatList
              data={publicBooks}
              keyExtractor={(b: Book) => b.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const on = !!selected[item.id];
                return (
                  <Pressable
                    onPress={() => toggle(item.id)}
                    style={[
                      styles.row,
                      {
                        borderColor: theme.border,
                        backgroundColor: on
                          ? theme.accentSoft
                          : theme.background,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.text,
                        fontFamily: 'SourceSans3_600SemiBold',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        color: on ? theme.accent : theme.textMuted,
                        fontFamily: 'SourceSans3_700Bold',
                      }}
                    >
                      {on ? '✓' : ''}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
          <View style={styles.actions}>
            <Pressable onPress={onClose}>
              <Text
                style={{
                  color: theme.textSecondary,
                  fontFamily: 'SourceSans3_600SemiBold',
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={moveSelected}
              style={[styles.primary, { backgroundColor: theme.accent }]}
            >
              <Text
                style={{
                  color: theme.onAccent,
                  fontFamily: 'SourceSans3_700Bold',
                }}
              >
                Move
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  primary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
});

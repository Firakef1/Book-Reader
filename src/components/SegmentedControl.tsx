import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface Props {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

export function SegmentedControl({ label, value, options, onChange }: Props) {
  const theme = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.label,
          {
            color: theme.textMuted,
            fontFamily: 'SourceSans3_600SemiBold',
          },
        ]}
      >
        {label}
      </Text>
      <View style={[styles.row, { backgroundColor: theme.accentSoft }]}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                styles.item,
                active && { backgroundColor: theme.accent },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.onAccent : theme.textMuted,
                  fontWeight: active ? '700' : '500',
                  fontSize: 13,
                  fontFamily: active
                    ? 'SourceSans3_700Bold'
                    : 'SourceSans3_400Regular',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
});

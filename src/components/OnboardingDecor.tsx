import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Soft atmospheric wash for onboarding without adding an extra dependency. */
export function Linearish({
  accent,
  soft,
}: {
  accent: string;
  soft: string;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.blob,
          {
            backgroundColor: soft,
            top: -40,
            right: -60,
            width: 260,
            height: 260,
          },
        ]}
      />
      <View
        style={[
          styles.blob,
          {
            backgroundColor: accent,
            opacity: 0.12,
            bottom: 120,
            left: -80,
            width: 220,
            height: 220,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
});

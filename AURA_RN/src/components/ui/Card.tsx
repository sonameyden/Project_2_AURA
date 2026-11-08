import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useAuraTheme } from '@/core/theme';

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: PropsWithChildren<{ style?: ViewStyle; onPress?: () => void; accessibilityLabel?: string }>) {
  const { colors, mode } = useAuraTheme();
  const containerStyle = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border },
    // In light mode a soft shadow lifts cards off the page; dark mode relies on the lighter surface.
    mode === 'light' && styles.lightShadow,
    style,
  ];
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...containerStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  ) : (
    <View style={containerStyle}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 12 },
  pressed: { opacity: 0.75 },
  lightShadow: {
    shadowColor: '#2A1F45',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

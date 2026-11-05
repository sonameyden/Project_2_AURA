import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ImageStyle } from 'react-native';

import { useAuraTheme } from '@/core/theme';

export function Artwork({
  uri,
  size = 56,
  rounded = 16,
  style,
}: {
  uri: string | null;
  size?: number;
  rounded?: number;
  style?: ImageStyle;
}) {
  const { colors } = useAuraTheme();
  return uri ? (
    <Image
      source={{ uri }}
      contentFit="cover"
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
      style={[{ width: size, height: size, borderRadius: rounded, backgroundColor: colors.elevated }, style]}
    />
  ) : (
    <LinearGradient
      colors={[colors.accentSoft, colors.elevated]}
      style={[styles.artworkFallback, { width: size, height: size, borderRadius: rounded }, style]}>
      <Ionicons name="musical-notes" size={size * 0.35} color={colors.accent} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  artworkFallback: { alignItems: 'center', justifyContent: 'center' },
});

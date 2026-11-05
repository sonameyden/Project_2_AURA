import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useAuraTheme } from '@/core/theme';

export function Page({
  children,
  scroll = true,
  style,
  transparent = false,
  safeAreaEdges = ['top'],
}: PropsWithChildren<{
  scroll?: boolean;
  style?: ViewStyle;
  transparent?: boolean;
  safeAreaEdges?: Edge[];
}>) {
  const { colors, mode } = useAuraTheme();
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.pageContent, style]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.pageContent, styles.fill, style]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: transparent ? 'transparent' : colors.background }]}
      edges={safeAreaEdges}>
      <View style={styles.fill}>
        {!transparent ? <AmbientBackground light={mode === 'light'} /> : null}
        {content}
      </View>
    </SafeAreaView>
  );
}

function AmbientBackground({ light }: { light: boolean }) {
  const colors = light
    ? ([
        ['#F3E8FF99', '#F3E8FF00'],
        ['#E0F2FE80', '#E0F2FE00'],
        ['#FEF3C766', '#FEF3C700'],
      ] as const)
    : ([
        ['#1A183066', '#1A183000'],
        ['#13383B55', '#13383B00'],
        ['#6366F122', '#6366F100'],
      ] as const);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={colors[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '58%' }}
      />
      <LinearGradient
        colors={colors[1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, width: '76%', height: '72%' }}
      />
      <LinearGradient
        colors={colors[2]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', bottom: 0, left: 0, width: '88%', height: '46%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  // Bottom padding leaves room for the floating mini-player and tab bar.
  pageContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 132, gap: 20 },
  fill: { flex: 1 },
});

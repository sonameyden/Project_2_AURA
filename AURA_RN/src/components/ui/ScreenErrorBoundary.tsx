import { Ionicons } from '@expo/vector-icons';
import { useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { ActionButton } from './ActionButton';
import { AuraText } from './Text';

/**
 * Shown in place of a screen that crashed while rendering, so one broken
 * screen doesn't blank the whole app. Every route file exports it as its
 * Expo Router `ErrorBoundary`; the rest of the app (tabs, mini-player) keeps working.
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  const { colors } = useAuraTheme();

  useEffect(() => {
    console.error('A screen crashed and was caught by its error boundary.', error);
  }, [error]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <View style={[styles.icon, { backgroundColor: `${colors.danger}22` }]}>
        <Ionicons name="alert-circle-outline" size={34} color={colors.danger} />
      </View>
      <AuraText style={[styles.title, { color: colors.text }]}>Something went wrong</AuraText>
      <AuraText style={[styles.message, { color: colors.muted }]}>
        This screen ran into a problem. You can try again, or head back home.
      </AuraText>
      {__DEV__ ? <AuraText style={[styles.detail, { color: colors.muted }]}>{error.message}</AuraText> : null}
      <View style={styles.actions}>
        <ActionButton title="Try again" onPress={() => void retry()} style={{ flex: 1 }} />
        <ActionButton
          title="Go home"
          variant="secondary"
          onPress={() => router.replace('/(tabs)')}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

/**
 * Last-resort fallback for the root layout. It renders outside the app's
 * providers (theme, settings), so it uses fixed colours and plain components.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('The app crashed and was caught by the root error boundary.', error);
  }, [error]);

  return (
    <View style={[styles.screen, { backgroundColor: '#0C0D12' }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: '#F3F4F6' }]}>AURA hit a problem</Text>
      <Text style={[styles.message, { color: '#9CA3AF' }]}>Something went wrong while starting the app.</Text>
      {__DEV__ ? <Text style={[styles.detail, { color: '#9CA3AF' }]}>{error.message}</Text> : null}
      <Pressable onPress={() => void retry()} accessibilityRole="button" style={styles.plainButton}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  detail: { fontSize: 12, textAlign: 'center', opacity: 0.8 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8 },
  plainButton: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#A855F7',
  },
});

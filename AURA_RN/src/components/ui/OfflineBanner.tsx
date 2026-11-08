import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isOnline } from '@/core/network';
import { useAuraTheme } from '@/core/theme';

import { AuraText } from './Text';

/**
 * A small notice at the top of the screen while the phone has no internet.
 * Screens keep showing what they already loaded; requests wait and resume
 * when the connection returns (see core/network.ts).
 */
export function OfflineBanner() {
  const network = useNetInfo();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useAuraTheme();
  if (isOnline(network)) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[styles.anchor, { top: insets.top + 6 }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert">
      <View
        style={[styles.pill, { backgroundColor: mode === 'dark' ? '#2A2438' : '#FFFFFF', borderColor: colors.border }]}>
        <Ionicons name="cloud-offline-outline" size={15} color={colors.muted} />
        <AuraText style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
          You&apos;re offline · showing saved content
        </AuraText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

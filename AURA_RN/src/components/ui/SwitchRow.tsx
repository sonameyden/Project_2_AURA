import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useSettings } from '@/core/settings';
import { useAuraTheme } from '@/core/theme';

import { Card } from './Card';
import { AuraText } from './Text';

/**
 * A labelled row with an on/off switch.
 *
 * When `onChange` returns a promise (e.g. a server update), the switch flips
 * straight away and holds the new position until the promise settles; if it
 * rejects, the switch falls back to `value`. That keeps toggles that save to
 * the backend feeling instant instead of waiting for the round trip.
 */
export function SwitchRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  /** Text under the label; a function gets the switch's shown state. */
  description?: string | ((value: boolean) => string);
  value: boolean;
  onChange: (value: boolean) => void | Promise<unknown>;
}) {
  const { colors } = useAuraTheme();
  const [pending, setPending] = useState<boolean | null>(null);
  const shown = pending ?? value;
  const text = typeof description === 'function' ? description(shown) : description;

  const toggle = (next: boolean) => {
    const result = onChange(next);
    if (result instanceof Promise) {
      setPending(next);
      void result.catch(() => undefined).finally(() => setPending(null));
    }
  };

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 3 }}>
        <AuraText style={{ fontWeight: '600' }}>{label}</AuraText>
        {text ? <AuraText style={{ color: colors.muted, fontSize: 12 }}>{text}</AuraText> : null}
      </View>
      <AnimatedSwitch label={label} enabled={shown} onChange={toggle} />
    </Card>
  );
}

function AnimatedSwitch({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { colors } = useAuraTheme();
  const { settings } = useSettings();
  const [progress] = useState(() => new Animated.Value(enabled ? 1 : 0));

  useEffect(() => {
    if (settings.reducedMotion) {
      progress.setValue(enabled ? 1 : 0);
      return;
    }
    const animation = Animated.spring(progress, {
      toValue: enabled ? 1 : 0,
      damping: 18,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [enabled, progress, settings.reducedMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={label}
      onPress={() => onChange(!enabled)}
      hitSlop={8}
      style={[styles.switch, { borderWidth: enabled ? 0 : 1, borderColor: colors.border }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 16,
            backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: ['#77717A55', colors.accent] }),
          },
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.knob, { transform: [{ translateX }] }]}>
        {/* Shape cue so state isn't shown by colour alone. */}
        <Ionicons name={enabled ? 'checkmark' : 'close'} size={14} color={enabled ? colors.accent : '#77717A'} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switch: { width: 48, height: 28, justifyContent: 'center', borderRadius: 16, padding: 2 },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
});

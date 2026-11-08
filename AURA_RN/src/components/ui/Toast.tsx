import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/core/settings';
import { useAuraTheme } from '@/core/theme';

import { AuraText } from './Text';

type ToastVariant = 'success' | 'error' | 'info';

export type ToastOptions = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** An optional button, e.g. "View" to open what was just changed. */
  action?: { label: string; onPress: () => void };
};

type ShownToast = ToastOptions & { id: number };

const ToastContext = createContext<((toast: ToastOptions) => void) | null>(null);

const VISIBLE_MS = 2600;
const VISIBLE_WITH_ACTION_MS = 4000;

const ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark',
  error: 'alert',
  info: 'information',
};

/**
 * In-app confirmation messages in AURA's own colours, replacing the phone's
 * system dialog for "it worked" messages. Mounted once at the root so a toast
 * survives navigating back after an action.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ShownToast | null>(null);
  const nextId = useRef(0);
  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastCard key={toast.id} toast={toast} onDone={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

/** `toast.show({ title: 'Added to playlist' })` from any screen. */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used within ToastProvider.');
  return useMemo(() => ({ show }), [show]);
}

function ToastCard({ toast, onDone }: { toast: ShownToast; onDone: () => void }) {
  const { colors, mode } = useAuraTheme();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const variant = toast.variant ?? 'success';
  const tone = variant === 'error' ? colors.danger : colors.accent;

  const hide = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [onDone, progress]);

  useEffect(() => {
    const enter = Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true });
    enter.start();
    const timer = setTimeout(hide, toast.action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS);
    return () => {
      enter.stop();
      clearTimeout(timer);
    };
  }, [hide, progress, toast.action]);

  // Reduced motion: fade only, no slide.
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [settings.reducedMotion ? 0 : -16, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity: progress, transform: [{ translateY }], width: '100%', maxWidth: 520 }}>
        <Pressable
          onPress={hide}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={[toast.title, toast.message].filter(Boolean).join('. ')}
          accessibilityHint="Tap to dismiss"
          style={[
            styles.card,
            {
              // Solid in both themes (the light theme's surface colours are translucent).
              backgroundColor: mode === 'dark' ? '#221F38' : '#FFFFFF',
              borderColor: `${tone}40`,
            },
          ]}>
          <View style={[styles.icon, { backgroundColor: `${tone}26` }]}>
            <Ionicons name={ICONS[variant]} size={16} color={tone} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AuraText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
              {toast.title}
            </AuraText>
            {toast.message ? (
              <AuraText numberOfLines={2} style={{ fontSize: 13, color: colors.muted }}>
                {toast.message}
              </AuraText>
            ) : null}
          </View>
          {toast.action ? (
            <Pressable
              onPress={() => {
                toast.action?.onPress();
                hide();
              }}
              accessibilityRole="button"
              hitSlop={10}
              style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
              <AuraText style={{ color: tone, fontWeight: '700', fontSize: 14 }}>{toast.action.label}</AuraText>
            </Pressable>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

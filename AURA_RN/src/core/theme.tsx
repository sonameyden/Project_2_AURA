import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { useSettings } from './settings';

const palette = {
  dark: {
    background: '#0C0D12',
    surface: '#1A1B23',
    elevated: '#1A1830',
    text: '#F3F4F6',
    muted: '#9CA3AF',
    border: '#FFFFFF1A',
    accent: '#A855F7',
    accentEnd: '#C084FC',
    accentBlue: '#3B82F6',
    accentCyan: '#22D3EE',
    accentSoft: '#2E1C4E',
    teal: '#13383B',
    danger: '#F87171',
  },
  light: {
    background: '#F8F9FD',
    // Solid white cards with a soft lavender-gray outline: translucent white cards
    // with white borders disappeared into the near-white background.
    surface: '#FFFFFF',
    elevated: '#F3EEFA',
    text: '#1C1925',
    muted: '#6B6875',
    border: '#E4DEEE',
    accent: '#9333EA',
    accentEnd: '#C084FC',
    accentBlue: '#3B82F6',
    accentCyan: '#22D3EE',
    accentSoft: '#F3E8FF',
    teal: '#0D9488',
    danger: '#DC2626',
  },
} as const;

/**
 * High-contrast variants: opaque surfaces, stronger borders and brighter
 * secondary text so content stays readable over atmospheric backgrounds.
 */
const highContrast = {
  dark: {
    ...palette.dark,
    background: '#000000',
    surface: '#16161C',
    elevated: '#24222E',
    text: '#FFFFFF',
    muted: '#E2E2EA',
    border: '#FFFFFF99',
    accent: '#C792FF',
    danger: '#FF8A8A',
  },
  light: {
    ...palette.light,
    background: '#FFFFFF',
    surface: '#FFFFFF',
    elevated: '#EDE7F7',
    text: '#000000',
    muted: '#2E2B36',
    border: '#1C1925',
    accent: '#6B21A8',
    danger: '#B91C1C',
  },
} as const;

export type AuraColors = { [K in keyof (typeof palette)['dark']]: string };
type ThemeContextValue = {
  colors: AuraColors;
  mode: 'dark' | 'light';
  highContrast: boolean;
  setMode: (mode: 'dark' | 'light') => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeStorageKey = 'aura.theme';

export function AuraThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<'dark' | 'light'>('dark');
  const [transitionOpacity] = useState(() => new Animated.Value(1));
  const { settings } = useSettings();
  const { highContrast: contrast, reducedMotion } = settings;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(themeStorageKey)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark')) setModeState(stored);
      })
      .catch((error: unknown) => console.error('Unable to load the saved appearance preference.', error));
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback(
    async (nextMode: 'dark' | 'light') => {
      const previousMode = mode;
      setModeState(nextMode);
      try {
        await AsyncStorage.setItem(themeStorageKey, nextMode);
      } catch (error) {
        setModeState(previousMode);
        throw error;
      }
    },
    [mode],
  );

  // Softens the switch between light and dark. Anything else (first load, the
  // reduce-motion setting changing) snaps to full opacity, so an interrupted
  // fade can never leave the whole app dimmed.
  const shownMode = useRef(mode);
  useEffect(() => {
    const modeChanged = shownMode.current !== mode;
    shownMode.current = mode;
    if (!modeChanged || reducedMotion) {
      transitionOpacity.setValue(1);
      return;
    }
    transitionOpacity.setValue(0.88);
    const animation = Animated.timing(transitionOpacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [mode, reducedMotion, transitionOpacity]);

  const colors: AuraColors = contrast ? highContrast[mode] : palette[mode];
  const value = useMemo(() => ({ mode, colors, highContrast: contrast, setMode }), [colors, contrast, mode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <Animated.View style={{ flex: 1, opacity: transitionOpacity, backgroundColor: colors.background }}>
        {children}
      </Animated.View>
    </ThemeContext.Provider>
  );
}

export function useAuraTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAuraTheme must be used within AuraThemeProvider.');
  return value;
}

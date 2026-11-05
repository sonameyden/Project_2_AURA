import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export type VisualIntensity = 'low' | 'medium' | 'high';
export type TextSize = 'small' | 'default' | 'large' | 'extraLarge';

/** Device-only preferences (proposal §2.2 "Visual intensity and accessibility"). */
export type AppSettings = {
  visualIntensity: VisualIntensity;
  /** Static or slowed visuals; defaults to the system "reduce motion" setting. */
  reducedMotion: boolean;
  textSize: TextSize;
  highContrast: boolean;
  crossfade: boolean;
  showCat: boolean;
};

export const defaultSettings: AppSettings = {
  visualIntensity: 'medium',
  reducedMotion: false,
  textSize: 'default',
  highContrast: false,
  crossfade: true,
  showCat: true,
};

export const textScaleFor: Record<TextSize, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  extraLarge: 1.3,
};

/** Seconds of overlap used when crossfade is on. */
export const CROSSFADE_SECONDS = 5;

type SettingsContextValue = {
  settings: AppSettings;
  /** Multiplier applied to every text style. */
  textScale: number;
  loaded: boolean;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const storageKey = 'aura.settings.v1';

/** Reads saved settings, keeping only valid values (exported for tests). */
export function parseStored(raw: string | null): Partial<AppSettings> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    const stored = value as Record<string, unknown>;
    const result: Partial<AppSettings> = {};
    if (stored.visualIntensity === 'low' || stored.visualIntensity === 'medium' || stored.visualIntensity === 'high') {
      result.visualIntensity = stored.visualIntensity;
    }
    if (typeof stored.textSize === 'string' && stored.textSize in textScaleFor) {
      result.textSize = stored.textSize as TextSize;
    }
    for (const key of ['reducedMotion', 'highContrast', 'crossfade', 'showCat'] as const) {
      if (typeof stored[key] === 'boolean') result[key] = stored[key];
    }
    return result;
  } catch {
    return {};
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(storageKey), AccessibilityInfo.isReduceMotionEnabled().catch(() => false)])
      .then(([raw, systemReducedMotion]) => {
        if (!active) return;
        const stored = parseStored(raw);
        setSettings({ ...defaultSettings, reducedMotion: systemReducedMotion, ...stored });
      })
      .catch((error: unknown) => console.error('Unable to load saved settings.', error))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const previous = settings;
      const next = { ...settings, [key]: value };
      setSettings(next);
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      } catch (error) {
        setSettings(previous);
        throw error;
      }
    },
    [settings],
  );

  const value = useMemo(
    () => ({ settings, loaded, update, textScale: textScaleFor[settings.textSize] }),
    [loaded, settings, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used within SettingsProvider.');
  return value;
}

/** Tier numbers used by the visual layers, from Kotlin's `VisualIntensity.toTierConfig`. */
export type VisualTier = { rings: number; particleCount: number; glow: number; motion: number };

export function useVisualTier(): VisualTier {
  const { settings } = useSettings();
  return useMemo(() => {
    const base =
      settings.visualIntensity === 'low'
        ? { rings: 2, particleCount: 16, glow: 0.45 }
        : settings.visualIntensity === 'high'
          ? { rings: 4, particleCount: 44, glow: 1 }
          : { rings: 3, particleCount: 28, glow: 0.7 };
    // Kotlin's reduced motion slows everything to 12% speed.
    return { ...base, motion: settings.reducedMotion ? 0.12 : 1 };
  }, [settings.reducedMotion, settings.visualIntensity]);
}

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useSettings } from '@/core/settings';
import { nativeSkiaAvailable, type SkiaModule } from '@/core/skia';

import { AURA_SKSL } from '../lib/aura-shader';
import { catPlacement } from '../lib/login-scene';

const catLooking = require('../../../../assets/images/now-playing/cat_looking.png');

type AuthBackgroundProps = {
  /** Changes on every keystroke; each change makes the aurora glow briefly. */
  pulseKey?: number;
  /** While signing in, the aurora breathes brighter. */
  busy?: boolean;
};

type AuthBackdropControls = {
  /** Call on each keystroke: the aurora glows briefly. */
  pulse: () => void;
  /** While true (signing in), the aurora breathes brighter. */
  setBusy: (busy: boolean) => void;
};

const AuthBackdropContext = createContext<AuthBackdropControls | null>(null);

/**
 * Draws the aurora once behind every auth screen (login and sign-up). Mounted
 * by the `(auth)` route group's layout, so moving between the two screens
 * keeps the same, continuously flowing background instead of starting a
 * second Skia canvas during the screen transition.
 */
export function AuthBackdrop({ children }: { children: React.ReactNode }) {
  const [pulseKey, setPulseKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const pulse = useCallback(() => setPulseKey((count) => count + 1), []);
  const controls = useMemo(() => ({ pulse, setBusy }), [pulse]);

  return (
    <AuthBackdropContext.Provider value={controls}>
      <View style={{ flex: 1, backgroundColor: '#0C0D12' }}>
        <AuthBackground pulseKey={pulseKey} busy={busy} />
        {children}
      </View>
    </AuthBackdropContext.Provider>
  );
}

/** Lets an auth screen make the shared background react to typing and signing in. */
export function useAuthBackdrop(): AuthBackdropControls {
  return useContext(AuthBackdropContext) ?? noBackdrop;
}

const noBackdrop: AuthBackdropControls = { pulse: () => undefined, setBusy: () => undefined };

/**
 * The login and sign-up background: an animated aurora in AURA's colours,
 * drawn by a Skia shader (see lib/aura-shader.ts). It replaces the Kotlin
 * app's Rive animation, which can't run in Expo Go. Falls back to a static
 * gradient where Skia isn't available (e.g. web) and while Skia loads.
 */
export function AuthBackground({ pulseKey = 0, busy = false }: AuthBackgroundProps) {
  const [skia, setSkia] = useState<SkiaModule | null>(null);
  const [failed, setFailed] = useState(() => !nativeSkiaAvailable());

  useEffect(() => {
    if (failed) return;
    let active = true;
    import('@shopify/react-native-skia')
      .then((module) => {
        if (!active) return;
        if (!module.Skia?.RuntimeEffect) setFailed(true);
        else setSkia(module);
      })
      .catch((error: unknown) => {
        console.warn('Skia failed to load; using the gradient login background.', error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [failed]);

  if (failed || !skia) return <GradientBackground />;
  return <AuroraBackground skia={skia} pulseKey={pulseKey} busy={busy} />;
}

function GradientBackground() {
  return (
    <LinearGradient colors={['#171226', '#0C0D12', '#0C0D12']} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
  );
}

function AuroraBackground({ skia, pulseKey = 0, busy = false }: AuthBackgroundProps & { skia: SkiaModule }) {
  const { Canvas, Fill, Shader, Skia } = skia;
  const window = useWindowDimensions();
  // The drawn area's real size (can differ from the window on Android), used for both the
  // shader and the cat so the cat's paws land exactly on the shader's horizon.
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const { width, height } = size;
  const { settings } = useSettings();
  const effect = useMemo(() => Skia.RuntimeEffect.Make(AURA_SKSL), [Skia]);

  // Start part-way into the animation, where the aurora is already lit.
  const time = useSharedValue(24);
  const glow = useSharedValue(0);
  // Reduced motion slows the drift right down rather than freezing it.
  const speed = useSharedValue(settings.reducedMotion ? 0.15 : 1);
  useEffect(() => {
    speed.set(settings.reducedMotion ? 0.15 : 1);
  }, [settings.reducedMotion, speed]);

  useFrameCallback((frame) => {
    time.set(time.get() + ((frame.timeSincePreviousFrame ?? 16) / 1000) * speed.get());
  });

  // Typing makes the light swell and settle.
  useEffect(() => {
    if (!pulseKey || busy) return;
    glow.set(
      withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
    );
  }, [busy, glow, pulseKey]);

  // Signing in: a slow breathing glow until it finishes.
  useEffect(() => {
    if (!busy) return;
    glow.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(glow);
      glow.set(withTiming(0, { duration: 600 }));
    };
  }, [busy, glow]);

  const uniforms = useDerivedValue(
    () => ({ resolution: [width, height], time: time.get(), glow: glow.get() }),
    [width, height],
  );

  // The cat's outline catches more of the aurora's light while it glows.
  const rimStyle = useAnimatedStyle(() => ({ opacity: 0.5 + 0.35 * glow.get() }));

  if (!effect) {
    console.warn('The AURA login shader did not compile; using the gradient background.');
    return <GradientBackground />;
  }

  const cat = catPlacement(width, height);
  const catBox = { position: 'absolute' as const, left: cat.left, top: cat.top, width: cat.width, height: cat.height };

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const layout = event.nativeEvent.layout;
        if (layout.width && layout.height) setSize({ width: layout.width, height: layout.height });
      }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Fill>
          <Shader source={effect} uniforms={uniforms} />
        </Fill>
      </Canvas>
      {/* The companion cat sits on the horizon watching the aurora: a dark silhouette
          with a faint rim of aurora light around its outline. */}
      <Animated.View style={[catBox, { transform: [{ translateX: -1 }, { translateY: -2 }] }, rimStyle]}>
        <Image source={catLooking} tintColor="#C9BCFF" contentFit="contain" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Image source={catLooking} tintColor="#07060E" contentFit="contain" style={catBox} />
    </View>
  );
}

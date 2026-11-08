import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { AtmosphereProfile } from '@/core/types';

import { EnvironmentBackdrop } from './EnvironmentBackdrop';
import { AtmosphereEffects } from './AtmosphereEffects';
import type { SceneLook } from '../lib/sections';

/**
 * The world behind Now Playing: environment image + lighting, atmospheric
 * particles and a colour wash for the current section. Every layer follows
 * `look`, which changes per song section; changes crossfade over the
 * profile's transition time. (The companion cat is placed in the screen's
 * layout, above the lyrics, so it never covers them.)
 */
export function NowPlayingScene({
  look,
  atmosphere,
  playing,
  baseColor,
}: {
  look: SceneLook;
  /** Base profile with the current section's look applied. */
  atmosphere: AtmosphereProfile | null;
  playing: boolean;
  baseColor: string;
}) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <EnvironmentBackdrop look={look} playing={playing} />
      <CrossfadingEffects atmosphere={atmosphere} playing={playing} durationMs={look.transitionMs} />
      <ColorWash color={look.primaryColorHex ?? baseColor} durationMs={look.transitionMs} />
    </View>
  );
}

/**
 * Particles (leaves, rain, stars…) for the environment. When the environment
 * changes, the old particles fade out while the new ones fade in, instead of
 * one set popping out and the other popping in.
 */
function CrossfadingEffects({
  atmosphere,
  playing,
  durationMs,
}: {
  atmosphere: AtmosphereProfile | null;
  playing: boolean;
  durationMs: number;
}) {
  const key = atmosphere?.environment ?? 'none';
  // `captured` is the profile when this environment began; it is what fades out next time.
  const [layers, setLayers] = useState<{
    key: string;
    captured: AtmosphereProfile | null;
    previous: { atmosphere: AtmosphereProfile | null } | null;
  }>({ key, captured: atmosphere, previous: null });
  const [fadeIn] = useState(() => new Animated.Value(1));

  if (layers.key !== key) setLayers({ key, captured: atmosphere, previous: { atmosphere: layers.captured } });

  useEffect(() => {
    if (!layers.previous) return;
    fadeIn.setValue(0);
    const animation = Animated.timing(fadeIn, { toValue: 1, duration: durationMs, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished) setLayers((value) => ({ ...value, previous: null }));
    });
    return () => animation.stop();
    // Restart only when the environment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.key]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layers.previous ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}>
          <AtmosphereEffects atmosphere={layers.previous.atmosphere} playing={playing} />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: layers.previous ? fadeIn : 1 }]}>
        <AtmosphereEffects atmosphere={atmosphere} playing={playing} />
      </Animated.View>
    </View>
  );
}

/** A faint wash of the section colour that crossfades when the colour changes. */
function ColorWash({ color, durationMs }: { color: string; durationMs: number }) {
  const [layers, setLayers] = useState<{ previous: string | null; latest: string }>({ previous: null, latest: color });
  const [fade] = useState(() => new Animated.Value(1));

  // Keep the old colour underneath and fade the new one in over it.
  if (layers.latest !== color) setLayers({ previous: layers.latest, latest: color });

  useEffect(() => {
    fade.setValue(0);
    const animation = Animated.timing(fade, { toValue: 1, duration: durationMs, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished) setLayers((value) => ({ previous: null, latest: value.latest }));
    });
    return () => animation.stop();
  }, [durationMs, fade, layers.latest]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layers.previous ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: layers.previous, opacity: 0.16 }]} />
      ) : null}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: layers.latest, opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) },
        ]}
      />
    </View>
  );
}

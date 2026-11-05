import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { AtmosphereProfile } from '@/core/types';

import { CatCompanion } from './CatCompanion';
import { EnvironmentBackdrop } from './EnvironmentBackdrop';
import { AtmosphereEffects } from './AtmosphereEffects';
import type { SceneLook } from '../lib/sections';

/**
 * The world behind Now Playing: environment image + lighting, atmospheric
 * particles, a colour wash for the current section, and the companion cat.
 * Every layer follows `look`, which changes per song section; changes
 * crossfade over the profile's transition time.
 */
export function NowPlayingScene({
  look,
  atmosphere,
  playing,
  songKey,
  baseColor,
}: {
  look: SceneLook;
  /** Base profile with the current section's look applied. */
  atmosphere: AtmosphereProfile | null;
  playing: boolean;
  songKey: string;
  baseColor: string;
}) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <EnvironmentBackdrop look={look} playing={playing} />
      <AtmosphereEffects atmosphere={atmosphere} playing={playing} />
      <ColorWash color={look.primaryColorHex ?? baseColor} durationMs={look.transitionMs} />
      <CatCompanion
        behavior={look.catBehavior}
        environment={look.environment}
        energy={look.energy}
        playing={playing}
        songKey={songKey}
      />
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
      {layers.previous ? <View style={[StyleSheet.absoluteFill, { backgroundColor: layers.previous, opacity: 0.16 }]} /> : null}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: layers.latest, opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) },
        ]}
      />
    </View>
  );
}

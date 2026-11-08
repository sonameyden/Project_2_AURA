import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated as RNAnimated, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAudioReactivity } from '@/core/player';
import { useVisualTier } from '@/core/settings';
import type { AtmosphereProfile } from '@/core/types';

import type { SceneLook } from '../lib/sections';

const backgrounds: Record<AtmosphereProfile['environment'] | 'Common', number> = {
  Heaven: require('../../../../assets/images/now-playing/bg_heaven.jpg'),
  Nature: require('../../../../assets/images/now-playing/bg_nature.jpg'),
  Ocean: require('../../../../assets/images/now-playing/bg_ocean.jpg'),
  Dream: require('../../../../assets/images/now-playing/bg_dream.jpg'),
  Romantic: require('../../../../assets/images/now-playing/bg_romantic.jpg'),
  Melancholic: require('../../../../assets/images/now-playing/bg_melancholic.jpg'),
  Hopeful: require('../../../../assets/images/now-playing/bg_hope.jpg'),
  Energetic: require('../../../../assets/images/now-playing/bg_energetic.jpg'),
  Common: require('../../../../assets/images/now-playing/bg_common.jpg'),
};

/**
 * Lighting as a dark (or light) veil over the environment image, matching the
 * brightness factors in the Kotlin EnvironmentCanvas: Soft 0.85, Bright 1.15,
 * Dramatic 1.0 (with deeper edges), Fading pulsing between 0.7 and 1.0.
 */
const DARKEN: Record<AtmosphereProfile['lightingStyle'], number> = {
  Soft: 0.15,
  Bright: 0,
  Dramatic: 0.08,
  Fading: 0.2,
};
const BRIGHTEN: Record<AtmosphereProfile['lightingStyle'], number> = { Soft: 0, Bright: 0.12, Dramatic: 0, Fading: 0 };

export function EnvironmentBackdrop({ look, playing }: { look: SceneLook; playing: boolean }) {
  const tier = useVisualTier();
  const reducedMotion = tier.motion < 1;
  const source = backgrounds[look.environment ?? 'Common'];
  const [darken] = useState(() => new RNAnimated.Value(DARKEN[look.lightingStyle]));
  const [brighten] = useState(() => new RNAnimated.Value(BRIGHTEN[look.lightingStyle]));
  const [pulse] = useState(() => new RNAnimated.Value(0));

  useEffect(() => {
    const animation = RNAnimated.parallel([
      RNAnimated.timing(darken, {
        toValue: DARKEN[look.lightingStyle],
        duration: look.transitionMs,
        useNativeDriver: true,
      }),
      RNAnimated.timing(brighten, {
        toValue: BRIGHTEN[look.lightingStyle],
        duration: look.transitionMs,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [brighten, darken, look.lightingStyle, look.transitionMs]);

  // "Fading" lighting slowly breathes darker and back; static under reduced motion.
  useEffect(() => {
    if (look.lightingStyle !== 'Fading' || reducedMotion || !playing) {
      pulse.setValue(0);
      return;
    }
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1, duration: 3200, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [look.lightingStyle, playing, pulse, reducedMotion]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={source}
        contentFit="cover"
        cachePolicy="memory-disk"
        // Environment changes (between sections or songs) dissolve instead of cutting.
        transition={{ duration: look.transitionMs, effect: 'cross-dissolve' }}
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: darken }]} />
      <RNAnimated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000000', opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }) },
        ]}
      />
      <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: brighten }]} />
      {look.lightingStyle === 'Dramatic' ? (
        <LinearGradient
          colors={['#00000066', '#00000000', '#00000000', '#00000073']}
          locations={[0, 0.3, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {!reducedMotion ? <BeatBloom color={look.primaryColorHex ?? '#FFFFFF'} glow={tier.glow} /> : null}
    </View>
  );
}

/** A soft flash of the section colour on each detected beat (Kotlin's beat bloom). */
function BeatBloom({ color, glow }: { color: string; glow: number }) {
  const audio = useAudioReactivity();
  const bloom = useSharedValue(0);
  const fallbackBeat = useSharedValue(false);
  const beat = audio?.beat ?? fallbackBeat;

  useAnimatedReaction(
    () => beat.value,
    (isBeat, wasBeat) => {
      if (isBeat && !wasBeat) {
        bloom.value = withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 650 }));
      }
    },
  );

  const style = useAnimatedStyle(() => ({ opacity: bloom.value * 0.16 * glow }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

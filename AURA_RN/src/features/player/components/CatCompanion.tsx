import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAudioReactivity } from '@/core/player';
import { useSettings } from '@/core/settings';
import type { AtmosphereProfile, CatBehavior } from '@/core/types';

import { effectiveCatBehavior } from '../lib/cat-behavior';

const poses = {
  idle: require('../../../../assets/images/now-playing/cat_idle.png'),
  sleeping: require('../../../../assets/images/now-playing/cat_sleeping.png'),
  watching: require('../../../../assets/images/now-playing/cat_looking.png'),
  playing: require('../../../../assets/images/now-playing/cat_playing.png'),
};

const walkingFrames = [
  require('../../../../assets/images/now-playing/cat_walk_1.png'),
  require('../../../../assets/images/now-playing/cat_walk_2.png'),
  require('../../../../assets/images/now-playing/cat_walk_3.png'),
  require('../../../../assets/images/now-playing/cat_walk_4.png'),
  require('../../../../assets/images/now-playing/cat_walk_5.png'),
  require('../../../../assets/images/now-playing/cat_walk_6.png'),
  require('../../../../assets/images/now-playing/cat_walk_7.png'),
  require('../../../../assets/images/now-playing/cat_walk_8.png'),
];

const CAT_SIZE = 150;
const DEMO_ORDER: CatBehavior[] = ['Idle', 'Watching', 'Walking', 'Running', 'Playing', 'Dancing', 'Stretching', 'Sleeping'];

/** Where the cat can stand in each environment image (from CatCompanion.kt). */
const ANCHORS: Record<AtmosphereProfile['environment'], { y: number; start: number; width: number }> = {
  Melancholic: { y: 0.72, start: 0.3, width: 0.4 },
  Nature: { y: 0.7, start: 0.2, width: 0.6 },
  Ocean: { y: 0.72, start: 0.25, width: 0.5 },
  Dream: { y: 0.7, start: 0.3, width: 0.4 },
  Romantic: { y: 0.72, start: 0.25, width: 0.5 },
  Heaven: { y: 0.74, start: 0.3, width: 0.4 },
  Hopeful: { y: 0.74, start: 0.25, width: 0.5 },
  Energetic: { y: 0.72, start: 0.2, width: 0.6 },
};

/** Colour cast so the cat sits in the scene's light (CatCompanion.kt tint + exposure). */
const TINTS: Record<AtmosphereProfile['environment'], { color: string; opacity: number; shade: number }> = {
  Melancholic: { color: '#6B7FB7', opacity: 0.22, shade: 0.25 },
  Nature: { color: '#AED581', opacity: 0.14, shade: 0 },
  Ocean: { color: '#81D4FA', opacity: 0.16, shade: 0 },
  Dream: { color: '#CE93D8', opacity: 0.2, shade: 0.15 },
  Romantic: { color: '#EF9A9A', opacity: 0.16, shade: 0 },
  Heaven: { color: '#FFF59D', opacity: 0.14, shade: 0 },
  Hopeful: { color: '#FFCCBC', opacity: 0.14, shade: 0 },
  Energetic: { color: '#FFE082', opacity: 0.16, shade: 0 },
};

const isMoving = (state: CatBehavior) => state === 'Walking' || state === 'Running';

export function CatCompanion({
  behavior,
  environment,
  energy,
  playing,
  songKey,
}: {
  behavior: CatBehavior;
  environment: AtmosphereProfile['environment'] | null;
  energy: number;
  playing: boolean;
  /** Changes per song; a tapped demo behaviour resets with it. */
  songKey: string;
}) {
  const { settings } = useSettings();
  const { width, height } = useWindowDimensions();
  const reduced = settings.reducedMotion;
  const [override, setOverride] = useState<{ key: string; state: CatBehavior } | null>(null);
  const state = override?.key === songKey ? override.state : effectiveCatBehavior(behavior, energy, playing);
  const anchor = ANCHORS[environment ?? 'Dream'];
  const tint = TINTS[environment ?? 'Dream'];
  const moving = isMoving(state) && !reduced;

  const [frame, setFrame] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [dancePose, setDancePose] = useState(false);
  const position = useSharedValue(0.5);
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const hop = useSharedValue(0);

  // Walk-cycle sprite frames; faster for running and for higher energy.
  useEffect(() => {
    if (!moving) return;
    const interval = state === 'Running' ? 85 : Math.max(90, Math.round(140 / (1 + energy)));
    const timer = setInterval(() => setFrame((current) => (current + 1) % walkingFrames.length), interval);
    return () => clearInterval(timer);
  }, [energy, moving, state]);

  // Wander to a new spot every 2–5 seconds while walking or running.
  useEffect(() => {
    if (!moving) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const target = 0.15 + Math.random() * 0.7;
      const distance = Math.abs(target - position.value);
      const speed = (state === 'Running' ? 0.00055 : 0.00025) * (1 + energy);
      setFacingLeft(target < position.value);
      position.value = withTiming(target, { duration: Math.max(500, distance / speed), easing: Easing.linear });
      timer = setTimeout(step, 2000 + Math.random() * 3000);
    };
    step();
    return () => {
      clearTimeout(timer);
      cancelAnimation(position);
    };
  }, [energy, moving, position, state]);

  // Breathing, playful bob and dance sway; all off under reduced motion.
  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(sway);
    breath.value = 0;
    sway.value = 0;
    if (reduced) return;
    const breathMs = state === 'Sleeping' ? 1500 : Math.round(1100 / (1 + energy * 0.3));
    breath.value = withRepeat(withTiming(1, { duration: breathMs, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (state === 'Dancing' || state === 'Playing') {
      const swayMs = state === 'Dancing' ? Math.round(520 - energy * 180) : 640;
      sway.value = withRepeat(withTiming(1, { duration: swayMs, easing: Easing.inOut(Easing.quad) }), -1, true);
    }
  }, [breath, energy, reduced, state, sway]);

  // Dancing alternates between two poses in time with the music.
  useEffect(() => {
    if (state !== 'Dancing' || reduced) return;
    const timer = setInterval(() => setDancePose((current) => !current), Math.round(560 - energy * 200));
    return () => clearInterval(timer);
  }, [energy, reduced, state]);

  // A little hop on every detected beat while dancing.
  const audio = useAudioReactivity();
  const fallbackBeat = useSharedValue(false);
  const beat = audio?.beat ?? fallbackBeat;
  const hopsOnBeat = state === 'Dancing' && !reduced;
  useAnimatedReaction(
    () => beat.value,
    (isBeat, wasBeat) => {
      if (hopsOnBeat && isBeat && !wasBeat) {
        hop.value = withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 240 }));
      }
    },
    [hopsOnBeat],
  );

  const bodyStyle = useAnimatedStyle(() => {
    const dancing = state === 'Dancing';
    const playful = state === 'Playing';
    const bob = dancing ? hop.value * 14 + sway.value * 4 : playful ? sway.value * 6 * Math.max(0.4, energy) : 0;
    const rotate = dancing ? (sway.value - 0.5) * 16 : playful ? (sway.value - 0.5) * 8 * Math.max(0.4, energy) : 0;
    const breathScale = state === 'Sleeping' ? 0.015 : 0.01;
    return {
      transform: [
        { translateY: -bob + (1 - breath.value) * 2 },
        { rotate: `${rotate}deg` },
        { scaleX: facingLeft && moving ? -1 : 1 },
        { scaleY: 1 + breath.value * breathScale - hop.value * 0.04 },
      ],
    };
  });

  const placement = useAnimatedStyle(() => ({
    transform: [{ translateX: width * (anchor.start + anchor.width * position.value) - CAT_SIZE / 2 }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.32 - hop.value * 0.12,
    transform: [{ scaleX: 1 - hop.value * 0.2 }],
  }));

  const image = moving
    ? walkingFrames[frame]
    : state === 'Sleeping'
      ? poses.sleeping
      : state === 'Watching'
        ? poses.watching
        : state === 'Playing'
          ? poses.playing
          : state === 'Dancing'
            ? dancePose
              ? poses.playing
              : poses.watching
            : isMoving(state)
              ? walkingFrames[0]
              : poses.idle;

  if (!settings.showCat) return null;

  const cycle = () => {
    const index = DEMO_ORDER.indexOf(state);
    setOverride({ key: songKey, state: DEMO_ORDER[(index + 1) % DEMO_ORDER.length] });
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="box-none"
        style={[{ position: 'absolute', left: 0, top: height * anchor.y - CAT_SIZE * 0.9, width: CAT_SIZE, height: CAT_SIZE }, placement]}>
        <Animated.View style={[styles.shadow, shadowStyle]} />
        <Pressable
          onPress={cycle}
          accessibilityRole="button"
          accessibilityLabel={`Companion cat is ${state.toLowerCase()}. Tap to change what it does.`}
          style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
            <Image source={image} contentFit="contain" style={StyleSheet.absoluteFill} />
            {/* Silhouette tint and shade so the cat picks up the scene's light. */}
            <Image source={image} contentFit="contain" tintColor={tint.color} style={[StyleSheet.absoluteFill, { opacity: tint.opacity }]} />
            {tint.shade > 0 ? (
              <Image source={image} contentFit="contain" tintColor="#000000" style={[StyleSheet.absoluteFill, { opacity: tint.shade }]} />
            ) : null}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    bottom: CAT_SIZE * 0.06,
    alignSelf: 'center',
    width: CAT_SIZE * 0.62,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#000000',
  },
});

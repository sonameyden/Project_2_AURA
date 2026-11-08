import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

/** Behaviours a tap cycles through (walking/running look like other poses now the cat stays put). */
const DEMO_ORDER: CatBehavior[] = ['Idle', 'Watching', 'Playing', 'Dancing', 'Sleeping'];

/** A little larger than the Kotlin app's cat (CatCompanion.kt: 140.dp). Shadow and placement scale with it. */
const CAT_SIZE = 160;
/** The cat art's feet sit this far down its box (Kotlin draws it at anchor - 0.9 × size). */
const FEET_Y = CAT_SIZE * 0.9;
/**
 * How far the stage tucks under the player controls below it, so the cat
 * stands on the ground just behind the seek bar, as in the Kotlin app.
 */
const TUCK_UNDER_CONTROLS = Math.round(CAT_SIZE * 0.32);

/**
 * Kotlin's contact shadow (an oval 45% × 12% of the cat at 25% black),
 * softened: stacked ovals fade towards the edge instead of one hard ellipse.
 */
const SHADOW_W = CAT_SIZE * 0.45;
const SHADOW_H = CAT_SIZE * 0.12;
const SHADOW_LAYERS = [
  { w: SHADOW_W * 1.4, h: SHADOW_H * 1.5, alpha: 0.06 },
  { w: SHADOW_W * 1.12, h: SHADOW_H * 1.15, alpha: 0.08 },
  { w: SHADOW_W * 0.86, h: SHADOW_H * 0.8, alpha: 0.11 },
  { w: SHADOW_W * 0.55, h: SHADOW_H * 0.5, alpha: 0.12 },
];

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
  // The cat stays in one place, centred on its stage: it reacts to the music
  // with its pose, breathing and dancing, but never wanders around.
  const { settings } = useSettings();
  const reduced = settings.reducedMotion;
  const [override, setOverride] = useState<{ key: string; state: CatBehavior } | null>(null);
  const state = override?.key === songKey ? override.state : effectiveCatBehavior(behavior, energy, playing);
  const tint = TINTS[environment ?? 'Dream'];

  const [dancePose, setDancePose] = useState(false);
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const hop = useSharedValue(0);

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
        { scaleY: 1 + breath.value * breathScale - hop.value * 0.04 },
      ],
    };
  });

  // The shadow tightens and fades as the cat lifts off the ground, and breathes with it.
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 1 - hop.value * 0.45,
    transform: [{ scaleX: (1 + breath.value * 0.012) * (1 - hop.value * 0.18) }],
  }));
  // Kotlin adds a darker contact spot where the paws and tail touch the ground.
  const pawContact = state === 'Idle' || state === 'Watching';

  // Walking shows the standing pose and running the playful one, in place.
  const image =
    state === 'Sleeping'
      ? poses.sleeping
      : state === 'Watching'
        ? poses.watching
        : state === 'Playing' || state === 'Running'
          ? poses.playing
          : state === 'Dancing'
            ? dancePose
              ? poses.playing
              : poses.watching
            : poses.idle;

  if (!settings.showCat) return null;

  const cycle = () => {
    const index = DEMO_ORDER.indexOf(state);
    setOverride({ key: songKey, state: DEMO_ORDER[(index + 1) % DEMO_ORDER.length] });
  };

  // Poses dissolve into each other instead of snapping.
  const poseTransition = 240;

  return (
    <View
      pointerEvents="box-none"
      style={{ height: CAT_SIZE, alignSelf: 'stretch', alignItems: 'center', marginBottom: -TUCK_UNDER_CONTROLS }}>
      <View pointerEvents="box-none" style={{ width: CAT_SIZE, height: CAT_SIZE }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shadowStyle]}>
          {SHADOW_LAYERS.map((layer) => (
            <Oval key={layer.w} width={layer.w} height={layer.h} centerX={CAT_SIZE / 2} centerY={FEET_Y} alpha={layer.alpha} />
          ))}
          {pawContact ? (
            <Oval
              width={SHADOW_W * 0.22}
              height={SHADOW_H * 0.6}
              centerX={CAT_SIZE / 2 - SHADOW_W * 0.3}
              centerY={FEET_Y}
              alpha={0.14}
            />
          ) : null}
        </Animated.View>
        <Pressable
          onPress={cycle}
          accessibilityRole="button"
          accessibilityLabel={`Companion cat is ${state.toLowerCase()}. Tap to change what it does.`}
          style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
            <Image source={image} contentFit="contain" transition={poseTransition} style={StyleSheet.absoluteFill} />
            {/* Silhouette tint and shade so the cat picks up the scene's light. */}
            <Image
              source={image}
              contentFit="contain"
              transition={poseTransition}
              tintColor={tint.color}
              style={[StyleSheet.absoluteFill, { opacity: tint.opacity }]}
            />
            {tint.shade > 0 ? (
              <Image
                source={image}
                contentFit="contain"
                transition={poseTransition}
                tintColor="#000000"
                style={[StyleSheet.absoluteFill, { opacity: tint.shade }]}
              />
            ) : null}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A soft black ellipse. React Native's borderRadius turns a wide box into a
 * capsule, so this draws a circle and squashes it vertically instead.
 */
function Oval({
  width,
  height,
  centerX,
  centerY,
  alpha,
}: {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  alpha: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: centerX - width / 2,
        top: centerY - width / 2,
        width,
        height: width,
        borderRadius: width / 2,
        backgroundColor: `rgba(0, 0, 0, ${alpha})`,
        transform: [{ scaleY: height / width }],
      }}
    />
  );
}

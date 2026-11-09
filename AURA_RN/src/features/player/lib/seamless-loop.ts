import { Animated, Easing, type EasingFunction } from 'react-native';

/**
 * Loops `value` from 0 to 1 forever, carrying on from wherever it is now.
 *
 * `Animated.loop` on the native driver remembers the value it started from and
 * replays every cycle from there. So a loop restarted part-way through (after a
 * speed change, pause/resume or the reduce-motion setting) only ever covered
 * the last part of its path: particles stuck low on the screen, rings jumping
 * back mid-turn. Here the current pass is finished first, then the value is
 * reset to 0 and full cycles loop from there.
 *
 * Returns a function that stops the loop (use it as an effect cleanup).
 */
export function loopFromCurrent(
  value: Animated.Value,
  {
    duration,
    easing = Easing.linear,
    useNativeDriver = true,
  }: {
    duration: number;
    /** Easing of each full cycle; linear by default. */ easing?: EasingFunction;
    useNativeDriver?: boolean;
  },
): () => void {
  let stopped = false;
  let running: Animated.CompositeAnimation | null = null;

  value.stopAnimation((now) => {
    if (stopped) return;
    const from = ((now % 1) + 1) % 1;
    value.setValue(from);
    running = Animated.timing(value, {
      toValue: 1,
      duration: Math.max(1, Math.round((1 - from) * duration)),
      easing: Easing.linear,
      useNativeDriver,
    });
    running.start(({ finished }) => {
      if (!finished || stopped) return;
      value.setValue(0);
      running = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver }));
      running.start();
    });
  });

  return () => {
    stopped = true;
    running?.stop();
  };
}

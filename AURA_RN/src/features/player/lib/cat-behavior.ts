import type { CatBehavior } from '@/core/types';

/**
 * The behaviour actually shown: the section's behaviour adjusted for energy
 * (Kotlin effectiveState) and for whether music is playing at all.
 */
export function effectiveCatBehavior(behavior: CatBehavior, energy: number, playing: boolean): CatBehavior {
  if (!playing) return behavior === 'Sleeping' ? 'Sleeping' : behavior === 'Watching' ? 'Watching' : 'Idle';
  if (energy < 0.2 && (behavior === 'Walking' || behavior === 'Running' || behavior === 'Dancing')) return 'Idle';
  if (energy > 0.8 && behavior === 'Idle') return 'Playing';
  return behavior;
}

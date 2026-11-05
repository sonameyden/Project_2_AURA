/**
 * Pure queue rules, kept free of React and audio so they are easy to test.
 * Mirrors AuraPlayer.kt in the Kotlin app: OFF stops at the ends, ALL wraps,
 * ONE replays the current song when it finishes on its own.
 */
export type RepeatMode = 'off' | 'all' | 'one';

export const nextRepeatMode = (mode: RepeatMode): RepeatMode =>
  mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off';

/** Index to play after `index` when the user presses next (or a track ends). */
export function nextQueueIndex(index: number, length: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (index < length - 1) return index + 1;
  return repeat === 'all' ? 0 : null;
}

/** Index to play before `index` when the user presses previous. */
export function previousQueueIndex(index: number, length: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (index > 0) return index - 1;
  return repeat === 'all' ? length - 1 : null;
}

/** What happens when a track reaches its natural end. */
export function indexAfterTrackEnds(index: number, length: number, repeat: RepeatMode): number | null {
  if (repeat === 'one') return index;
  return nextQueueIndex(index, length, repeat);
}

/**
 * Returns a shuffled copy with the item at `keepIndex` moved to the front, so
 * the current song keeps playing and the rest of the queue is randomised.
 */
export function shuffleKeepingCurrent<T>(items: readonly T[], keepIndex: number, random = Math.random): T[] {
  if (items.length === 0) return [];
  const current = items[keepIndex];
  const rest = items.filter((_, index) => index !== keepIndex);
  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [rest[index], rest[swap]] = [rest[swap], rest[index]];
  }
  return current === undefined ? rest : [current, ...rest];
}

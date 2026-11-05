import { describe, expect, it } from '@jest/globals';

import {
  indexAfterTrackEnds,
  nextQueueIndex,
  nextRepeatMode,
  previousQueueIndex,
  shuffleKeepingCurrent,
} from '../queue';

describe('queue rules', () => {
  it('stops at the end with repeat off and wraps with repeat all', () => {
    expect(nextQueueIndex(2, 3, 'off')).toBeNull();
    expect(nextQueueIndex(2, 3, 'all')).toBe(0);
    expect(previousQueueIndex(0, 3, 'off')).toBeNull();
    expect(previousQueueIndex(0, 3, 'all')).toBe(2);
  });

  it('replays the song when it ends with repeat one, otherwise advances', () => {
    expect(indexAfterTrackEnds(1, 3, 'one')).toBe(1);
    expect(indexAfterTrackEnds(1, 3, 'off')).toBe(2);
    expect(indexAfterTrackEnds(2, 3, 'off')).toBeNull();
  });

  it('cycles repeat modes off → all → one → off', () => {
    expect(nextRepeatMode('off')).toBe('all');
    expect(nextRepeatMode('all')).toBe('one');
    expect(nextRepeatMode('one')).toBe('off');
  });

  it('shuffles without losing songs and keeps the current one first', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    let seed = 0.3;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const shuffled = shuffleKeepingCurrent(items, 2, random);
    expect(shuffled[0]).toBe('c');
    expect([...shuffled].sort()).toEqual(items);
  });
});

import { describe, expect, it } from '@jest/globals';

import type { AtmosphereProfile } from '@/core/types';

import { effectiveCatBehavior } from '../lib/cat-behavior';
import { lookFor, profileWithLook, sectionIndexAt } from '../lib/sections';

const profile: AtmosphereProfile = {
  songId: 's1',
  emotion: 'hopeful',
  energy: 0.8,
  valence: 0.7,
  environment: 'Hopeful',
  primaryColorHex: '#336699',
  secondaryColorHexes: ['#FFAA00'],
  lightingStyle: 'Soft',
  particleStyle: 'Stars',
  kaleidoscopeStyle: 'Floral',
  catBehavior: 'Idle',
  transitionStyle: 'Sharp',
  resonantLyricLineIds: [],
  sectionProfiles: [
    { section: 'Intro', startTimeMs: 0, intensityMultiplier: 0.6, lightingStyle: 'Soft', catBehavior: 'Watching' },
    {
      section: 'Chorus',
      startTimeMs: 30_000,
      intensityMultiplier: 1.2,
      environment: 'Energetic',
      primaryColorHex: '#FFAA00',
      lightingStyle: 'Bright',
      catBehavior: 'Dancing',
    },
  ],
};

describe('section timeline', () => {
  it('switches half a transition before the boundary', () => {
    // Sharp transitions take 600 ms, so the chorus look starts at 29.7 s.
    expect(sectionIndexAt(profile.sectionProfiles, 29_600, 300)).toBe(0);
    expect(sectionIndexAt(profile.sectionProfiles, 29_800, 300)).toBe(1);
  });

  it('applies the section look over the base profile', () => {
    const look = lookFor(profile, 45_000, 'song');
    expect(look).toMatchObject({
      section: 'Chorus',
      environment: 'Energetic',
      catBehavior: 'Dancing',
      lightingStyle: 'Bright',
    });
    expect(look.energy).toBeCloseTo(0.96);
    expect(profileWithLook(profile, look)?.primaryColorHex).toBe('#FFAA00');
  });

  it('falls back to the base profile when there are no sections', () => {
    const look = lookFor({ ...profile, sectionProfiles: [] }, 10_000, 'song');
    expect(look).toMatchObject({ section: null, environment: 'Hopeful', catBehavior: 'Idle', energy: 0.8 });
  });

  it('changes key between sections and songs so layers crossfade', () => {
    expect(lookFor(profile, 1_000, 'a').key).not.toBe(lookFor(profile, 40_000, 'a').key);
    expect(lookFor(profile, 1_000, 'a').key).not.toBe(lookFor(profile, 1_000, 'b').key);
  });
});

describe('cat behaviour', () => {
  it('rests when the music is paused or quiet and plays when it is loud', () => {
    expect(effectiveCatBehavior('Dancing', 0.9, false)).toBe('Idle');
    expect(effectiveCatBehavior('Sleeping', 0.9, false)).toBe('Sleeping');
    expect(effectiveCatBehavior('Running', 0.1, true)).toBe('Idle');
    expect(effectiveCatBehavior('Idle', 0.9, true)).toBe('Playing');
    expect(effectiveCatBehavior('Dancing', 0.9, true)).toBe('Dancing');
  });
});

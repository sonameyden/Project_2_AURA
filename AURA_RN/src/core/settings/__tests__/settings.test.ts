import { describe, expect, it, jest } from '@jest/globals';

import { parseStored, textScaleFor } from '../settings-context';

// Hoisted above the imports by babel-jest.
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

describe('saved settings', () => {
  it('keeps valid values and drops tampered ones', () => {
    expect(
      parseStored(JSON.stringify({ visualIntensity: 'high', textSize: 'huge', reducedMotion: 'yes', showCat: false })),
    ).toEqual({ visualIntensity: 'high', showCat: false });
  });

  it('ignores missing or corrupt storage', () => {
    expect(parseStored(null)).toEqual({});
    expect(parseStored('{not json')).toEqual({});
  });

  it('scales text from small to extra large', () => {
    expect(textScaleFor.small).toBeLessThan(1);
    expect(textScaleFor.extraLarge).toBeGreaterThan(textScaleFor.large);
  });
});

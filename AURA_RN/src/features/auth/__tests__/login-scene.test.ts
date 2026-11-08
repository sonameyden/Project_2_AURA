import { describe, expect, it } from '@jest/globals';

import { AURA_SKSL, horizonY } from '../lib/aura-shader';
import { CAT_IMAGE, CAT_MAX_HEIGHT, CAT_MIN_HEIGHT, CAT_X, catPlacement } from '../lib/login-scene';

describe('login scene', () => {
  it('centres the shader backlight on the cat', () => {
    expect(CAT_X).toBe(0.24);
    expect(AURA_SKSL).toContain('float2((uv.x - 0.24) * aspect');
  });

  it('keeps the JS horizon identical to the shader horizon', () => {
    expect(AURA_SKSL).toContain(
      'float horizon = 0.875 + 0.022 * sin(uv.x * 5.0 + 0.7) + 0.012 * sin(uv.x * 11.0 + 2.1);',
    );
    expect(horizonY(0)).toBeCloseTo(0.875 + 0.022 * Math.sin(0.7) + 0.012 * Math.sin(2.1));
  });

  it.each([
    [360, 740],
    [390, 845],
    [430, 932],
    [800, 1280],
  ])('seats the cat’s paws on the ridge on a %ix%i screen', (width, height) => {
    const box = catPlacement(width, height);
    const paws = box.top + CAT_IMAGE.bottomY * box.height;
    const ridge = horizonY(CAT_X) * height;
    expect(paws).toBeCloseTo(ridge + 2, 5);
    // The cat's body is where CAT_X says, and it stays a sensible size.
    expect(box.left + CAT_IMAGE.bodyCenterX * box.width).toBeCloseTo(CAT_X * width, 5);
    const visible = (CAT_IMAGE.bottomY - CAT_IMAGE.topY) * box.height;
    expect(visible).toBeGreaterThanOrEqual(CAT_MIN_HEIGHT - 0.001);
    expect(visible).toBeLessThanOrEqual(CAT_MAX_HEIGHT + 0.001);
  });
});

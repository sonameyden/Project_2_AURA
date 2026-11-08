import { horizonY } from './aura-shader';

/**
 * Where the companion cat sits on the login horizon. Measured from
 * assets/images/now-playing/cat_looking.png (1408 × 768, transparent): the cat
 * spans 23.6–63.2% of the width, its body is centred near 48%, and its lowest
 * point (paws and tail) is at 96.4% of the height.
 */
export const CAT_IMAGE = { aspect: 1408 / 768, bodyCenterX: 0.48, topY: 0.089, bottomY: 0.964 } as const;

/**
 * Horizontal position of the cat's body, as a fraction of the screen width (left side, gazing
 * across the sky). The shader's backlight halo is centred on the same spot (0.24).
 */
export const CAT_X = 0.24;

/** The cat's visible height, as a fraction of the screen height (clamped for very small or large screens). */
const CAT_HEIGHT = 0.17;
export const CAT_MIN_HEIGHT = 110;
export const CAT_MAX_HEIGHT = 170;

/** The image box (left, top, width, height in px) that seats the cat's paws on the ridge. */
export function catPlacement(screenWidth: number, screenHeight: number) {
  const visibleHeight = Math.min(CAT_MAX_HEIGHT, Math.max(CAT_MIN_HEIGHT, screenHeight * CAT_HEIGHT));
  const height = visibleHeight / (CAT_IMAGE.bottomY - CAT_IMAGE.topY);
  const width = height * CAT_IMAGE.aspect;
  const ridge = horizonY(CAT_X) * screenHeight;
  // Sink the paws 2px into the hill so the cat sits on it rather than hovering.
  const top = ridge - CAT_IMAGE.bottomY * height + 2;
  const left = CAT_X * screenWidth - CAT_IMAGE.bodyCenterX * width;
  return { left, top, width, height };
}

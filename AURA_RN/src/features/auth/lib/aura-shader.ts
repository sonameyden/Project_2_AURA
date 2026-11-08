/**
 * Height of the horizon (as a fraction of the screen height, from the top) at
 * horizontal position `x` (0 = left edge, 1 = right edge). Mirrors the
 * `horizon` line in the shader below, so the cat can sit exactly on the ridge.
 */
export function horizonY(x: number) {
  return 0.875 + 0.022 * Math.sin(x * 5.0 + 0.7) + 0.012 * Math.sin(x * 11.0 + 2.1);
}

/**
 * AURA's login/sign-up background: a slow aurora of the brand colours
 * (purple, blue, cyan) drifting over the app's dark background. It's a Skia
 * runtime shader (SkSL), drawn entirely on the GPU.
 *
 * Uniforms:
 * - resolution: canvas size in pixels
 * - time: seconds (already slowed down for reduced motion)
 * - glow: 0..1, brightens the aurora while the person types or signs in
 */
export const AURA_SKSL = `
uniform float2 resolution;
uniform float time;
uniform float glow;

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(float2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + float2(1.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution;
  float aspect = resolution.x / resolution.y;
  // Several aurora shapes fit on screen, so the overall brightness stays steady over time.
  float2 p = float2(uv.x * aspect, uv.y) * 3.4;
  float t = time * 0.06;

  // Domain warping makes the noise flow like curtains of light.
  float2 q = float2(fbm(p + float2(0.0, t)), fbm(p + float2(5.2, -t * 0.8)));
  // Sampled finer than the warp and thresholded gently, so the screen's overall
  // brightness doesn't drift between near-black and bright as the noise moves.
  float n = fbm(p * 1.5 + 1.8 * q + float2(t * 0.6, -t * 0.4));
  float band = smoothstep(0.18, 0.76, n);
  // Vertical ripples give the light the look of aurora curtains.
  float curtain = 0.5 + 0.5 * sin(p.x * 7.0 + q.y * 6.0 + t * 2.5);
  band *= mix(0.55, 1.0, curtain);

  float3 base = float3(0.047, 0.051, 0.071);   // #0C0D12, the app background
  float3 purple = float3(0.659, 0.333, 0.969); // #A855F7
  float3 blue = float3(0.231, 0.510, 0.965);   // #3B82F6
  float3 cyan = float3(0.133, 0.827, 0.933);   // #22D3EE
  float3 tint = mix(purple, blue, smoothstep(0.25, 0.8, q.x));
  tint = mix(tint, cyan, smoothstep(0.55, 0.95, q.y) * 0.55);

  // Brightest near the top, fading into the dark behind the form.
  // (smoothstep needs edge0 < edge1, so the fade is inverted with 1 - smoothstep.)
  float vertical = 1.0 - smoothstep(0.0, 0.95, uv.y);
  float intensity = band * (0.2 + 0.8 * vertical) * (0.85 + 0.5 * glow);
  float3 color = base + tint * intensity * 1.5;
  // A faint wash of colour across the sky, so the top never goes fully black.
  color += tint * 0.1 * vertical * (1.0 + glow);

  // A sparse starfield that twinkles in the dark areas.
  float2 cell = floor(fragCoord / 3.0);
  float star = step(0.9988, hash(cell));
  float twinkle = 0.5 + 0.5 * sin(time * 1.3 + hash(cell + 7.0) * 40.0);
  color += star * twinkle * 0.55 * (1.0 - band) * (0.4 + 0.6 * vertical);

  // A soft backlight in the sky behind the companion cat (see CAT_X in login-scene.ts),
  // so its dark silhouette stands out instead of disappearing into the dark lower sky.
  float2 haloOffset = float2((uv.x - 0.24) * aspect, uv.y - 0.79);
  float halo = exp(-dot(haloOffset, haloOffset) * 26.0);
  color += mix(tint, float3(0.75, 0.68, 1.0), 0.35) * halo * (0.5 + 0.25 * glow);

  // Horizon: dark rolling hills along the bottom (see horizonY below; keep the two in sync),
  // with the aurora's light catching the ridge and fading into the ground.
  float horizon = 0.875 + 0.022 * sin(uv.x * 5.0 + 0.7) + 0.012 * sin(uv.x * 11.0 + 2.1);
  float ground = smoothstep(horizon - 0.0015, horizon + 0.0015, uv.y);
  float depth = clamp((uv.y - horizon) * 12.0, 0.0, 1.0);
  float3 groundColor = mix(float3(0.035, 0.035, 0.06) + tint * 0.06, float3(0.012, 0.012, 0.02), depth);
  color = mix(color, groundColor, ground);
  float ridge = exp(-abs(uv.y - horizon) * 320.0);
  color += tint * ridge * (0.22 + 0.25 * glow);

  // Gentle vignette.
  float2 c = uv - 0.5;
  color *= 1.0 - dot(c, c) * 0.9;
  return half4(half3(color), 1.0);
}
`;

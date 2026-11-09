/**
 * React Native port of the native app's `KaleidoscopeLayer.kt`
 * (AURA/feature/nowplaying/.../visuals/KaleidoscopeLayer.kt).
 *
 * The Compose version draws imperatively into a full-screen DrawScope every
 * frame. This port does the same thing: a Reanimated frame callback runs on
 * the UI thread, advances the exact same per-frame state (accumulated
 * rotation, fast-attack/slow-release amplitude smoothing, beat bloom,
 * sparkle decay) and records an SkPicture with the same transforms, shapes,
 * gradients and alphas. Every constant below is copied from the Kotlin file;
 * if you tune one side, tune the other.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { Easing, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import type {
  PaintStyle,
  SkCanvas,
  SkColor,
  SkPaint,
  SkPicture,
  SkShader,
  SkSize,
  StrokeCap,
  TileMode,
} from '@shopify/react-native-skia';

import { useAudioReactivity } from '@/core/player';
import { nativeSkiaAvailable, type SkiaModule } from '@/core/skia';
import { useVisualTier } from '@/core/settings';
import type { AtmosphereProfile } from '@/core/types';

import { loopFromCurrent } from '../lib/seamless-loop';

type KaleidoscopeStyle = AtmosphereProfile['kaleidoscopeStyle'];

export type KaleidoscopeProps = {
  atmosphere: AtmosphereProfile | null;
  playing: boolean;
  currentTime: number;
  duration: number;
};

// Compose's default `tween` easing (FastOutSlowInEasing).
const FAST_OUT_SLOW_IN = Easing.bezier(0.4, 0, 0.2, 1);
// Ring/particle counts come from the visual-intensity setting (useVisualTier).
const DEFAULT_ENERGY = 0.35;
const DEFAULT_VALENCE = 0.5;
/** Vertical centre of the kaleidoscope, as a fraction of the screen height. */
const KALEIDOSCOPE_CENTER_Y = 0.28;

export function KaleidoscopeLayer(props: KaleidoscopeProps) {
  const [skia, setSkia] = useState<SkiaModule | null>(null);
  const [failed, setFailed] = useState(() => !nativeSkiaAvailable());

  useEffect(() => {
    if (failed) {
      if (Platform.OS !== 'web') {
        console.warn(
          'Skia is not compiled into this build. Rebuild the dev client (npx expo run:android) to enable the kaleidoscope canvas.',
        );
      }
      return;
    }
    let active = true;
    import('@shopify/react-native-skia')
      .then((module) => {
        if (!active) return;
        if (!module.Skia || typeof module.Skia.PictureRecorder !== 'function') {
          setFailed(true);
          return;
        }
        setSkia(module);
      })
      .catch((error: unknown) => {
        console.error('Skia failed to load; using the fallback kaleidoscope.', error);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [failed]);

  if (failed) return <FallbackKaleidoscope {...props} />;
  if (!skia) return null;
  return <SkiaKaleidoscope {...props} skia={skia} />;
}

// ---------------------------------------------------------------------------
// Skia implementation
// ---------------------------------------------------------------------------

type SkiaApi = SkiaModule['Skia'];
type Lab = [number, number, number, number]; // Oklab L, a, b + alpha
type Sparkle = { x: number; y: number; life: number };
type Particle = { angle: number; baseRadius: number; speed: number; size: number; phase: number };
type MotifKind = 'Petal' | 'Leaf' | 'Wave' | 'Shard' | 'RibbonLong' | 'Flower';

type Kit = {
  Sk: SkiaApi;
  canvas: SkCanvas;
  paint: SkPaint;
  fill: PaintStyle;
  stroke: PaintStyle;
  butt: StrokeCap;
  round: StrokeCap;
  clamp: TileMode;
};

// ---- Maths & colour --------------------------------------------------------
// Order matters below: the worklets Babel plugin turns every 'worklet'
// function into a variable that captures the functions it calls at the point
// it is defined, so normal function hoisting does not apply. Keep each helper
// above the worklets that use it.

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function degrees(radians: number) {
  'worklet';
  return radians * (180 / Math.PI);
}

function easeOutCubic(x: number) {
  'worklet';
  const inv = 1 - x;
  return 1 - inv * inv * inv;
}

// ---- Paint helpers --------------------------------------------------------

function rgba(r: number, g: number, b: number, a: number): SkColor {
  'worklet';
  return Float32Array.of(r, g, b, clamp(a, 0, 1));
}

/** Compose `Color.copy(alpha = …)`: replaces (not multiplies) the alpha. */
function withAlpha(color: SkColor, alpha: number): SkColor {
  'worklet';
  return rgba(color[0], color[1], color[2], alpha);
}

function solid(kit: Kit, style: PaintStyle, color: SkColor, strokeWidth = 0, cap?: StrokeCap) {
  'worklet';
  const paint = kit.paint;
  paint.setShader(null);
  paint.setStyle(style);
  paint.setColor(color);
  paint.setStrokeWidth(strokeWidth);
  paint.setStrokeCap(cap ?? kit.butt);
}

function shaded(kit: Kit, style: PaintStyle, shader: SkShader, alpha: number, strokeWidth = 0, cap?: StrokeCap) {
  'worklet';
  const paint = kit.paint;
  paint.setColor(rgba(0, 0, 0, 1));
  paint.setAlphaf(clamp(alpha, 0, 1));
  paint.setShader(shader);
  paint.setStyle(style);
  paint.setStrokeWidth(strokeWidth);
  paint.setStrokeCap(cap ?? kit.butt);
}

type Rgba = [number, number, number, number];

/** Same rules as the native `buildColorPalette`, including its defaults. */
function buildColorPalette(primaryHex: string | undefined, secondaryHexes: string[]): Rgba[] {
  const parsed = [primaryHex, ...secondaryHexes].map(parseHexColor).filter((color): color is Rgba => color !== null);
  if (parsed.length === 0) {
    return [parseHexColor('#A79AC7')!, parseHexColor('#E9E4DE')!, parseHexColor('#A79AC7')!];
  }
  while (parsed.length < 3) parsed.push(parsed[0]);
  return parsed;
}

/** Android `String.toColorInt()` hex forms: #RRGGBB and #AARRGGBB. */
function parseHexColor(value: string | undefined): Rgba | null {
  if (!value) return null;
  const match = /^#([\da-f]{6}|[\da-f]{8})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1];
  const hasAlpha = hex.length === 8;
  const offset = hasAlpha ? 2 : 0;
  const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16) / 255;
  return [channel(offset), channel(offset + 2), channel(offset + 4), hasAlpha ? channel(0) : 1];
}

// animateColorAsState interpolates in Oklab; do the same so colour changes
// between songs blend identically.
function rgbaToLab([r, g, b, a]: Rgba): Lab {
  'worklet';
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    a,
  ];
}

function labToColor([L, A, B, alpha]: Lab): SkColor {
  'worklet';
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  const toSrgb = (c: number) => clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055, 0, 1);
  return rgba(
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    alpha,
  );
}

function lerpLabs(from: Lab[], to: Lab[], t: number): Lab[] {
  'worklet';
  const result: Lab[] = [];
  for (let index = 0; index < to.length; index++) {
    const start = from[index] ?? to[index];
    const end = to[index];
    result.push([
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
      start[2] + (end[2] - start[2]) * t,
      start[3] + (end[3] - start[3]) * t,
    ]);
  }
  return result;
}

function labsToColors(labs: Lab[]): SkColor[] {
  'worklet';
  return labs.map(labToColor);
}

// ---- Style tables (identical to the Kotlin extension functions) ----------

function motifSequence(style: KaleidoscopeStyle): MotifKind[] {
  'worklet';
  switch (style) {
    case 'SoftOrganic':
      return ['Petal', 'Leaf', 'Shard'];
    case 'FluidSymmetry':
      return ['Petal', 'Flower', 'Shard'];
    case 'WaveLike':
      return ['Wave', 'Leaf', 'Shard'];
    case 'SharpGeometric':
      return ['Shard', 'Flower', 'Leaf'];
    case 'DarkReflective':
      return ['RibbonLong', 'Leaf', 'Shard'];
    case 'Floral':
      return ['Flower', 'Petal', 'Shard'];
  }
}

function symmetryCount(style: KaleidoscopeStyle): number {
  'worklet';
  switch (style) {
    case 'SoftOrganic':
      return 8;
    case 'FluidSymmetry':
      return 11;
    case 'WaveLike':
      return 9;
    case 'SharpGeometric':
      return 14;
    case 'DarkReflective':
      return 7;
    case 'Floral':
      return 11;
  }
}

/**
 * Song-position -> complexity curve. Sparse on intro/outro, builds through
 * verse/pre-chorus, peaks at chorus, dips on bridge.
 */
function sectionComplexity(progress: number) {
  'worklet';
  const pos = clamp(progress, 0, 1) * 100;
  if (pos < 12) return 0.35 + (pos / 12) * 0.15;
  if (pos < 35) return 0.5 + ((pos - 12) / 23) * 0.15;
  if (pos < 55) return 0.65 + ((pos - 35) / 20) * 0.2;
  if (pos < 80) return 1;
  if (pos < 92) return 0.55;
  return Math.max(0.4 - ((pos - 92) / 8) * 0.15, 0.2);
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    baseRadius: 50 + Math.random() * 210,
    speed: 0.1 + Math.random() * 0.3,
    size: 0.8 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawSpecular(kit: Kit, x: number, y: number, size: number, alpha: number) {
  'worklet';
  if (alpha <= 0) return;
  solid(kit, kit.stroke, rgba(1, 1, 1, alpha * 0.9), 0.8);
  kit.canvas.drawLine(x - size, y, x + size, y, kit.paint);
  kit.canvas.drawLine(x, y - size, x, y + size, kit.paint);
}

function drawSecondaryGeom(kit: Kit, color: SkColor, radius: number, size: number, alpha: number) {
  'worklet';
  if (alpha <= 0) return;
  const path = kit.Sk.PathBuilder.Make();
  path.moveTo(0, -radius - size);
  path.lineTo(size * 0.7, -radius);
  path.lineTo(0, -radius + size);
  path.lineTo(-size * 0.7, -radius);
  path.close();
  solid(kit, kit.stroke, withAlpha(color, alpha), 0.7);
  kit.canvas.drawPath(path.build(), kit.paint);
}

function drawMotif(
  kit: Kit,
  kind: MotifKind,
  color: SkColor,
  highlightColor: SkColor,
  length: number,
  widthPx: number,
  bloomEased: number,
  alpha: number,
) {
  'worklet';
  if (alpha <= 0) return;
  const { Sk, canvas } = kit;
  const w = widthPx * (1 + bloomEased * 0.08);
  const bodyShader = Sk.Shader.MakeLinearGradient(
    Sk.Point(0, 0),
    Sk.Point(0, -length),
    [withAlpha(color, 0), withAlpha(color, 0.5 * alpha), withAlpha(color, 0.85 * alpha)],
    [0, 0.5, 1],
    kit.clamp,
  );

  const body = Sk.PathBuilder.Make();
  switch (kind) {
    case 'Petal':
    case 'Flower':
      body.moveTo(0, 0);
      body.cubicTo(w, -length * 0.35, w * 0.7, -length * 0.85, 0, -length);
      body.cubicTo(-w * 0.7, -length * 0.85, -w, -length * 0.35, 0, 0);
      body.close();
      shaded(kit, kit.fill, bodyShader, 1);
      canvas.drawPath(body.build(), kit.paint);
      if (kind === 'Flower') {
        solid(kit, kit.fill, withAlpha(highlightColor, 0.35 * alpha));
        canvas.drawOval(Sk.XYWHRect(-w * 0.3, -length * 0.7, w * 0.6, length * 0.4), kit.paint);
      }
      break;
    case 'Leaf':
      body.moveTo(0, 0);
      body.quadTo(w, -length * 0.5, 0, -length);
      body.quadTo(-w, -length * 0.5, 0, 0);
      body.close();
      shaded(kit, kit.fill, bodyShader, 1);
      canvas.drawPath(body.build(), kit.paint);
      break;
    case 'Shard':
      body.moveTo(0, 0);
      body.lineTo(w * 0.5, -length * 0.6);
      body.lineTo(0, -length);
      body.lineTo(-w * 0.5, -length * 0.6);
      body.close();
      shaded(kit, kit.fill, bodyShader, 1);
      canvas.drawPath(body.build(), kit.paint);
      break;
    case 'Wave':
      body.moveTo(-w, 0);
      body.quadTo(0, -length * (1 + bloomEased * 0.1), w, 0);
      shaded(kit, kit.stroke, bodyShader, 0.7 * alpha, w * 0.28, kit.round);
      canvas.drawPath(body.build(), kit.paint);
      break;
    case 'RibbonLong':
      body.moveTo(0, 0);
      body.cubicTo(w * 1.4, -length * 0.4, -w * 1.2, -length * 0.7, 0, -length);
      shaded(kit, kit.stroke, bodyShader, 0.62 * alpha, w * 0.22);
      canvas.drawPath(body.build(), kit.paint);
      break;
  }

  const outline = Sk.PathBuilder.Make();
  switch (kind) {
    case 'Petal':
    case 'Flower':
      outline.moveTo(0, 0);
      outline.cubicTo(w, -length * 0.35, w * 0.7, -length * 0.85, 0, -length);
      break;
    case 'Shard':
      outline.moveTo(0, 0);
      outline.lineTo(w * 0.5, -length * 0.6);
      outline.lineTo(0, -length);
      break;
    case 'Leaf':
      outline.moveTo(0, 0);
      outline.quadTo(w, -length * 0.5, 0, -length);
      break;
    default:
      return;
  }
  solid(kit, kit.stroke, withAlpha(highlightColor, (0.28 + bloomEased * 0.3) * alpha), 0.7);
  canvas.drawPath(outline.build(), kit.paint);
}

function drawMandala(
  kit: Kit,
  style: KaleidoscopeStyle,
  colors: SkColor[],
  /** May be fractional: the outermost ring is drawn with the leftover as its opacity. */
  rings: number,
  baseRot: number,
  energy: number,
  bloomEased: number,
  alpha: number,
  sparkles: Sparkle[],
) {
  'worklet';
  if (alpha <= 0) return;
  const { canvas } = kit;
  const sequence = motifSequence(style);
  const symmetry = symmetryCount(style);

  const layerCount = Math.ceil(rings);
  // How far the outermost ring has grown in (1 = fully there).
  const partial = rings - (layerCount - 1);
  for (let layer = 0; layer < layerCount; layer++) {
    const motif = sequence[layer % sequence.length];
    const layerLength = 60 + layer * (40 + energy * 15) + bloomEased * (10 + layer * 4);
    const layerRot = baseRot * (1 + layer * 0.16);
    // The outer ring is dimmer (0.55); as a new ring grows in, the ring inside it
    // brightens to full, so nothing jumps when the ring count changes.
    const edgeFade = layer === layerCount - 1 ? 0.55 * partial : layer === layerCount - 2 ? 0.55 + 0.45 * partial : 1;
    const color = colors[layer % colors.length];
    const highlight = colors[(layer + 1) % colors.length];
    const width = 14 + energy * 9 - layer * 1.2;

    canvas.save();
    canvas.rotate(degrees(layerRot), 0, 0);
    for (let sector = 0; sector < symmetry; sector++) {
      canvas.save();
      canvas.rotate((360 / symmetry) * sector, 0, 0);

      drawMotif(kit, motif, color, highlight, layerLength, width, bloomEased, edgeFade * alpha);
      canvas.save();
      canvas.scale(-1, 1);
      drawMotif(kit, motif, color, highlight, layerLength * 0.9, width * 0.85, bloomEased, edgeFade * alpha);
      canvas.restore();

      // Rare specular sparkle on the outer ring's tips (same maths as native).
      if (layer === layerCount - 1 && sparkles.length < 14 && Math.random() < 0.0025) {
        const worldAngle = layerRot + ((2 * Math.PI) / symmetry) * sector;
        sparkles.push({
          x: Math.sin(-worldAngle) * layerLength,
          y: -Math.cos(worldAngle) * layerLength,
          life: 1,
        });
      }
      canvas.restore();
    }
    canvas.restore();
  }
}

type SceneInput = {
  width: number;
  height: number;
  timeMs: number;
  colors: SkColor[];
  prevStyle: KaleidoscopeStyle;
  currentStyle: KaleidoscopeStyle;
  morph: number;
  bloomEased: number;
  smoothedAmplitude: number;
  energy: number;
  valence: number;
  sectionMul: number;
  outerRot: number;
  midRot: number;
  motionMul: number;
  rings: number;
  particles: Particle[];
  sparkles: Sparkle[];
};

function drawScene(kit: Kit, s: SceneInput) {
  'worklet';
  const { Sk, canvas } = kit;
  const colors = s.colors;
  const bloomEased = s.bloomEased;

  const reactiveEnergy = clamp(s.energy + s.smoothedAmplitude * 1.2, 0, 1.5);
  const effectiveEnergy = clamp(reactiveEnergy * (0.6 + s.sectionMul * 0.4), 0, 1.5);
  const activeRings = clamp(1 + s.sectionMul * (s.rings - 1), 1, s.rings);
  const warm = s.valence > 0.5;
  const warmAmt = Math.abs(s.valence - 0.5) * 2;
  const auraColor = warm ? rgba(0xf2 / 255, 0xc4 / 255, 0x8a / 255, 1) : rgba(0x7a / 255, 0x8c / 255, 0xd8 / 255, 1);

  // Slow atmospheric drift for the centre point.
  const driftX = Math.sin(s.timeMs * 0.0007) * 10;
  const driftY = Math.cos(s.timeMs * 0.0005) * 10;
  const cx = s.width / 2 + driftX;
  const cy = s.height * KALEIDOSCOPE_CENTER_Y + driftY;
  const breathe = 1 + Math.sin(s.timeMs * 0.0011) * 0.02 + bloomEased * 0.06 + s.smoothedAmplitude * 0.08;

  // Reactive aura.
  const auraRadius = 100 + effectiveEnergy * 75 + bloomEased * 35;
  shaded(
    kit,
    kit.fill,
    Sk.Shader.MakeRadialGradient(
      Sk.Point(cx, cy),
      auraRadius,
      [withAlpha(auraColor, 0.14 + warmAmt * 0.08 + bloomEased * 0.12), withAlpha(auraColor, 0)],
      null,
      kit.clamp,
    ),
    1,
  );
  canvas.drawCircle(cx, cy, auraRadius, kit.paint);

  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(breathe, breathe);

  if (s.morph < 1) {
    drawMandala(
      kit,
      s.prevStyle,
      colors,
      activeRings,
      s.outerRot,
      effectiveEnergy,
      bloomEased,
      1 - s.morph,
      s.sparkles,
    );
  }
  drawMandala(kit, s.currentStyle, colors, activeRings, s.outerRot, effectiveEnergy, bloomEased, s.morph, s.sparkles);

  canvas.save();
  canvas.rotate(degrees(s.midRot), 0, 0);
  const geomSymmetry = symmetryCount(s.morph < 0.5 ? s.prevStyle : s.currentStyle);
  const geomCount = geomSymmetry * (activeRings > 2 ? 2 : 1);
  for (let index = 0; index < geomCount; index++) {
    canvas.save();
    canvas.rotate((360 / geomCount) * index, 0, 0);
    drawSecondaryGeom(
      kit,
      colors[(index + 1) % colors.length],
      48 + effectiveEnergy * 26,
      6 + effectiveEnergy * 3,
      (0.26 + s.sectionMul * 0.14) * s.morph,
    );
    canvas.restore();
  }
  canvas.restore();

  // Glowing core.
  const coreRadius = 14 + effectiveEnergy * 10 + bloomEased * 10;
  const coreColor = colors[0];
  shaded(
    kit,
    kit.fill,
    Sk.Shader.MakeRadialGradient(
      Sk.Point(0, 0),
      coreRadius,
      [
        withAlpha(coreColor, 0.85 + bloomEased * 0.15),
        withAlpha(colors[1] ?? coreColor, 0.35),
        withAlpha(coreColor, 0),
      ],
      null,
      kit.clamp,
    ),
    1,
  );
  canvas.drawCircle(0, 0, coreRadius, kit.paint);

  // Orbiting particles: brighten near the core, fade at the edge.
  for (let index = 0; index < s.particles.length; index++) {
    const p = s.particles[index];
    const outward = bloomEased * 14;
    const radius = p.baseRadius + Math.sin(s.timeMs * 0.01 * p.speed + p.phase) * 7 + outward;
    const angle = p.angle + s.timeMs * 0.0005 * p.speed * s.motionMul;
    const edgeFalloff = clamp(1 - Math.max(0, (radius - 200) / 100), 0, 1);
    const coreLight = Math.max(0, 1 - radius / 90) * 0.4;
    const alpha = Math.max(
      0,
      (0.2 + Math.sin(s.timeMs * 0.02 + p.phase) * 0.12 + bloomEased * 0.2 + coreLight) * edgeFalloff,
    );
    solid(kit, kit.fill, withAlpha(colors[index % colors.length], alpha));
    canvas.drawCircle(Math.cos(angle) * radius, Math.sin(angle) * radius, p.size + coreLight * 1.2, kit.paint);
  }

  for (const sparkle of s.sparkles) {
    drawSpecular(kit, sparkle.x, sparkle.y, 4, sparkle.life * 0.8);
  }

  canvas.restore();

  // Soft vignette that extends past the screen diagonal.
  const vignetteRadius = Math.hypot(s.width, s.height) * 0.75;
  shaded(
    kit,
    kit.fill,
    Sk.Shader.MakeRadialGradient(
      Sk.Point(cx, cy),
      vignetteRadius,
      [rgba(0, 0, 0, 0), rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.16)],
      [0, 0.55, 0.8, 1],
      kit.clamp,
    ),
    1,
  );
  canvas.drawCircle(cx, cy, vignetteRadius, kit.paint);
}

function SkiaKaleidoscope({ atmosphere, currentTime, duration, skia }: KaleidoscopeProps & { skia: SkiaModule }) {
  const { Canvas, Picture, Skia: Sk } = skia;
  const enums = {
    fill: skia.PaintStyle.Fill,
    stroke: skia.PaintStyle.Stroke,
    butt: skia.StrokeCap.Butt,
    round: skia.StrokeCap.Round,
    clamp: skia.TileMode.Clamp,
  };

  const audio = useAudioReactivity();
  const idleAmplitude = useSharedValue(0);
  const idleBeat = useSharedValue(false);
  const liveAmplitude = audio?.amplitude ?? idleAmplitude;
  const beatPulse = audio?.beat ?? idleBeat;

  const style = atmosphere?.kaleidoscopeStyle ?? 'SoftOrganic';
  const baseEnergy = atmosphere?.energy ?? DEFAULT_ENERGY;
  const valence = atmosphere?.valence ?? DEFAULT_VALENCE;
  const progress = duration > 0 ? currentTime / duration : 0;
  const secondaryKey = (atmosphere?.secondaryColorHexes ?? []).join(',');
  const palette = useMemo(
    () => buildColorPalette(atmosphere?.primaryColorHex, secondaryKey ? secondaryKey.split(',') : []),
    [atmosphere?.primaryColorHex, secondaryKey],
  );

  const tier = useVisualTier();
  const motionMulValue = useSharedValue(tier.motion);
  const tierValue = useSharedValue({ rings: tier.rings, glow: tier.glow });
  // Particles are re-randomised when the tier changes, like `remember(visualIntensity)`.
  const particles = useMemo(() => makeParticles(tier.particleCount), [tier.particleCount]);
  useEffect(() => {
    motionMulValue.value = tier.motion;
    tierValue.value = { rings: tier.rings, glow: tier.glow };
  }, [motionMulValue, tier.glow, tier.motion, tier.rings, tierValue]);
  // A recorder must begin recording before it can finish: finishing an unstarted
  // recorder dereferences a null canvas inside Skia and crashes the app natively.
  const [emptyPicture] = useState(() => {
    const recorder = Sk.PictureRecorder();
    recorder.beginRecording(Sk.XYWHRect(0, 0, 1, 1));
    return recorder.finishRecordingAsPicture();
  });

  const canvasSize = useSharedValue<SkSize>({ width: 0, height: 0 });
  const picture = useSharedValue<SkPicture>(emptyPicture);

  // Animated inputs (animateFloatAsState / animateColorAsState, 1500 ms).
  const animatedEnergy = useSharedValue(baseEnergy);
  const animatedValence = useSharedValue(valence);
  const progressValue = useSharedValue(progress);
  const paletteFrom = useSharedValue<Lab[]>(palette.map(rgbaToLab));
  const paletteTo = useSharedValue<Lab[]>(palette.map(rgbaToLab));
  const paletteT = useSharedValue(1);

  // Style morph (prevStyle -> currentStyle crossfade, 1200 ms).
  const prevStyle = useSharedValue<KaleidoscopeStyle>(style);
  const currentStyle = useSharedValue<KaleidoscopeStyle>(style);
  const morph = useSharedValue(1);

  // Per-frame state, mirrors the `remember { mutableFloatStateOf(...) }` block.
  const lastFrame = useSharedValue(-1);
  const timeMs = useSharedValue(0);
  const bloom = useSharedValue(0);
  const bloomTarget = useSharedValue(0);
  const outerAngle = useSharedValue(0);
  const midAngle = useSharedValue(0);
  const smoothedAmplitude = useSharedValue(0);
  const smoothedSection = useSharedValue(-1);
  const sparkles = useSharedValue<Sparkle[]>([]);

  useEffect(() => {
    animatedEnergy.value = withTiming(baseEnergy, { duration: 1500, easing: FAST_OUT_SLOW_IN });
  }, [animatedEnergy, baseEnergy]);

  useEffect(() => {
    animatedValence.value = withTiming(valence, { duration: 1500, easing: FAST_OUT_SLOW_IN });
  }, [animatedValence, valence]);

  useEffect(() => {
    progressValue.value = progress;
  }, [progress, progressValue]);

  useEffect(() => {
    const target = palette.map(rgbaToLab);
    const current = lerpLabs(paletteFrom.value, paletteTo.value, paletteT.value);
    paletteFrom.value = target.map((color, index) => current[index] ?? color);
    paletteTo.value = target;
    paletteT.value = 0;
    paletteT.value = withTiming(1, { duration: 1500, easing: FAST_OUT_SLOW_IN });
  }, [palette, paletteFrom, paletteT, paletteTo]);

  useEffect(() => {
    if (style === currentStyle.value) return;
    prevStyle.value = currentStyle.value;
    currentStyle.value = style;
    morph.value = 0;
    morph.value = withTiming(1, { duration: 1200, easing: FAST_OUT_SLOW_IN });
  }, [currentStyle, morph, prevStyle, style]);

  useFrameCallback((frame) => {
    const dtMs = lastFrame.value >= 0 ? frame.timestamp - lastFrame.value : 0;
    lastFrame.value = frame.timestamp;
    const time = timeMs.value + dtMs;
    timeMs.value = time;

    // Local fast-attack / slow-release smoothing of the raw amplitude.
    const live = liveAmplitude.value;
    let smoothed = smoothedAmplitude.value;
    smoothed += (live - smoothed) * (live > smoothed ? 0.25 : 0.04);
    smoothedAmplitude.value = smoothed;

    let target = bloomTarget.value;
    if (beatPulse.value) target = 1.2;
    let bloomNow = bloom.value;
    bloomNow += (target - bloomNow) * (target > bloomNow ? 0.35 : 0.04);
    bloom.value = bloomNow;
    bloomTarget.value = target * 0.94;

    const motionMul = motionMulValue.value;
    // Eased towards the song-position target (~1 s) so section changes and a new
    // song starting (progress back to 0) grow or shrink the mandala smoothly.
    const sectionTarget = sectionComplexity(progressValue.value);
    const previousSection = smoothedSection.value;
    const sectionMul =
      previousSection < 0
        ? sectionTarget
        : previousSection + (sectionTarget - previousSection) * Math.min(1, dtMs / 900);
    smoothedSection.value = sectionMul;
    const energy = animatedEnergy.value;
    const totalEnergyForMotion = clamp(energy + smoothed * 1.2, 0, 1.5);
    const effectiveEnergyForMotion = clamp(totalEnergyForMotion * (0.5 + sectionMul * 0.5), 0, 1.5);
    const outerRot = outerAngle.value + dtMs * (0.00007 + effectiveEnergyForMotion * 0.0015) * motionMul;
    const midRot = midAngle.value - dtMs * (0.00011 + effectiveEnergyForMotion * 0.0021) * motionMul;
    outerAngle.value = outerRot;
    midAngle.value = midRot;

    const liveSparkles: Sparkle[] = [];
    for (const sparkle of sparkles.value) {
      const life = sparkle.life - 0.03;
      if (life > 0) liveSparkles.push({ x: sparkle.x, y: sparkle.y, life });
    }

    const { width, height } = canvasSize.value;
    if (width <= 0 || height <= 0) {
      sparkles.value = liveSparkles;
      return;
    }

    const recorder = Sk.PictureRecorder();
    const canvas = recorder.beginRecording(Sk.XYWHRect(0, 0, width, height));
    const paint = Sk.Paint();
    paint.setAntiAlias(true);
    const kit: Kit = { Sk, canvas, paint, ...enums };

    drawScene(kit, {
      width,
      height,
      timeMs: time,
      colors: labsToColors(lerpLabs(paletteFrom.value, paletteTo.value, paletteT.value)),
      prevStyle: prevStyle.value,
      currentStyle: currentStyle.value,
      morph: clamp(morph.value, 0, 1),
      // Medium (glow 0.7) keeps the original bloom strength.
      bloomEased: clamp(easeOutCubic(clamp(bloomNow, 0, 1)) * (tierValue.value.glow / 0.7), 0, 1),
      rings: tierValue.value.rings,
      smoothedAmplitude: smoothed,
      energy,
      valence: animatedValence.value,
      sectionMul,
      outerRot,
      midRot,
      motionMul,
      particles,
      sparkles: liveSparkles,
    });

    picture.value = recorder.finishRecordingAsPicture();
    sparkles.value = liveSparkles;
  });

  // Size comes from onLayout rather than Canvas `onSize`: `onSize` calls
  // Reanimated's measure() every frame and floods the log with LayoutMetrics
  // warnings whenever the canvas isn't laid out yet (e.g. during navigation).
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        canvasSize.set({ width, height });
      }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fallback (web, or a native build without Skia)
// ---------------------------------------------------------------------------

function FallbackKaleidoscope({ atmosphere, playing, currentTime }: KaleidoscopeProps) {
  const { motion } = useVisualTier();
  const [rotation] = useState(() => new Animated.Value(0));
  const style = atmosphere?.kaleidoscopeStyle ?? 'SoftOrganic';
  const color = parseHexColor(atmosphere?.primaryColorHex) ? atmosphere!.primaryColorHex.slice(0, 7) : '#A79AC7';
  const secondary = atmosphere?.secondaryColorHexes.find((hex) => parseHexColor(hex))?.slice(0, 7) ?? '#E9E4DE';
  const energy = Math.max(0, Math.min(1, atmosphere?.energy ?? DEFAULT_ENERGY));
  const glyph =
    style === 'Floral'
      ? 'flower'
      : style === 'SharpGeometric'
        ? 'hexagon-outline'
        : style === 'WaveLike'
          ? 'waves'
          : style === 'DarkReflective'
            ? 'diamond-stone'
            : 'star-four-points';

  useEffect(() => {
    if (!playing) {
      rotation.stopAnimation();
      return;
    }
    return loopFromCurrent(rotation, {
      duration: Math.round((24000 - energy * 10000) / motion),
      useNativeDriver: Platform.OS !== 'web',
    });
  }, [energy, motion, playing, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const reverseRotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const pulseScale = 1 + Math.max(0, Math.sin(currentTime * (1.5 + energy))) * 0.025;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.fallbackAnchor}>
        <Animated.View
          style={[
            styles.fallbackRing,
            {
              borderColor: `${color}A8`,
              shadowColor: color,
              opacity: 0.62 + energy * 0.22,
              transform: [{ rotate }, { scale: pulseScale }],
            },
          ]}>
          {Array.from({ length: 8 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.fallbackMotif,
                {
                  left: `${47 + 42 * Math.cos((index * Math.PI) / 4)}%`,
                  top: `${47 + 42 * Math.sin((index * Math.PI) / 4)}%`,
                  transform: [{ rotate: `${index * 45}deg` }],
                },
              ]}>
              <MaterialCommunityIcons name={glyph} size={22} color={index % 2 ? secondary : color} />
            </View>
          ))}
          <Animated.View
            style={[
              styles.fallbackInnerRing,
              { borderColor: `${secondary}A8`, transform: [{ rotate: reverseRotate }] },
            ]}>
            <MaterialCommunityIcons name={glyph} size={58} color={secondary} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackAnchor: {
    position: 'absolute',
    top: `${KALEIDOSCOPE_CENTER_Y * 100}%`,
    alignSelf: 'center',
    width: 220,
    height: 220,
    marginTop: -110,
  },
  fallbackRing: {
    width: '100%',
    height: '100%',
    borderRadius: 120,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 3,
  },
  fallbackMotif: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInnerRing: {
    width: '58%',
    height: '58%',
    borderWidth: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C0D1238',
  },
});

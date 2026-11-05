import type {
  AtmosphereProfile,
  CatBehaviorState,
  EnvironmentType,
  KaleidoscopeStyle,
  LightingStyle,
  ParticleStyle,
  SectionCatBehavior,
  SongSection,
  TransitionStyle,
} from "../../types";

/**
 * Runtime checks for OpenAI output. The model is asked for exact enum values,
 * but anything it gets wrong is replaced with a safe default instead of
 * reaching clients that parse enums strictly (the Kotlin app does).
 */

export const ENVIRONMENTS: readonly EnvironmentType[] = [
  "Heaven", "Nature", "Ocean", "Dream", "Romantic", "Melancholic", "Hopeful", "Energetic",
];
export const LIGHTING: readonly LightingStyle[] = ["Soft", "Bright", "Dramatic", "Fading"];
const PARTICLES: readonly ParticleStyle[] = ["Dust", "Rain", "Bubbles", "Petals", "Stars", "Sparks", "None"];
const KALEIDOSCOPES: readonly KaleidoscopeStyle[] = [
  "SoftOrganic", "FluidSymmetry", "WaveLike", "SharpGeometric", "DarkReflective", "Floral",
];
export const CAT_STATES: readonly CatBehaviorState[] = [
  "Idle", "Sleeping", "Walking", "Stretching", "Playing", "Running", "Watching",
];
export const SECTION_CAT_STATES: readonly SectionCatBehavior[] = [...CAT_STATES, "Dancing"];
const TRANSITIONS: readonly TransitionStyle[] = ["Gentle", "Progressive", "Sharp"];
export const SECTIONS: readonly SongSection[] = [
  "Intro", "Verse", "PreChorus", "Chorus", "Bridge", "FinalChorus", "Outro",
];

const HEX = /^#[0-9a-f]{6}$/i;

export function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function hexOr(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

export function unitOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

/** Validates a generated profile; every field ends up with a legal value. */
export function sanitizeAtmosphereProfile(raw: any, songId: string): AtmosphereProfile {
  const primary = hexOr(raw?.primaryColorHex, "#7C6BD6");
  const secondaries = Array.isArray(raw?.secondaryColorHexes)
    ? raw.secondaryColorHexes.map((hex: unknown) => hexOr(hex, "")).filter(Boolean).slice(0, 3)
    : [];
  return {
    songId,
    emotion: typeof raw?.emotion === "string" && raw.emotion.trim() ? raw.emotion.trim().slice(0, 60) : "reflective",
    energy: unitOr(raw?.energy, 0.5),
    valence: unitOr(raw?.valence, 0.5),
    environment: pick(raw?.environment, ENVIRONMENTS, "Dream"),
    primaryColorHex: primary,
    secondaryColorHexes: secondaries.length ? secondaries : [primary],
    lightingStyle: pick(raw?.lightingStyle, LIGHTING, "Soft"),
    particleStyle: pick(raw?.particleStyle, PARTICLES, "Dust"),
    kaleidoscopeStyle: pick(raw?.kaleidoscopeStyle, KALEIDOSCOPES, "SoftOrganic"),
    // Top-level cat behaviour stays within the Project I enum for the Kotlin client.
    catBehavior: pick(raw?.catBehavior, CAT_STATES, "Idle"),
    transitionStyle: pick(raw?.transitionStyle, TRANSITIONS, "Gentle"),
    resonantLyricLineIds: Array.isArray(raw?.resonantLyricLineIds)
      ? raw.resonantLyricLineIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 1)
      : [],
    sectionProfiles: Array.isArray(raw?.sectionProfiles) ? raw.sectionProfiles : [],
  };
}

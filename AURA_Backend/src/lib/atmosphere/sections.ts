import type {
  AtmosphereProfile,
  LightingStyle,
  LyricLine,
  SectionCatBehavior,
  SongSection,
  SongSectionProfile,
} from "../../types";
import { ENVIRONMENTS, LIGHTING, SECTIONS, SECTION_CAT_STATES, hexOr, pick } from "./profileSchema";

/**
 * Section timelines (Project II "dynamic colour and environment through a
 * song"). A timeline splits the song into Intro/Verse/Chorus/... with each
 * section carrying its own palette, lighting, environment and cat behaviour.
 */

const MIN_SECTION_MS = 6_000;
const MAX_SECTIONS = 12;

const INTENSITY: Record<SongSection, number> = {
  Intro: 0.6,
  Verse: 0.8,
  PreChorus: 0.95,
  Chorus: 1.15,
  Bridge: 0.85,
  FinalChorus: 1.3,
  Outro: 0.55,
};

/** Shifts a #RRGGBB colour towards white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)),
  );
  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function catFor(section: SongSection, profile: AtmosphereProfile): SectionCatBehavior {
  const calm = profile.energy < 0.35;
  switch (section) {
    case "Intro":
      return calm ? "Sleeping" : "Watching";
    case "Chorus":
    case "FinalChorus":
      return profile.energy > 0.7 ? "Dancing" : profile.energy > 0.5 ? "Playing" : "Watching";
    case "PreChorus":
      return profile.energy > 0.6 ? "Running" : "Walking";
    case "Bridge":
      return "Watching";
    case "Outro":
      return calm ? "Sleeping" : "Idle";
    default:
      return profile.catBehavior;
  }
}

function lightingFor(section: SongSection, profile: AtmosphereProfile): LightingStyle {
  if (section === "Outro") return "Fading";
  if (section === "Intro") return "Soft";
  if (section === "Chorus" || section === "FinalChorus") return profile.valence >= 0.5 ? "Bright" : "Dramatic";
  return profile.lightingStyle;
}

/** Gives one section its look, derived from the song's base profile. */
export function styleSection(
  section: SongSection,
  startTimeMs: number,
  endTimeMs: number,
  profile: AtmosphereProfile,
  occurrence: number,
): SongSectionProfile {
  const accents = profile.secondaryColorHexes.length ? profile.secondaryColorHexes : [profile.primaryColorHex];
  const chorusLike = section === "Chorus" || section === "FinalChorus";
  const primary =
    section === "Intro" || section === "Outro"
      ? shade(profile.primaryColorHex, -0.25)
      : chorusLike
        ? accents[occurrence % accents.length]
        : section === "Bridge"
          ? accents[(occurrence + 1) % accents.length]
          : profile.primaryColorHex;
  return {
    section,
    startTimeMs,
    endTimeMs,
    intensityMultiplier: INTENSITY[section],
    environment: profile.environment,
    primaryColorHex: section === "FinalChorus" ? shade(primary, 0.15) : primary,
    secondaryColorHexes: [profile.primaryColorHex, ...accents].filter((hex) => hex !== primary).slice(0, 3),
    lightingStyle: lightingFor(section, profile),
    catBehavior: catFor(section, profile),
    source: "estimated",
  };
}

type Span = { section: SongSection; start: number; end: number };

/**
 * Estimates the song structure without AI. With timed lyrics, lines that
 * repeat are treated as the chorus; otherwise a typical pop structure is laid
 * over the duration.
 */
export function estimateStructure(durationMs: number, lyrics: LyricLine[]): Span[] {
  const duration = Math.max(durationMs, 30_000);
  const timed = lyrics.filter((line) => line.startTimeMs >= 0 && line.startTimeMs < duration);

  if (timed.length >= 8) {
    const counts = new Map<string, number>();
    for (const line of timed) {
      const key = line.text
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const isRepeated = (line: LyricLine) =>
      (counts.get(
        line.text
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .trim(),
      ) ?? 0) >= 2;

    const spans: Span[] = [];
    const firstVocal = timed[0].startTimeMs;
    if (firstVocal > 4_000) spans.push({ section: "Intro", start: 0, end: firstVocal });

    for (const line of timed) {
      const kind: SongSection = isRepeated(line) ? "Chorus" : "Verse";
      const previous = spans[spans.length - 1];
      if (previous && previous.section === kind) previous.end = line.endTimeMs;
      else spans.push({ section: kind, start: spans.length === 0 ? 0 : line.startTimeMs, end: line.endTimeMs });
    }
    const lastVocal = timed[timed.length - 1].endTimeMs;
    if (duration - lastVocal > 6_000) spans.push({ section: "Outro", start: lastVocal, end: duration });

    const merged = mergeShortSpans(spans);
    labelLateSections(merged);
    if (merged.length >= 3) return closeGaps(merged, duration);
  }

  const template: [SongSection, number][] = [
    ["Intro", 0],
    ["Verse", 0.08],
    ["Chorus", 0.28],
    ["Verse", 0.42],
    ["Chorus", 0.58],
    ["Bridge", 0.72],
    ["FinalChorus", 0.82],
    ["Outro", 0.94],
  ];
  return template.map(([section, at], index) => ({
    section,
    start: Math.round(at * duration),
    end: Math.round((template[index + 1]?.[1] ?? 1) * duration),
  }));
}

function mergeShortSpans(spans: Span[]): Span[] {
  const result: Span[] = [];
  for (const span of spans) {
    const previous = result[result.length - 1];
    if (previous && (span.end - span.start < MIN_SECTION_MS || previous.section === span.section)) {
      previous.end = span.end;
    } else {
      result.push({ ...span });
    }
  }
  return result.slice(0, MAX_SECTIONS);
}

/** The last chorus becomes FinalChorus; a verse between the last two choruses becomes the Bridge. */
function labelLateSections(spans: Span[]) {
  const choruses = spans.map((span, index) => (span.section === "Chorus" ? index : -1)).filter((index) => index >= 0);
  if (choruses.length >= 2) {
    const last = choruses[choruses.length - 1];
    spans[last].section = "FinalChorus";
    const previous = choruses[choruses.length - 2];
    if (last - previous === 2 && spans[last - 1].section === "Verse") spans[last - 1].section = "Bridge";
  }
}

function closeGaps(spans: Span[], duration: number): Span[] {
  return spans.map((span, index) => ({
    ...span,
    start: index === 0 ? 0 : spans[index - 1].end,
    end: index === spans.length - 1 ? duration : span.end,
  }));
}

export function estimatedTimeline(
  profile: AtmosphereProfile,
  durationMs: number,
  lyrics: LyricLine[],
): SongSectionProfile[] {
  const seen = new Map<SongSection, number>();
  return estimateStructure(durationMs, lyrics).map((span) => {
    const occurrence = seen.get(span.section) ?? 0;
    seen.set(span.section, occurrence + 1);
    return styleSection(span.section, span.start, span.end, profile, occurrence);
  });
}

/**
 * Validates an AI timeline: legal enums and colours, sorted, non-overlapping,
 * inside the song. Returns null if it is unusable, so the caller can fall
 * back to the estimate.
 */
export function validateTimeline(
  raw: unknown,
  profile: AtmosphereProfile,
  durationMs: number,
): SongSectionProfile[] | null {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.sections) ? (raw as any).sections : null;
  if (!list) return null;

  const sections: SongSectionProfile[] = [];
  for (const item of list.slice(0, MAX_SECTIONS)) {
    const start = Number(item?.startTimeMs);
    if (!Number.isFinite(start) || start < 0 || start >= durationMs) continue;
    const section = pick(item?.section, SECTIONS, "Verse");
    const primary = hexOr(item?.primaryColorHex, profile.primaryColorHex);
    sections.push({
      section,
      startTimeMs: Math.round(start),
      intensityMultiplier: Math.max(0.3, Math.min(1.6, Number(item?.intensityMultiplier) || INTENSITY[section])),
      environment: pick(item?.environment, ENVIRONMENTS, profile.environment),
      primaryColorHex: primary,
      secondaryColorHexes: Array.isArray(item?.secondaryColorHexes)
        ? item.secondaryColorHexes
            .map((hex: unknown) => hexOr(hex, ""))
            .filter(Boolean)
            .slice(0, 3)
        : profile.secondaryColorHexes,
      lightingStyle: pick(item?.lightingStyle, LIGHTING, profile.lightingStyle),
      catBehavior: pick(item?.catBehavior, SECTION_CAT_STATES, profile.catBehavior),
      source: "ai",
    });
  }

  sections.sort((a, b) => a.startTimeMs - b.startTimeMs);
  const distinct = sections.filter(
    (section, index) => index === 0 || section.startTimeMs - sections[index - 1].startTimeMs >= 3_000,
  );
  if (distinct.length < 3) return null;
  distinct[0].startTimeMs = 0;
  return distinct.map((section, index) => ({
    ...section,
    endTimeMs: distinct[index + 1]?.startTimeMs ?? durationMs,
  }));
}

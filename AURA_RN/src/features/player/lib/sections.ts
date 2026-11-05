import type { AtmosphereProfile, CatBehavior, SongSectionProfile } from '@/core/types';

import { isHexColor } from './visual-utils';

/** Everything the Now Playing layers need to draw one moment of a song. */
export type SceneLook = {
  /** Changes whenever the look changes (song or section), for crossfades. */
  key: string;
  section: SongSectionProfile['section'] | null;
  environment: AtmosphereProfile['environment'] | null;
  primaryColorHex: string | null;
  secondaryColorHexes: string[];
  lightingStyle: AtmosphereProfile['lightingStyle'];
  catBehavior: CatBehavior;
  /** Profile energy scaled by the section's intensity, 0..1. */
  energy: number;
  valence: number;
  transitionMs: number;
};

const TRANSITION_MS: Record<AtmosphereProfile['transitionStyle'], number> = {
  Gentle: 2400,
  Progressive: 1500,
  Sharp: 600,
};

export function transitionMsFor(profile: AtmosphereProfile | null) {
  return TRANSITION_MS[profile?.transitionStyle ?? 'Gentle'] ?? 1500;
}

/**
 * Index of the section playing at `timeMs`. The switch happens half a
 * transition early so the crossfade is centred on the real boundary.
 */
export function sectionIndexAt(sections: SongSectionProfile[], timeMs: number, leadMs = 0): number {
  let index = -1;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].startTimeMs - (i === 0 ? 0 : leadMs) <= timeMs) index = i;
    else break;
  }
  return index;
}

export function lookFor(profile: AtmosphereProfile | null, timeMs: number, songKey: string): SceneLook {
  const transitionMs = transitionMsFor(profile);
  if (!profile) {
    return {
      key: `${songKey}:none`,
      section: null,
      environment: null,
      primaryColorHex: null,
      secondaryColorHexes: [],
      lightingStyle: 'Soft',
      catBehavior: 'Idle',
      energy: 0.35,
      valence: 0.5,
      transitionMs,
    };
  }
  const sections = [...(profile.sectionProfiles ?? [])].sort((a, b) => a.startTimeMs - b.startTimeMs);
  const index = sectionIndexAt(sections, timeMs, transitionMs / 2);
  const section = index >= 0 ? sections[index] : null;
  const primary = isHexColor(section?.primaryColorHex) ? section.primaryColorHex : profile.primaryColorHex;
  const secondaries = (section?.secondaryColorHexes ?? []).filter(isHexColor);
  return {
    key: `${songKey}:${profile.songId}:${index}`,
    section: section?.section ?? null,
    environment: section?.environment ?? profile.environment,
    primaryColorHex: primary,
    secondaryColorHexes: secondaries.length ? secondaries : profile.secondaryColorHexes,
    lightingStyle: section?.lightingStyle ?? profile.lightingStyle,
    catBehavior: section?.catBehavior ?? profile.catBehavior,
    energy: Math.max(0, Math.min(1, profile.energy * (section?.intensityMultiplier ?? 1))),
    valence: profile.valence,
    transitionMs,
  };
}

/** The base profile with the current section's look applied, for layers that take a profile. */
export function profileWithLook(profile: AtmosphereProfile | null, look: SceneLook): AtmosphereProfile | null {
  if (!profile) return null;
  return {
    ...profile,
    environment: look.environment ?? profile.environment,
    primaryColorHex: look.primaryColorHex ?? profile.primaryColorHex,
    secondaryColorHexes: look.secondaryColorHexes,
    lightingStyle: look.lightingStyle,
    energy: look.energy,
  };
}

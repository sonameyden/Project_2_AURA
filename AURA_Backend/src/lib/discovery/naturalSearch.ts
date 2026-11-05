import type { Song } from "../../types";
import type { SongFeatures } from "./catalog";
import type { QueryInterpretation } from "./queryInterpretation";

export interface RankedSong {
  song: Song;
  score: number;
  reason: string;
}

const includesLoose = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/** 1 when equal, 0 when as far apart as possible. */
const closeness = (a: number, b: number) => 1 - Math.abs(a - b);

/** Genre names are free text in the catalog ("Indie Pop", "lo-fi"); match loosely. */
export function genreMatches(songGenre: string | null, wanted: string): boolean {
  if (!songGenre) return false;
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9&]/g, "");
  const genre = normalise(songGenre);
  const target = normalise(wanted);
  return target.length > 1 && (genre.includes(target) || target.includes(genre));
}

/**
 * Scores one song against an interpreted query. Returns 0 for songs with no
 * evidence of relevance, so the result list only contains real matches.
 */
export function scoreSong(features: SongFeatures, query: QueryInterpretation): RankedSong {
  const { song } = features;
  let score = 0;
  const reasons: string[] = [];

  const artistHit = query.artistHints.find((hint) => includesLoose(song.artistName, hint));
  if (artistHit) {
    score += 5;
    reasons.push(`by ${song.artistName}`);
  }
  const titleHit = query.titleHints.find((hint) => includesLoose(song.title, hint));
  if (titleHit) {
    score += 4;
    reasons.push("title match");
  }
  const genreHit = query.genres.find((genre) => genreMatches(song.genre, genre));
  if (genreHit) {
    score += 3;
    reasons.push(song.genre ?? genreHit);
  }
  const moodHits = query.moods.filter((mood) => features.moodTags.some((tag) => tag.includes(mood) || mood.includes(tag)));
  if (moodHits.length) {
    score += 1.5 * moodHits.length;
    reasons.push(moodHits.join(", "));
  }
  const activityHits = query.activities.filter((activity) => features.activityTags.includes(activity));
  if (activityHits.length) {
    score += 1.5 * activityHits.length;
    reasons.push(`good for ${activityHits.join(" and ")}`);
  }

  // Energy/valence only count when both sides are known. A good fit is the
  // main signal for purely descriptive queries ("calm songs for studying").
  let fit = 0;
  let fitParts = 0;
  if (query.targetEnergy !== null && features.energy !== null) {
    fit += closeness(query.targetEnergy, features.energy);
    fitParts += 1;
  }
  if (query.targetValence !== null && features.valence !== null) {
    fit += closeness(query.targetValence, features.valence);
    fitParts += 1;
  }
  if (fitParts > 0) {
    const average = fit / fitParts;
    // Only reward a genuinely close fit; a far-off song gets nothing.
    if (average >= 0.7) {
      score += (average - 0.7) * 10; // up to +3
      reasons.push(describeFeel(features.energy, features.valence));
    }
  }

  if (score > 0) score += Math.min(0.5, features.playCount / 2000); // tie-break on popularity
  return { song, score, reason: reasons.filter(Boolean).slice(0, 2).join(" · ") };
}

export function describeFeel(energy: number | null, valence: number | null): string {
  const energyWord = energy === null ? "" : energy < 0.35 ? "calm" : energy > 0.65 ? "high-energy" : "mid-tempo";
  const valenceWord = valence === null ? "" : valence < 0.35 ? "moody" : valence > 0.65 ? "bright" : "";
  return [energyWord, valenceWord].filter(Boolean).join(", ") || "matching feel";
}

/** Ranks the catalog for a query; at most two songs per artist unless the user asked for that artist. */
export function rankCatalog(catalog: SongFeatures[], query: QueryInterpretation, limit = 20): RankedSong[] {
  const ranked = catalog
    .map((features) => scoreSong(features, query))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);

  const perArtist = new Map<string, number>();
  const results: RankedSong[] = [];
  for (const result of ranked) {
    const askedForArtist = query.artistHints.some((hint) => includesLoose(result.song.artistName, hint));
    const count = perArtist.get(result.song.artistId) ?? 0;
    if (!askedForArtist && count >= 2) continue;
    perArtist.set(result.song.artistId, count + 1);
    results.push(result);
    if (results.length >= limit) break;
  }
  return results;
}

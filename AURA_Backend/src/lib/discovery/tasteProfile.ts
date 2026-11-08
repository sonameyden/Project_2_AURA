import type { Song } from "../../types";
import type { SongFeatures } from "./catalog";
import { describeFeel, genreMatches } from "./naturalSearch";

/** What the user has done that tells us about their taste. */
export interface TasteSignals {
  likedSongIds: string[];
  /** Most recent first; repeats are meaningful (they count as more plays). */
  historySongIds: string[];
  followedArtistIds: string[];
  followedArtistNames: Record<string, string>;
}

export interface TasteProfile {
  averageEnergy: number | null;
  averageValence: number | null;
  /** Genres ordered by weight, highest first. */
  topGenres: string[];
  topArtistIds: string[];
  /** e.g. "calm indie" — used in "Because you like calm indie". */
  label: string | null;
  signalCount: number;
}

export interface Recommendation {
  song: Song;
  score: number;
  reason: string;
}

/** Below this many new songs, "Made for you" is topped up from the listener's history. */
const MIN_RECOMMENDATIONS = 8;
const LIKE_WEIGHT = 3;
const PLAY_WEIGHT = 1;
const FOLLOW_GENRE_WEIGHT = 2;

export function buildTasteProfile(signals: TasteSignals, catalog: SongFeatures[]): TasteProfile {
  const byId = new Map(catalog.map((item) => [item.song.id, item]));
  const weights = new Map<string, number>();
  for (const id of signals.likedSongIds) weights.set(id, (weights.get(id) ?? 0) + LIKE_WEIGHT);
  for (const id of signals.historySongIds) weights.set(id, (weights.get(id) ?? 0) + PLAY_WEIGHT);

  let energySum = 0;
  let energyWeight = 0;
  let valenceSum = 0;
  let valenceWeight = 0;
  const genreWeights = new Map<string, number>();
  const artistWeights = new Map<string, number>();

  for (const [id, weight] of weights) {
    const item = byId.get(id);
    if (!item) continue;
    if (item.energy !== null) {
      energySum += item.energy * weight;
      energyWeight += weight;
    }
    if (item.valence !== null) {
      valenceSum += item.valence * weight;
      valenceWeight += weight;
    }
    if (item.song.genre) {
      const genre = item.song.genre.toLowerCase();
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight);
    }
    artistWeights.set(item.song.artistId, (artistWeights.get(item.song.artistId) ?? 0) + weight);
  }

  const followed = new Set(signals.followedArtistIds);
  for (const item of catalog) {
    if (!followed.has(item.song.artistId) || !item.song.genre) continue;
    const genre = item.song.genre.toLowerCase();
    genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + FOLLOW_GENRE_WEIGHT / 4);
  }
  for (const artistId of followed)
    artistWeights.set(artistId, (artistWeights.get(artistId) ?? 0) + FOLLOW_GENRE_WEIGHT);

  const sortKeys = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const averageEnergy = energyWeight > 0 ? energySum / energyWeight : null;
  const averageValence = valenceWeight > 0 ? valenceSum / valenceWeight : null;
  const topGenres = sortKeys(genreWeights).slice(0, 5);
  const feel =
    averageEnergy === null && averageValence === null ? "" : describeFeel(averageEnergy, averageValence).split(",")[0];
  const label = topGenres[0] ? [feel === "matching feel" ? "" : feel, topGenres[0]].filter(Boolean).join(" ") : null;

  return {
    averageEnergy,
    averageValence,
    topGenres,
    topArtistIds: sortKeys(artistWeights).slice(0, 10),
    label,
    signalCount: weights.size + followed.size,
  };
}

/**
 * Songs the user has not heard yet, ranked against their taste profile, each
 * with a short reason. Falls back to popular songs for brand-new users.
 */
export function recommend(
  profile: TasteProfile,
  catalog: SongFeatures[],
  signals: TasteSignals,
  limit = 20,
): Recommendation[] {
  const heard = new Set([...signals.likedSongIds, ...signals.historySongIds]);
  const unheard = catalog.filter((item) => !heard.has(item.song.id));

  if (profile.signalCount === 0) {
    return unheard
      .slice()
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit)
      .map((item) => ({ song: item.song, score: 0, reason: "Popular on AURA right now" }));
  }

  const followed = new Set(signals.followedArtistIds);
  const genreRank = new Map(profile.topGenres.map((genre, index) => [genre, index]));
  const artistRank = new Map(profile.topArtistIds.map((artistId, index) => [artistId, index]));

  const scoreItem = (item: SongFeatures): Recommendation => {
    let score = 0;
    let reason = "";
    const genre = item.song.genre?.toLowerCase() ?? null;
    const matchedGenre = genre ? profile.topGenres.find((top) => genreMatches(genre, top)) : undefined;

    if (followed.has(item.song.artistId)) {
      score += 4;
      reason = `Because you follow ${signals.followedArtistNames[item.song.artistId] ?? item.song.artistName}`;
    } else if (artistRank.has(item.song.artistId)) {
      score += 3 - Math.min(2, (artistRank.get(item.song.artistId) ?? 0) * 0.3);
      reason = `More from ${item.song.artistName}, an artist you play`;
    }
    if (matchedGenre) {
      score += 3 - Math.min(2, (genreRank.get(matchedGenre) ?? 0) * 0.5);
      if (!reason)
        reason =
          profile.label && profile.topGenres[0] === matchedGenre
            ? `Because you like ${profile.label}`
            : `Because you listen to ${matchedGenre}`;
    }

    let fit = 0;
    let parts = 0;
    if (profile.averageEnergy !== null && item.energy !== null) {
      fit += 1 - Math.abs(profile.averageEnergy - item.energy);
      parts += 1;
    }
    if (profile.averageValence !== null && item.valence !== null) {
      fit += 1 - Math.abs(profile.averageValence - item.valence);
      parts += 1;
    }
    if (parts > 0) {
      const average = fit / parts;
      score += average * 2;
      if (!reason && average >= 0.8)
        reason = `Matches the ${describeFeel(item.energy, item.valence)} feel you've been playing`;
    }
    score += Math.min(0.5, item.playCount / 2000);
    return { song: item.song, score, reason: reason || "Something new to explore" };
  };

  const perArtist = new Map<string, number>();
  const results: Recommendation[] = [];
  for (const item of unheard.map(scoreItem).sort((a, b) => b.score - a.score)) {
    const count = perArtist.get(item.song.artistId) ?? 0;
    if (count >= 2) continue;
    perArtist.set(item.song.artistId, count + 1);
    results.push(item);
    if (results.length >= limit) break;
  }

  // With a small catalogue, a regular listener soon has nothing left they haven't heard, and the
  // section would come back empty. Top it up with songs from their history they haven't liked,
  // ranked by the same taste score, so "Made for you" keeps working.
  const target = Math.min(limit, MIN_RECOMMENDATIONS);
  if (results.length < target) {
    const liked = new Set(signals.likedSongIds);
    const played = new Set(signals.historySongIds);
    const rotation = catalog
      .filter((item) => played.has(item.song.id) && !liked.has(item.song.id))
      .map((item) => ({ ...scoreItem(item), reason: "Back in your rotation" }))
      .sort((a, b) => b.score - a.score);
    for (const item of rotation) {
      results.push(item);
      if (results.length >= target) break;
    }
  }
  return results;
}

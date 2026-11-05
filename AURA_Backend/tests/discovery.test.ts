import { describe, expect, it } from "vitest";
import queries from "./nl-search-queries.json";
import type { SongFeatures } from "../src/lib/discovery/catalog";
import { rowToFeatures } from "../src/lib/discovery/catalog";
import { rankCatalog } from "../src/lib/discovery/naturalSearch";
import { heuristicInterpretation, validateInterpretation } from "../src/lib/discovery/queryInterpretation";
import { buildTasteProfile, recommend, type TasteSignals } from "../src/lib/discovery/tasteProfile";

function song(id: string, overrides: Partial<{ genre: string; artist: string; energy: number; valence: number; moods: string[]; activities: string[]; plays: number }> = {}): SongFeatures {
  return rowToFeatures({
    id,
    title: `Song ${id}`,
    artist_id: overrides.artist ?? `artist-${id}`,
    artist_name: overrides.artist ?? `Artist ${id}`,
    album_id: null,
    duration_ms: 200_000,
    stream_url: `https://example.com/${id}.mp3`,
    artwork_url: null,
    genre: overrides.genre ?? "pop",
    release_date: null,
    play_count: overrides.plays ?? 0,
    valence: overrides.valence ?? 0.5,
    energy: overrides.energy ?? 0.5,
    mood_tags: overrides.moods ?? [],
    activity_tags: overrides.activities ?? [],
    features_source: "atmosphere",
  });
}

describe("keyword fallback interpreter (proposal objective 2 test set)", () => {
  const level = (value: number | null) => (value === null ? null : value < 0.45 ? "low" : value > 0.55 ? "high" : "mid");

  it("covers at least 27 of the 30 test queries", () => {
    const failures: string[] = [];
    for (const { q, expect: wanted } of queries.queries as { q: string; expect: Record<string, string> }[]) {
      const result = heuristicInterpretation(q);
      const ok =
        result.isDescriptive &&
        (!wanted.energy || level(result.targetEnergy) === wanted.energy) &&
        (!wanted.valence || level(result.targetValence) === wanted.valence) &&
        (!wanted.activity || result.activities.includes(wanted.activity)) &&
        (!wanted.mood || result.moods.includes(wanted.mood)) &&
        (!wanted.genre || result.genres.some((genre) => genre.replace("-", " ") === wanted.genre || genre === wanted.genre));
      if (!ok) failures.push(q);
    }
    // ≥ 90% (27/30) is the proposal's target; OpenAI is expected to do better.
    expect(failures.length, `failed: ${failures.join(" | ")}`).toBeLessThanOrEqual(3);
  });

  it("treats a bare title as a lookup, not a description", () => {
    expect(heuristicInterpretation("starboy").isDescriptive).toBe(false);
  });
});

describe("validateInterpretation", () => {
  it("drops malformed fields and clamps numbers", () => {
    const result = validateInterpretation(
      { moods: ["Calm", 4, ""], genres: "pop", targetEnergy: 3, targetValence: "high", activities: ["study"] },
      "calm study"
    );
    expect(result).toMatchObject({ moods: ["calm"], genres: [], targetEnergy: 1, targetValence: null, activities: ["study"] });
  });

  it("rejects output with no usable signal", () => {
    expect(validateInterpretation({ summary: "nothing" }, "x")).toBeNull();
    expect(validateInterpretation("not json", "x")).toBeNull();
  });
});

describe("rankCatalog", () => {
  const catalog = [
    song("calm-lofi", { genre: "lofi", energy: 0.2, valence: 0.45, activities: ["study"], moods: ["calm"] }),
    song("party", { genre: "edm", energy: 0.92, valence: 0.85, activities: ["party"] }),
    song("sad-piano", { genre: "piano", energy: 0.18, valence: 0.15, moods: ["sad"] }),
  ];

  it("puts the calm study song first for a study query", () => {
    const results = rankCatalog(catalog, heuristicInterpretation("calm songs for studying at night"));
    expect(results[0]?.song.id).toBe("calm-lofi");
    expect(results.find((item) => item.song.id === "party")).toBeUndefined();
    expect(results[0].reason).not.toBe("");
  });

  it("finds high-energy songs for a workout", () => {
    const results = rankCatalog(catalog, heuristicInterpretation("upbeat songs for a morning run"));
    expect(results[0]?.song.id).toBe("party");
  });

  it("ignores placeholder 0.5/0.5 features", () => {
    const placeholder = rowToFeatures({ id: "p", title: "P", artist_id: "a", artist_name: "A", duration_ms: 1, stream_url: "", valence: 0.5, energy: 0.5 });
    expect(placeholder.energy).toBeNull();
    expect(placeholder.valence).toBeNull();
  });

  it("limits each artist to two results", () => {
    const sameArtist = [1, 2, 3, 4].map((n) => song(`s${n}`, { artist: "solo", genre: "jazz", energy: 0.2 }));
    expect(rankCatalog(sameArtist, heuristicInterpretation("slow jazz")).length).toBe(2);
  });
});

describe("taste profile and recommendations", () => {
  const catalog = [
    song("indie-1", { genre: "indie", energy: 0.25, valence: 0.4, artist: "A" }),
    song("indie-2", { genre: "indie", energy: 0.3, valence: 0.45, artist: "B" }),
    song("indie-3", { genre: "indie", energy: 0.28, valence: 0.5, artist: "C" }),
    song("metal-1", { genre: "metal", energy: 0.95, valence: 0.2, artist: "D" }),
    song("pop-1", { genre: "pop", energy: 0.7, valence: 0.8, artist: "E", plays: 900 }),
  ];
  const signals: TasteSignals = {
    likedSongIds: ["indie-1"],
    historySongIds: ["indie-2", "indie-2"],
    followedArtistIds: [],
    followedArtistNames: {},
  };

  it("builds a calm indie profile", () => {
    const profile = buildTasteProfile(signals, catalog);
    expect(profile.topGenres[0]).toBe("indie");
    expect(profile.averageEnergy).toBeLessThan(0.35);
    expect(profile.label).toBe("calm indie");
  });

  it("recommends unheard songs that fit, with a reason", () => {
    const items = recommend(buildTasteProfile(signals, catalog), catalog, signals);
    expect(items.map((item) => item.song.id)).not.toContain("indie-1");
    expect(items.map((item) => item.song.id)).not.toContain("indie-2");
    expect(items[0].song.id).toBe("indie-3");
    expect(items[0].reason).toBe("Because you like calm indie");
  });

  it("falls back to popular songs for new users", () => {
    const empty: TasteSignals = { likedSongIds: [], historySongIds: [], followedArtistIds: [], followedArtistNames: {} };
    const items = recommend(buildTasteProfile(empty, catalog), catalog, empty);
    expect(items[0].song.id).toBe("pop-1");
    expect(items[0].reason).toBe("Popular on AURA right now");
  });

  it("explains follows by artist name", () => {
    const followSignals: TasteSignals = { ...signals, followedArtistIds: ["D"], followedArtistNames: { D: "Doom Band" } };
    const items = recommend(buildTasteProfile(followSignals, catalog), catalog, followSignals);
    expect(items.find((item) => item.song.id === "metal-1")?.reason).toBe("Because you follow Doom Band");
  });
});

import { Hono } from "hono";
import type { AtmosphereProfile, Env, LyricLine, MoodRequest, MoodResponse, Song, SongSectionProfile } from "../types";
import { rowToSong } from "../lib/mappers";
import { getSupabase } from "../lib/supabase";
import { invalidJsonResponse, likeContains, readJsonBody, sanitizeIds } from "../lib/validation";
import { generateAtmosphereProfile, generateSectionTimeline, interpretMood } from "../lib/openai";
import { sanitizeAtmosphereProfile } from "../lib/atmosphere/profileSchema";
import { estimatedTimeline, validateTimeline } from "../lib/atmosphere/sections";
import { fetchLyrics } from "../lib/lyricsProvider";
import { tagsFromAtmosphere } from "../lib/discovery/featureTags";

/**
 * Implements AtmosphereApi.kt's two endpoints. This is the ONLY route file
 * that calls OpenAI — matches Section 9 of the project spec exactly:
 * song/lyrics -> OpenAI -> structured AtmosphereProfile, cached in Supabase
 * after the first generation so repeat plays don't re-call OpenAI.
 */
export const atmosphereRoutes = new Hono<{ Bindings: Env }>();

/**
 * Shared core: given a Song (and optional user mood text), return its
 * AtmosphereProfile — checking the Supabase cache first, generating via
 * OpenAI + lyrics lookup only on a cache miss.
 *
 * NOTE: profiles generated WITH a user mood (resonant lyrics depend on it)
 * are intentionally NOT cached, since the same song needs a different
 * resonant-lyric profile per listener mood. Mood-less profiles ARE cached.
 */
/** Runs work after the response is sent (Cloudflare `waitUntil`). */
type Defer = (work: Promise<unknown>) => void;

async function getOrGenerateAtmosphere(
  env: Env,
  song: Song,
  userMoodText: string | null,
  defer: Defer,
): Promise<AtmosphereProfile> {
  const supabase = getSupabase(env);
  const lyrics = await getLyricLines(env, song);

  let profile: AtmosphereProfile | null = null;
  if (!userMoodText) {
    const { data: cached } = await supabase
      .from("atmosphere_profiles")
      .select("profile_json")
      .eq("song_id", song.id)
      .maybeSingle();
    if (cached?.profile_json) profile = sanitizeAtmosphereProfile(cached.profile_json, song.id);
  }

  if (!profile) {
    const lyricsText = lyrics.length ? lyrics.map((line) => line.text).join("\n") : null;
    profile = await generateAtmosphereProfile(env, song, lyricsText, userMoodText);
    if (!userMoodText) {
      await supabase.from("atmosphere_profiles").upsert({ song_id: song.id, profile_json: profile });
      await recordSongFeatures(env, song.id, profile);
    }
  }

  return { ...profile, sectionProfiles: await getSectionTimeline(env, song, profile, lyrics, defer) };
}

/** Timed lyrics from the shared cache, fetching from LRCLIB once on a miss. */
async function getLyricLines(env: Env, song: Song): Promise<LyricLine[]> {
  const supabase = getSupabase(env);
  const { data: cached } = await supabase
    .from("lyrics_cache")
    .select("lyrics_json")
    .eq("song_id", song.id)
    .maybeSingle();
  if (Array.isArray(cached?.lyrics_json)) return cached.lyrics_json as LyricLine[];

  const lines = await fetchLyrics(song.title, song.artistName, song.durationMs).catch(() => null);
  if (lines && lines.length > 0) {
    await supabase.from("lyrics_cache").upsert({ song_id: song.id, lyrics_json: lines });
    return lines;
  }
  return [];
}

/**
 * The song's section timeline. A stored AI timeline is used when present;
 * otherwise an estimate (from lyrics timing and duration) is returned at once
 * and the AI timeline is generated in the background for the next play.
 * Sections depend only on the song, so they're shared by mood and non-mood plays.
 */
async function getSectionTimeline(
  env: Env,
  song: Song,
  profile: AtmosphereProfile,
  lyrics: LyricLine[],
  defer: Defer,
): Promise<SongSectionProfile[]> {
  const supabase = getSupabase(env);
  const stored = await supabase.from("song_sections").select("sections_json").eq("song_id", song.id).maybeSingle();
  if (!stored.error && Array.isArray(stored.data?.sections_json) && stored.data.sections_json.length) {
    return stored.data.sections_json as SongSectionProfile[];
  }

  // Table missing (migration not run yet): estimate only, don't call OpenAI.
  if (!stored.error) {
    defer(
      generateSectionTimeline(env, song, profile, lyrics)
        .then((raw) => validateTimeline(raw, profile, song.durationMs))
        .then(async (timeline) => {
          if (!timeline) return;
          const { error } = await supabase.from("song_sections").upsert({ song_id: song.id, sections_json: timeline });
          if (error) console.warn("Section timeline was not stored:", error.message);
        })
        .catch((error: unknown) => console.warn("Section timeline generation failed:", (error as Error).message)),
    );
  }
  return estimatedTimeline(profile, song.durationMs, lyrics);
}

function deferFrom(c: { executionCtx: { waitUntil(promise: Promise<unknown>): void } }): Defer {
  return (work) => {
    try {
      c.executionCtx.waitUntil(work);
    } catch {
      // No execution context (e.g. tests): let the promise run unawaited.
      void work;
    }
  };
}

atmosphereRoutes.get("/song/:songId", async (c) => {
  const songId = c.req.param("songId");
  const supabase = getSupabase(c.env);

  const { data: songRow, error } = await supabase.from("songs").select("*").eq("id", songId).single();
  if (error || !songRow) return c.json({ error: "Song not found" }, 404);

  try {
    const profile = await getOrGenerateAtmosphere(c.env, rowToSong(songRow), null, deferFrom(c));
    return c.json(profile);
  } catch (e) {
    return c.json({ error: `Atmosphere generation failed: ${(e as Error).message}` }, 500);
  }
});

atmosphereRoutes.post("/mood", async (c) => {
  const body = await readJsonBody<MoodRequest>(c);
  if (!body) return invalidJsonResponse(c);
  const moodText = typeof body.moodText === "string" ? body.moodText.trim() : "";
  if (!moodText) {
    return c.json({ error: "moodText is required" }, 400);
  }
  const recentlyPlayedSongIds = sanitizeIds(body.recentlyPlayedSongIds);

  const supabase = getSupabase(c.env);

  try {
    const interpretation = await interpretMood(c.env, moodText);

    // Query the real catalog using AI-derived targets — OpenAI never invents
    // a song; it only interprets the user's request.
    let query = supabase
      .from("songs")
      .select("*")
      .gte("valence", Math.max(0, interpretation.targetValence - 0.25))
      .lte("valence", Math.min(1, interpretation.targetValence + 0.25))
      .gte("energy", Math.max(0, interpretation.targetEnergy - 0.25))
      .lte("energy", Math.min(1, interpretation.targetEnergy + 0.25));

    if (recentlyPlayedSongIds.length > 0) {
      query = query.not("id", "in", `(${recentlyPlayedSongIds.join(",")})`);
    }

    // requestedSongTitle/requestedArtist come from the model, which echoes
    // user text — escape them like any other user input.
    const requestedTitle =
      typeof interpretation.requestedSongTitle === "string" ? interpretation.requestedSongTitle.trim() : "";
    if (requestedTitle) {
      query = supabase.from("songs").select("*").ilike("title", likeContains(requestedTitle));
      if (typeof interpretation.requestedArtist === "string" && interpretation.requestedArtist.trim()) {
        query = query.ilike("artist_name", likeContains(interpretation.requestedArtist));
      }
    }

    const { data: candidates, error } = await query.limit(10);
    if (error) return c.json({ error: error.message }, 500);
    if (requestedTitle && (!candidates || candidates.length === 0)) {
      return c.json({ error: "That song is not available in the catalog" }, 404);
    }

    const pool =
      candidates && candidates.length > 0 ? candidates : (await supabase.from("songs").select("*").limit(10)).data;
    if (!pool || pool.length === 0) return c.json({ error: "No songs available in catalog" }, 404);

    const songs = pool.map(rowToSong);
    const isDirectPlay = interpretation.mode === "direct_play";
    if (!isDirectPlay) {
      const response: MoodResponse = {
        mode: "recommendations",
        reply: interpretation.reply,
        songs,
        song: null,
        atmosphereProfile: null,
      };
      return c.json(response);
    }

    const song = songs[0];

    const profile = await getOrGenerateAtmosphere(c.env, song, moodText, deferFrom(c));

    const response: MoodResponse = {
      mode: "direct_play",
      reply: interpretation.reply,
      songs: [song],
      song,
      atmosphereProfile: profile,
    };
    return c.json(response);
  } catch (e) {
    return c.json({ error: `Mood processing failed: ${(e as Error).message}` }, 500);
  }
});

/**
 * Copies the song's measured feel (energy, valence, mood/activity tags) onto
 * its catalogue row so natural-language search and recommendations can use
 * it. Only mood-less profiles are stored, since those describe the song alone.
 * Failure is logged, never surfaced: playback must not depend on it.
 */
async function recordSongFeatures(env: Env, songId: string, profile: AtmosphereProfile) {
  const { moodTags, activityTags } = tagsFromAtmosphere(profile);
  const supabase = getSupabase(env);
  const { error } = await supabase
    .from("songs")
    .update({
      energy: profile.energy,
      valence: profile.valence,
      mood_tags: moodTags,
      activity_tags: activityTags,
      features_source: "atmosphere",
    })
    .eq("id", songId);
  if (!error) return;
  // Before the Phase 2 migration the tag columns don't exist; still save energy/valence.
  const fallback = await supabase
    .from("songs")
    .update({ energy: profile.energy, valence: profile.valence })
    .eq("id", songId);
  if (fallback.error) console.warn("Song features were not saved:", fallback.error.message);
}

import { Hono } from "hono";
import type { Env, LyricsResponse } from "../types";
import { getSupabase } from "../lib/supabase";
import { fetchLyrics } from "../lib/lyricsProvider";

/**
 * Implements LyricsApi.kt's one endpoint. Reuses the same lyrics_cache table
 * atmosphere.ts writes to, so a song's lyrics are only ever fetched from
 * LRCLIB once, regardless of which route triggers the first fetch.
 */
export const lyricsRoutes = new Hono<{ Bindings: Env }>();

lyricsRoutes.get("/:songId", async (c) => {
  const songId = c.req.param("songId");
  const supabase = getSupabase(c.env);

  const { data: cached } = await supabase
    .from("lyrics_cache")
    .select("lyrics_json")
    .eq("song_id", songId)
    .single();

  if (cached?.lyrics_json) {
    const response: LyricsResponse = { songId, lines: cached.lyrics_json };
    return c.json(response);
  }

  const { data: songRow, error } = await supabase.from("songs").select("*").eq("id", songId).single();
  if (error || !songRow) return c.json({ error: "Song not found" }, 404);

  const lines = await fetchLyrics(songRow.title, songRow.artist_name, songRow.duration_ms).catch(() => null);
  if (!lines) {
    const empty: LyricsResponse = { songId, lines: [] };
    return c.json(empty);
  }

  await supabase.from("lyrics_cache").upsert({ song_id: songId, lyrics_json: lines });

  const response: LyricsResponse = { songId, lines };
  return c.json(response);
});

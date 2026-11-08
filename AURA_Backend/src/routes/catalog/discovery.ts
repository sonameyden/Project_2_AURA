import { Hono } from "hono";
import type { AppEnv } from "../../lib/context";
import { rowToAlbum, rowToArtist, rowToPlaylist, rowToSong } from "../../lib/mappers";
import { findReadablePlaylist } from "../../lib/playlistAccess";
import { getSupabase } from "../../lib/supabase";
import { fetchCatalog } from "../../lib/discovery/catalog";
import { loadTasteSignals } from "../../lib/discovery/signals";
import { buildTasteProfile, recommend } from "../../lib/discovery/tasteProfile";
import { likeContains, likeExact, orFilterValue } from "../../lib/validation";

/**
 * Search, browsing and discovery: unified search, genres, trending,
 * recommendations and public playlists. Read-only.
 */
export const discoveryRoutes = new Hono<AppEnv>();

/** `title` or `artist_name` contains the term; safe for user input. */
function songTitleOrArtistFilter(term: string): string {
  const pattern = orFilterValue(likeContains(term));
  return `title.ilike.${pattern},artist_name.ilike.${pattern}`;
}

discoveryRoutes.get("/songs/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json([]);

  const { data, error } = await getSupabase(c.env).from("songs").select("*").or(songTitleOrArtistFilter(q)).limit(30);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToSong));
});

discoveryRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ error: "q is required" }, 400);

  const pattern = likeContains(q);
  const supabase = getSupabase(c.env);
  const [songs, artists, albums, playlists] = await Promise.all([
    supabase.from("songs").select("*").or(songTitleOrArtistFilter(q)).limit(20),
    supabase.from("artists").select("*").ilike("name", pattern).limit(20),
    supabase.from("albums").select("*").ilike("title", pattern).limit(20),
    supabase.from("playlists").select("*").eq("is_public", true).ilike("title", pattern).limit(20),
  ]);

  const firstError = [songs, artists, albums, playlists].find((result) => result.error)?.error;
  if (firstError) return c.json({ error: firstError.message }, 500);

  return c.json({
    songs: (songs.data ?? []).map(rowToSong),
    artists: (artists.data ?? []).map(rowToArtist),
    albums: (albums.data ?? []).map(rowToAlbum),
    playlists: (playlists.data ?? []).map(rowToPlaylist),
  });
});

// Registered before albums.ts's `/albums/:id`, so "search" is never read as an id.
discoveryRoutes.get("/albums/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ error: "q is required" }, 400);

  const { data, error } = await getSupabase(c.env).from("albums").select("*").ilike("title", likeContains(q)).limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToAlbum));
});

discoveryRoutes.get("/genres", async (c) => {
  const { data, error } = await getSupabase(c.env)
    .from("songs")
    .select("genre")
    .not("genre", "is", null)
    .order("genre", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  const genres = [
    ...new Set(
      (data ?? [])
        .map((row: any) => row.genre)
        .filter((genre: unknown): genre is string => typeof genre === "string" && genre.length > 0),
    ),
  ];
  return c.json(genres);
});

discoveryRoutes.get("/genres/:genre/songs", async (c) => {
  const genre = c.req.param("genre");
  const { data, error } = await getSupabase(c.env).from("songs").select("*").ilike("genre", likeExact(genre)).limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToSong));
});

discoveryRoutes.get("/playlists", async (c) => {
  const { data, error } = await getSupabase(c.env)
    .from("playlists")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToPlaylist));
});

discoveryRoutes.get("/playlists/:id", async (c) => {
  try {
    const playlist = await findReadablePlaylist(getSupabase(c.env), c.req.param("id"), c.get("auth").uid);
    if (!playlist) return c.json({ error: "Playlist not found" }, 404);
    return c.json(rowToPlaylist(playlist));
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

discoveryRoutes.get("/trending", async (c) => {
  const { data, error } = await getSupabase(c.env)
    .from("songs")
    .select("*")
    .order("play_count", { ascending: false })
    .limit(20);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToSong));
});

/**
 * Plain song list kept for the Kotlin app and older clients. Uses the same
 * taste-profile engine as `/discover/for-you`; `?basedOn=<songId>` narrows it
 * to songs like one track.
 */
discoveryRoutes.get("/recommendations", async (c) => {
  const supabase = getSupabase(c.env);
  const basedOnId = c.req.query("basedOn");
  try {
    const [signals, catalog] = await Promise.all([
      loadTasteSignals(supabase, c.get("auth").uid),
      fetchCatalog(supabase),
    ]);
    const seed = basedOnId ? catalog.find((item) => item.song.id === basedOnId) : undefined;
    const effectiveSignals = seed
      ? { ...signals, likedSongIds: [seed.song.id], historySongIds: [], followedArtistIds: [], followedArtistNames: {} }
      : signals;
    const profile = buildTasteProfile(effectiveSignals, catalog);
    return c.json(recommend(profile, catalog, effectiveSignals).map((item) => item.song));
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

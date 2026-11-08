import { Hono } from "hono";
import type { AppEnv } from "../../lib/context";
import { rowToAlbum, rowToSong } from "../../lib/mappers";
import { getSupabase, getVersionedAudioPublicUrl, storagePathFromPublicUrl } from "../../lib/supabase";
import { invalidJsonResponse, normalizeIds, readJsonBody } from "../../lib/validation";

/**
 * Album browsing and artist album management. Write routes are owner-only.
 * Static `/albums/mine` is registered before `/albums/:id` (and discovery.ts
 * mounts `/albums/search` before this file).
 */
export const albumRoutes = new Hono<AppEnv>();

albumRoutes.get("/albums", async (c) => {
  const artistId = c.req.query("artistId");
  let query = getSupabase(c.env).from("albums").select("*").order("release_date", { ascending: false }).limit(50);
  if (artistId) query = query.eq("artist_id", artistId);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToAlbum));
});

albumRoutes.get("/albums/mine", async (c) => {
  const artistId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("albums")
    .select("*")
    .eq("artist_id", artistId)
    .order("release_date", { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToAlbum));
});

albumRoutes.post("/albums", async (c) => {
  const artistId = c.get("auth").uid;
  const form = await c.req.parseBody();
  const title = typeof form.title === "string" ? form.title.trim() : "";
  const releaseDate = typeof form.releaseDate === "string" ? form.releaseDate.trim() || null : null;
  const artwork = form.artwork;

  if (!title) return c.json({ error: "title is required" }, 400);
  if (artwork !== undefined && !(artwork instanceof File)) {
    return c.json({ error: "artwork must be an image file" }, 400);
  }
  if (artwork instanceof File && !artwork.type.startsWith("image/")) {
    return c.json({ error: "Artwork must be an image file" }, 400);
  }
  if (artwork instanceof File && artwork.size > 10 * 1024 * 1024) {
    return c.json({ error: "Artwork must be 10 MB or smaller" }, 413);
  }

  const supabase = getSupabase(c.env);
  const albumId = crypto.randomUUID();
  const extension = artwork instanceof File && artwork.name.includes(".") ? artwork.name.split(".").pop() : "bin";
  const artworkPath = `albums/${artistId}/${albumId}.${extension}`;
  let artworkUrl: string | null = null;

  if (artwork instanceof File) {
    const { error } = await supabase.storage
      .from("audio")
      .upload(artworkPath, await artwork.arrayBuffer(), { contentType: artwork.type, upsert: false });
    if (error) return c.json({ error: error.message }, 500);
    artworkUrl = getVersionedAudioPublicUrl(c.env, artworkPath);
  }

  const { data, error } = await supabase
    .from("albums")
    .insert({
      id: albumId,
      title,
      artist_id: artistId,
      artwork_url: artworkUrl,
      song_ids: [],
      release_date: releaseDate,
    })
    .select("*")
    .single();

  if (error) {
    if (artworkUrl) await supabase.storage.from("audio").remove([artworkPath]);
    return c.json({ error: error.message }, 500);
  }
  return c.json(rowToAlbum(data), 201);
});

albumRoutes.post("/albums/:id/artwork", async (c) => {
  const albumId = c.req.param("id");
  const artistId = c.get("auth").uid;
  const form = await c.req.parseBody();
  const artwork = form.artwork;

  if (!(artwork instanceof File)) return c.json({ error: "artwork is required" }, 400);
  if (!artwork.type.startsWith("image/")) return c.json({ error: "Artwork must be an image file" }, 400);
  if (artwork.size > 10 * 1024 * 1024) return c.json({ error: "Artwork must be 10 MB or smaller" }, 413);

  const supabase = getSupabase(c.env);
  const { data: album, error: loadError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .single();
  if (loadError || !album) return c.json({ error: "Album not found" }, 404);

  const extension = artwork.name.includes(".") ? artwork.name.split(".").pop() : "bin";
  const artworkPath = `albums/${artistId}/${albumId}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(artworkPath, await artwork.arrayBuffer(), { contentType: artwork.type, upsert: true });
  if (uploadError) return c.json({ error: uploadError.message }, 500);

  const artworkUrl = getVersionedAudioPublicUrl(c.env, artworkPath);
  const { data, error } = await supabase
    .from("albums")
    .update({ artwork_url: artworkUrl })
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .select("*")
    .single();
  if (error || !data) return c.json({ error: error?.message ?? "Album not found" }, error ? 500 : 404);

  const previousArtworkPath = storagePathFromPublicUrl(c.env, album.artwork_url);
  if (previousArtworkPath && previousArtworkPath !== artworkPath) {
    await supabase.storage.from("audio").remove([previousArtworkPath]);
  }
  return c.json(rowToAlbum(data));
});

albumRoutes.post("/albums/:id/songs", async (c) => {
  const albumId = c.req.param("id");
  const artistId = c.get("auth").uid;
  const body = await readJsonBody<{ songId: string; songIds: string[] }>(c);
  if (!body) return invalidJsonResponse(c);
  const requestedSongIds = normalizeIds(body.songIds ?? (body.songId ? [body.songId] : []));
  if (requestedSongIds.length === 0) return c.json({ error: "songId or songIds is required" }, 400);

  const supabase = getSupabase(c.env);
  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .single();
  if (albumError || !album) return c.json({ error: "Album not found" }, 404);

  const { data: songs, error: songError } = await supabase
    .from("songs")
    .select("id, artist_id, album_id")
    .in("id", requestedSongIds)
    .eq("artist_id", artistId);
  if (songError) return c.json({ error: songError.message }, 500);
  if ((songs ?? []).length !== requestedSongIds.length) {
    return c.json({ error: "All songs must exist and belong to the signed-in artist" }, 400);
  }
  if ((songs ?? []).some((song: any) => song.album_id && song.album_id !== albumId)) {
    return c.json({ error: "A song already belongs to another album" }, 409);
  }

  const songIds = [...new Set([...(album.song_ids ?? []), ...requestedSongIds])];
  const { data, error } = await supabase
    .from("albums")
    .update({ song_ids: songIds })
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .select("*")
    .single();
  if (error) return c.json({ error: error.message }, 500);

  const { error: linkError } = await supabase
    .from("songs")
    .update({ album_id: albumId })
    .in("id", requestedSongIds)
    .eq("artist_id", artistId);
  if (linkError) return c.json({ error: linkError.message }, 500);
  return c.json(rowToAlbum(data));
});

albumRoutes.delete("/albums/:id/songs/:songId", async (c) => {
  const albumId = c.req.param("id");
  const songId = c.req.param("songId");
  const artistId = c.get("auth").uid;
  const supabase = getSupabase(c.env);
  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .single();
  if (albumError || !album) return c.json({ error: "Album not found" }, 404);

  const songIds = (album.song_ids ?? []).filter((id: string) => id !== songId);
  const { data, error } = await supabase
    .from("albums")
    .update({ song_ids: songIds })
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .select("*")
    .single();
  if (error) return c.json({ error: error.message }, 500);

  const { error: unlinkError } = await supabase
    .from("songs")
    .update({ album_id: null })
    .eq("id", songId)
    .eq("artist_id", artistId)
    .eq("album_id", albumId);
  if (unlinkError) return c.json({ error: unlinkError.message }, 500);
  return c.json(rowToAlbum(data));
});

albumRoutes.delete("/albums/:id", async (c) => {
  const albumId = c.req.param("id");
  const artistId = c.get("auth").uid;
  const supabase = getSupabase(c.env);
  const { data: album, error: loadError } = await supabase
    .from("albums")
    .select("id, artwork_url, song_ids")
    .eq("id", albumId)
    .eq("artist_id", artistId)
    .single();
  if (loadError || !album) return c.json({ error: "Album not found" }, 404);

  const { data: songs, error: songsLoadError } = await supabase
    .from("songs")
    .select("id, stream_url, artwork_url")
    .eq("album_id", albumId)
    .eq("artist_id", artistId);
  if (songsLoadError) return c.json({ error: songsLoadError.message }, 500);

  const songIds = (songs ?? []).map((song: any) => song.id);
  if (songIds.length > 0) {
    for (const table of ["atmosphere_profiles", "lyrics_cache", "liked_songs", "listening_history"]) {
      const { error } = await supabase.from(table).delete().in("song_id", songIds);
      if (error) return c.json({ error: error.message }, 500);
    }
  }

  const { error: songsDeleteError } = await supabase
    .from("songs")
    .delete()
    .eq("album_id", albumId)
    .eq("artist_id", artistId);
  if (songsDeleteError) return c.json({ error: songsDeleteError.message }, 500);

  const { error: deleteError } = await supabase.from("albums").delete().eq("id", albumId).eq("artist_id", artistId);
  if (deleteError) return c.json({ error: deleteError.message }, 500);

  const storagePaths = [
    storagePathFromPublicUrl(c.env, album.artwork_url),
    ...(songs ?? []).flatMap((song: any) => [
      storagePathFromPublicUrl(c.env, song.stream_url),
      storagePathFromPublicUrl(c.env, song.artwork_url),
    ]),
  ].filter((path): path is string => !!path);
  if (storagePaths.length > 0) {
    await supabase.storage.from("audio").remove([...new Set(storagePaths)]);
  }
  return c.json({ deleted: true, albumId, songsDeleted: songIds.length });
});

albumRoutes.get("/albums/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await getSupabase(c.env).from("albums").select("*").eq("id", id).single();

  if (error || !data) return c.json({ error: "Album not found" }, 404);
  return c.json(rowToAlbum(data));
});

albumRoutes.get("/albums/:id/songs", async (c) => {
  const albumId = c.req.param("id");
  const supabase = getSupabase(c.env);
  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("song_ids")
    .eq("id", albumId)
    .single();
  if (albumError || !album) return c.json({ error: "Album not found" }, 404);

  const songIds = normalizeIds(album.song_ids);
  if (songIds.length === 0) return c.json([]);
  const { data, error } = await supabase.from("songs").select("*").in("id", songIds);
  if (error) return c.json({ error: error.message }, 500);

  const songsById = new Map((data ?? []).map((song: any) => [song.id, song]));
  return c.json(
    songIds.flatMap((songId) => {
      const song = songsById.get(songId);
      return song ? [rowToSong(song)] : [];
    }),
  );
});

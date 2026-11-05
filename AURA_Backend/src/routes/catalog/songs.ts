import { Hono } from "hono";
import type { AppEnv } from "../../lib/context";
import { rowToSong } from "../../lib/mappers";
import {
  getAudioPublicUrl,
  getSupabase,
  getVersionedAudioPublicUrl,
  storagePathFromPublicUrl,
} from "../../lib/supabase";

/** Song upload, artwork, deletion and lookup. Write routes are owner-only. */
export const songRoutes = new Hono<AppEnv>();

songRoutes.post("/songs/upload", async (c) => {
  const auth = c.get("auth");
  const form = await c.req.parseBody();
  const file = form.file;
  const artwork = form.artwork;
  const title = typeof form.title === "string" ? form.title.trim() : "";
  const artistName = typeof form.artistName === "string" ? form.artistName.trim() : "";
  const genre = typeof form.genre === "string" ? form.genre.trim() : null;
  const albumId = typeof form.albumId === "string" ? form.albumId.trim() || null : null;
  const durationMs = Number(form.durationMs ?? 0);

  if (!(file instanceof File) || !title || !artistName || !Number.isFinite(durationMs) || durationMs <= 0) {
    return c.json({ error: "file, title, artistName, and a positive durationMs are required" }, 400);
  }
  if (!file.type.startsWith("audio/")) {
    return c.json({ error: "Only audio files are allowed" }, 400);
  }
  if (file.size > 50 * 1024 * 1024) {
    return c.json({ error: "Audio files must be 50 MB or smaller" }, 413);
  }
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
  if (albumId) {
    const { data: album, error: albumError } = await supabase
      .from("albums")
      .select("id")
      .eq("id", albumId)
      .eq("artist_id", auth.uid)
      .single();
    if (albumError || !album) return c.json({ error: "Album not found" }, 404);
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const songId = crypto.randomUUID();
  const storagePath = `uploads/${auth.uid}/${songId}.${extension}`;
  const artworkExtension = artwork instanceof File && artwork.name.includes(".")
    ? artwork.name.split(".").pop()
    : "bin";
  const artworkPath = `artwork/${auth.uid}/${songId}.${artworkExtension}`;

  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return c.json({ error: uploadError.message }, 500);

  let artworkUrl: string | null = null;
  if (artwork instanceof File) {
    const { error: artworkError } = await supabase.storage
      .from("audio")
      .upload(artworkPath, await artwork.arrayBuffer(), {
        contentType: artwork.type,
        upsert: false,
      });
    if (artworkError) {
      await supabase.storage.from("audio").remove([storagePath]);
      return c.json({ error: artworkError.message }, 500);
    }
    artworkUrl = getVersionedAudioPublicUrl(c.env, artworkPath);
  }

  const { error: artistError } = await supabase.from("artists").upsert({
    id: auth.uid,
    name: artistName,
    is_verified: false,
  });
  if (artistError) {
    await supabase.storage.from("audio").remove([storagePath, ...(artworkUrl ? [artworkPath] : [])]);
    return c.json({ error: artistError.message }, 500);
  }

  const streamUrl = getAudioPublicUrl(c.env, storagePath);
  const { data, error: songError } = await supabase
    .from("songs")
    .insert({
      id: songId,
      title,
      artist_id: auth.uid,
      artist_name: artistName,
      album_id: albumId,
      duration_ms: Math.round(durationMs),
      stream_url: streamUrl,
      artwork_url: artworkUrl,
      genre,
    })
    .select("*")
    .single();

  if (songError) {
    await supabase.storage.from("audio").remove([storagePath, ...(artworkUrl ? [artworkPath] : [])]);
    return c.json({ error: songError.message }, 500);
  }

  if (albumId) {
    const { data: album, error: albumLoadError } = await supabase
      .from("albums")
      .select("song_ids")
      .eq("id", albumId)
      .eq("artist_id", auth.uid)
      .single();
    if (albumLoadError || !album) {
      await supabase.from("songs").delete().eq("id", songId).eq("artist_id", auth.uid);
      await supabase.storage.from("audio").remove([storagePath, ...(artworkUrl ? [artworkPath] : [])]);
      return c.json({ error: "Album could not be updated" }, 500);
    }

    const { error: albumUpdateError } = await supabase
      .from("albums")
      .update({ song_ids: [...new Set([...(album.song_ids ?? []), songId])] })
      .eq("id", albumId)
      .eq("artist_id", auth.uid);
    if (albumUpdateError) {
      await supabase.from("songs").delete().eq("id", songId).eq("artist_id", auth.uid);
      await supabase.storage.from("audio").remove([storagePath, ...(artworkUrl ? [artworkPath] : [])]);
      return c.json({ error: albumUpdateError.message }, 500);
    }
  }

  return c.json(rowToSong(data), 201);
});

songRoutes.post("/songs/:id/artwork", async (c) => {
  const songId = c.req.param("id");
  const artistId = c.get("auth").uid;
  const form = await c.req.parseBody();
  const artwork = form.artwork;

  if (!(artwork instanceof File)) return c.json({ error: "artwork is required" }, 400);
  if (!artwork.type.startsWith("image/")) return c.json({ error: "Artwork must be an image file" }, 400);
  if (artwork.size > 10 * 1024 * 1024) {
    return c.json({ error: "Artwork must be 10 MB or smaller" }, 413);
  }

  const supabase = getSupabase(c.env);
  const { data: song, error: loadError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .eq("artist_id", artistId)
    .single();

  if (loadError || !song) return c.json({ error: "Song not found" }, 404);

  const extension = artwork.name.includes(".") ? artwork.name.split(".").pop() : "bin";
  const artworkPath = `artwork/${artistId}/${songId}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(artworkPath, await artwork.arrayBuffer(), {
      contentType: artwork.type,
      upsert: true,
    });

  if (uploadError) return c.json({ error: uploadError.message }, 500);

  const artworkUrl = getVersionedAudioPublicUrl(c.env, artworkPath);
  const { data, error } = await supabase
    .from("songs")
    .update({ artwork_url: artworkUrl })
    .eq("id", songId)
    .eq("artist_id", artistId)
    .select("*")
    .single();

  if (error || !data) return c.json({ error: error?.message ?? "Song not found" }, error ? 500 : 404);

  const previousArtworkPath = storagePathFromPublicUrl(c.env, song.artwork_url);
  if (previousArtworkPath && previousArtworkPath !== artworkPath) {
    await supabase.storage.from("audio").remove([previousArtworkPath]);
  }

  return c.json(rowToSong(data));
});

songRoutes.get("/songs/artist/:artistId", async (c) => {
  const artistId = c.req.param("artistId");
  const { data, error } = await getSupabase(c.env)
    .from("songs")
    .select("*")
    .eq("artist_id", artistId)
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToSong));
});

songRoutes.delete("/songs/:id", async (c) => {
  const songId = c.req.param("id");
  const artistId = c.get("auth").uid;
  const supabase = getSupabase(c.env);
  const { data: song, error: loadError } = await supabase
    .from("songs")
    .select("id, artist_id, stream_url, artwork_url")
    .eq("id", songId)
    .eq("artist_id", artistId)
    .single();

  if (loadError || !song) return c.json({ error: "Song not found" }, 404);

  const { error: atmosphereDeleteError } = await supabase
    .from("atmosphere_profiles")
    .delete()
    .eq("song_id", songId);
  if (atmosphereDeleteError) return c.json({ error: atmosphereDeleteError.message }, 500);

  const { error: lyricsDeleteError } = await supabase
    .from("lyrics_cache")
    .delete()
    .eq("song_id", songId);
  if (lyricsDeleteError) return c.json({ error: lyricsDeleteError.message }, 500);

  const { error: deleteError } = await supabase
    .from("songs")
    .delete()
    .eq("id", songId)
    .eq("artist_id", artistId);

  if (deleteError) return c.json({ error: deleteError.message }, 500);

  const storagePaths = [
    storagePathFromPublicUrl(c.env, song.stream_url),
    storagePathFromPublicUrl(c.env, song.artwork_url),
  ].filter((path): path is string => !!path);
  if (storagePaths.length > 0) {
    await supabase.storage.from("audio").remove(storagePaths);
  }

  return c.json({ deleted: true, songId });
});

// After every static `/songs/<word>` route (discovery.ts mounts `/songs/search` first).
songRoutes.get("/songs/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await getSupabase(c.env).from("songs").select("*").eq("id", id).single();

  if (error || !data) return c.json({ error: "Song not found" }, 404);
  return c.json(rowToSong(data));
});

import { Hono, type Context } from "hono";
import { deleteArtistContent } from "../../lib/accountDeletion";
import type { AppEnv } from "../../lib/context";
import { rowToArtist, rowToSong } from "../../lib/mappers";
import { getSupabase, getVersionedAudioPublicUrl } from "../../lib/supabase";
import { invalidJsonResponse, readJsonBody } from "../../lib/validation";

/**
 * Artist profiles, follows and artist song lists.
 *
 * Order matters: Hono tries routes in registration order, so every static
 * `/artists/me…` and `/artists/following` route is registered before the
 * matching `/artists/:id…` route.
 */
export const artistRoutes = new Hono<AppEnv>();

artistRoutes.get("/artists/me", async (c) => {
  const artistId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env).from("artists").select("*").eq("id", artistId).single();

  if (error || !data) return c.json({ error: "Artist profile not found" }, 404);
  return c.json(rowToArtist(data));
});

artistRoutes.get("/artists", async (c) => {
  const { data, error } = await getSupabase(c.env)
    .from("artists")
    .select("*")
    .order("name", { ascending: true })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToArtist));
});

artistRoutes.post("/artists/:id/follow", async (c) => {
  const userId = c.get("auth").uid;
  const artistId = c.req.param("id");
  const supabase = getSupabase(c.env);

  const { data: artist, error: artistError } = await supabase.from("artists").select("id").eq("id", artistId).single();

  if (artistError || !artist) return c.json({ error: "Artist not found" }, 404);

  const { error } = await supabase
    .from("artist_follows")
    .upsert({ user_id: userId, artist_id: artistId }, { onConflict: "user_id,artist_id" });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ following: true, artistId });
});

artistRoutes.delete("/artists/:id/follow", async (c) => {
  const userId = c.get("auth").uid;
  const artistId = c.req.param("id");
  const { error } = await getSupabase(c.env)
    .from("artist_follows")
    .delete()
    .eq("user_id", userId)
    .eq("artist_id", artistId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ following: false, artistId });
});

artistRoutes.get("/artists/following", async (c) => {
  const userId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("artist_follows")
    .select("created_at, artists(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).flatMap((row: any) => (row.artists ? [rowToArtist(row.artists)] : [])));
});

artistRoutes.get("/artists/:id/followers", async (c) => {
  const artistId = c.req.param("id");
  const supabase = getSupabase(c.env);
  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id, follower_count")
    .eq("id", artistId)
    .single();

  if (artistError || !artist) return c.json({ error: "Artist not found" }, 404);
  const { count, error } = await supabase
    .from("artist_follows")
    .select("user_id", { count: "exact", head: true })
    .eq("artist_id", artistId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ artistId, followerCount: count ?? artist.follower_count ?? 0 });
});

/** Real numbers for the artist page's Insights cards (Project II). */
artistRoutes.get("/artists/:id/stats", async (c) => {
  const artistId = c.req.param("id") === "me" ? c.get("auth").uid : c.req.param("id");
  const supabase = getSupabase(c.env);
  const [songs, followers] = await Promise.all([
    supabase.from("songs").select("id, play_count").eq("artist_id", artistId),
    supabase.from("artist_follows").select("user_id", { count: "exact", head: true }).eq("artist_id", artistId),
  ]);
  if (songs.error) return c.json({ error: songs.error.message }, 500);
  const songIds = (songs.data ?? []).map((song: any) => song.id);
  const likes = songIds.length
    ? await supabase.from("liked_songs").select("song_id", { count: "exact", head: true }).in("song_id", songIds)
    : { count: 0, error: null };
  if (likes.error) return c.json({ error: likes.error.message }, 500);

  return c.json({
    artistId,
    followers: followers.count ?? 0,
    songs: songIds.length,
    likes: likes.count ?? 0,
    plays: (songs.data ?? []).reduce((sum: number, song: any) => sum + (song.play_count ?? 0), 0),
  });
});

artistRoutes.get("/artists/:id/following", async (c) => {
  const userId = c.get("auth").uid;
  const artistId = c.req.param("id");
  const { data, error } = await getSupabase(c.env)
    .from("artist_follows")
    .select("user_id")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ artistId, following: !!data });
});

async function createArtist(c: Context<AppEnv>) {
  const body = await readJsonBody<{ name: string; bio: string | null; imageUrl: string | null }>(c);
  if (!body) return invalidJsonResponse(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name) return c.json({ error: "name is required" }, 400);

  const artistId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("artists")
    .upsert({
      id: artistId,
      name,
      bio: body.bio ?? null,
      image_url: body.imageUrl ?? null,
      is_verified: false,
    })
    .select("*")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(rowToArtist(data), 201);
}

artistRoutes.post("/artists/me", createArtist);
artistRoutes.post("/artists", createArtist);

artistRoutes.post("/artists/me/profile-image", async (c) => {
  const form = await c.req.parseBody();
  const file = form.file;

  if (!(file instanceof File)) {
    return c.json({ error: "file is required" }, 400);
  }
  if (!file.type.startsWith("image/")) {
    return c.json({ error: "Only image files are allowed" }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "Profile images must be 5 MB or smaller" }, 413);
  }

  const artistId = c.get("auth").uid;
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const storagePath = `artists/${artistId}/profile.${extension}`;
  const supabase = getSupabase(c.env);
  const { error: uploadError } = await supabase.storage.from("audio").upload(storagePath, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) return c.json({ error: uploadError.message }, 500);

  const imageUrl = getVersionedAudioPublicUrl(c.env, storagePath);
  const { data, error } = await supabase
    .from("artists")
    .update({ image_url: imageUrl })
    .eq("id", artistId)
    .select("*")
    .single();

  if (error || !data) return c.json({ error: "Artist profile not found" }, 404);
  return c.json(rowToArtist(data));
});

async function listSongsByArtist(c: Context<AppEnv>, artistId: string) {
  const { data, error } = await getSupabase(c.env).from("songs").select("*").eq("artist_id", artistId).limit(50);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map(rowToSong));
}

artistRoutes.get("/artists/me/songs", (c) => listSongsByArtist(c, c.get("auth").uid));
artistRoutes.get("/artists/:id/songs", (c) => listSongsByArtist(c, c.req.param("id")));

artistRoutes.get("/artists/:id", async (c) => {
  const id = c.req.param("id");
  const { data, error } = await getSupabase(c.env).from("artists").select("*").eq("id", id).single();

  if (error || !data) return c.json({ error: "Artist not found" }, 404);
  return c.json(rowToArtist(data));
});

artistRoutes.delete("/artists/me", async (c) => {
  const artistId = c.get("auth").uid;
  try {
    await deleteArtistContent(c.env, artistId);
    return c.json({ deleted: true, artistId, userAccountPreserved: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

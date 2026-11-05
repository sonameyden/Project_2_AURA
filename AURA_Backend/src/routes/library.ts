import { Hono } from "hono";
import { deleteFirebaseUser, deleteUserData } from "../lib/accountDeletion";
import type { AppEnv } from "../lib/context";
import { rowToSong } from "../lib/mappers";
import { playlistRoutes } from "./playlists";
import { getSupabase, getVersionedAudioPublicUrl } from "../lib/supabase";
import { invalidJsonResponse, readJsonBody } from "../lib/validation";

export const libraryRoutes = new Hono<AppEnv>();

libraryRoutes.route("/playlists", playlistRoutes);

libraryRoutes.delete("/account", async (c) => {
  const userId = c.get("auth").uid;
  const authorization = c.req.header("Authorization");
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  if (!idToken) return c.json({ error: "Missing Authorization header" }, 401);

  try {
    await deleteFirebaseUser(c.env, idToken);
    await deleteUserData(c.env, userId);
    return c.json({ deleted: true, userId });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("CREDENTIAL_TOO_OLD_LOGIN_AGAIN")) {
      return c.json({
        error: "Recent login required before deleting the account",
        code: "requires_recent_login",
      }, 401);
    }
    return c.json({ error: message }, 500);
  }
});

/** `select("*")` keeps this working before the Phase 5 columns exist. */
function profileResponse(userId: string, row: any, email: string | null) {
  return {
    userId,
    displayName: row?.display_name ?? email?.split("@")[0] ?? null,
    imageUrl: row?.image_url ?? null,
    bio: row?.bio ?? null,
    showListening: row?.show_listening !== false,
  };
}

libraryRoutes.get("/profile", async (c) => {
  const { uid, email } = c.get("auth");
  const { data, error } = await getSupabase(c.env).from("user_profiles").select("*").eq("user_id", uid).maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(profileResponse(uid, data, email));
});

/** Partial update: only the fields sent are changed. */
libraryRoutes.put("/profile", async (c) => {
  const body = await readJsonBody<{ displayName: string | null; bio: string | null; showListening: boolean }>(c);
  if (!body) return invalidJsonResponse(c);
  const changes: Record<string, unknown> = {};

  if ("displayName" in body) {
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() || null : null;
    if (displayName && displayName.length > 50) return c.json({ error: "displayName must be 50 characters or fewer" }, 400);
    changes.display_name = displayName;
  }
  if ("bio" in body) {
    const bio = typeof body.bio === "string" ? body.bio.trim() || null : null;
    if (bio && bio.length > 300) return c.json({ error: "bio must be 300 characters or fewer" }, 400);
    changes.bio = bio;
  }
  if (typeof body.showListening === "boolean") changes.show_listening = body.showListening;

  const { uid, email } = c.get("auth");
  const { data, error } = await getSupabase(c.env)
    .from("user_profiles")
    .upsert({ user_id: uid, ...changes, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(profileResponse(uid, data, email));
});

libraryRoutes.post("/profile-image", async (c) => {
  const form = await c.req.parseBody();
  const file = form.file;

  if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
  if (!file.type.startsWith("image/")) return c.json({ error: "Only image files are allowed" }, 400);
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "Profile images must be 5 MB or smaller" }, 413);
  }

  const userId = c.get("auth").uid;
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const storagePath = `users/${userId}/profile.${extension}`;
  const supabase = getSupabase(c.env);
  const { error: uploadError } = await supabase.storage
    .from("audio")
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: true });

  if (uploadError) return c.json({ error: uploadError.message }, 500);

  const imageUrl = getVersionedAudioPublicUrl(c.env, storagePath);
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, image_url: imageUrl, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(profileResponse(userId, data, c.get("auth").email));
});

libraryRoutes.get("/liked", async (c) => {
  const userId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("liked_songs")
    .select("song_id, created_at, songs(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).flatMap((row: any) => row.songs ? [rowToSong(row.songs)] : []));
});

libraryRoutes.post("/liked/:songId", async (c) => {
  const userId = c.get("auth").uid;
  const songId = c.req.param("songId");
  const { error } = await getSupabase(c.env)
    .from("liked_songs")
    .upsert({ user_id: userId, song_id: songId });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ liked: true, songId });
});

libraryRoutes.delete("/liked/:songId", async (c) => {
  const userId = c.get("auth").uid;
  const songId = c.req.param("songId");
  const { error } = await getSupabase(c.env)
    .from("liked_songs")
    .delete()
    .eq("user_id", userId)
    .eq("song_id", songId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ liked: false, songId });
});

libraryRoutes.post("/history/:songId", async (c) => {
  const userId = c.get("auth").uid;
  const songId = c.req.param("songId");
  const { error } = await getSupabase(c.env)
    .from("listening_history")
    .insert({ user_id: userId, song_id: songId });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ recorded: true, songId }, 201);
});

libraryRoutes.get("/history", async (c) => {
  const userId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("listening_history")
    .select("id, song_id, played_at, songs(*)")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(100);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []).map((row: any) => row.songs ? rowToSong(row.songs) : null).filter(Boolean));
});

libraryRoutes.get("/search-history", async (c) => {
  const userId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("search_history")
    .select("id, query, result_type, result_id, result_title, searched_at")
    .eq("user_id", userId)
    .order("searched_at", { ascending: false })
    .limit(20);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

libraryRoutes.post("/search-history", async (c) => {
  const userId = c.get("auth").uid;
  const body = await readJsonBody<{
    query: string;
    resultType: "song" | "artist" | "album" | "playlist" | null;
    resultId: string | null;
    resultTitle: string | null;
  }>(c);
  if (!body) return invalidJsonResponse(c);
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return c.json({ error: "query is required" }, 400);
  if (query.length > 200) return c.json({ error: "query must be 200 characters or fewer" }, 400);

  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from("search_history")
    .insert({
      user_id: userId,
      query,
      result_type: body.resultType ?? null,
      result_id: body.resultId ?? null,
      result_title: body.resultTitle ?? null,
    })
    .select("id, query, result_type, result_id, result_title, searched_at")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

libraryRoutes.delete("/search-history", async (c) => {
  const userId = c.get("auth").uid;
  const id = c.req.query("id");
  let query = getSupabase(c.env).from("search_history").delete().eq("user_id", userId);
  if (id) query = query.eq("id", id);

  const { error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ deleted: true, id: id ?? null });
});

libraryRoutes.get("/worlds", async (c) => {
  const userId = c.get("auth").uid;
  const { data, error } = await getSupabase(c.env)
    .from("music_worlds")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

libraryRoutes.post("/worlds", async (c) => {
  const userId = c.get("auth").uid;
  const body = await readJsonBody<{ name: string; songId: string; atmosphereProfile: unknown }>(c);
  if (!body) return invalidJsonResponse(c);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || !body.atmosphereProfile) {
    return c.json({ error: "name and atmosphereProfile are required" }, 400);
  }

  const { data, error } = await getSupabase(c.env)
    .from("music_worlds")
    .insert({
      user_id: userId,
      name,
      song_id: typeof body.songId === "string" ? body.songId : null,
      atmosphere_profile: body.atmosphereProfile,
    })
    .select("*")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

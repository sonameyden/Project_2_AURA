import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "../lib/context";
import { rowToPlaylist, rowToSong } from "../lib/mappers";
import {
  PlaylistConflictError,
  findPlaylistWithRole,
  updatePlaylistAtomically,
  type PlaylistRole,
  type PlaylistRow,
} from "../lib/playlistAccess";
import { appendUnique, mergeOrder } from "../lib/playlistOrder";
import { getSupabase } from "../lib/supabase";
import { invalidJsonResponse, normalizeIds, readJsonBody, sanitizeIds } from "../lib/validation";

/**
 * `/library/playlists/*` — the user's playlists, plus sharing and
 * collaboration (Project II). Clients poll `GET /:id` every few seconds while
 * a playlist is open to see collaborators' changes live; `version` tells them
 * whether anything changed.
 */
export const playlistRoutes = new Hono<AppEnv>();

const INVITE_DAYS = 14;

type Person = { userId: string; displayName: string | null; imageUrl: string | null };

async function loadPeople(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, Person>> {
  const people = new Map<string, Person>();
  if (!userIds.length) return people;
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, image_url")
    .in("user_id", userIds);
  for (const row of (data ?? []) as any[]) {
    people.set(row.user_id, { userId: row.user_id, displayName: row.display_name, imageUrl: row.image_url });
  }
  for (const id of userIds) if (!people.has(id)) people.set(id, { userId: id, displayName: null, imageUrl: null });
  return people;
}

/** Playlist fields stay at the top level so older clients that expect a Playlist still work. */
function summary(row: PlaylistRow, role: PlaylistRole) {
  return {
    ...rowToPlaylist(row),
    description: row.description ?? null,
    version: typeof row.version === "number" ? row.version : 0,
    updatedAt: row.updated_at ?? null,
    role,
  };
}

async function detail(supabase: SupabaseClient, row: PlaylistRow, role: PlaylistRole, uid: string) {
  const songIds: string[] = row.song_ids ?? [];
  const [songs, collaborators] = await Promise.all([
    songIds.length ? supabase.from("songs").select("*").in("id", songIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("playlist_collaborators").select("user_id, role, created_at").eq("playlist_id", row.id),
  ]);
  if (songs.error) throw new Error(songs.error.message);
  const byId = new Map((songs.data ?? []).map((song: any) => [song.id, rowToSong(song)]));
  const collaboratorRows = (collaborators.error ? [] : (collaborators.data ?? [])) as any[];
  const people = await loadPeople(supabase, [row.owner_id, ...collaboratorRows.map((item) => item.user_id)]);

  return {
    ...summary(row, role),
    // Songs in playlist order; ids of deleted songs are skipped.
    songs: songIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    owner: people.get(row.owner_id)!,
    // True for the owner and invited collaborators (false for public-only viewers).
    isMember: role === "owner" || collaboratorRows.some((item) => item.user_id === uid),
    // Only owners and editors see who else is collaborating.
    collaborators:
      role === "viewer"
        ? []
        : collaboratorRows.map((item) => ({ ...people.get(item.user_id)!, role: item.role as "viewer" | "editor" })),
  };
}

function fail(c: any, error: unknown) {
  if (error instanceof PlaylistConflictError) return c.json({ error: error.message, code: "conflict" }, 409);
  return c.json({ error: (error as Error).message }, 500);
}

// ---------------------------------------------------------------------------
// The user's playlists
// ---------------------------------------------------------------------------

playlistRoutes.get("/", async (c) => {
  const userId = c.get("auth").uid;
  const supabase = getSupabase(c.env);
  const [owned, shared] = await Promise.all([
    supabase.from("playlists").select("*").eq("owner_id", userId).order("id", { ascending: false }),
    supabase.from("playlist_collaborators").select("role, playlists(*)").eq("user_id", userId),
  ]);
  if (owned.error) return c.json({ error: owned.error.message }, 500);

  const sharedPlaylists = (shared.error ? [] : (shared.data ?? [])).flatMap((item: any) => {
    const row = Array.isArray(item.playlists) ? item.playlists[0] : item.playlists;
    return row ? [summary(row, item.role)] : [];
  });
  return c.json([...(owned.data ?? []).map((row: any) => summary(row, "owner")), ...sharedPlaylists]);
});

playlistRoutes.post("/", async (c) => {
  const userId = c.get("auth").uid;
  const body = await readJsonBody<{
    title: string;
    songIds: string[];
    isPublic: boolean;
    coverColorHex: string | null;
    description: string;
  }>(c);
  if (!body) return invalidJsonResponse(c);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return c.json({ error: "title is required" }, 400);
  if (title.length > 80) return c.json({ error: "title must be 80 characters or fewer" }, 400);

  const { data, error } = await getSupabase(c.env)
    .from("playlists")
    .insert({
      id: crypto.randomUUID(),
      title,
      owner_id: userId,
      song_ids: normalizeIds(body.songIds),
      is_public: !!body.isPublic,
      cover_color_hex: body.coverColorHex ?? null,
    })
    .select("*")
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(summary(data, "owner"), 201);
});

// ---------------------------------------------------------------------------
// Invites (static paths first so they win over /:playlistId)
// ---------------------------------------------------------------------------

async function loadInvite(supabase: SupabaseClient, code: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) return null;
  const { data, error } = await supabase.from("playlist_invites").select("*").eq("code", code).maybeSingle();
  if (error || !data || data.revoked) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

/** What an invite opens, so the app can show "Join <playlist> as editor?". */
playlistRoutes.get("/invites/:code", async (c) => {
  const supabase = getSupabase(c.env);
  const invite = await loadInvite(supabase, c.req.param("code"));
  if (!invite) return c.json({ error: "This invite link is invalid or has expired" }, 404);

  const { data: playlist } = await supabase.from("playlists").select("*").eq("id", invite.playlist_id).maybeSingle();
  if (!playlist) return c.json({ error: "This playlist no longer exists" }, 404);
  const owner = (await loadPeople(supabase, [playlist.owner_id])).get(playlist.owner_id)!;
  const userId = c.get("auth").uid;

  return c.json({
    code: invite.code,
    role: invite.role,
    playlist: { id: playlist.id, title: playlist.title, songCount: (playlist.song_ids ?? []).length },
    owner,
    alreadyMember: playlist.owner_id === userId,
  });
});

playlistRoutes.post("/invites/:code/accept", async (c) => {
  const userId = c.get("auth").uid;
  const supabase = getSupabase(c.env);
  const invite = await loadInvite(supabase, c.req.param("code"));
  if (!invite) return c.json({ error: "This invite link is invalid or has expired" }, 404);

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, owner_id")
    .eq("id", invite.playlist_id)
    .maybeSingle();
  if (!playlist) return c.json({ error: "This playlist no longer exists" }, 404);
  if (playlist.owner_id === userId) return c.json({ playlistId: playlist.id, role: "owner" });

  // Never downgrade: an editor opening a viewer link stays an editor.
  const { data: existing } = await supabase
    .from("playlist_collaborators")
    .select("role")
    .eq("playlist_id", playlist.id)
    .eq("user_id", userId)
    .maybeSingle();
  const role = existing?.role === "editor" ? "editor" : invite.role;

  const { error } = await supabase
    .from("playlist_collaborators")
    .upsert({ playlist_id: playlist.id, user_id: userId, role, invited_by: invite.created_by });
  if (error) return c.json({ error: error.message }, 500);
  await supabase
    .from("playlist_invites")
    .update({ uses: (invite.uses ?? 0) + 1 })
    .eq("code", invite.code);
  return c.json({ playlistId: playlist.id, role });
});

// ---------------------------------------------------------------------------
// One playlist
// ---------------------------------------------------------------------------

playlistRoutes.get("/:playlistId", async (c) => {
  const supabase = getSupabase(c.env);
  try {
    const access = await findPlaylistWithRole(supabase, c.req.param("playlistId"), c.get("auth").uid, "viewer");
    if (!access) return c.json({ error: "Playlist not found" }, 404);
    return c.json(await detail(supabase, access.playlist, access.role, c.get("auth").uid));
  } catch (error) {
    return fail(c, error);
  }
});

/** Rename (owner or editor); visibility and description (owner only). */
playlistRoutes.patch("/:playlistId", async (c) => {
  const playlistId = c.req.param("playlistId");
  const body = await readJsonBody<{ title: string; isPublic: boolean; description: string | null }>(c);
  if (!body) return invalidJsonResponse(c);
  const supabase = getSupabase(c.env);

  try {
    const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "editor");
    if (!access) return c.json({ error: "Playlist not found" }, 404);
    if ((body.isPublic !== undefined || body.description !== undefined) && access.role !== "owner") {
      return c.json({ error: "Only the owner can change visibility or the description" }, 403);
    }
    const title = typeof body.title === "string" ? body.title.trim() : undefined;
    if (title !== undefined && (!title || title.length > 80)) {
      return c.json({ error: "title must be 1-80 characters" }, 400);
    }
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 300) || null : body.description;

    const saved = await updatePlaylistAtomically(
      supabase,
      playlistId,
      () => ({
        ...(title !== undefined ? { title } : {}),
        ...(typeof body.isPublic === "boolean" ? { is_public: body.isPublic } : {}),
        ...(description !== undefined ? { description } : {}),
      }),
      4,
      access.playlist,
    );
    return c.json(await detail(supabase, saved, access.role, c.get("auth").uid));
  } catch (error) {
    return fail(c, error);
  }
});

playlistRoutes.post("/:playlistId/songs", async (c) => {
  const playlistId = c.req.param("playlistId");
  const body = await readJsonBody<{ songId: string; songIds: string[] }>(c);
  if (!body) return invalidJsonResponse(c);
  const requested = normalizeIds(body.songIds ?? (body.songId ? [body.songId] : []));
  if (!requested.length) return c.json({ error: "songId or songIds array is required" }, 400);
  const supabase = getSupabase(c.env);

  try {
    const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "editor");
    if (!access) return c.json({ error: "Playlist not found" }, 404);
    const saved = await updatePlaylistAtomically(
      supabase,
      playlistId,
      (current) => ({
        song_ids: appendUnique(current.song_ids ?? [], requested),
      }),
      4,
      access.playlist,
    );
    return c.json(summary(saved, access.role));
  } catch (error) {
    return fail(c, error);
  }
});

playlistRoutes.delete("/:playlistId/songs/:songId", async (c) => {
  const playlistId = c.req.param("playlistId");
  const songId = c.req.param("songId");
  const supabase = getSupabase(c.env);

  try {
    const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "editor");
    if (!access) return c.json({ error: "Playlist not found" }, 404);
    const saved = await updatePlaylistAtomically(
      supabase,
      playlistId,
      (current) => ({
        song_ids: (current.song_ids ?? []).filter((id: string) => id !== songId),
      }),
      4,
      access.playlist,
    );
    return c.json(await detail(supabase, saved, access.role, c.get("auth").uid));
  } catch (error) {
    return fail(c, error);
  }
});

/** New song order. Songs added or removed by others meanwhile are kept (see mergeOrder). */
playlistRoutes.put("/:playlistId/order", async (c) => {
  const playlistId = c.req.param("playlistId");
  const body = await readJsonBody<{ songIds: string[] }>(c);
  if (!body || !Array.isArray(body.songIds)) return c.json({ error: "songIds array is required" }, 400);
  const requested = normalizeIds(body.songIds);
  const supabase = getSupabase(c.env);

  try {
    const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "editor");
    if (!access) return c.json({ error: "Playlist not found" }, 404);
    const saved = await updatePlaylistAtomically(
      supabase,
      playlistId,
      (current) => ({
        song_ids: mergeOrder(current.song_ids ?? [], requested),
      }),
      4,
      access.playlist,
    );
    return c.json(await detail(supabase, saved, access.role, c.get("auth").uid));
  } catch (error) {
    return fail(c, error);
  }
});

playlistRoutes.delete("/:playlistId", async (c) => {
  const playlistId = c.req.param("playlistId");
  const supabase = getSupabase(c.env);
  try {
    const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "owner");
    if (!access) return c.json({ error: "Playlist not found" }, 404);
    const { error } = await supabase.from("playlists").delete().eq("id", playlistId).eq("owner_id", c.get("auth").uid);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ deleted: true, playlistId });
  } catch (error) {
    return fail(c, error);
  }
});

// ---------------------------------------------------------------------------
// Sharing (owner only, except leaving)
// ---------------------------------------------------------------------------

playlistRoutes.post("/:playlistId/invites", async (c) => {
  const playlistId = c.req.param("playlistId");
  const body = await readJsonBody<{ role: "viewer" | "editor" }>(c);
  if (!body) return invalidJsonResponse(c);
  const role = body.role === "editor" ? "editor" : "viewer";
  const userId = c.get("auth").uid;
  const supabase = getSupabase(c.env);

  const access = await findPlaylistWithRole(supabase, playlistId, userId, "owner").catch(() => null);
  if (!access) return c.json({ error: "Playlist not found" }, 404);

  const code = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("playlist_invites")
    .insert({ code, playlist_id: playlistId, role, created_by: userId, expires_at: expiresAt });
  if (error) return c.json({ error: error.message }, 500);

  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      code,
      role,
      expiresAt,
      // https link works when pasted into any chat; it opens the app via the aura:// scheme.
      url: `${origin}/invite/${code}`,
      appUrl: `aura://invite/${code}`,
    },
    201,
  );
});

playlistRoutes.delete("/:playlistId/invites", async (c) => {
  const playlistId = c.req.param("playlistId");
  const supabase = getSupabase(c.env);
  const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "owner").catch(() => null);
  if (!access) return c.json({ error: "Playlist not found" }, 404);
  const { error } = await supabase.from("playlist_invites").update({ revoked: true }).eq("playlist_id", playlistId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ revoked: true });
});

playlistRoutes.patch("/:playlistId/collaborators/:userId", async (c) => {
  const playlistId = c.req.param("playlistId");
  const [targetId] = sanitizeIds([c.req.param("userId")]);
  const body = await readJsonBody<{ role: "viewer" | "editor" }>(c);
  if (!body || (body.role !== "viewer" && body.role !== "editor") || !targetId) {
    return c.json({ error: "role must be viewer or editor" }, 400);
  }
  const supabase = getSupabase(c.env);
  const access = await findPlaylistWithRole(supabase, playlistId, c.get("auth").uid, "owner").catch(() => null);
  if (!access) return c.json({ error: "Playlist not found" }, 404);

  const { data, error } = await supabase
    .from("playlist_collaborators")
    .update({ role: body.role })
    .eq("playlist_id", playlistId)
    .eq("user_id", targetId)
    .select("user_id")
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: "Collaborator not found" }, 404);
  return c.json(await detail(supabase, access.playlist, access.role, c.get("auth").uid));
});

/** The owner removes someone, or a collaborator leaves (userId = their own id). */
playlistRoutes.delete("/:playlistId/collaborators/:userId", async (c) => {
  const playlistId = c.req.param("playlistId");
  const userId = c.get("auth").uid;
  const [targetId] = sanitizeIds([c.req.param("userId")]);
  if (!targetId) return c.json({ error: "Invalid user id" }, 400);
  const supabase = getSupabase(c.env);

  const access = await findPlaylistWithRole(supabase, playlistId, userId, "viewer").catch(() => null);
  if (!access) return c.json({ error: "Playlist not found" }, 404);
  if (access.role !== "owner" && targetId !== userId) {
    return c.json({ error: "Only the owner can remove other collaborators" }, 403);
  }

  const { error } = await supabase
    .from("playlist_collaborators")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("user_id", targetId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ removed: true, userId: targetId });
});

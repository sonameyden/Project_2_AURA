import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single place that decides who may see or change a playlist. Every playlist
 * route loads rows through these helpers rather than querying `playlists`
 * directly.
 *
 * Roles: the owner can do everything; editors can add, remove and reorder
 * songs and rename; viewers (and anyone, for public playlists) can read.
 *
 * Each helper returns null when the playlist doesn't exist *or* the caller
 * has no access — routes answer 404 in both cases so private playlist ids
 * can't be probed.
 */

export type PlaylistRole = "owner" | "editor" | "viewer";
export type PlaylistRow = Record<string, any>;

const RANK: Record<PlaylistRole, number> = { viewer: 1, editor: 2, owner: 3 };

async function loadPlaylist(supabase: SupabaseClient, playlistId: string): Promise<PlaylistRow | null> {
  const { data, error } = await supabase.from("playlists").select("*").eq("id", playlistId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The caller's role, or null for no access. Public playlists give everyone
 * at least "viewer". If the collaborators table doesn't exist yet (migration
 * 003 not applied) only owners and public access work.
 */
export async function roleFor(supabase: SupabaseClient, playlist: PlaylistRow, uid: string): Promise<PlaylistRole | null> {
  if (playlist.owner_id === uid) return "owner";
  const { data, error } = await supabase
    .from("playlist_collaborators")
    .select("role")
    .eq("playlist_id", playlist.id)
    .eq("user_id", uid)
    .maybeSingle();
  const collaboratorRole = !error && (data?.role === "editor" || data?.role === "viewer") ? (data.role as PlaylistRole) : null;
  if (collaboratorRole) return collaboratorRole;
  return playlist.is_public === true ? "viewer" : null;
}

/** Loads a playlist if the caller has at least `minimum` access. */
export async function findPlaylistWithRole(
  supabase: SupabaseClient,
  playlistId: string,
  uid: string,
  minimum: PlaylistRole,
): Promise<{ playlist: PlaylistRow; role: PlaylistRole } | null> {
  const playlist = await loadPlaylist(supabase, playlistId);
  if (!playlist) return null;
  const role = await roleFor(supabase, playlist, uid);
  return role && RANK[role] >= RANK[minimum] ? { playlist, role } : null;
}

/** Public playlists, ones the caller owns, or ones they collaborate on. */
export async function findReadablePlaylist(supabase: SupabaseClient, playlistId: string, uid: string) {
  return (await findPlaylistWithRole(supabase, playlistId, uid, "viewer"))?.playlist ?? null;
}

/** Playlists the caller may add, remove or reorder songs in (owner or editor). */
export async function findEditablePlaylist(supabase: SupabaseClient, playlistId: string, uid: string) {
  return (await findPlaylistWithRole(supabase, playlistId, uid, "editor"))?.playlist ?? null;
}

/** Playlists the caller owns (delete, visibility, sharing, roles). */
export async function findOwnedPlaylist(supabase: SupabaseClient, playlistId: string, uid: string) {
  return (await findPlaylistWithRole(supabase, playlistId, uid, "owner"))?.playlist ?? null;
}

export async function canReadPlaylist(supabase: SupabaseClient, playlistId: string, uid: string) {
  return (await findReadablePlaylist(supabase, playlistId, uid)) !== null;
}

export async function canEditPlaylist(supabase: SupabaseClient, playlistId: string, uid: string) {
  return (await findEditablePlaylist(supabase, playlistId, uid)) !== null;
}

export class PlaylistConflictError extends Error {
  constructor() {
    super("The playlist changed too many times while saving. Please try again.");
  }
}

/**
 * Compare-and-swap update: reads the playlist, applies `change`, and writes
 * only if nobody else wrote in between (`version` unchanged), retrying a few
 * times. Falls back to a plain write when the `version` column doesn't exist
 * yet. Returns the saved row.
 *
 * Pass `initial` when the caller has just loaded the row (e.g. for the access
 * check) to skip re-reading it on the first attempt; if it is out of date the
 * version check fails and the row is reloaded as usual.
 */
export async function updatePlaylistAtomically(
  supabase: SupabaseClient,
  playlistId: string,
  change: (current: PlaylistRow) => Record<string, unknown>,
  attempts = 4,
  initial?: PlaylistRow,
): Promise<PlaylistRow> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = attempt === 0 && initial ? initial : await loadPlaylist(supabase, playlistId);
    if (!current) throw new Error("Playlist not found");
    const patch = change(current);

    if (typeof current.version !== "number") {
      const { data, error } = await supabase.from("playlists").update(patch).eq("id", playlistId).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { data, error } = await supabase
      .from("playlists")
      .update({ ...patch, version: current.version + 1, updated_at: new Date().toISOString() })
      .eq("id", playlistId)
      .eq("version", current.version)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
    // Someone else saved first: reload and re-apply our change on top.
  }
  throw new PlaylistConflictError();
}

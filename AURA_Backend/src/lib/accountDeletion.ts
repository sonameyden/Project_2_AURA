import type { Env } from "../types";
import { getSupabase } from "./supabase";

function storagePathFromPublicUrl(env: Env, url: string | null): string | null {
  if (!url) return null;
  const prefix = `${env.SUPABASE_URL}/storage/v1/object/public/audio/`;
  if (!url.startsWith(prefix)) return null;
  return decodeURIComponent(url.slice(prefix.length).split(/[?#]/, 1)[0]);
}

async function listStoragePaths(env: Env, prefix: string): Promise<string[]> {
  const { data, error } = await getSupabase(env).storage.from("audio").list(prefix);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((file: any) => file.id !== null)
    .map((file: any) => `${prefix}/${file.name}`);
}

/** Deletes an artist profile and all of its albums, songs, and storage files. */
export async function deleteArtistContent(env: Env, artistId: string): Promise<void> {
  const supabase = getSupabase(env);
  const [{ data: songs, error: songsLoadError }, { data: albums, error: albumsLoadError }] = await Promise.all([
    supabase.from("songs").select("id, stream_url, artwork_url").eq("artist_id", artistId),
    supabase.from("albums").select("id, artwork_url").eq("artist_id", artistId),
  ]);
  if (songsLoadError) throw new Error(songsLoadError.message);
  if (albumsLoadError) throw new Error(albumsLoadError.message);

  const songIds = (songs ?? []).map((song: any) => song.id);
  const storagePaths = [
    ...(songs ?? []).flatMap((song: any) => [
      storagePathFromPublicUrl(env, song.stream_url),
      storagePathFromPublicUrl(env, song.artwork_url),
    ]),
    ...(albums ?? []).map((album: any) => storagePathFromPublicUrl(env, album.artwork_url)),
  ].filter((path): path is string => !!path);
  storagePaths.push(...await listStoragePaths(env, `artists/${artistId}`));

  if (songIds.length > 0) {
    for (const table of ["atmosphere_profiles", "lyrics_cache", "liked_songs", "listening_history"]) {
      const column = table === "liked_songs" || table === "listening_history" ? "song_id" : "song_id";
      const { error } = await supabase.from(table).delete().in(column, songIds);
      if (error) throw new Error(error.message);
    }
  }

  const { error: songsDeleteError } = await supabase.from("songs").delete().eq("artist_id", artistId);
  if (songsDeleteError) throw new Error(songsDeleteError.message);

  const { error: albumsDeleteError } = await supabase.from("albums").delete().eq("artist_id", artistId);
  if (albumsDeleteError) throw new Error(albumsDeleteError.message);

  const { error: followsDeleteError } = await supabase.from("artist_follows").delete().eq("artist_id", artistId);
  if (followsDeleteError) throw new Error(followsDeleteError.message);

  const { error: artistDeleteError } = await supabase.from("artists").delete().eq("id", artistId);
  if (artistDeleteError) throw new Error(artistDeleteError.message);

  if (storagePaths.length > 0) {
    await supabase.storage.from("audio").remove([...new Set(storagePaths)]);
  }
}

export async function deleteUserData(env: Env, userId: string): Promise<void> {
  const supabase = getSupabase(env);
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("image_url")
    .eq("user_id", userId)
    .maybeSingle();
  const userStoragePaths = [
    storagePathFromPublicUrl(env, profile?.image_url ?? null),
    ...(await listStoragePaths(env, `users/${userId}`)),
  ].filter((path): path is string => !!path);
  const { data: artist } = await supabase.from("artists").select("id").eq("id", userId).maybeSingle();
  if (artist) await deleteArtistContent(env, userId);

  for (const [table, column] of [
    ["artist_follows", "user_id"],
    ["liked_songs", "user_id"],
    ["listening_history", "user_id"],
    ["music_worlds", "user_id"],
    ["playlists", "owner_id"],
    ["search_history", "user_id"],
    ["user_profiles", "user_id"],
  ] as const) {
    const { error } = await supabase.from(table).delete().eq(column, userId);
    if (error) throw new Error(error.message);
  }
  // Project II tables. They may not exist until the migrations are applied, so
  // a failure here is logged rather than blocking the account deletion.
  for (const [table, column] of [
    ["playlist_collaborators", "user_id"],
    ["playlist_invites", "created_by"],
  ] as const) {
    const { error } = await supabase.from(table).delete().eq(column, userId);
    if (error) console.warn(`Account deletion: ${table} cleanup skipped (${error.message})`);
  }
  if (userStoragePaths.length > 0) {
    await supabase.storage.from("audio").remove([...new Set(userStoragePaths)]);
  }
}

export async function deleteFirebaseUser(env: Env, idToken: string): Promise<void> {
  if (!env.FIREBASE_WEB_API_KEY) {
    throw new Error("FIREBASE_WEB_API_KEY is not configured");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) throw new Error(`Firebase account deletion failed: ${await response.text()}`);
}
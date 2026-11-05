import type { SupabaseClient } from "@supabase/supabase-js";
import type { TasteSignals } from "./tasteProfile";

const HISTORY_WINDOW = 200;

/** Likes, recent plays and followed artists for one user. */
export async function loadTasteSignals(supabase: SupabaseClient, userId: string): Promise<TasteSignals> {
  const [liked, history, follows] = await Promise.all([
    supabase.from("liked_songs").select("song_id").eq("user_id", userId),
    supabase
      .from("listening_history")
      .select("song_id")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(HISTORY_WINDOW),
    supabase.from("artist_follows").select("artist_id, artists(name)").eq("user_id", userId),
  ]);
  const failure = [liked, history, follows].find((result) => result.error)?.error;
  if (failure) throw new Error(failure.message);

  const followedArtistNames: Record<string, string> = {};
  for (const row of (follows.data ?? []) as any[]) {
    const name = Array.isArray(row.artists) ? row.artists[0]?.name : row.artists?.name;
    if (typeof name === "string") followedArtistNames[row.artist_id] = name;
  }

  return {
    likedSongIds: (liked.data ?? []).map((row: any) => row.song_id),
    historySongIds: (history.data ?? []).map((row: any) => row.song_id),
    followedArtistIds: (follows.data ?? []).map((row: any) => row.artist_id),
    followedArtistNames,
  };
}

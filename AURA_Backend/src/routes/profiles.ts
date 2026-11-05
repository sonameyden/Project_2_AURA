import { Hono } from "hono";
import type { AppEnv } from "../lib/context";
import { fetchCatalog } from "../lib/discovery/catalog";
import { loadTasteSignals } from "../lib/discovery/signals";
import { buildTasteProfile } from "../lib/discovery/tasteProfile";
import { rowToArtist, rowToPlaylist, rowToSong } from "../lib/mappers";
import { getSupabase } from "../lib/supabase";
import { sanitizeIds } from "../lib/validation";

/**
 * `GET /profiles/:userId` (or `/profiles/me`) — a listener's public profile
 * (Project II): name, photo, bio, public playlists, top genres and recent
 * listening. Recent listening and genres are hidden from others when the
 * user turns off "Show my listening".
 */
export const profileRoutes = new Hono<AppEnv>();

const RECENT_LIMIT = 12;

profileRoutes.get("/:userId", async (c) => {
  const viewerId = c.get("auth").uid;
  const requested = c.req.param("userId");
  const [userId] = requested === "me" ? [viewerId] : sanitizeIds([requested]);
  if (!userId) return c.json({ error: "Profile not found" }, 404);
  const isSelf = userId === viewerId;
  const supabase = getSupabase(c.env);

  try {
    const [profile, playlists, artist, follows, likes] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("playlists").select("*").eq("owner_id", userId).eq("is_public", true).order("id", { ascending: false }).limit(20),
      supabase.from("artists").select("*").eq("id", userId).maybeSingle(),
      supabase.from("artist_follows").select("artist_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("liked_songs").select("song_id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    // Someone with no profile row, playlists or artist page is treated as unknown.
    if (!isSelf && !profile.data && !artist.data && !(playlists.data ?? []).length) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const showListening = isSelf || profile.data?.show_listening !== false;
    let topGenres: string[] = [];
    let recentListening: ReturnType<typeof rowToSong>[] = [];
    if (showListening) {
      const [signals, catalog] = await Promise.all([loadTasteSignals(supabase, userId), fetchCatalog(supabase)]);
      topGenres = buildTasteProfile(signals, catalog).topGenres.slice(0, 5);
      const byId = new Map(catalog.map((item) => [item.song.id, item.song]));
      const seen = new Set<string>();
      for (const id of signals.historySongIds) {
        if (seen.has(id) || !byId.has(id)) continue;
        seen.add(id);
        recentListening.push(byId.get(id)!);
        if (recentListening.length >= RECENT_LIMIT) break;
      }
    }

    return c.json({
      userId,
      isSelf,
      displayName: profile.data?.display_name ?? (isSelf ? c.get("auth").email?.split("@")[0] ?? null : null),
      imageUrl: profile.data?.image_url ?? null,
      bio: profile.data?.bio ?? null,
      showListening: profile.data?.show_listening !== false,
      listeningHidden: !showListening,
      stats: {
        publicPlaylists: (playlists.data ?? []).length,
        following: follows.count ?? 0,
        likedSongs: likes.count ?? 0,
      },
      topGenres,
      recentListening,
      publicPlaylists: (playlists.data ?? []).map(rowToPlaylist),
      artist: artist.data ? rowToArtist(artist.data) : null,
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

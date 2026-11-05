import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../types";

/**
 * One Supabase client per request, using the SERVICE ROLE key — this is why
 * this code only ever runs inside the Worker, never in the Android app.
 * The service role key bypasses row-level security, which is fine here
 * because the Worker is the trusted backend, not a public client.
 */
export function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Builds a public URL for a file in Supabase Storage's "audio" bucket —
 * this is what replaces R2's role. Used once the artist-upload flow (Phase 4)
 * actually writes files here; songs.stream_url can be set to this URL's
 * output after an upload completes.
 */
export function getAudioPublicUrl(env: Env, storagePath: string): string {
  return `${env.SUPABASE_URL}/storage/v1/object/public/audio/${storagePath}`;
}

/** Adds a cache-busting version while keeping the underlying storage path stable. */
export function getVersionedAudioPublicUrl(env: Env, storagePath: string): string {
  return `${getAudioPublicUrl(env, storagePath)}?v=${Date.now()}`;
}

/** Reverse of getAudioPublicUrl: the bucket path for one of our public URLs, else null. */
export function storagePathFromPublicUrl(env: Env, url: string | null): string | null {
  if (!url) return null;
  const prefix = `${env.SUPABASE_URL}/storage/v1/object/public/audio/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length).split(/[?#]/, 1)[0];
  return decodeURIComponent(path);
}

/**
 * Expected Supabase schema (create these tables before deploying):
 *
 * songs (id text pk, title text, artist_id text, artist_name text, album_id text,
 *        duration_ms bigint, stream_url text, artwork_url text, genre text,
 *        release_date text, play_count int default 0, valence float, energy float)
 *
 * artists (id text pk, name text, bio text, image_url text,
 *          is_verified boolean default false, follower_count int default 0)
 *
 * albums (id text pk, title text, artist_id text, artwork_url text,
 *         song_ids text[], release_date text)
 *
 * playlists (id text pk, title text, owner_id text, song_ids text[],
 *            is_public boolean, cover_color_hex text)
 *
 * atmosphere_profiles (song_id text pk, profile_json jsonb, created_at timestamptz default now())
 *   -- cache table: once OpenAI generates a profile for a song, it's stored
 *   -- here and reused on every subsequent request, per Section 9 of the spec.
 *
 * lyrics_cache (song_id text pk, lyrics_json jsonb, created_at timestamptz default now())
 */

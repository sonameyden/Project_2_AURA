import type { Album, Artist, Playlist, Song } from "../types";

/**
 * Supabase row (snake_case) -> API shape (camelCase) mappers shared by every
 * route file. The API shapes mirror `src/types.ts`, which the mobile clients
 * deserialize by field name — change both sides together.
 */

export function rowToSong(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    albumId: row.album_id,
    durationMs: row.duration_ms,
    streamUrl: row.stream_url,
    artworkUrl: row.artwork_url,
    genre: row.genre,
    releaseDate: row.release_date,
  };
}

export function rowToArtist(row: any): Artist {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    imageUrl: row.image_url,
    isVerified: row.is_verified,
    followerCount: row.follower_count,
    monthlyListeners: row.monthly_listeners ?? 0,
  };
}

export function rowToAlbum(row: any): Album {
  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artworkUrl: row.artwork_url,
    songIds: row.song_ids ?? [],
    releaseDate: row.release_date,
  };
}

export function rowToPlaylist(row: any): Playlist {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    songIds: row.song_ids ?? [],
    isPublic: row.is_public,
    coverColorHex: row.cover_color_hex,
  };
}

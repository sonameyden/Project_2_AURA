import type { PlaylistDetail, PlaylistSummary, Song } from '@/core/types';

/** The list-row fields of a playlist (a detail response also carries songs, owner, collaborators). */
export function toSummary(playlist: PlaylistSummary | PlaylistDetail): PlaylistSummary {
  const { id, title, ownerId, songIds, isPublic, coverColorHex, role, version, description, updatedAt } = playlist;
  return { id, title, ownerId, songIds, isPublic, coverColorHex, role, version, description, updatedAt };
}

/**
 * The open playlist after adding `song`: the server's new song order (`saved`)
 * filled in from the songs already loaded plus the added one.
 */
export function withAddedSong(detail: PlaylistDetail, saved: PlaylistSummary, song: Song): PlaylistDetail {
  const byId = new Map(detail.songs.map((item) => [item.id, item]));
  byId.set(song.id, song);
  return {
    ...detail,
    ...toSummary(saved),
    songs: saved.songIds.flatMap((songId) => (byId.has(songId) ? [byId.get(songId)!] : [])),
  };
}

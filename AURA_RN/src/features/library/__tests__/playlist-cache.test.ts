import { describe, expect, it } from '@jest/globals';

import type { PlaylistDetail, PlaylistSummary, Song } from '@/core/types';

import { toSummary, withAddedSong } from '../lib/playlist-cache';

const song = (id: string): Song => ({
  id,
  title: `Song ${id}`,
  artistId: 'artist',
  artistName: 'Artist',
  albumId: null,
  durationMs: 1000,
  streamUrl: `https://example.com/${id}.mp3`,
  artworkUrl: null,
  genre: null,
  releaseDate: null,
});

const summary = (songIds: string[], version: number): PlaylistSummary => ({
  id: 'p1',
  title: 'Road trip',
  ownerId: 'me',
  songIds,
  isPublic: false,
  coverColorHex: null,
  role: 'owner',
  version,
  description: null,
  updatedAt: null,
});

const detail = (songs: Song[]): PlaylistDetail => ({
  ...summary(
    songs.map((item) => item.id),
    1,
  ),
  songs,
  owner: { userId: 'me', displayName: 'Me', imageUrl: null },
  collaborators: [],
});

describe('playlist cache after adding a song', () => {
  it('shows the added song at once, in the order the server saved', () => {
    const next = withAddedSong(detail([song('a'), song('b')]), summary(['a', 'b', 'c'], 2), song('c'));
    expect(next.songs.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(next.songIds).toEqual(['a', 'b', 'c']);
    expect(next.version).toBe(2);
    expect(next.owner.displayName).toBe('Me');
  });

  it("follows the server's order when a collaborator changed the playlist meanwhile", () => {
    // Someone removed "a" before our add landed; the server's order wins.
    const next = withAddedSong(detail([song('a'), song('b')]), summary(['b', 'c'], 3), song('c'));
    expect(next.songs.map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('keeps only list fields in a summary', () => {
    expect(Object.keys(toSummary(detail([song('a')]))).sort()).toEqual(
      [
        'coverColorHex',
        'description',
        'id',
        'isPublic',
        'ownerId',
        'role',
        'songIds',
        'title',
        'updatedAt',
        'version',
      ].sort(),
    );
  });
});

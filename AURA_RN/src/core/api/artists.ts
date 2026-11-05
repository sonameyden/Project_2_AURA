import type { Album, Artist, ArtistStats, Song } from '../types';
import { encode, json, request } from './client';

export const artistsApi = {
  artist: (token: string, id: string) => request<Artist>(`catalog/artists/${encode(id)}`, token),
  artistSongs: (token: string, id: string) =>
    request<Song[]>(`catalog/artists/${encode(id)}/songs`, token),
  myArtistSongs: (token: string) => request<Song[]>('catalog/artists/me/songs', token),
  artists: (token: string) => request<Artist[]>('catalog/artists', token),
  artistStats: (token: string, id: string) => request<ArtistStats>(`catalog/artists/${encode(id)}/stats`, token),
  followedArtists: (token: string) => request<Artist[]>('catalog/artists/following', token),
  followArtist: (token: string, id: string, follow: boolean) =>
    request<void>(`catalog/artists/${encode(id)}/follow`, token, { method: follow ? 'POST' : 'DELETE' }),
  isFollowingArtist: (token: string, id: string) =>
    request<{ artistId: string; following: boolean }>(`catalog/artists/${encode(id)}/following`, token),
  createArtist: (token: string, body: { name: string; bio: string }) =>
    request<Artist>('catalog/artists/me', token, json('POST', body)),
  getMyArtist: (token: string) => request<Artist>('catalog/artists/me', token),
  uploadArtistImage: (token: string, formData: FormData) =>
    request<Artist>('catalog/artists/me/profile-image', token, { method: 'POST', formData }),
  uploadSong: (token: string, formData: FormData) =>
    request<Song>('catalog/songs/upload', token, { method: 'POST', formData }),
  deleteSong: (token: string, songId: string) =>
    request<void>(`catalog/songs/${encode(songId)}`, token, { method: 'DELETE' }),
  replaceSongArtwork: (token: string, songId: string, formData: FormData) =>
    request<Song>(`catalog/songs/${encode(songId)}/artwork`, token, { method: 'POST', formData }),
  deleteArtist: (token: string) => request<void>('catalog/artists/me', token, { method: 'DELETE' }),
};

export const albumsApi = {
  albumsByArtist: (token: string, artistId: string) =>
    request<Album[]>(`catalog/albums?artistId=${encode(artistId)}`, token),
  albums: (token: string) => request<Album[]>('catalog/albums/mine', token),
  newReleases: (token: string) => request<Album[]>('catalog/albums', token),
  album: (token: string, id: string) => request<Album>(`catalog/albums/${encode(id)}`, token),
  albumSongs: (token: string, id: string) => request<Song[]>(`catalog/albums/${encode(id)}/songs`, token),
  createAlbum: (token: string, formData: FormData) =>
    request<Album>('catalog/albums', token, { method: 'POST', formData }),
  updateAlbumArtwork: (token: string, albumId: string, formData: FormData) =>
    request<Album>(`catalog/albums/${encode(albumId)}/artwork`, token, { method: 'POST', formData }),
  addSongToAlbum: (token: string, albumId: string, songId: string) =>
    request<Album>(`catalog/albums/${encode(albumId)}/songs`, token, json('POST', { songId })),
  removeSongFromAlbum: (token: string, albumId: string, songId: string) =>
    request<void>(`catalog/albums/${encode(albumId)}/songs/${encode(songId)}`, token, { method: 'DELETE' }),
  deleteAlbum: (token: string, albumId: string) =>
    request<void>(`catalog/albums/${encode(albumId)}`, token, { method: 'DELETE' }),
};

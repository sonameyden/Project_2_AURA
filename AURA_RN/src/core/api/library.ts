import type { PublicProfile, SearchHistoryEntry, Song, UserProfile } from '../types';
import { encode, json, request } from './client';

export const libraryApi = {
  likedSongs: (token: string) => request<Song[]>('library/liked', token),
  likeSong: (token: string, songId: string, liked: boolean) =>
    request<void>(`library/liked/${encode(songId)}`, token, { method: liked ? 'POST' : 'DELETE' }),
  history: (token: string) => request<Song[]>('library/history', token),
  addHistory: (token: string, songId: string) =>
    request<void>(`library/history/${encode(songId)}`, token, json('POST', {})),

  searchHistory: (token: string) => request<SearchHistoryEntry[]>('library/search-history', token),
  addSearchHistory: (
    token: string,
    body: {
      query: string;
      resultType: SearchHistoryEntry['result_type'];
      resultId: string | null;
      resultTitle: string | null;
    },
  ) => request<SearchHistoryEntry>('library/search-history', token, json('POST', body)),
  deleteSearchHistory: (token: string, id?: number) =>
    request<void>(`library/search-history${id === undefined ? '' : `?id=${id}`}`, token, { method: 'DELETE' }),

  profile: (token: string) => request<UserProfile>('library/profile', token),
  uploadProfileImage: (token: string, formData: FormData) =>
    request<UserProfile>('library/profile-image', token, { method: 'POST', formData }),
  updateProfile: (token: string, changes: { displayName?: string; bio?: string | null; showListening?: boolean }) =>
    request<UserProfile>('library/profile', token, json('PUT', changes)),
  publicProfile: (token: string, userId: string) => request<PublicProfile>(`profiles/${encode(userId)}`, token),
  deleteAccount: (token: string) => request<{ deleted: boolean }>('library/account', token, { method: 'DELETE' }),
};

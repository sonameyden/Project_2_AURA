import type { SearchResults, Song } from '../types';
import { encode, request } from './client';

export const catalogApi = {
  song: (token: string, id: string) => request<Song>(`catalog/songs/${encode(id)}`, token),
  trending: (token: string) => request<Song[]>('catalog/trending', token),
  recommendations: (token: string) => request<Song[]>('catalog/recommendations', token),
  search: (token: string, value: string, signal?: AbortSignal) =>
    request<SearchResults>(`catalog/search?q=${encode(value)}`, token, { signal }),
};

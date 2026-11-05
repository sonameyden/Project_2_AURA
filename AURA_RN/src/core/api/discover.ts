import type { ForYouResponse, NaturalSearchResponse } from '../types';
import { encode, request } from './client';

export const discoverApi = {
  naturalSearch: (token: string, query: string, signal?: AbortSignal) =>
    request<NaturalSearchResponse>(`discover/search?q=${encode(query)}`, token, { signal }),
  forYou: (token: string) => request<ForYouResponse>('discover/for-you', token),
};

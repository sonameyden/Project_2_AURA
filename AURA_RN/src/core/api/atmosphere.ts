import type { AtmosphereProfile, LyricLine, MoodResponse } from '../types';
import { encode, request } from './client';

export const atmosphereApi = {
  mood: (token: string, moodText: string, recentlyPlayedSongIds: string[]) =>
    request<MoodResponse>('atmosphere/mood', token, {
      method: 'POST',
      body: { moodText, recentlyPlayedSongIds },
    }),
  atmosphere: (token: string, songId: string) => request<AtmosphereProfile>(`atmosphere/song/${encode(songId)}`, token),
  lyrics: (token: string, songId: string) =>
    request<{ songId: string; lines: LyricLine[] }>(`lyrics/${encode(songId)}`, token),
};

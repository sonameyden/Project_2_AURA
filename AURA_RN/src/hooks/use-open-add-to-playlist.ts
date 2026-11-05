import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import type { Song } from '@/core/types';

/** Opens the add-to-playlist modal for any song, not only the one playing. */
export function useOpenAddToPlaylist() {
  const router = useRouter();
  return useCallback(
    (song: Song) => router.push({ pathname: '/add-to-playlist', params: { songId: song.id } }),
    [router],
  );
}

import { ApiError, auraApi } from '@/core/api';
import type { Artist } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

/** The signed-in user's artist profile, or `null` when they haven't become an artist yet. */
export function useMyArtist() {
  return useAuraQuery<Artist | null>(['catalog', 'my-artist'], async (token) => {
    try {
      return await auraApi.getMyArtist(token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  });
}

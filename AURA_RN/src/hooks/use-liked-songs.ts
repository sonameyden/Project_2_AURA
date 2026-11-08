import { useMutation, useQueryClient } from '@tanstack/react-query';

import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import type { Song } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

export const likedSongsKey = (userId: string | undefined) => ['library', 'liked', userId] as const;

export function useLikedSongs(enabled = true) {
  return useAuraQuery(['library', 'liked'], (token) => auraApi.likedSongs(token), enabled);
}

/** Like/unlike with an optimistic update that rolls back if the request fails. */
export function useToggleLike() {
  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  const key = likedSongsKey(user?.uid);

  return useMutation({
    mutationFn: async ({ song, liked }: { song: Song; liked: boolean }) =>
      auraApi.likeSong(await getToken(), song.id, liked),
    onMutate: async ({ song, liked }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Song[]>(key);
      queryClient.setQueryData<Song[]>(key, (current = []) =>
        liked
          ? [song, ...current.filter((item) => item.id !== song.id)]
          : current.filter((item) => item.id !== song.id),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library', 'liked'] }),
        // Likes feed the taste profile behind "Made for you".
        queryClient.invalidateQueries({ queryKey: ['home', 'for-you'] }),
      ]),
  });
}

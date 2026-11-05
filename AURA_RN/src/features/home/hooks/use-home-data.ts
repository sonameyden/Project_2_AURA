import { useQueries } from '@tanstack/react-query';

import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import type { Song } from '@/core/types';

/** Every Home section loads independently; one failing section doesn't hide the others. */
export function useHomeData() {
  const { getToken, user } = useAuth();
  const enabled = Boolean(user);
  const [trending, forYou, artists, newReleases, history, followed] = useQueries({
    queries: [
      { queryKey: ['home', 'trending', user?.uid], queryFn: async () => auraApi.trending(await getToken()), enabled },
      { queryKey: ['home', 'for-you', user?.uid], queryFn: async () => auraApi.forYou(await getToken()), enabled },
      { queryKey: ['home', 'artists', user?.uid], queryFn: async () => auraApi.artists(await getToken()), enabled },
      { queryKey: ['home', 'new-releases', user?.uid], queryFn: async () => auraApi.newReleases(await getToken()), enabled },
      { queryKey: ['library', 'history', user?.uid], queryFn: async () => auraApi.history(await getToken()), enabled },
      { queryKey: ['library', 'followed-artists', user?.uid], queryFn: async () => auraApi.followedArtists(await getToken()), enabled },
    ],
  });
  const all = [trending, forYou, artists, newReleases, history, followed];

  return {
    trending: trending.data ?? [],
    forYou: forYou.data ?? null,
    artists: artists.data ?? [],
    newReleases: newReleases.data ?? [],
    recentlyPlayed: uniqueSongs(history.data ?? []).slice(0, 12),
    followedArtists: followed.data ?? [],
    loading: all.some((query) => query.isPending),
    error: all.find((query) => query.error)?.error,
    retry: () => Promise.all(all.map((query) => query.refetch())),
  };
}

/** History lists a song once per play; Home shows each song once. */
function uniqueSongs(songs: Song[]) {
  const seen = new Set<string>();
  return songs.filter((song) => (seen.has(song.id) ? false : (seen.add(song.id), true)));
}

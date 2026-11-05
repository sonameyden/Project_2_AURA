import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import type { PlaylistDetail } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

/** How often an open playlist checks for collaborators' changes. */
export const LIVE_REFRESH_MS = 3000;

export function usePlaylists() {
  return useAuraQuery(['library', 'playlists'], (token) => auraApi.playlists(token));
}

/** Playlists the user can add songs to (owned or shared as editor). */
export function useEditablePlaylists() {
  const query = usePlaylists();
  return { ...query, data: query.data?.filter((playlist) => playlist.role !== 'viewer') };
}

/**
 * One playlist with its songs, owner and collaborators. While the screen is
 * focused it re-fetches every few seconds, so edits made by other people
 * appear live (proposal §2.2: changes appear for everyone).
 */
export function usePlaylistDetail(id: string | undefined) {
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return useAuraQuery(
    ['library', 'playlist', id],
    async (token) => {
      if (!id) throw new Error('Playlist id is missing.');
      const detail = await auraApi.playlist(token, id);
      // Older backends return the playlist without songs.
      if (!Array.isArray(detail.songs)) {
        const songs = await Promise.all(detail.songIds.map((songId) => auraApi.song(token, songId)));
        return { ...detail, songs, role: detail.role ?? (detail.ownerId === user?.uid ? 'owner' : 'viewer'), collaborators: [] };
      }
      return detail;
    },
    Boolean(id),
    { refetchInterval: focused ? LIVE_REFRESH_MS : false, refetchIntervalInBackground: false },
  );
}

function usePlaylistMutation<TVariables, TResult>(
  mutate: (token: string, variables: TVariables) => Promise<TResult>,
  playlistIdOf?: (variables: TVariables) => string,
) {
  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => mutate(await getToken(), variables),
    onSuccess: async (result, variables) => {
      // Endpoints that return the full detail update the open screen immediately.
      if (playlistIdOf && result && typeof result === 'object' && 'songs' in result) {
        queryClient.setQueryData(['library', 'playlist', playlistIdOf(variables), user?.uid], result);
      }
      await queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
      if (playlistIdOf) {
        await queryClient.invalidateQueries({ queryKey: ['library', 'playlist', playlistIdOf(variables)] });
      }
    },
  });
}

export const useCreatePlaylist = () => usePlaylistMutation((token, title: string) => auraApi.createPlaylist(token, title));

export const useDeletePlaylist = () =>
  usePlaylistMutation((token, playlistId: string) => auraApi.deletePlaylist(token, playlistId));

export const useAddSongToPlaylist = () =>
  usePlaylistMutation(
    (token, { playlistId, songId }: { playlistId: string; songId: string }) => auraApi.addSongToPlaylist(token, playlistId, songId),
    ({ playlistId }) => playlistId,
  );

export const useRemoveSongFromPlaylist = () =>
  usePlaylistMutation(
    (token, { playlistId, songId }: { playlistId: string; songId: string }) =>
      auraApi.removeSongFromPlaylist(token, playlistId, songId),
    ({ playlistId }) => playlistId,
  );

export const useUpdatePlaylist = () =>
  usePlaylistMutation(
    (token, { playlistId, ...changes }: { playlistId: string; title?: string; isPublic?: boolean }) =>
      auraApi.updatePlaylist(token, playlistId, changes),
    ({ playlistId }) => playlistId,
  );

export const useCollaboratorRole = () =>
  usePlaylistMutation(
    (token, { playlistId, userId, role }: { playlistId: string; userId: string; role: 'viewer' | 'editor' }) =>
      auraApi.updateCollaborator(token, playlistId, userId, role),
    ({ playlistId }) => playlistId,
  );

export const useRemoveCollaborator = () =>
  usePlaylistMutation(
    (token, { playlistId, userId }: { playlistId: string; userId: string }) =>
      auraApi.removeCollaborator(token, playlistId, userId),
    ({ playlistId }) => playlistId,
  );

/** Moves a song with an optimistic update; the server merges with others' edits. */
export function useReorderPlaylist(playlistId: string) {
  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['library', 'playlist', playlistId, user?.uid];
  return useMutation({
    mutationFn: async (songIds: string[]) => auraApi.reorderPlaylist(await getToken(), playlistId, songIds),
    onMutate: async (songIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PlaylistDetail>(key);
      if (previous) {
        const byId = new Map(previous.songs.map((song) => [song.id, song]));
        queryClient.setQueryData<PlaylistDetail>(key, {
          ...previous,
          songIds,
          songs: songIds.flatMap((songId) => (byId.has(songId) ? [byId.get(songId)!] : [])),
        });
      }
      return { previous };
    },
    onError: (_error, _songIds, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (detail) => queryClient.setQueryData(key, detail),
  });
}

export function useCreateInvite() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async ({ playlistId, role }: { playlistId: string; role: 'viewer' | 'editor' }) =>
      auraApi.createInvite(await getToken(), playlistId, role),
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import type { PlaylistDetail, PlaylistSummary, Song } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

import { toSummary, withAddedSong } from '../lib/playlist-cache';

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
        return {
          ...detail,
          songs,
          role: detail.role ?? (detail.ownerId === user?.uid ? 'owner' : 'viewer'),
          collaborators: [],
        };
      }
      return detail;
    },
    Boolean(id),
    { refetchInterval: focused ? LIVE_REFRESH_MS : false, refetchIntervalInBackground: false },
  );
}

type CacheWriter<TVariables, TResult> = (cache: PlaylistCache, result: TResult, variables: TVariables) => void;

/** Reads and writes the cached playlist list and playlist details for the signed-in user. */
type PlaylistCache = {
  /** Applies `change` to the cached playlist list, if it has been loaded. */
  updateList: (change: (list: PlaylistSummary[]) => PlaylistSummary[]) => void;
  /** Applies `change` to one cached playlist detail, if it has been loaded. */
  updateDetail: (playlistId: string, change: (detail: PlaylistDetail) => PlaylistDetail) => void;
  setDetail: (detail: PlaylistDetail) => void;
  removeDetail: (playlistId: string) => void;
};

/** Replaces one playlist's row in the cached list with the server's newer copy. */
const replaceInList = (cache: PlaylistCache, playlist: PlaylistSummary | PlaylistDetail) =>
  cache.updateList((list) =>
    list.map((item) => (item.id === playlist.id ? { ...item, ...toSummary(playlist) } : item)),
  );

/**
 * Runs a playlist change, then writes the server's answer straight into the
 * cache so every screen shows it immediately. A background refetch follows to
 * pick up anything else (e.g. collaborators' edits); it is not awaited, so the
 * caller isn't kept waiting on a second round trip.
 */
function usePlaylistMutation<TVariables, TResult>(
  mutate: (token: string, variables: TVariables) => Promise<TResult>,
  {
    playlistIdOf,
    writeCache,
  }: { playlistIdOf?: (variables: TVariables) => string; writeCache?: CacheWriter<TVariables, TResult> } = {},
) {
  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => mutate(await getToken(), variables),
    onSuccess: (result, variables) => {
      const uid = user?.uid;
      const detailKey = (playlistId: string) => ['library', 'playlist', playlistId, uid];
      const cache: PlaylistCache = {
        updateList: (change) =>
          queryClient.setQueryData<PlaylistSummary[]>(['library', 'playlists', uid], (list) =>
            list ? change(list) : list,
          ),
        updateDetail: (playlistId, change) =>
          queryClient.setQueryData<PlaylistDetail>(detailKey(playlistId), (detail) =>
            detail ? change(detail) : detail,
          ),
        setDetail: (detail) => queryClient.setQueryData(detailKey(detail.id), detail),
        removeDetail: (playlistId) => queryClient.removeQueries({ queryKey: ['library', 'playlist', playlistId] }),
      };
      writeCache?.(cache, result, variables);

      void queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
      if (playlistIdOf)
        void queryClient.invalidateQueries({ queryKey: ['library', 'playlist', playlistIdOf(variables)] });
    },
  });
}

/** Endpoints that answer with the full playlist detail. */
const writeDetail = (cache: PlaylistCache, detail: PlaylistDetail) => {
  if (!detail || !Array.isArray(detail.songs)) return;
  cache.setDetail(detail);
  replaceInList(cache, detail);
};

export const useCreatePlaylist = () =>
  usePlaylistMutation((token, title: string) => auraApi.createPlaylist(token, title), {
    writeCache: (cache, created) =>
      cache.updateList((list) => [created, ...list.filter((item) => item.id !== created.id)]),
  });

export const useDeletePlaylist = () =>
  usePlaylistMutation((token, playlistId: string) => auraApi.deletePlaylist(token, playlistId), {
    writeCache: (cache, _result, playlistId) => {
      cache.updateList((list) => list.filter((item) => item.id !== playlistId));
      cache.removeDetail(playlistId);
    },
  });

export const useAddSongToPlaylist = () =>
  usePlaylistMutation(
    (token, { playlistId, song }: { playlistId: string; song: Song }) =>
      auraApi.addSongToPlaylist(token, playlistId, song.id),
    {
      playlistIdOf: ({ playlistId }) => playlistId,
      // The server answers with the playlist's new song order (no song objects),
      // so the open playlist is rebuilt from the songs it already has plus this one.
      writeCache: (cache, saved, { playlistId, song }) => {
        replaceInList(cache, saved);
        cache.updateDetail(playlistId, (detail) => withAddedSong(detail, saved, song));
      },
    },
  );

export const useRemoveSongFromPlaylist = () =>
  usePlaylistMutation(
    (token, { playlistId, songId }: { playlistId: string; songId: string }) =>
      auraApi.removeSongFromPlaylist(token, playlistId, songId),
    { playlistIdOf: ({ playlistId }) => playlistId, writeCache: (cache, detail) => writeDetail(cache, detail) },
  );

export const useUpdatePlaylist = () =>
  usePlaylistMutation(
    (token, { playlistId, ...changes }: { playlistId: string; title?: string; isPublic?: boolean }) =>
      auraApi.updatePlaylist(token, playlistId, changes),
    { playlistIdOf: ({ playlistId }) => playlistId, writeCache: (cache, detail) => writeDetail(cache, detail) },
  );

export const useCollaboratorRole = () =>
  usePlaylistMutation(
    (token, { playlistId, userId, role }: { playlistId: string; userId: string; role: 'viewer' | 'editor' }) =>
      auraApi.updateCollaborator(token, playlistId, userId, role),
    { playlistIdOf: ({ playlistId }) => playlistId, writeCache: (cache, detail) => writeDetail(cache, detail) },
  );

export const useRemoveCollaborator = () =>
  usePlaylistMutation(
    (token, { playlistId, userId }: { playlistId: string; userId: string }) =>
      auraApi.removeCollaborator(token, playlistId, userId),
    { playlistIdOf: ({ playlistId }) => playlistId },
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

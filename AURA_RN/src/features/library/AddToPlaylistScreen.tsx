import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { BackButton, AuraText, EmptyState, ErrorMessage, Heading, LoadingState, Page, useToast } from '@/components/ui';
import { auraApi } from '@/core/api';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { Playlist } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

import { useAddSongToPlaylist, useEditablePlaylists } from './hooks/use-playlists';

/**
 * Adds a song to one of the user's playlists. Opened with `?songId=` from any
 * song row; without it, the currently playing song is used.
 */
export default function AddToPlaylistScreenFeature() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useAuraTheme();
  const { songId } = useLocalSearchParams<{ songId?: string }>();
  const { song: playingSong } = usePlayer();
  const requestedSong = useAuraQuery(
    ['catalog', 'song', songId],
    (token) => auraApi.song(token, songId ?? ''),
    Boolean(songId) && songId !== playingSong?.id,
  );
  const song = songId && songId !== playingSong?.id ? (requestedSong.data ?? null) : playingSong;
  // Only playlists the user owns or can edit.
  const playlistsQuery = useEditablePlaylists();
  const addSong = useAddSongToPlaylist();
  const playlists = playlistsQuery.data ?? [];
  const addError = addSong.error instanceof Error ? addSong.error.message : null;

  const add = (playlist: Playlist) => {
    if (!song) {
      toast.show({
        title: 'No song selected',
        message: 'Choose a song before adding it to a playlist.',
        variant: 'error',
      });
      return;
    }
    if (playlist.songIds.includes(song.id)) {
      toast.show({ title: `Already in ${playlist.title}`, message: song.title, variant: 'info' });
      return;
    }
    addSong.mutate(
      { playlistId: playlist.id, song },
      {
        onSuccess: () => {
          toast.show({
            title: `Added to ${playlist.title}`,
            message: song.title,
            action: {
              label: 'View',
              onPress: () => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } }),
            },
          });
          router.back();
        },
      },
    );
  };

  return (
    <Page>
      <BackButton variant="close" />
      <Heading title="Add to playlist" subtitle={song?.title ?? 'Choose a playlist for this song.'} />
      {addError ? <ErrorMessage message={addError} /> : null}
      {requestedSong.error instanceof Error ? (
        <ErrorMessage message={requestedSong.error.message} onRetry={() => void requestedSong.refetch()} />
      ) : null}
      {playlistsQuery.error instanceof Error ? (
        <ErrorMessage message={playlistsQuery.error.message} onRetry={() => void playlistsQuery.refetch()} />
      ) : null}
      {playlistsQuery.isPending ? <LoadingState label="Loading playlists…" /> : null}
      {!playlistsQuery.error && !playlistsQuery.isPending && playlists.length === 0 ? (
        <EmptyState
          title="No playlists yet"
          description="Create a playlist in your Library first, then come back to save this song."
          icon="albums-outline"
        />
      ) : null}
      {playlists.map((playlist) => {
        const working = addSong.isPending && addSong.variables?.playlistId === playlist.id;
        const alreadyAdded = Boolean(song && playlist.songIds.includes(song.id));
        return (
          <Pressable
            key={playlist.id}
            onPress={() => add(playlist)}
            disabled={addSong.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Add to ${playlist.title}`}
            accessibilityState={{ disabled: addSong.isPending, selected: alreadyAdded }}
            style={{
              padding: 16,
              borderRadius: 15,
              backgroundColor: colors.surface,
              opacity: addSong.isPending && !working ? 0.6 : 1,
            }}>
            <AuraText style={{ fontWeight: '700' }}>{working ? 'Adding…' : playlist.title}</AuraText>
            <AuraText style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {playlist.songIds.length} songs{alreadyAdded ? ' · already added' : ''}
            </AuraText>
          </Pressable>
        );
      })}
    </Page>
  );
}

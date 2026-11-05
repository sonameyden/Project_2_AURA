import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  ActionButton,
  Artwork,
  AuraText,
  Card,
  ErrorMessage,
  Heading,
  LoadingState,
  Page,
  TrackRow,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { pickImageForm } from '@/core/pick-image';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { Song } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';

export default function AlbumDetailScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useAuraTheme();
  const { getToken, user } = useAuth();
  const { playSong, togglePlayback, song: playing, isPlaying } = usePlayer();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const albumQuery = useAuraQuery(
    ['catalog', 'album', id],
    async (token) => {
      const [album, songs] = await Promise.all([auraApi.album(token, id), auraApi.albumSongs(token, id)]);
      return { album, songs };
    },
    Boolean(id),
  );
  const album = albumQuery.data?.album ?? null;
  const songs = albumQuery.data?.songs ?? [];
  // Albums are owned by the artist whose id is the owner's Firebase uid.
  const isOwner = Boolean(album && user && album.artistId === user.uid);
  const ownSongsQuery = useAuraQuery(['catalog', 'my-artist-songs'], (token) => auraApi.myArtistSongs(token), isOwner);
  const availableSongs = (ownSongsQuery.data ?? []).filter((song) => !songs.some((track) => track.id === song.id));
  const albumIsPlaying = Boolean(playing && songs.some((track) => track.id === playing.id));
  const error = mutationError ?? (albumQuery.error instanceof Error ? albumQuery.error.message : null);

  const run = async (action: (token: string) => Promise<unknown>, failure: string) => {
    setWorking(true);
    setMutationError(null);
    try {
      await action(await getToken());
      await Promise.all([
        albumQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['catalog', 'my-artist-songs'] }),
      ]);
    } catch (actionError) {
      setMutationError(actionError instanceof Error ? actionError.message : failure);
    } finally {
      setWorking(false);
    }
  };

  const addSong = (song: Song) => run((token) => auraApi.addSongToAlbum(token, id, song.id), 'Song could not be added.');
  const removeSong = (song: Song) =>
    run((token) => auraApi.removeSongFromAlbum(token, id, song.id), 'Song could not be removed.');
  const changeArtwork = async () => {
    const form = await pickImageForm('artwork', { fallbackName: 'album-artwork.jpg' });
    if (form) await run((token) => auraApi.updateAlbumArtwork(token, id, form), 'Artwork could not be updated.');
  };

  const deleteAlbum = () =>
    Alert.alert('Delete this album?', 'This removes the album and its songs from your artist profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete album',
        style: 'destructive',
        onPress: () => {
          setWorking(true);
          void getToken()
            .then((token) => auraApi.deleteAlbum(token, id))
            .then(() => queryClient.invalidateQueries({ queryKey: ['catalog'] }))
            .then(() => router.back())
            .catch((deleteError: unknown) =>
              Alert.alert('Could not delete album', deleteError instanceof Error ? deleteError.message : 'Please try again.'),
            )
            .finally(() => setWorking(false));
        },
      },
    ]);

  const playAlbum = () => {
    if (albumIsPlaying) {
      togglePlayback();
      return;
    }
    void playSong(songs[0], songs).then(() => router.push('/now-playing'));
  };

  return (
    <Page>
      {error ? <ErrorMessage message={error} onRetry={() => void albumQuery.refetch()} /> : null}
      {albumQuery.isPending ? <LoadingState label="Loading album…" /> : null}
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => void changeArtwork()}
          disabled={!isOwner || working}
          accessibilityRole={isOwner ? 'button' : 'image'}
          accessibilityLabel={isOwner ? 'Change album artwork' : `${album?.title ?? 'Album'} artwork`}>
          <Artwork uri={album?.artworkUrl ?? null} size={180} rounded={24} />
          {isOwner ? (
            <View style={{ position: 'absolute', right: 8, bottom: 8, borderRadius: 16, padding: 6, backgroundColor: colors.elevated }}>
              <Ionicons name="camera-outline" size={18} color={colors.text} />
            </View>
          ) : null}
        </Pressable>
        <Heading title={album?.title ?? 'Album'} subtitle={`${songs.length} tracks`} />
        {songs.length ? (
          <ActionButton
            title={albumIsPlaying ? (isPlaying ? 'Pause' : 'Resume') : 'Play album'}
            onPress={playAlbum}
            style={{ minWidth: 160 }}
          />
        ) : null}
      </View>
      {isOwner ? (
        <ActionButton
          title="Upload a track to this album"
          variant="secondary"
          onPress={() => router.push({ pathname: '/upload', params: { albumId: id } })}
        />
      ) : null}
      {songs.map((song) => (
        <TrackRow
          key={song.id}
          song={song}
          active={playing?.id === song.id}
          onPress={() => void playSong(song, songs).then(() => router.push('/now-playing'))}
          onMore={() => openAddToPlaylist(song)}
          trailing={
            isOwner ? (
              <Pressable
                onPress={() => void removeSong(song)}
                disabled={working}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${song.title} from album`}
                hitSlop={8}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.muted} />
              </Pressable>
            ) : undefined
          }
        />
      ))}
      {isOwner && availableSongs.length ? (
        <View style={{ gap: 10 }}>
          <AuraText style={{ fontSize: 17, fontWeight: '800' }}>Add an existing song</AuraText>
          {availableSongs.map((song) => (
            <Card
              key={song.id}
              onPress={working ? undefined : () => void addSong(song)}
              accessibilityLabel={`Add ${song.title} to album`}
              style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AuraText style={{ flex: 1 }}>{song.title}</AuraText>
              <Ionicons name="add-circle-outline" color={colors.accent} size={21} />
            </Card>
          ))}
        </View>
      ) : null}
      {isOwner ? (
        <Pressable onPress={deleteAlbum} disabled={working} accessibilityRole="button">
          <AuraText style={{ color: colors.danger, textAlign: 'center' }}>Delete album</AuraText>
        </Pressable>
      ) : null}
    </Page>
  );
}

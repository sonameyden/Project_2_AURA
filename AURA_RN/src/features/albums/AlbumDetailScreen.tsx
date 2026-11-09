import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  BackButton,
  ActionButton,
  Artwork,
  AuraText,
  Card,
  ErrorMessage,
  Heading,
  LoadingState,
  PageList,
  TrackRow,
  showAlert,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { IMAGE_MAX_SIZE, pickImageForm } from '@/core/pick-image';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import { useGoBack } from '@/core/use-go-back';
import { useRefreshCatalog } from '@/hooks/use-refresh-catalog';
import type { Song } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';

export default function AlbumDetailScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const refreshCatalog = useRefreshCatalog();
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
      // This album, the artist page (track counts, artwork) and Home all show it.
      await refreshCatalog();
    } catch (actionError) {
      setMutationError(actionError instanceof Error ? actionError.message : failure);
    } finally {
      setWorking(false);
    }
  };

  const addSong = (song: Song) =>
    run((token) => auraApi.addSongToAlbum(token, id, song.id), 'Song could not be added.');
  const removeSong = (song: Song) =>
    run((token) => auraApi.removeSongFromAlbum(token, id, song.id), 'Song could not be removed.');
  const changeArtwork = async () => {
    const form = await pickImageForm('artwork', { fallbackName: 'album-artwork.jpg', maxSize: IMAGE_MAX_SIZE.artwork });
    if (form) await run((token) => auraApi.updateAlbumArtwork(token, id, form), 'Artwork could not be updated.');
  };

  const deleteAlbum = () =>
    showAlert('Delete this album?', 'This removes the album and its songs from your artist profile.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete album',
        style: 'destructive',
        onPress: () => {
          setWorking(true);
          void getToken()
            .then((token) => auraApi.deleteAlbum(token, id))
            .then(() => refreshCatalog())
            .then(() => goBack())
            .catch((deleteError: unknown) =>
              showAlert(
                'Could not delete album',
                deleteError instanceof Error ? deleteError.message : 'Please try again.',
              ),
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
    <PageList
      data={songs}
      keyExtractor={(song) => song.id}
      extraData={[playing?.id, isOwner, working]}
      header={
        <>
          <BackButton />
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
                <View
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    borderRadius: 16,
                    padding: 6,
                    backgroundColor: colors.elevated,
                  }}>
                  <Ionicons name="camera-outline" size={18} color={colors.text} />
                </View>
              ) : null}
            </Pressable>
            <Heading
              title={album?.title ?? 'Album'}
              subtitle={`${isOwner ? 'Your album · ' : ''}${songs.length} ${songs.length === 1 ? 'track' : 'tracks'}`}
            />
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
        </>
      }
      renderItem={({ item: song }) => (
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
      )}
      footer={
        <>
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
        </>
      }
    />
  );
}

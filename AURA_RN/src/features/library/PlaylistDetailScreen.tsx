import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  BackButton,
  ActionButton,
  AuraText,
  EmptyState,
  ErrorMessage,
  Field,
  Heading,
  LoadingState,
  PageList,
  TrackRow,
  showAlert,
} from '@/components/ui';
import { useAuth } from '@/core/auth-context';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { PlaylistDetail } from '@/core/types';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';

import { IconButton } from './components/IconButton';
import { PlaylistPeopleRow } from './components/PlaylistPeopleRow';
import {
  usePlaylistDetail,
  useRemoveCollaborator,
  useRemoveSongFromPlaylist,
  useReorderPlaylist,
  useUpdatePlaylist,
} from './hooks/use-playlists';

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Please try again.');

export default function PlaylistDetailScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAuraTheme();
  const { user } = useAuth();
  const { playSong, song: playing } = usePlayer();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const playlistQuery = usePlaylistDetail(id);
  const reorder = useReorderPlaylist(id ?? '');
  const removeSong = useRemoveSongFromPlaylist();
  const update = useUpdatePlaylist();
  const leave = useRemoveCollaborator();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);

  const playlist = playlistQuery.data ?? null;
  const songs = playlist?.songs ?? [];
  const canEdit = playlist?.role === 'owner' || playlist?.role === 'editor';
  const error = playlistQuery.error instanceof Error ? playlistQuery.error.message : null;

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (!playlist || target < 0 || target >= songs.length) return;
    const ids = songs.map((song) => song.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids, { onError: (moveError) => showAlert('Could not reorder', errorText(moveError)) });
  };

  const saveTitle = () => {
    const title = draftTitle?.trim();
    if (!playlist || !title || title === playlist.title) {
      setDraftTitle(null);
      return;
    }
    update.mutate(
      { playlistId: playlist.id, title },
      {
        onSuccess: () => setDraftTitle(null),
        onError: (renameError) => showAlert('Could not rename', errorText(renameError)),
      },
    );
  };

  const leavePlaylist = () => {
    if (!playlist || !user) return;
    showAlert('Leave this playlist?', 'You will need a new invite to rejoin.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          leave.mutate(
            { playlistId: playlist.id, userId: user.uid },
            {
              onSuccess: () => router.back(),
              onError: (leaveError) => showAlert('Could not leave', errorText(leaveError)),
            },
          ),
      },
    ]);
  };

  return (
    <PageList
      data={songs}
      keyExtractor={(song) => song.id}
      extraData={[editing, playing?.id, playlist?.id]}
      header={
        <>
          <BackButton />
          {editing && draftTitle !== null ? (
            <Field
              label="Playlist name"
              value={draftTitle}
              onChangeText={setDraftTitle}
              maxLength={80}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveTitle}
              onBlur={saveTitle}
            />
          ) : (
            <Heading title={playlist?.title ?? 'Playlist'} subtitle={subtitleFor(playlist, songs.length)} />
          )}
          {playlist ? <PlaylistPeopleRow playlist={playlist} live={playlistQuery.isFetching} /> : null}
          {error ? <ErrorMessage message={error} onRetry={() => void playlistQuery.refetch()} /> : null}
          {playlistQuery.isPending ? <LoadingState label="Loading playlist…" /> : null}

          {playlist ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {songs.length > 0 ? (
                <ActionButton
                  title="Play all"
                  style={{ flex: 1 }}
                  onPress={() => void playSong(songs[0], songs).then(() => router.push('/now-playing'))}
                />
              ) : null}
              {playlist.role === 'owner' && !editing ? (
                <ActionButton
                  title="Share"
                  variant="secondary"
                  icon={<Ionicons name="share-social-outline" size={18} color={colors.text} />}
                  style={{ minWidth: 96 }}
                  accessibilityHint="Opens visibility, invite links and collaborators"
                  onPress={() => router.push({ pathname: '/playlist-share/[id]', params: { id: playlist.id } })}
                />
              ) : null}
              {canEdit ? (
                <ActionButton
                  title={editing ? 'Done' : 'Edit'}
                  variant="secondary"
                  style={{ flex: songs.length ? 0 : 1, minWidth: 96 }}
                  onPress={() => {
                    if (editing) saveTitle();
                    else setDraftTitle(playlist.title);
                    setEditing(!editing);
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {!error && playlist && songs.length === 0 ? (
            <EmptyState
              title="This playlist is waiting"
              description={
                canEdit
                  ? 'Add songs from any song’s ••• menu or from Now Playing.'
                  : 'The owner hasn’t added songs yet.'
              }
              icon="musical-notes-outline"
            />
          ) : null}
        </>
      }
      renderItem={({ item: song, index }) => (
        <TrackRow
          key={song.id}
          song={song}
          active={playing?.id === song.id}
          onPress={() => void playSong(song, songs).then(() => router.push('/now-playing'))}
          onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: song.artistId } })}
          onMore={editing ? undefined : () => openAddToPlaylist(song)}
          trailing={
            editing && playlist ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <IconButton
                  icon="chevron-up"
                  label={`Move ${song.title} up`}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                />
                <IconButton
                  icon="chevron-down"
                  label={`Move ${song.title} down`}
                  disabled={index === songs.length - 1}
                  onPress={() => move(index, 1)}
                />
                <IconButton
                  icon="remove-circle-outline"
                  label={`Remove ${song.title} from playlist`}
                  color={colors.danger}
                  onPress={() =>
                    removeSong.mutate(
                      { playlistId: playlist.id, songId: song.id },
                      { onError: (removeError) => showAlert('Could not remove song', errorText(removeError)) },
                    )
                  }
                />
              </View>
            ) : undefined
          }
        />
      )}
      footer={
        <>
          {playlist && playlist.role !== 'owner' && playlist.isMember ? (
            <Pressable
              onPress={leavePlaylist}
              accessibilityRole="button"
              style={{ alignItems: 'center', paddingVertical: 8 }}>
              <AuraText style={{ color: colors.danger, fontWeight: '600' }}>Leave playlist</AuraText>
            </Pressable>
          ) : null}
        </>
      }
    />
  );
}

function subtitleFor(playlist: PlaylistDetail | null, count: number) {
  if (!playlist) return `${count} songs`;
  const role = playlist.role === 'owner' ? '' : playlist.role === 'editor' ? ' · You can edit' : ' · View only';
  return `${count} songs${playlist.isPublic ? ' · Public' : ' · Private'}${role}`;
}

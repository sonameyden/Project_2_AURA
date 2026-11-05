import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ActionButton, AuraText, Card, EmptyState, ErrorMessage, Field, Heading, LoadingState, Page } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { PlaylistSummary } from '@/core/types';

import { useCreatePlaylist, useDeletePlaylist, usePlaylists } from './hooks/use-playlists';

export default function PlaylistsScreenFeature() {
  const router = useRouter();
  const { colors } = useAuraTheme();
  const playlistsQuery = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const playlists = playlistsQuery.data ?? [];
  const [title, setTitle] = useState('');
  const loadError = playlistsQuery.error instanceof Error ? playlistsQuery.error.message : null;
  const createError = createPlaylist.error instanceof Error ? createPlaylist.error.message : null;

  const create = () => {
    if (!title.trim()) {
      Alert.alert('Name your playlist', 'Enter a title before creating the playlist.');
      return;
    }
    createPlaylist.mutate(title.trim(), { onSuccess: () => setTitle('') });
  };

  const confirmDelete = (playlist: PlaylistSummary) =>
    Alert.alert('Delete playlist?', `"${playlist.title}" will be removed. Songs stay in the catalog.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletePlaylist.mutate(playlist.id, {
            onError: (error) =>
              Alert.alert('Could not delete playlist', error instanceof Error ? error.message : 'Please try again.'),
          }),
      },
    ]);

  return (
    <Page>
      <Heading title="Playlists" subtitle="Gather songs around a feeling, a moment, or a place." />
      <Card>
        <AuraText style={{ fontSize: 17, fontWeight: '800' }}>Create a playlist</AuraText>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Give it a name"
          accessibilityLabel="Playlist name"
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={create}
        />
        <ActionButton title="Create playlist" onPress={create} loading={createPlaylist.isPending} />
      </Card>
      {loadError ? <ErrorMessage message={loadError} onRetry={() => void playlistsQuery.refetch()} /> : null}
      {createError ? <ErrorMessage message={createError} /> : null}
      {playlistsQuery.isPending ? <LoadingState label="Loading playlists…" /> : null}
      {!playlistsQuery.isPending && !loadError && playlists.length === 0 ? (
        <EmptyState title="A blank canvas" description="Create your first playlist above." icon="albums-outline" />
      ) : null}
      {playlists.map((playlist) => (
        <Card
          key={playlist.id}
          onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
          accessibilityLabel={`${playlist.title}, ${playlist.songIds.length} songs`}
          style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: playlist.coverColorHex ?? colors.accentSoft,
            }}>
            <Ionicons name="musical-notes" color={colors.accent} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <AuraText style={{ fontWeight: '700' }}>{playlist.title}</AuraText>
            <AuraText style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
              {playlist.songIds.length} songs{playlist.isPublic ? ' · Public' : ''}
              {playlist.role === 'editor' ? ' · Shared with you · Editor' : playlist.role === 'viewer' ? ' · Shared with you' : ''}
            </AuraText>
          </View>
          {playlist.role === 'owner' ? (
          <Pressable
            onPress={() => confirmDelete(playlist)}
            disabled={deletePlaylist.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${playlist.title}`}
            hitSlop={10}
            style={{ padding: 6 }}>
            <Ionicons name="trash-outline" color={colors.muted} size={20} />
          </Pressable>
          ) : null}
          <Ionicons name="chevron-forward" color={colors.muted} size={18} />
        </Card>
      ))}
    </Page>
  );
}

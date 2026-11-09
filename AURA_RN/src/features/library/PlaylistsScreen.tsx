import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  BackButton,
  ActionButton,
  AuraText,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Heading,
  LoadingState,
  PageList,
  useToast,
  showAlert,
} from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { PlaylistSummary } from '@/core/types';

import { useCreatePlaylist, useDeletePlaylist, usePlaylists } from './hooks/use-playlists';
import { parseInviteCode } from './lib/invite-code';

export default function PlaylistsScreenFeature() {
  const router = useRouter();
  const { colors } = useAuraTheme();
  const playlistsQuery = usePlaylists();
  const toast = useToast();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const playlists = playlistsQuery.data ?? [];
  const [title, setTitle] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const loadError = playlistsQuery.error instanceof Error ? playlistsQuery.error.message : null;
  const createError = createPlaylist.error instanceof Error ? createPlaylist.error.message : null;

  const create = () => {
    if (!title.trim()) {
      toast.show({ title: 'Name your playlist', message: 'Enter a title before creating it.', variant: 'error' });
      return;
    }
    createPlaylist.mutate(title.trim(), {
      onSuccess: (created) => {
        setTitle('');
        toast.show({ title: `Created ${created.title}` });
      },
    });
  };

  // Opens the same invite screen a tapped link would, so joining works even where links can't open the app (Expo Go).
  const joinWithInvite = () => {
    const code = parseInviteCode(inviteLink);
    if (!code) {
      toast.show({
        title: 'That is not an invite link',
        message: 'Paste the whole link or message your friend shared.',
        variant: 'error',
      });
      return;
    }
    setInviteLink('');
    router.push({ pathname: '/invite/[code]', params: { code } });
  };

  const confirmDelete = (playlist: PlaylistSummary) =>
    showAlert('Delete playlist?', `"${playlist.title}" will be removed. Songs stay in the catalog.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletePlaylist.mutate(playlist.id, {
            onError: (error) =>
              showAlert('Could not delete playlist', error instanceof Error ? error.message : 'Please try again.'),
          }),
      },
    ]);

  return (
    <PageList
      data={playlists}
      keyExtractor={(playlist) => playlist.id}
      header={
        <>
          <BackButton />
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
          <Card>
            <AuraText style={{ fontSize: 17, fontWeight: '800' }}>Join a shared playlist</AuraText>
            <AuraText style={{ color: colors.muted, fontSize: 13 }}>
              Got an invite? Paste the link or the whole message here.
            </AuraText>
            <Field
              value={inviteLink}
              onChangeText={setInviteLink}
              placeholder="Paste invite link"
              accessibilityLabel="Invite link"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={joinWithInvite}
            />
            <ActionButton
              title="Join with invite link"
              variant="secondary"
              onPress={joinWithInvite}
              disabled={!inviteLink.trim()}
            />
          </Card>
          {loadError ? <ErrorMessage message={loadError} onRetry={() => void playlistsQuery.refetch()} /> : null}
          {createError ? <ErrorMessage message={createError} /> : null}
          {playlistsQuery.isPending ? <LoadingState label="Loading playlists…" /> : null}
          {!playlistsQuery.isPending && !loadError && playlists.length === 0 ? (
            <EmptyState title="A blank canvas" description="Create your first playlist above." icon="albums-outline" />
          ) : null}
        </>
      }
      renderItem={({ item: playlist }) => (
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
              {playlist.role === 'editor'
                ? ' · Shared with you · Editor'
                : playlist.role === 'viewer'
                  ? ' · Shared with you'
                  : ''}
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
      )}
    />
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Share, View } from 'react-native';

import { ActionButton, Artwork, AuraText, Card, SwitchRow } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { PlaylistDetail } from '@/core/types';

import { useCollaboratorRole, useCreateInvite, useRemoveCollaborator, useUpdatePlaylist } from '../hooks/use-playlists';

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Please try again.');

/** Owner-only controls: visibility, invite links, and collaborator roles. */
export function PlaylistSharePanel({ playlist }: { playlist: PlaylistDetail }) {
  const { colors } = useAuraTheme();
  const update = useUpdatePlaylist();
  const invite = useCreateInvite();
  const changeRole = useCollaboratorRole();
  const removeCollaborator = useRemoveCollaborator();

  const shareInvite = (role: 'viewer' | 'editor') =>
    invite.mutate(
      { playlistId: playlist.id, role },
      {
        onSuccess: ({ url }) => {
          const action = role === 'editor' ? 'build' : 'listen to';
          void Share.share({
            title: `Join "${playlist.title}" on AURA`,
            message: `Come ${action} my playlist "${playlist.title}" with me on AURA: ${url}`,
            url,
          }).catch((error: unknown) => Alert.alert('Could not open sharing', errorText(error)));
        },
        onError: (error) => Alert.alert('Could not create invite', errorText(error)),
      },
    );

  return (
    <Card style={{ gap: 14 }}>
      <AuraText style={{ fontSize: 17, fontWeight: '800' }} accessibilityRole="header">
        Share & collaborate
      </AuraText>
      <SwitchRow
        label="Public playlist"
        description={playlist.isPublic ? 'Anyone can find and listen to it.' : 'Only you and people you invite can see it.'}
        value={playlist.isPublic}
        onChange={(isPublic) =>
          update.mutate(
            { playlistId: playlist.id, isPublic },
            { onError: (error) => Alert.alert('Could not change visibility', errorText(error)) },
          )
        }
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ActionButton
          title="Invite editors"
          icon={<Ionicons name="people-outline" size={18} color="#FFFFFF" />}
          onPress={() => shareInvite('editor')}
          loading={invite.isPending && invite.variables?.role === 'editor'}
          style={{ flex: 1 }}
          accessibilityHint="Shares a link that lets people add, remove and reorder songs"
        />
        <ActionButton
          title="Invite listeners"
          variant="secondary"
          onPress={() => shareInvite('viewer')}
          loading={invite.isPending && invite.variables?.role === 'viewer'}
          style={{ flex: 1 }}
          accessibilityHint="Shares a link that lets people view and play the playlist"
        />
      </View>
      <AuraText style={{ color: colors.muted, fontSize: 12 }}>Invite links work for 14 days.</AuraText>

      {playlist.collaborators.length ? (
        <View style={{ gap: 10 }}>
          <AuraText style={{ fontWeight: '700' }}>People</AuraText>
          {playlist.collaborators.map((person) => {
            const name = person.displayName ?? 'AURA listener';
            const isEditor = person.role === 'editor';
            return (
              <View key={person.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Artwork uri={person.imageUrl} size={36} rounded={18} />
                <AuraText numberOfLines={1} style={{ flex: 1 }}>{name}</AuraText>
                <Pressable
                  onPress={() =>
                    changeRole.mutate(
                      { playlistId: playlist.id, userId: person.userId, role: isEditor ? 'viewer' : 'editor' },
                      { onError: (error) => Alert.alert('Could not change role', errorText(error)) },
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${name} is ${isEditor ? 'an editor' : 'a viewer'}. Tap to make them ${isEditor ? 'a viewer' : 'an editor'}.`}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.accentSoft }}>
                  <AuraText style={{ fontSize: 12, fontWeight: '700' }}>{isEditor ? 'Editor' : 'Viewer'}</AuraText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Remove collaborator?', `${name} will lose access to this playlist.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () =>
                          removeCollaborator.mutate(
                            { playlistId: playlist.id, userId: person.userId },
                            { onError: (error) => Alert.alert('Could not remove', errorText(error)) },
                          ),
                      },
                    ])
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name}`}
                  hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <AuraText style={{ color: colors.muted, fontSize: 13 }}>
          No collaborators yet. Invite friends and edit this playlist together in real time.
        </AuraText>
      )}
    </Card>
  );
}

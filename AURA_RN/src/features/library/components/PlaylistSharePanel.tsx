import { Ionicons } from '@expo/vector-icons';
import { Pressable, Share, View } from 'react-native';

import { ActionButton, Artwork, AuraText, Card, SectionTitle, SwitchRow, showAlert } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { PlaylistDetail } from '@/core/types';

import { useCollaboratorRole, useCreateInvite, useRemoveCollaborator, useUpdatePlaylist } from '../hooks/use-playlists';

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Please try again.');

/** Owner-only controls, shown on the playlist's Share page: visibility, invite links and collaborator roles. */
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
          }).catch((error: unknown) => showAlert('Could not open sharing', errorText(error)));
        },
        onError: (error) => showAlert('Could not create invite', errorText(error)),
      },
    );

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Visibility" />
        <SwitchRow
          label="Public playlist"
          description={(isPublic) =>
            isPublic ? 'Anyone can find and listen to it.' : 'Only you and people you invite can see it.'
          }
          value={playlist.isPublic}
          onChange={(isPublic) =>
            update.mutateAsync({ playlistId: playlist.id, isPublic }).catch((error: unknown) => {
              showAlert('Could not change visibility', errorText(error));
              throw error;
            })
          }
        />
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Invite" />
        <AuraText style={{ color: colors.muted, fontSize: 13 }}>
          Editors can add, remove and reorder songs. Listeners can only play the playlist.
        </AuraText>
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
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="People" />
        {playlist.collaborators.length ? (
          <Card style={{ gap: 12 }}>
            {playlist.collaborators.map((person) => {
              const name = person.displayName ?? 'AURA listener';
              const isEditor = person.role === 'editor';
              return (
                <View key={person.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Artwork uri={person.imageUrl} size={36} rounded={18} />
                  <AuraText numberOfLines={1} style={{ flex: 1 }}>
                    {name}
                  </AuraText>
                  <Pressable
                    onPress={() =>
                      changeRole.mutate(
                        { playlistId: playlist.id, userId: person.userId, role: isEditor ? 'viewer' : 'editor' },
                        { onError: (error) => showAlert('Could not change role', errorText(error)) },
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${name} is ${isEditor ? 'an editor' : 'a viewer'}. Tap to make them ${isEditor ? 'a viewer' : 'an editor'}.`}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: colors.accentSoft,
                    }}>
                    <AuraText style={{ fontSize: 12, fontWeight: '700' }}>{isEditor ? 'Editor' : 'Viewer'}</AuraText>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      showAlert('Remove collaborator?', `${name} will lose access to this playlist.`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () =>
                            removeCollaborator.mutate(
                              { playlistId: playlist.id, userId: person.userId },
                              { onError: (error) => showAlert('Could not remove', errorText(error)) },
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
          </Card>
        ) : (
          <AuraText style={{ color: colors.muted, fontSize: 13 }}>
            No collaborators yet. Invite friends and edit this playlist together in real time.
          </AuraText>
        )}
      </View>
    </View>
  );
}

import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Artwork, AuraText } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { PlaylistDetail } from '@/core/types';

/** Owner + collaborators, and a live indicator when the playlist is shared. */
export function PlaylistPeopleRow({ playlist, live }: { playlist: PlaylistDetail; live: boolean }) {
  const { colors } = useAuraTheme();
  const router = useRouter();
  const people = [playlist.owner, ...playlist.collaborators].filter(Boolean);
  const shared = playlist.collaborators.length > 0 || playlist.role !== 'owner';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        {people.slice(0, 5).map((person, index) => (
          <View
            key={person.userId}
            style={{
              marginLeft: index === 0 ? 0 : -10,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.background,
            }}>
            <Artwork uri={person.imageUrl} size={28} rounded={14} />
          </View>
        ))}
      </View>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => playlist.owner && router.push({ pathname: '/user/[id]', params: { id: playlist.owner.userId } })}
        accessibilityRole="link"
        accessibilityLabel={`Created by ${playlist.owner?.displayName ?? 'an AURA listener'}. Open profile.`}>
        <AuraText numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
          by {playlist.owner?.displayName ?? 'AURA listener'}
          {playlist.collaborators.length ? ` + ${playlist.collaborators.length}` : ''}
        </AuraText>
      </Pressable>
      {shared ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
          accessible
          accessibilityLabel="Live: changes from collaborators appear automatically">
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? colors.accentCyan : colors.teal }}
          />
          <AuraText style={{ fontSize: 12, color: colors.muted }}>Live</AuraText>
        </View>
      ) : null}
    </View>
  );
}

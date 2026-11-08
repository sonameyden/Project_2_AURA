import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AuraText, ErrorMessage, Heading, LoadingState, Page } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';

import { PlaylistSharePanel } from './components/PlaylistSharePanel';
import { usePlaylistDetail } from './hooks/use-playlists';

/**
 * Sharing settings for one playlist, kept on their own page so the playlist
 * itself is just its songs: visibility, invite links and collaborators.
 * Owner only; refreshes live like the playlist so new collaborators appear.
 */
export default function PlaylistShareScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAuraTheme();
  const playlistQuery = usePlaylistDetail(id);
  const playlist = playlistQuery.data;

  return (
    <Page style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Heading title="Share & collaborate" subtitle={playlist?.title} />
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      {playlistQuery.isPending ? <LoadingState label="Loading sharing settings…" /> : null}
      {playlistQuery.error instanceof Error ? (
        <ErrorMessage message={playlistQuery.error.message} onRetry={() => void playlistQuery.refetch()} />
      ) : null}
      {playlist && playlist.role !== 'owner' ? (
        <AuraText style={{ color: colors.muted }}>
          Only the playlist&apos;s owner can change how it&apos;s shared.
        </AuraText>
      ) : null}
      {playlist?.role === 'owner' ? <PlaylistSharePanel playlist={playlist} /> : null}
    </Page>
  );
}

import { useRouter } from 'expo-router';
import { Alert, FlatList, View } from 'react-native';

import { AuraText, EmptyState, ErrorMessage, Heading, LoadingState, Page, TrackRow } from '@/components/ui';
import { auraApi } from '@/core/api';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import { useAuraQuery } from '@/core/use-aura-query';

import { useLikedSongs, useToggleLike } from '@/hooks/use-liked-songs';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';

export function SongListScreen({ kind }: { kind: 'liked' | 'history' }) {
  const router = useRouter();
  const { colors } = useAuraTheme();
  const { playSong, song: playing } = usePlayer();
  const likedQuery = useLikedSongs(kind === 'liked');
  const historyQuery = useAuraQuery(['library', 'history'], (token) => auraApi.history(token), kind === 'history');
  const songsQuery = kind === 'liked' ? likedQuery : historyQuery;
  const toggleLike = useToggleLike();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const songs = songsQuery.data ?? [];
  const error = songsQuery.error instanceof Error ? songsQuery.error.message : null;

  return (
    <Page scroll={false} style={{ paddingBottom: 0 }}>
      <FlatList
        data={songs}
        // History can contain the same song more than once.
        keyExtractor={(item, index) => `${item.id}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 4, paddingBottom: 132 }}
        ListHeaderComponent={
          <View style={{ gap: 20, marginBottom: 12 }}>
            <Heading
              title={kind === 'liked' ? 'Liked Songs' : 'Listening History'}
              subtitle={kind === 'liked' ? 'The songs you want to keep close.' : 'Your recent listening, all in one place.'}
            />
            {error ? <ErrorMessage message={error} onRetry={() => void songsQuery.refetch()} /> : null}
            {songsQuery.isPending ? <LoadingState label="Loading songs…" /> : null}
          </View>
        }
        ListEmptyComponent={
          !error && !songsQuery.isPending ? (
            <EmptyState
              title={kind === 'liked' ? 'Your heart is still open' : 'Your story starts here'}
              description={
                kind === 'liked'
                  ? 'Like a song from Now Playing and it will appear here.'
                  : 'Start playing music to build your listening history.'
              }
              icon={kind === 'liked' ? 'heart-outline' : 'time-outline'}
            />
          ) : undefined
        }
        renderItem={({ item: song }) => (
          <TrackRow
            song={song}
            active={playing?.id === song.id}
            onPress={() => void playSong(song, songs).then(() => router.push('/now-playing'))}
            onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: song.artistId } })}
            onMore={() => openAddToPlaylist(song)}
            trailing={
              kind === 'liked' ? (
                <AuraText
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${song.title} from liked songs`}
                  onPress={() =>
                    toggleLike.mutate(
                      { song, liked: false },
                      {
                        onError: (removeError) =>
                          Alert.alert(
                            'Could not remove song',
                            removeError instanceof Error ? removeError.message : 'Please try again.',
                          ),
                      },
                    )
                  }
                  style={{ color: colors.accent, fontSize: 13, paddingHorizontal: 4 }}>
                  Remove
                </AuraText>
              ) : undefined
            }
          />
        )}
      />
    </Page>
  );
}

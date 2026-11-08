import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import {
  BackButton,
  ActionButton,
  Artwork,
  AuraText,
  Card,
  ErrorMessage,
  Heading,
  LoadingState,
  Page,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { useAuraTheme } from '@/core/theme';
import { useAuraQuery } from '@/core/use-aura-query';

/** Opened from a shared link (`aura://invite/<code>`): preview, then join. */
export default function InviteScreenFeature() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { colors } = useAuraTheme();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const preview = useAuraQuery(
    ['library', 'invite', code],
    (token) => auraApi.invitePreview(token, code ?? ''),
    Boolean(code),
  );
  const accept = useMutation({
    mutationFn: async () => auraApi.acceptInvite(await getToken(), code ?? ''),
    onSuccess: async ({ playlistId }) => {
      await queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
      router.replace({ pathname: '/playlist/[id]', params: { id: playlistId } });
    },
  });

  const data = preview.data;
  const loadError = preview.error instanceof Error ? preview.error.message : null;
  const acceptError = accept.error instanceof Error ? accept.error.message : null;

  return (
    <Page>
      <BackButton variant="close" />
      <Heading title="Playlist invite" />
      {preview.isPending ? <LoadingState label="Opening invite…" /> : null}
      {loadError ? <ErrorMessage message={loadError} onRetry={() => void preview.refetch()} /> : null}
      {data ? (
        <Card style={{ gap: 14, alignItems: 'center' }}>
          <Artwork uri={data.owner.imageUrl} size={64} rounded={32} />
          <AuraText style={{ textAlign: 'center' }}>
            <AuraText style={{ fontWeight: '700' }}>{data.owner.displayName ?? 'An AURA listener'}</AuraText> invited
            you to {data.role === 'editor' ? 'build' : 'listen to'}
          </AuraText>
          <AuraText style={{ fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{data.playlist.title}</AuraText>
          <AuraText style={{ color: colors.muted }}>
            {data.playlist.songCount} songs ·{' '}
            {data.role === 'editor' ? 'You can add, remove and reorder songs' : 'View and play'}
          </AuraText>
          {acceptError ? <ErrorMessage message={acceptError} /> : null}
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            {data.alreadyMember ? (
              <ActionButton
                title="Open playlist"
                onPress={() => router.replace({ pathname: '/playlist/[id]', params: { id: data.playlist.id } })}
              />
            ) : (
              <ActionButton title="Join playlist" onPress={() => accept.mutate()} loading={accept.isPending} />
            )}
            <ActionButton title="Not now" variant="quiet" onPress={() => router.replace('/(tabs)')} />
          </View>
        </Card>
      ) : null}
    </Page>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  ActionButton,
  AuraText,
  Card,
  ErrorMessage,
  Field,
  GradientText,
  LoadingState,
  Page,
  SectionTitle,
  TrackRow,
  showAlert,
} from '@/components/ui';
import { ApiError, auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { appendUploadFile } from '@/core/native-upload';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import { useAuraQuery } from '@/core/use-aura-query';
import { IMAGE_MAX_SIZE, pickImageForm, pickImageUpload } from '@/core/pick-image';
import type { Song } from '@/core/types';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';
import { useRefreshCatalog } from '@/hooks/use-refresh-catalog';

export default function ArtistProfileScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken, user } = useAuth();
  const { colors } = useAuraTheme();
  const { playSong, togglePlayback, isPlaying, song: currentSong } = usePlayer();
  const queryClient = useQueryClient();
  const refreshCatalog = useRefreshCatalog();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const isOwnProfile = id === 'me' || id === 'current_user' || id === user?.uid;

  const artistQuery = useAuraQuery(
    ['catalog', 'artist-profile', id],
    async (token) => {
      if (!id) throw new Error('Artist id is missing.');
      const artist = isOwnProfile
        ? await auraApi.getMyArtist(token)
        : await auraApi.artist(token, id);
      const [songs, albums, followStatus, stats] = await Promise.all([
        isOwnProfile ? auraApi.myArtistSongs(token) : auraApi.artistSongs(token, artist.id),
        auraApi.albumsByArtist(token, artist.id),
        isOwnProfile
          ? Promise.resolve({ following: false })
          : auraApi.isFollowingArtist(token, artist.id),
        // Stats are a nice-to-have; an older backend without them shouldn't break the page.
        auraApi.artistStats(token, artist.id).catch(() => null),
      ]);
      return { artist, songs, albums, following: followStatus.following, stats };
    },
    Boolean(id),
  );
  const artist = artistQuery.data?.artist ?? null;
  const songs = artistQuery.data?.songs ?? [];
  const albums = artistQuery.data?.albums ?? [];
  const following = artistQuery.data?.following ?? false;
  const stats = artistQuery.data?.stats ?? null;
  const error =
    mutationError ??
    (artistQuery.error instanceof Error ? artistQuery.error.message : null);
  const artistNotFound = isOwnProfile && artistQuery.error instanceof ApiError && artistQuery.error.status === 404;
  const artistIsPlaying = Boolean(
    isPlaying && currentSong && currentSong.artistId === artist?.id,
  );

  useEffect(() => {
    if (artistNotFound) router.replace('/artist-dashboard');
  }, [artistNotFound, router]);

  if (artistQuery.isPending || artistNotFound) {
    return (
      <Page style={{ justifyContent: 'center' }}>
        <LoadingState label={artistNotFound ? 'Opening creator setup…' : 'Loading artist profile…'} />
      </Page>
    );
  }

  const toggleFollow = async () => {
    if (!artist) return;
    setWorking(true);
    setMutationError(null);
    try {
      const token = await getToken();
      await auraApi.followArtist(token, artist.id, !following);
      await artistQuery.refetch();
      // Follows feed Home's "Artists you follow" and "Made for you".
      void queryClient.invalidateQueries({ queryKey: ['library', 'followed-artists'] });
      void queryClient.invalidateQueries({ queryKey: ['home', 'for-you'] });
    } catch (followError) {
      setMutationError(followError instanceof Error ? followError.message : 'Could not update follow status.');
    } finally {
      setWorking(false);
    }
  };

  /** Owner menu for one of their songs: add to playlist, new artwork, or delete. */
  const manageSong = (song: Song) =>
    showAlert(song.title, 'What would you like to do?', [
      { text: 'Add to playlist', onPress: () => openAddToPlaylist(song) },
      {
        text: 'Replace artwork',
        onPress: () => {
          void (async () => {
            const form = await pickImageForm('artwork', { fallbackName: 'song-artwork.jpg', maxSize: IMAGE_MAX_SIZE.artwork });
            if (!form) return;
            setWorking(true);
            setMutationError(null);
            try {
              await auraApi.replaceSongArtwork(await getToken(), song.id, form);
              await refreshCatalog();
            } catch (artworkError) {
              setMutationError(artworkError instanceof Error ? artworkError.message : 'Artwork could not be updated.');
            } finally {
              setWorking(false);
            }
          })();
        },
      },
      {
        text: 'Delete song',
        style: 'destructive',
        onPress: () =>
          showAlert('Delete this song?', `"${song.title}" and its audio will be removed for everyone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                setWorking(true);
                void getToken()
                  .then((token) => auraApi.deleteSong(token, song.id))
                  .then(() => refreshCatalog())
                  .catch((deleteError: unknown) =>
                    setMutationError(deleteError instanceof Error ? deleteError.message : 'Song could not be deleted.'),
                  )
                  .finally(() => setWorking(false));
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const startEditingBio = () => {
    setBioDraft(artist?.bio ?? '');
    setMutationError(null);
    setEditingBio(true);
  };

  const saveBio = async () => {
    if (!artist) return;
    setWorking(true);
    setMutationError(null);
    try {
      // The endpoint replaces the whole profile, so resend the current name and photo.
      await auraApi.createArtist(await getToken(), {
        name: artist.name,
        bio: bioDraft.trim() || null,
        imageUrl: artist.imageUrl,
      });
      await refreshCatalog();
      setEditingBio(false);
    } catch (saveError) {
      setMutationError(saveError instanceof Error ? saveError.message : 'Bio could not be saved.');
    } finally {
      setWorking(false);
    }
  };

  const chooseArtistImage = async () => {
    const image = await pickImageUpload({ fallbackName: 'artist-profile.jpg', maxSize: IMAGE_MAX_SIZE.avatar });
    if (!image) return;

    setWorking(true);
    setMutationError(null);
    try {
      const token = await getToken();
      const form = new FormData();
      appendUploadFile(form, 'file', image);
      await auraApi.uploadArtistImage(token, form);
      await refreshCatalog();
    } catch (uploadError) {
      setMutationError(
        uploadError instanceof Error ? uploadError.message : 'Artist photo could not be uploaded.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    // Fades in once the profile has loaded, instead of jumping in over the loading screen.
    <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1 }}>
      <Page style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 24, gap: 20 }}>
        {error ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <ErrorMessage message={error} onRetry={() => void artistQuery.refetch()} />
          </View>
        ) : null}
        <View>
          <View style={{ height: 380, backgroundColor: colors.elevated }}>
            {artist?.imageUrl ? (
              <Image source={{ uri: artist.imageUrl }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <LinearGradient
                colors={[colors.elevated, colors.background]}
                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person-circle-outline" size={120} color={colors.accent} />
              </LinearGradient>
            )}
            <LinearGradient
              colors={['transparent', '#00000033', '#00000099', colors.background]}
              locations={[0, 0.4, 0.78, 1]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            {isOwnProfile ? (
              <Pressable
                onPress={() => void chooseArtistImage()}
                disabled={working}
                accessibilityRole="button"
                accessibilityLabel="Change artist profile photo"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 20,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#00000066',
                  opacity: working ? 0.6 : 1,
                }}>
                <Ionicons name={working ? 'hourglass-outline' : 'camera-outline'} size={21} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{
                position: 'absolute',
                top: 12,
                left: 20,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#00000055',
              }}>
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>
            <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
              {artist?.isVerified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#3D91FF" />
                  <AuraText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    Verified Artist
                  </AuraText>
                </View>
              ) : null}
              <GradientText
                numberOfLines={2}
                style={{ fontSize: 42, lineHeight: 48, fontWeight: '900', marginVertical: 8 }}>
                {artist?.name ?? 'Artist'}
              </GradientText>
              <AuraText style={{ color: '#FFFFFFE6', fontSize: 14, fontWeight: '500' }}>
                {formatCount(artist?.monthlyListeners ?? 0)} monthly listeners
              </AuraText>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              paddingHorizontal: 24,
              paddingTop: 12,
            }}>
            {!isOwnProfile ? (
              <Pressable
                onPress={() => void toggleFollow()}
                disabled={working}
                accessibilityRole="button"
                style={{
                  minWidth: 96,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#FFFFFF66',
                  paddingHorizontal: 16,
                  opacity: working ? 0.6 : 1,
                }}>
                <AuraText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  {following ? 'Following' : 'Follow'}
                </AuraText>
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                if (currentSong?.artistId === artist?.id) {
                  togglePlayback();
                  return;
                }
                const firstSong = songs[0];
                if (firstSong) void playSong(firstSong, songs).then(() => router.push('/now-playing'));
              }}
              disabled={!songs.length}
              accessibilityRole="button"
              accessibilityLabel={artistIsPlaying ? 'Pause artist' : 'Play artist'}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.accent,
                opacity: songs.length ? 1 : 0.55,
              }}>
              <Ionicons name={artistIsPlaying ? 'pause' : 'play'} size={30} color="#000000" />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <AuraText style={{ fontSize: 22, fontWeight: '800' }}>Insights</AuraText>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatCard
              title="Followers"
              value={formatCount(stats?.followers ?? artist?.followerCount ?? 0)}
              icon="people-outline"
            />
            <StatCard
              title={stats ? 'Song likes' : 'Monthly listeners'}
              value={formatCount(stats ? stats.likes : artist?.monthlyListeners ?? 0)}
              icon="trending-up-outline"
            />
          </View>
        </View>

        {isOwnProfile && editingBio ? (
          <View style={{ paddingHorizontal: 24, gap: 10 }}>
            <SectionTitle title="About" />
            <Field
              value={bioDraft}
              onChangeText={setBioDraft}
              placeholder="Tell listeners about your sound"
              accessibilityLabel="Artist bio"
              multiline
              maxLength={500}
              autoFocus
              style={{ minHeight: 110, textAlignVertical: 'top' }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ActionButton
                title="Cancel"
                variant="secondary"
                onPress={() => setEditingBio(false)}
                disabled={working}
                style={{ flex: 1 }}
              />
              <ActionButton title="Save bio" onPress={() => void saveBio()} loading={working} style={{ flex: 1 }} />
            </View>
            {mutationError ? <AuraText style={{ color: colors.danger, fontSize: 13 }}>{mutationError}</AuraText> : null}
          </View>
        ) : artist?.bio ? (
          <View style={{ paddingHorizontal: 24, gap: 8 }}>
            <SectionTitle title="About" action={isOwnProfile ? 'Edit' : undefined} onAction={startEditingBio} />
            <AuraText style={{ color: colors.muted, lineHeight: 21 }}>{artist.bio}</AuraText>
          </View>
        ) : isOwnProfile ? (
          <View style={{ paddingHorizontal: 24 }}>
            <Card onPress={startEditingBio} accessibilityLabel="Add a bio">
              <AuraText style={{ color: colors.muted }}>Add a bio so listeners can get to know you →</AuraText>
            </Card>
          </View>
        ) : null}

        {isOwnProfile ? (
          <View style={{ paddingHorizontal: 24, gap: 12 }}>
            <SectionTitle title="Content Management" />
            <Pressable onPress={() => router.push('/upload')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
                <Ionicons name="cloud-upload-outline" size={30} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <AuraText style={{ fontWeight: '600' }}>Upload new experience</AuraText>
                  <AuraText style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    Add high-quality audio &amp; sync lyrics
                  </AuraText>
                </View>
              </Card>
            </Pressable>
            <Pressable onPress={() => router.push('/album/create')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
                <Ionicons name="add" size={30} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <AuraText style={{ fontWeight: '600' }}>Create new album</AuraText>
                  <AuraText style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    Group your songs into a collection
                  </AuraText>
                </View>
              </Card>
            </Pressable>
          </View>
        ) : null}

        {albums.length ? (
          <View style={{ paddingHorizontal: 24, gap: 12 }}>
            <SectionTitle title="Albums" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
              {albums.map((album) => (
                <Pressable
                  key={album.id}
                  onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
                  style={{ width: '48%', gap: 8 }}>
                  {album.artworkUrl ? (
                    <Image
                      source={{ uri: album.artworkUrl }}
                      contentFit="cover"
                      style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }}
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.accentSoft, colors.elevated]}
                      style={{ width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="albums-outline" size={34} color={colors.accent} />
                    </LinearGradient>
                  )}
                  <AuraText numberOfLines={1} style={{ fontWeight: '700' }}>{album.title}</AuraText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          <SectionTitle title="Top Songs" />
          {songs.length ? (
            songs.map((song) => (
              <TrackRow
                key={song.id}
                song={song}
                active={currentSong?.id === song.id}
                onPress={() => void playSong(song, songs).then(() => router.push('/now-playing'))}
                onMore={() => (isOwnProfile ? manageSong(song) : openAddToPlaylist(song))}
              />
            ))
          ) : (
            <Card>
              <AuraText style={{ color: colors.muted }}>This artist has not shared any songs yet.</AuraText>
            </Card>
          )}
        </View>
      </Page>
    </Animated.View>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: 'people-outline' | 'trending-up-outline';
}) {
  const { colors } = useAuraTheme();
  return (
    <Card style={{ flex: 1, minHeight: 132, justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <AuraText style={{ fontSize: 20, fontWeight: '800' }}>{value}</AuraText>
      <AuraText style={{ color: colors.muted, fontSize: 11 }}>{title}</AuraText>
    </Card>
  );
}

function formatCount(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
  PageList,
  SectionTitle,
  TrackRow,
} from '@/components/ui';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import { useGoBack } from '@/core/use-go-back';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';

import { useArtistProfile } from './hooks/use-artist-profile';

export default function ArtistProfileScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const { colors } = useAuraTheme();
  const { playSong, togglePlayback, isPlaying, song: currentSong } = usePlayer();
  const openAddToPlaylist = useOpenAddToPlaylist();
  // Data and owner actions live in the hook; this screen only renders them.
  const profile = useArtistProfile(id);
  const {
    artist,
    songs,
    albums,
    following,
    stats,
    error,
    isOwnProfile,
    working,
    toggleFollow,
    manageSong,
    chooseArtistImage,
    deleteArtistAccount,
  } = profile;
  const mutationError = profile.actionError;
  const artistQuery = profile.query;
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const artistIsPlaying = Boolean(isPlaying && currentSong && currentSong.artistId === artist?.id);

  if (artistQuery.isPending || profile.artistNotFound) {
    return (
      <Page style={{ justifyContent: 'center' }}>
        <LoadingState label={profile.artistNotFound ? 'Opening creator setup…' : 'Loading artist profile…'} />
      </Page>
    );
  }

  const startEditingBio = () => {
    setBioDraft(artist?.bio ?? '');
    profile.clearError();
    setEditingBio(true);
  };

  const saveBio = async () => {
    if (await profile.saveBio(bioDraft)) setEditingBio(false);
  };

  return (
    // Fades in once the profile has loaded, instead of jumping in over the loading screen.
    <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1 }}>
      <PageList
        data={songs}
        keyExtractor={(song) => song.id}
        extraData={[currentSong?.id, isOwnProfile]}
        itemSpacing={10}
        style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 24, gap: 20 }}
        header={
          <>
            {error ? (
              <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
                <ErrorMessage message={error} onRetry={() => void artistQuery.refetch()} />
              </View>
            ) : null}
            <View>
              <View style={{ height: 380, backgroundColor: colors.elevated }}>
                {artist?.imageUrl ? (
                  <Image
                    source={{ uri: artist.imageUrl }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
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
                  onPress={() => goBack()}
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
                      <AuraText style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Verified Artist</AuraText>
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
                  value={formatCount(stats ? stats.likes : (artist?.monthlyListeners ?? 0))}
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
                {mutationError ? (
                  <AuraText style={{ color: colors.danger, fontSize: 13 }}>{mutationError}</AuraText>
                ) : null}
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
                          style={{
                            width: '100%',
                            aspectRatio: 1,
                            borderRadius: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Ionicons name="albums-outline" size={34} color={colors.accent} />
                        </LinearGradient>
                      )}
                      <AuraText numberOfLines={1} style={{ fontWeight: '700' }}>
                        {album.title}
                      </AuraText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ paddingHorizontal: 24 }}>
              <SectionTitle title="Top Songs" />
            </View>
            {!songs.length ? (
              <View style={{ paddingHorizontal: 24 }}>
                <Card>
                  <AuraText style={{ color: colors.muted }}>This artist has not shared any songs yet.</AuraText>
                </Card>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item: song }) => (
          <View style={{ paddingHorizontal: 24 }}>
            <TrackRow
              song={song}
              active={currentSong?.id === song.id}
              onPress={() => void playSong(song, songs).then(() => router.push('/now-playing'))}
              onMore={() => (isOwnProfile ? manageSong(song) : openAddToPlaylist(song))}
            />
          </View>
        )}
        footer={
          <>
            {isOwnProfile ? (
              <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 10 }}>
                <SectionTitle title="Account" />
                <AuraText style={{ color: colors.muted, fontSize: 13 }}>
                  Removes your artist page, songs and albums. Your listener account stays.
                </AuraText>
                <ActionButton
                  title="Delete artist account"
                  variant="danger"
                  onPress={deleteArtistAccount}
                  loading={working}
                />
              </View>
            ) : null}
          </>
        }
      />
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

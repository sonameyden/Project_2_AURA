import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, View } from 'react-native';

import { AuraText, ErrorMessage, GradientText, Page } from '@/components/ui';
import { useAuth } from '@/core/auth-context';
import { usePlayer } from '@/core/player';
import { useSettings } from '@/core/settings';
import { useAuraTheme } from '@/core/theme';
import type { Song } from '@/core/types';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';
import { useUserProfile } from '@/hooks/use-user-profile';

import { AlbumCard, ArtistCard, HorizontalSection, SongCard } from './components/HomeCards';
import { useHomeData } from './hooks/use-home-data';

const moodBackground = require('../../../assets/images/mood-background.jpg');

export default function HomeScreenFeature() {
  const router = useRouter();
  const { colors, mode } = useAuraTheme();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { playSong, song: playing } = usePlayer();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const { trending, forYou, artists, newReleases, recentlyPlayed, followedArtists, loading, error, retry } = useHomeData();
  const profileQuery = useUserProfile();
  const [orbScale] = useState(() => new Animated.Value(1));
  const profileImage = profileQuery.data?.imageUrl || user?.photoURL || null;
  const isLight = mode === 'light';
  const errorMessage = error instanceof Error ? error.message : 'Some discovery sections did not load.';

  useEffect(() => {
    if (!isLight || settings.reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 0.98, duration: 2000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isLight, orbScale, settings.reducedMotion]);

  const play = (song: Song, queue: Song[]) => {
    void playSong(song, queue).then(() => router.push('/now-playing'));
  };
  const openArtist = (artistId: string) => router.push({ pathname: '/artist/[id]', params: { id: artistId } });
  const songCard = (song: Song, queue: Song[], reason?: string) => (
    <SongCard
      key={song.id}
      song={song}
      reason={reason}
      playing={playing?.id === song.id}
      onPress={() => play(song, queue)}
      onArtistPress={() => openArtist(song.artistId)}
      onMore={() => openAddToPlaylist(song)}
    />
  );
  const forYouSongs = forYou?.items.map((item) => item.song) ?? [];
  const forYouSubtitle = forYou?.profile.label
    ? `Tuned to your taste for ${forYou.profile.label}`
    : 'Like songs and keep listening to tune these to you';

  return (
    <Page style={{ paddingHorizontal: 12, paddingTop: 12, gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GradientText style={{ fontSize: 20, fontWeight: '800', letterSpacing: 4 }}>AURA</GradientText>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} contentFit="cover" style={{ width: 36, height: 36 }} />
          ) : (
            <Ionicons name="person-circle" size={25} color={colors.text} />
          )}
        </Pressable>
      </View>
      <AuraText style={{ color: colors.muted, fontSize: 14, fontWeight: '500', marginTop: 8, marginBottom: 12 }}>
        Step into it.
      </AuraText>

      <GradientText style={{ fontSize: 22, fontWeight: '700' }}>Discover by Mood</GradientText>
      <Pressable
        onPress={() => router.push('/mood')}
        accessibilityRole="button"
        accessibilityLabel="How are you feeling? Describe your mood to get music."
        style={{
          height: 140,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          marginTop: 12,
          marginBottom: 4,
          backgroundColor: colors.surface,
        }}>
        <Image source={moodBackground} contentFit="cover" style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.25 }} />
        <LinearGradient
          colors={isLight ? ['rgba(248,249,253,0.08)', 'rgba(248,249,253,0.58)'] : ['rgba(12,13,18,0.08)', 'rgba(12,13,18,0.68)']}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
        {isLight ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -20,
              top: -10,
              width: 160,
              height: 160,
              borderRadius: 80,
              overflow: 'hidden',
              opacity: 0.8,
              transform: [{ scale: orbScale }],
            }}>
            <LinearGradient colors={['#DDD4E899', '#EAD9DD66', '#EAD9DD00']} style={{ width: '100%', height: '100%' }} />
          </Animated.View>
        ) : null}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
          <AuraText style={{ color: isLight ? '#29262D' : '#FFFFFF', fontSize: 20, fontWeight: '700' }}>How are you feeling?</AuraText>
          <AuraText style={{ color: isLight ? '#77717A' : '#FFFFFFB3', fontSize: 12, marginTop: 5 }}>
            Let AI find the perfect world for you.
          </AuraText>
        </View>
      </Pressable>

      {error ? <ErrorMessage message={errorMessage} onRetry={() => void retry()} /> : null}
      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} accessibilityLabel="Loading discovery" /> : null}

      {forYou?.items.length ? (
        <HorizontalSection title="Made for you" subtitle={forYouSubtitle}>
          {forYou.items.map((item) => songCard(item.song, forYouSongs, item.reason))}
        </HorizontalSection>
      ) : null}

      {recentlyPlayed.length ? (
        <HorizontalSection title="Recently played">
          {recentlyPlayed.map((song) => songCard(song, recentlyPlayed))}
        </HorizontalSection>
      ) : null}

      {followedArtists.length ? (
        <HorizontalSection title="Artists you follow">
          {followedArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} onPress={() => openArtist(artist.id)} />
          ))}
        </HorizontalSection>
      ) : null}

      {trending.length ? (
        <HorizontalSection title="Trending">{trending.map((song) => songCard(song, trending))}</HorizontalSection>
      ) : null}

      {newReleases.length ? (
        <HorizontalSection title="New Releases">
          {newReleases.map((album) => (
            <AlbumCard key={album.id} album={album} onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })} />
          ))}
        </HorizontalSection>
      ) : null}

      {artists.length ? (
        <HorizontalSection title="Discover artists">
          {artists
            .filter((artist) => !followedArtists.some((followed) => followed.id === artist.id))
            .slice(0, 12)
            .map((artist) => (
              <ArtistCard key={artist.id} artist={artist} onPress={() => openArtist(artist.id)} />
            ))}
        </HorizontalSection>
      ) : null}
    </Page>
  );
}

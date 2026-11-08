import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, AuraText, ErrorMessage, Page, showAlert } from '@/components/ui';
import { usePlaybackProgress, usePlayer } from '@/core/player';
import { useSettings } from '@/core/settings';
import { useAuraTheme } from '@/core/theme';
import { useLikedSongs, useToggleLike } from '@/hooks/use-liked-songs';
import { CatCompanion } from './components/CatCompanion';
import { KaleidoscopeLayer } from './components/KaleidoscopeLayer';
import { LyricsOverlay } from './components/LyricsOverlay';
import { NowPlayingScene } from './components/NowPlayingScene';
import { PlayerControls } from './components/PlayerControls';
import { QueueSheet } from './components/QueueSheet';
import { lookFor, profileWithLook, type SceneLook } from './lib/sections';
import { isHexColor } from './lib/visual-utils';

export default function NowPlayingScreenFeature() {
  const router = useRouter();
  const { colors, highContrast } = useAuraTheme();
  const { settings, textScale } = useSettings();
  const { song, isPlaying, atmosphere, atmosphereLoading, lyrics, error, clearError } = usePlayer();
  const { currentTime, duration, activeLyricId } = usePlaybackProgress();
  const [showQueue, setShowQueue] = useState(false);
  // The look the scene is showing. While the next song's atmosphere loads it
  // stays on the previous song's look, so a song change is one smooth
  // transition instead of a jump back to the old song's intro and then another.
  const [heldLook, setHeldLook] = useState<SceneLook | null>(null);
  const likedQuery = useLikedSongs(Boolean(song));
  const toggleLike = useToggleLike();

  if (!song) {
    return (
      <Page style={{ flexGrow: 1, justifyContent: 'center' }}>
        <AuraText style={{ textAlign: 'center' }}>Choose a song to step into its atmosphere.</AuraText>
        <ActionButton title="Browse music" onPress={() => router.replace('/(tabs)')} />
      </Page>
    );
  }

  const liked = Boolean(likedQuery.data?.some((item) => item.id === song.id));
  // The look for the current song section (palette, lighting, environment, cat).
  const latestLook = lookFor(atmosphere, currentTime * 1000, song.id);
  if (!atmosphereLoading && heldLook?.key !== latestLook.key) setHeldLook(latestLook);
  const look = atmosphereLoading && heldLook ? heldLook : latestLook;
  const sectionAtmosphere = profileWithLook(atmosphere, look);
  const background = isHexColor(look.primaryColorHex) ? look.primaryColorHex : colors.accent;
  const activeLyric = lyrics.find((line) => line.id === activeLyricId) ?? null;
  const isResonant = Boolean(
    activeLyric && atmosphere?.resonantLyricLineIds.some((id) => id === activeLyric.id || id === activeLyric.text),
  );
  const onToggleLike = () =>
    toggleLike.mutate(
      { song, liked: !liked },
      {
        onError: (likeError) =>
          showAlert('Could not update liked songs', likeError instanceof Error ? likeError.message : 'Please try again.'),
      },
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NowPlayingScene
        look={look}
        atmosphere={sectionAtmosphere}
        playing={isPlaying}
        baseColor={colors.accent}
      />
      <LinearGradient
        pointerEvents="none"
        // High contrast darkens the lower half so controls and lyrics stay legible.
        colors={
          highContrast
            ? [colors.background + '66', colors.background + '33', colors.background + 'B3', colors.background + 'F2']
            : [colors.background + '33', colors.background + '08', background + '24', colors.background + 'C9']
        }
        locations={[0, 0.28, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KaleidoscopeLayer atmosphere={sectionAtmosphere} playing={isPlaying} currentTime={currentTime} duration={duration} />
      <View style={{ flex: 1 }}>
        {/* Bottom edge too: otherwise the like/queue row sits under Android's navigation bar. */}
        <Page
          transparent
          safeAreaEdges={['top', 'bottom']}
          style={{ flexGrow: 1, justifyContent: 'space-between', paddingTop: 16, paddingBottom: 24 }}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close player" hitSlop={12}>
              <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/add-to-playlist')}
              accessibilityRole="button"
              accessibilityLabel="Add to playlist"
              hitSlop={12}
              style={styles.roundButton}>
              <MaterialCommunityIcons name="playlist-plus" size={25} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Open space for the kaleidoscope, which is drawn full-screen behind it (see KaleidoscopeLayer). */}
          <View style={{ flex: 1, minHeight: 120 }} />

          <View style={{ gap: 14, paddingBottom: 8 }}>
            {lyrics.length ? (
              <LyricsOverlay
                lineId={activeLyric?.id ?? null}
                text={activeLyric?.text ?? ''}
                resonant={isResonant}
                reducedMotion={settings.reducedMotion}
                fontScale={textScale}
              />
            ) : null}
            <View style={{ alignItems: 'center', gap: 5 }}>
              <AuraText numberOfLines={1} style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
                {song.title}
              </AuraText>
              <Pressable
                onPress={() => router.push({ pathname: '/artist/[id]', params: { id: song.artistId } })}
                accessibilityRole="link">
                <AuraText style={{ color: '#FFFFFFB3', fontSize: 15 }}>{song.artistName}</AuraText>
              </Pressable>
            </View>

            {/* Like the Kotlin app: the cat stands on the ground between the title and
                the controls, with the seek bar passing in front of its feet. */}
            <CatCompanion
              behavior={look.catBehavior}
              environment={look.environment}
              energy={look.energy}
              playing={isPlaying}
              songKey={song.id}
            />
            <PlayerControls accentColor={background} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable
                onPress={onToggleLike}
                disabled={toggleLike.isPending}
                accessibilityRole="button"
                accessibilityLabel={liked ? 'Unlike song' : 'Like song'}
                accessibilityState={{ selected: liked }}
                hitSlop={10}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? '#FFFFFF' : '#FFFFFFB3'} />
              </Pressable>
              <Pressable onPress={() => setShowQueue(true)} accessibilityRole="button" accessibilityLabel="Open queue" hitSlop={10}>
                <Ionicons name="list" size={27} color="#FFFFFFB3" />
              </Pressable>
            </View>
          </View>
          {error ? <ErrorMessage message={error} onRetry={clearError} actionLabel="Dismiss" /> : null}
        </Page>
      </View>
      <QueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF1F',
  },
});

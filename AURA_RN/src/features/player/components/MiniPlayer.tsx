import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Artwork, AuraText } from '@/components/ui';
import { usePlaybackProgress, usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';

/** Persistent mini-player; mounted once in the root layout above every screen. */
export function MiniPlayer() {
  const router = useRouter();
  const { colors } = useAuraTheme();
  const { song, isPlaying, togglePlayback, playNext, hasNext } = usePlayer();
  const { currentTime, duration } = usePlaybackProgress();
  if (!song) return null;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <Pressable
      onPress={() => router.push('/now-playing')}
      accessibilityRole="button"
      accessibilityLabel={`Now playing ${song.title} by ${song.artistName}. Open player.`}
      style={({ pressed }) => [
        styles.miniPlayer,
        { backgroundColor: colors.elevated, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Artwork uri={song.artworkUrl} size={42} rounded={12} />
      <View style={styles.details}>
        <AuraText numberOfLines={1} style={styles.title}>{song.title}</AuraText>
        <AuraText numberOfLines={1} style={[styles.artist, { color: colors.muted }]}>{song.artistName}</AuraText>
      </View>
      <Pressable
        onPress={togglePlayback}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        hitSlop={12}
        style={styles.iconButton}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={() => void playNext()}
        disabled={!hasNext}
        accessibilityRole="button"
        accessibilityLabel="Next song"
        accessibilityState={{ disabled: !hasNext }}
        hitSlop={12}
        style={[styles.iconButton, !hasNext && { opacity: 0.4 }]}>
        <Ionicons name="play-skip-forward" size={20} color={colors.text} />
      </Pressable>
      <View pointerEvents="none" style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={{ width: `${progress * 100}%`, height: 2, backgroundColor: colors.accent }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  miniPlayer: {
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 9,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  details: { flex: 1, gap: 4, minWidth: 0, marginLeft: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  artist: { fontSize: 13 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 2 },
});

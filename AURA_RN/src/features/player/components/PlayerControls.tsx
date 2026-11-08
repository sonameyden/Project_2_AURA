import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { AuraText } from '@/components/ui';
import { usePlaybackProgress, usePlayer } from '@/core/player';

const ON = '#FFFFFF';
const OFF = '#FFFFFFB3';

/** Seek bar + transport controls for Now Playing. */
export function PlayerControls({ accentColor }: { accentColor: string }) {
  const {
    isPlaying,
    isBuffering,
    repeatMode,
    shuffleEnabled,
    hasNext,
    hasPrevious,
    togglePlayback,
    playNext,
    playPrevious,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  return (
    <View style={{ gap: 14 }}>
      <SeekBar />
      <View style={styles.row}>
        <Pressable
          onPress={toggleShuffle}
          accessibilityRole="switch"
          accessibilityLabel="Shuffle"
          accessibilityState={{ checked: shuffleEnabled }}
          hitSlop={10}>
          <Ionicons name="shuffle" size={22} color={shuffleEnabled ? ON : OFF} />
          {shuffleEnabled ? <View style={styles.dot} /> : null}
        </Pressable>
        <Pressable
          onPress={() => void playPrevious()}
          disabled={!hasPrevious}
          accessibilityRole="button"
          accessibilityLabel="Previous song"
          hitSlop={10}
          style={!hasPrevious && styles.disabled}>
          <Ionicons name="play-skip-back" size={27} color={ON} />
        </Pressable>
        <Pressable
          onPress={togglePlayback}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          style={styles.playButton}>
          <Ionicons
            name={isBuffering ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
            size={28}
            color={accentColor}
          />
        </Pressable>
        <Pressable
          onPress={() => void playNext()}
          disabled={!hasNext}
          accessibilityRole="button"
          accessibilityLabel="Next song"
          accessibilityState={{ disabled: !hasNext }}
          hitSlop={10}
          style={!hasNext && styles.disabled}>
          <Ionicons name="play-skip-forward" size={27} color={ON} />
        </Pressable>
        <Pressable
          onPress={cycleRepeat}
          accessibilityRole="button"
          accessibilityLabel={`Repeat: ${repeatMode === 'off' ? 'off' : repeatMode === 'all' ? 'all songs' : 'this song'}`}
          hitSlop={10}>
          <MaterialCommunityIcons
            name={repeatMode === 'one' ? 'repeat-once' : repeatMode === 'all' ? 'repeat' : 'repeat-off'}
            size={23}
            color={repeatMode === 'off' ? OFF : ON}
          />
          {repeatMode !== 'off' ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

/** Tap or drag to seek; shows the drag position while the finger is down. */
function SeekBar() {
  const { seekTo } = usePlayer();
  const { currentTime, duration } = usePlaybackProgress();
  const [width, setWidth] = useState(1);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  // Rebuilt only when the bar's width or the song's length changes.
  const wholeSeconds = Math.round(duration);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => setDragRatio(clamp(event.nativeEvent.locationX / width)),
        onPanResponderMove: (event) => setDragRatio(clamp(event.nativeEvent.locationX / width)),
        onPanResponderRelease: (event) => {
          const ratio = clamp(event.nativeEvent.locationX / width);
          setDragRatio(null);
          void seekTo(ratio * wholeSeconds);
        },
        onPanResponderTerminate: () => setDragRatio(null),
      }),
    [seekTo, wholeSeconds, width],
  );

  const ratio = dragRatio ?? (duration > 0 ? Math.min(1, currentTime / duration) : 0);
  const shownTime = dragRatio === null ? currentTime : dragRatio * duration;

  return (
    <View style={{ gap: 7 }}>
      <View
        {...responder.panHandlers}
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{
          min: 0,
          max: Math.round(duration),
          now: Math.round(currentTime),
          text: formatTime(currentTime),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const delta = event.nativeEvent.actionName === 'increment' ? 10 : -10;
          void seekTo(currentTime + delta);
        }}
        style={styles.track}>
        <View style={styles.rail}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: ratio * width - (dragRatio === null ? 5 : 8) },
            dragRatio !== null && styles.thumbActive,
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AuraText style={styles.time}>{formatTime(shownTime)}</AuraText>
        <AuraText style={styles.time}>-{formatTime(Math.max(0, duration - shownTime))}</AuraText>
      </View>
    </View>
  );
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function formatTime(seconds: number) {
  const total = Math.floor(seconds || 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  disabled: { opacity: 0.35 },
  dot: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ON,
  },
  track: { height: 28, justifyContent: 'center' },
  rail: { height: 4, borderRadius: 4, backgroundColor: '#FFFFFF38', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 4, backgroundColor: '#FFFFFF' },
  thumb: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  thumbActive: { width: 16, height: 16, borderRadius: 8 },
  time: { color: '#FFFFFFB3', fontSize: 11 },
});

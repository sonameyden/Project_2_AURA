import { useQueryClient } from '@tanstack/react-query';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { auraApi } from '../api';
import { useAuth } from '../auth-context';
import type { AtmosphereProfile, LyricLine, Song } from '../types';
import {
  indexAfterTrackEnds,
  nextQueueIndex,
  nextRepeatMode,
  previousQueueIndex,
  shuffleKeepingCurrent,
  type RepeatMode,
} from './queue';
import { AudioReactivityContext, useAudioAnalyzer } from './use-audio-reactivity';

export type { RepeatMode } from './queue';
export { useAudioReactivity, type AudioReactivity } from './use-audio-reactivity';

type PlayerContextValue = {
  song: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  /**
   * The atmosphere on screen. While the next song's profile loads, the previous
   * song's profile stays here so visuals morph instead of resetting (the Kotlin
   * app's `carriedAtmosphereProfile`).
   */
  atmosphere: AtmosphereProfile | null;
  /** True while `atmosphere` still belongs to the previous song. */
  atmosphereLoading: boolean;
  lyrics: LyricLine[];
  error: string | null;
  playSong: (song: Song, queue?: Song[], atmosphereOverride?: AtmosphereProfile | null) => Promise<void>;
  playQueueIndex: (index: number) => Promise<void>;
  togglePlayback: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  seekTo: (seconds: number) => Promise<void>;
  stop: () => void;
  clearError: () => void;
};

/** Position data changes several times a second, so it lives in its own context. */
type PlaybackProgress = {
  currentTime: number;
  duration: number;
  activeLyricId: string | null;
};

type PlayerOptions = {
  /** Seconds of overlap between songs; 0 turns crossfade off. */
  crossfadeSeconds: number;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const ProgressContext = createContext<PlaybackProgress>({ currentTime: 0, duration: 0, activeLyricId: null });

const noop = () => {};
const noopAsync = async () => {};
const inactivePlayer: PlayerContextValue = {
  song: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  isBuffering: false,
  repeatMode: 'off',
  shuffleEnabled: false,
  hasNext: false,
  hasPrevious: false,
  atmosphere: null,
  atmosphereLoading: false,
  lyrics: [],
  error: null,
  playSong: noopAsync,
  playQueueIndex: noopAsync,
  togglePlayback: noop,
  playNext: noopAsync,
  playPrevious: noopAsync,
  toggleShuffle: noop,
  cycleRepeat: noop,
  seekTo: noopAsync,
  stop: noop,
  clearError: noop,
};

export function PlayerProvider({ children, crossfadeSeconds = 0 }: { children: React.ReactNode } & Partial<PlayerOptions>) {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const frame = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!hydrated) {
    return <PlayerContext.Provider value={inactivePlayer}>{children}</PlayerContext.Provider>;
  }
  return <ActivePlayerProvider crossfadeSeconds={crossfadeSeconds}>{children}</ActivePlayerProvider>;
}

const FADE_STEP_MS = 50;

function ActivePlayerProvider({ children, crossfadeSeconds }: { children: React.ReactNode } & PlayerOptions) {
  // Two players so one song can fade out while the next fades in.
  const playerA = useAudioPlayer(null, { updateInterval: 250 });
  const playerB = useAudioPlayer(null, { updateInterval: 250 });
  const statusA = useAudioPlayerStatus(playerA);
  const statusB = useAudioPlayerStatus(playerB);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const players = useMemo(() => [playerA, playerB] as const, [playerA, playerB]);
  const player = players[activeSlot];
  const status = activeSlot === 0 ? statusA : statusB;

  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [unshuffledQueue, setUnshuffledQueue] = useState<Song[] | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [atmosphere, setAtmosphere] = useState<AtmosphereProfile | null>(null);
  const [atmosphereLoading, setAtmosphereLoading] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadCounter = useRef(0);
  const [loadId, setLoadId] = useState(0);
  const earlyAdvanceFor = useRef(-1);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const song = queue[queueIndex] ?? null;
  const reactivity = useAudioAnalyzer(player, song ? `${loadId}` : null, status.playing);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch((audioError: unknown) => {
      console.error('Unable to configure audio playback.', audioError);
      setError(audioError instanceof Error ? audioError.message : 'Audio setup failed.');
    });
  }, []);

  const finishFade = useCallback(() => {
    if (fadeTimer.current) clearInterval(fadeTimer.current);
    fadeTimer.current = null;
  }, []);

  /** Loads `nextQueue[nextIndex]`, optionally crossfading from the current song. */
  const startTrack = useCallback(
    async (
      nextQueue: Song[],
      nextIndex: number,
      { atmosphereOverride = null, crossfade = false }: { atmosphereOverride?: AtmosphereProfile | null; crossfade?: boolean } = {},
    ) => {
      const nextSong = nextQueue[nextIndex];
      if (!nextSong) return;
      const id = ++loadCounter.current;
      setLoadId(id);
      setQueue(nextQueue);
      setQueueIndex(nextIndex);
      setLyrics([]);
      setError(null);
      if (atmosphereOverride) {
        setAtmosphere(atmosphereOverride);
        setAtmosphereLoading(false);
      } else {
        // Keep the previous atmosphere on screen until the new one arrives.
        setAtmosphereLoading(true);
      }

      finishFade();
      const current = players[activeSlot];
      const other = players[activeSlot === 0 ? 1 : 0];
      const fadeSeconds = crossfade && current.playing ? crossfadeSeconds : 0;
      const target: AudioPlayer = fadeSeconds > 0 ? other : current;

      try {
        if (fadeSeconds > 0) {
          setVolume(target, 0);
          target.replace(nextSong.streamUrl);
          target.play();
          setActiveSlot(activeSlot === 0 ? 1 : 0);
          const steps = Math.max(1, Math.round((fadeSeconds * 1000) / FADE_STEP_MS));
          let step = 0;
          fadeTimer.current = setInterval(() => {
            step += 1;
            const progress = Math.min(1, step / steps);
            setVolume(target, progress);
            setVolume(current, 1 - progress);
            if (progress >= 1) {
              current.pause();
              setVolume(current, 1);
              finishFade();
            }
          }, FADE_STEP_MS);
        } else {
          other.pause();
          setVolume(other, 1);
          setVolume(target, 1);
          target.replace(nextSong.streamUrl);
          target.play();
        }
        if (target !== current) {
          try {
            current.setActiveForLockScreen(false);
          } catch {
            // Lock screen controls are optional; ignore platforms without them.
          }
        }
        target.setActiveForLockScreen(
          true,
          {
            title: nextSong.title,
            artist: nextSong.artistName,
            albumTitle: undefined,
            artworkUrl: nextSong.artworkUrl ?? undefined,
          },
          // expo-audio does not yet emit next/previous events back to JS, so
          // only show controls that work.
          { showNextTrack: false, showPreviousTrack: false },
        );
      } catch (playbackError) {
        setError(errorMessage(playbackError));
      }

      try {
        const token = await getToken();
        const [history, profile, lyricResponse] = await Promise.allSettled([
          auraApi.addHistory(token, nextSong.id),
          atmosphereOverride ? Promise.resolve(atmosphereOverride) : auraApi.atmosphere(token, nextSong.id),
          auraApi.lyrics(token, nextSong.id),
        ]);
        if (loadCounter.current !== id) return; // the user has already moved on
        setAtmosphereLoading(false);
        const problems: string[] = [];
        if (history.status === 'rejected') problems.push(`history was not saved (${errorMessage(history.reason)})`);
        else void queryClient.invalidateQueries({ queryKey: ['library', 'history'] });
        if (profile.status === 'fulfilled') setAtmosphere(profile.value);
        else problems.push(`atmosphere could not be loaded (${errorMessage(profile.reason)})`);
        if (lyricResponse.status === 'fulfilled') setLyrics(lyricResponse.value.lines);
        else problems.push(`lyrics could not be loaded (${errorMessage(lyricResponse.reason)})`);
        if (problems.length) setError(`Playing, but ${problems.join('; ')}.`);
      } catch (requestError) {
        if (loadCounter.current !== id) return;
        setAtmosphereLoading(false);
        setError(errorMessage(requestError));
      }
    },
    [activeSlot, crossfadeSeconds, finishFade, getToken, players, queryClient],
  );

  const playSong = useCallback(
    async (nextSong: Song, nextQueue?: Song[], atmosphereOverride?: AtmosphereProfile | null) => {
      const base = nextQueue?.length ? nextQueue : [nextSong];
      const chosen = Math.max(0, base.findIndex((item) => item.id === nextSong.id));
      if (unshuffledQueue) {
        setUnshuffledQueue(base);
        await startTrack(shuffleKeepingCurrent(base, chosen), 0, { atmosphereOverride, crossfade: true });
      } else {
        await startTrack(base, chosen, { atmosphereOverride, crossfade: true });
      }
    },
    [startTrack, unshuffledQueue],
  );

  const playQueueIndex = useCallback(
    (index: number) => startTrack(queue, index, { crossfade: true }),
    [queue, startTrack],
  );

  const playNext = useCallback(async () => {
    const next = nextQueueIndex(queueIndex, queue.length, repeatMode);
    if (next !== null) await startTrack(queue, next, { crossfade: true });
  }, [queue, queueIndex, repeatMode, startTrack]);

  const playPrevious = useCallback(async () => {
    const previous = previousQueueIndex(queueIndex, queue.length, repeatMode);
    if (status.currentTime > 3 || previous === null) {
      await player.seekTo(0);
      return;
    }
    await startTrack(queue, previous, { crossfade: true });
  }, [player, queue, queueIndex, repeatMode, startTrack, status.currentTime]);

  // A song that reaches its natural end moves the queue on (or repeats).
  useEffect(() => {
    if (!status.didJustFinish || !song) return;
    const next = indexAfterTrackEnds(queueIndex, queue.length, repeatMode);
    if (next === queueIndex && repeatMode === 'one') {
      void player.seekTo(0).then(() => player.play());
    } else if (next !== null) {
      void startTrack(queue, next);
    } else {
      void player.seekTo(0);
    }
    // Only react to the finish signal itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // With crossfade on, start the next song a little before this one ends.
  useEffect(() => {
    if (crossfadeSeconds <= 0 || !status.playing || repeatMode === 'one') return;
    if (!status.duration || status.duration - status.currentTime > crossfadeSeconds) return;
    if (earlyAdvanceFor.current === loadId) return;
    const next = nextQueueIndex(queueIndex, queue.length, repeatMode);
    if (next === null) return;
    earlyAdvanceFor.current = loadId;
    void startTrack(queue, next, { crossfade: true });
  }, [crossfadeSeconds, loadId, queue, queueIndex, repeatMode, startTrack, status.currentTime, status.duration, status.playing]);

  const toggleShuffle = useCallback(() => {
    if (unshuffledQueue) {
      const restoredIndex = song ? unshuffledQueue.indexOf(song) : 0;
      setQueue(unshuffledQueue);
      setQueueIndex(Math.max(0, restoredIndex));
      setUnshuffledQueue(null);
    } else {
      setUnshuffledQueue(queue);
      setQueue(shuffleKeepingCurrent(queue, queueIndex));
      setQueueIndex(0);
    }
  }, [queue, queueIndex, song, unshuffledQueue]);

  const cycleRepeat = useCallback(() => setRepeatMode(nextRepeatMode), []);

  const togglePlayback = useCallback(() => {
    if (status.playing) player.pause();
    else if (song) player.play();
  }, [player, song, status.playing]);

  const seekTo = useCallback(
    async (seconds: number) => {
      await player.seekTo(Math.max(0, Math.min(seconds, status.duration || seconds)));
    },
    [player, status.duration],
  );

  const stop = useCallback(() => {
    finishFade();
    loadCounter.current += 1;
    for (const item of players) {
      try {
        item.pause();
        setVolume(item, 1);
        item.clearLockScreenControls();
      } catch {
        // Player may already be released.
      }
    }
    setQueue([]);
    setQueueIndex(0);
    setUnshuffledQueue(null);
    setAtmosphere(null);
    setAtmosphereLoading(false);
    setLyrics([]);
    setError(null);
  }, [finishFade, players]);

  // Signing out (or switching account) must not keep the previous user's music playing.
  const userId = user?.uid ?? null;
  const previousUserId = useRef(userId);
  useEffect(() => {
    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      stop();
    }
  }, [stop, userId]);

  useEffect(() => finishFade, [finishFade]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      song,
      queue,
      queueIndex,
      isPlaying: status.playing,
      isBuffering: status.isBuffering,
      repeatMode,
      shuffleEnabled: unshuffledQueue !== null,
      hasNext: nextQueueIndex(queueIndex, queue.length, repeatMode) !== null,
      hasPrevious: Boolean(song),
      atmosphere,
      atmosphereLoading,
      lyrics,
      error: status.error ?? error,
      playSong,
      playQueueIndex,
      togglePlayback,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeat,
      seekTo,
      stop,
      clearError: () => setError(null),
    }),
    [
      song,
      queue,
      queueIndex,
      status.playing,
      status.isBuffering,
      status.error,
      repeatMode,
      unshuffledQueue,
      atmosphere,
      atmosphereLoading,
      lyrics,
      error,
      playSong,
      playQueueIndex,
      togglePlayback,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeat,
      seekTo,
      stop,
    ],
  );

  const duration = status.duration || (song?.durationMs ?? 0) / 1000;
  const positionMs = status.currentTime * 1000;
  const activeLyricId =
    [...lyrics].reverse().find((line) => positionMs >= line.startTimeMs && positionMs <= line.endTimeMs + 2000)?.id ??
    null;
  const progress = useMemo(
    () => ({ currentTime: status.currentTime, duration, activeLyricId }),
    [activeLyricId, duration, status.currentTime],
  );

  return (
    <PlayerContext.Provider value={value}>
      <ProgressContext.Provider value={progress}>
        <AudioReactivityContext.Provider value={reactivity}>{children}</AudioReactivityContext.Provider>
      </ProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected request error occurred.';
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used within PlayerProvider.');
  return value;
}

/** Current position, duration and lyric line. Subscribing re-renders ~4×/second. */
export function usePlaybackProgress() {
  return useContext(ProgressContext);
}

/**
 * expo-audio players are imperative native objects. Volume changes go through
 * this helper so React's render-purity rules don't treat them as state writes.
 */
function setVolume(player: AudioPlayer, volume: number) {
  player.volume = volume;
}

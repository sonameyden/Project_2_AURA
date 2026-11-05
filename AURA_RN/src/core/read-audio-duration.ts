import { createAudioPlayer, type AudioStatus } from 'expo-audio';

/**
 * Reads a local audio file's length in seconds by loading it into a silent,
 * paused player (the Kotlin app used MediaMetadataRetriever). Resolves null if
 * the length can't be read in time, so the user can type it instead.
 */
export function readAudioDuration(uri: string, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const player = createAudioPlayer({ uri }, { updateInterval: 200 });
    const finish = (seconds: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      try {
        player.remove();
      } catch {
        // Already released.
      }
      resolve(seconds);
    };
    const check = (status: Pick<AudioStatus, 'isLoaded' | 'duration'>) => {
      if (status.isLoaded && status.duration > 0) finish(status.duration);
    };
    const subscription = player.addListener('playbackStatusUpdate', check);
    const timer = setTimeout(() => finish(player.duration > 0 ? player.duration : null), timeoutMs);
    check({ isLoaded: player.isLoaded, duration: player.duration });
  });
}

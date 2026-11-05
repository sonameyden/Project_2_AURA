import { requestRecordingPermissionsAsync, type AudioPlayer, type AudioSample } from 'expo-audio';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Live audio reactivity, ported from the native app's `AudioAnalyzer.kt`.
 * Kept in Reanimated shared values (not React state) so visual layers can
 * read it every frame on the UI thread without re-rendering the player tree.
 */
export type AudioReactivity = {
  /** Smoothed loudness, 0..1 (AudioAnalyzer.currentAmplitude). */
  amplitude: SharedValue<number>;
  /** True while a detected onset is active (AudioAnalyzer.beatPulse). */
  beat: SharedValue<boolean>;
};

export const AudioReactivityContext = createContext<AudioReactivity | null>(null);

export function useAudioReactivity() {
  return useContext(AudioReactivityContext);
}

/**
 * Attaches the analyser to whichever player is currently audible. `trackKey`
 * changes on every new song so the rolling average restarts, like
 * AudioAnalyzer.detach()/attach().
 */
export function useAudioAnalyzer(player: AudioPlayer, trackKey: string | null, playing: boolean): AudioReactivity {
  const amplitude = useSharedValue(0);
  const beat = useSharedValue(false);
  const analyzer = useRef({ smoothed: 0, rollingAverage: 0, beat: false });
  const [samplingPermitted, setSamplingPermitted] = useState(Platform.OS === 'ios');

  // Android's Visualizer (which expo-audio sampling uses) needs RECORD_AUDIO;
  // the native app requests it on launch in MainActivity, so do the same.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    requestRecordingPermissionsAsync()
      .then(({ granted }) => {
        if (active) setSamplingPermitted(granted);
      })
      .catch((permissionError: unknown) => {
        console.warn('Audio-reactive visuals are disabled: permission request failed.', permissionError);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!samplingPermitted || !trackKey || !player.isAudioSamplingSupported) return;
    const state = analyzer.current;
    const onSample = (sample: AudioSample) => {
      const frames = sample.channels[0]?.frames;
      if (!frames?.length) return;
      // Same maths as AudioAnalyzer.processWaveform: mean absolute deviation,
      // boosted with pow(0.6), EMA smoothing, beat = spike over rolling average.
      let sum = 0;
      for (const frame of frames) sum += Math.abs(frame);
      const raw = sum / frames.length;
      const clamped = Math.min(1, Math.max(0, raw > 0 ? Math.pow(raw, 0.6) : 0));
      state.smoothed += (clamped - state.smoothed) * 0.45;
      amplitude.set(state.smoothed);
      state.rollingAverage = Math.max(0.01, state.rollingAverage * 0.8 + clamped * 0.2);
      const isBeat = clamped > state.rollingAverage * 1.12;
      if (isBeat && !state.beat) {
        state.beat = true;
        beat.set(true);
      } else if (!isBeat) {
        state.beat = false;
        beat.set(false);
      }
    };
    try {
      player.setAudioSamplingEnabled(true);
    } catch (samplingError) {
      console.warn('Audio-reactive visuals are disabled: sampling could not start.', samplingError);
      return;
    }
    const subscription = player.addListener('audioSampleUpdate', onSample);
    return () => {
      subscription.remove();
      try {
        player.setAudioSamplingEnabled(false);
      } catch {
        // The player may already be released while unmounting.
      }
    };
  }, [amplitude, beat, player, samplingPermitted, trackKey]);

  // expo-audio stops emitting samples while paused, so drop to silence instead
  // of freezing on the last loudness (the native Visualizer reads silence).
  useEffect(() => {
    if (playing) return;
    analyzer.current.smoothed = 0;
    analyzer.current.beat = false;
    amplitude.set(0);
    beat.set(false);
  }, [amplitude, beat, playing]);

  useEffect(() => {
    analyzer.current = { smoothed: 0, rollingAverage: 0, beat: false };
    amplitude.set(0);
    beat.set(false);
  }, [amplitude, beat, trackKey]);

  return useMemo(() => ({ amplitude, beat }), [amplitude, beat]);
}

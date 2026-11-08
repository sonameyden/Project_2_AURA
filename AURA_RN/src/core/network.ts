import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * Whether the device can reach the internet. NetInfo reports `null` while it
 * is still checking, which counts as online so the app doesn't flash an
 * offline state on start-up.
 */
export function isOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Connects TanStack Query to the phone's network and app state:
 * - offline: queries and mutations pause instead of failing, and resume on reconnect;
 * - back in the foreground: stale data refetches (React Native has no window focus event).
 * Called once at start-up.
 */
export function connectQueryClientToDevice() {
  if (Platform.OS === 'web') return;
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(isOnline(state))));
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status) => handleFocus(status === 'active'));
    return () => subscription.remove();
  });
}

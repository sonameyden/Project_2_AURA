import { isRunningInExpoGo } from 'expo';

/**
 * True when running inside the Expo Go app. Expo Go does not apply this app's
 * config plugins, so features that depend on them (background audio, lock
 * screen media controls) are skipped there.
 */
export const isExpoGo = isRunningInExpoGo();

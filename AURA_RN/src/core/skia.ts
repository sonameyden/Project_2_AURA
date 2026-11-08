import { Platform, TurboModuleRegistry } from 'react-native';

export type SkiaModule = typeof import('@shopify/react-native-skia');

/**
 * True when Skia's native module is compiled into the running app (it is in
 * Expo Go and in development builds). Importing the JS package without the
 * native half throws inside the module body and leaves a half-initialised
 * module behind, so check this before importing it.
 */
export function nativeSkiaAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    return TurboModuleRegistry.get('RNSkiaModule') != null;
  } catch {
    return false;
  }
}

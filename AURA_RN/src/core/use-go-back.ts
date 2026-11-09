import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * Leaves the current screen. If there's nothing behind it (it was opened from a
 * link, reached with `replace`, or a close button was tapped twice while the
 * screen was already closing), it goes to `fallback` instead of sending a
 * back action no navigator can handle.
 */
export function useGoBack(fallback: Href = '/(tabs)') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}

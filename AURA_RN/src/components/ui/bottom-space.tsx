import { createContext, useContext, useSyncExternalStore, type PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Room that scrolling content must leave at the bottom so nothing ends up
 * hidden under the floating mini-player.
 *
 * The mini-player floats over every screen (it's mounted once in the root
 * layout), so pages can't simply lay out around it. It reports its measured
 * height here (0 while hidden), which grows with the text-size setting, and
 * `Page`/`PageList` pad their content by exactly that much.
 */
let miniPlayerHeight = 0;
const listeners = new Set<() => void>();

export function setMiniPlayerHeight(height: number) {
  const rounded = Math.ceil(height);
  if (rounded === miniPlayerHeight) return;
  miniPlayerHeight = rounded;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readHeight = () => miniPlayerHeight;

/** Gap between the mini-player and the screen edge on full-screen pages (matches the root layout). */
export const MINI_PLAYER_SCREEN_GAP = 8;

/** Marks the tab screens: their tab bar already takes up the bottom edge and safe area. */
const TabScreenContext = createContext(false);

export function TabScreens({ children }: PropsWithChildren) {
  return <TabScreenContext.Provider value>{children}</TabScreenContext.Provider>;
}

/** Height of whatever floats over the bottom of the current page: the mini-player and the system navigation bar. */
export function useBottomOverlap() {
  const insets = useSafeAreaInsets();
  const onTabScreen = useContext(TabScreenContext);
  const player = useSyncExternalStore(subscribe, readHeight, readHeight);
  // On tab screens the mini-player sits directly on top of the tab bar, which content already stops above.
  if (onTabScreen) return player;
  return insets.bottom + (player ? player + MINI_PLAYER_SCREEN_GAP : 0);
}

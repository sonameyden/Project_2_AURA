import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppErrorBoundary,
  AuraText,
  DialogHost,
  MINI_PLAYER_SCREEN_GAP,
  OfflineBanner,
  setMiniPlayerHeight,
  ToastProvider,
} from '@/components/ui';
import { AuthProvider, useAuth } from '@/core/auth-context';
import { QueryCacheBoundary } from '@/core/query-cache-boundary';
import { queryClient } from '@/core/query-client';
import { PlayerProvider } from '@/core/player';
import { crossfadeSecondsFor, SettingsProvider, useSettings } from '@/core/settings';
import { AuraThemeProvider, useAuraTheme } from '@/core/theme';
import { MiniPlayer } from '@/features/player/components/MiniPlayer';

function Navigation() {
  const { colors, mode } = useAuraTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // An invite link opened while signed out is resumed after signing in.
  const pendingInvite = useRef<string | null>(null);

  // The window behind every screen matches the theme, so nothing flashes through during transitions.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  // React Navigation paints screen and tab containers with its own theme, which
  // defaults to a light gray (#F2F2F2). Without this, that gray flashes behind
  // screens while they slide or crossfade. Give it AURA's colours instead.
  const navigationTheme = useMemo(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors.accent, colors.background, colors.border, colors.text, mode]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      const [route, code] = segments as string[];
      if (route === 'invite' && code) pendingInvite.current = code;
      router.replace('/login');
    }
    if (user && inAuth) {
      if (pendingInvite.current) {
        router.replace({ pathname: '/invite/[code]', params: { code: pendingInvite.current } });
        pendingInvite.current = null;
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [loading, router, segments, user]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
        <ActivityIndicator color={colors.accent} />
        <AuraText>Opening your atmosphere…</AuraText>
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // One smooth, consistent slide for every push (Android's default fade-and-zoom looks jumpy).
          animation: 'ios_from_right',
        }}>
        {/* Signing in/out and switching between login and sign-up crossfade instead of sliding. */}
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        {/* Login and sign-up live in one group so they share a single aurora background. */}
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="mood" options={{ presentation: 'modal' }} />
        {/* Now Playing rises from the mini-player and slides back down when closed. There is only ever
            one: opening it again (a song tapped twice while it loads, or the mini-player) reuses it
            instead of stacking a second copy that needs a second Back. */}
        <Stack.Screen
          name="now-playing"
          dangerouslySingular
          options={{ animation: 'slide_from_bottom', gestureEnabled: true, gestureDirection: 'vertical' }}
        />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="album/[id]" />
        <Stack.Screen name="album/create" />
        <Stack.Screen name="liked" />
        <Stack.Screen name="history" />
        <Stack.Screen name="playlists" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="user/[id]" />
        {/* Reached by replacing the artist page when you aren't an artist yet, so fade rather than slide twice. */}
        <Stack.Screen name="artist-dashboard" options={{ animation: 'fade' }} />
        <Stack.Screen name="upload" />
        <Stack.Screen name="add-to-playlist" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="playlist-share/[id]" options={{ presentation: 'modal' }} />
      </Stack>
      <GlobalMiniPlayer route={segments[0]} />
      <OfflineBanner />
    </ThemeProvider>
  );
}

const routesWithoutMiniPlayer = new Set([
  'index',
  '(auth)',
  'now-playing',
  'mood',
  'add-to-playlist',
  'invite',
  'playlist-share',
]);

/** Keeps the mini-player on every screen except auth, Now Playing and modals. */
function GlobalMiniPlayer({ route }: { route: string | undefined }) {
  const insets = useSafeAreaInsets();
  const hidden = !route || routesWithoutMiniPlayer.has(route);
  // While hidden it takes no room, so pages don't keep empty space for it.
  useEffect(() => {
    if (hidden) setMiniPlayerHeight(0);
  }, [hidden]);
  if (hidden) return null;
  const aboveTabBar = route === '(tabs)';
  // Eases in after Now Playing has slid away (instead of popping over it), and glides
  // between its tab-bar and full-screen positions.
  return (
    <Animated.View
      entering={FadeInDown.duration(240).delay(140)}
      exiting={FadeOutDown.duration(160)}
      layout={LinearTransition.duration(200)}
      pointerEvents="box-none"
      // Pages pad their content by this height so their last rows can scroll clear of the player (0 with no song).
      onLayout={(event) => setMiniPlayerHeight(event.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: aboveTabBar ? 72 + insets.bottom : MINI_PLAYER_SCREEN_GAP + insets.bottom,
      }}>
      <MiniPlayer />
    </Animated.View>
  );
}

/** The player reads the crossfade preference from settings. */
function SettingsAwarePlayer({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  return <PlayerProvider crossfadeSeconds={crossfadeSecondsFor[settings.crossfade]}>{children}</PlayerProvider>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <AuraThemeProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <QueryCacheBoundary>
                <SettingsAwarePlayer>
                  <ToastProvider>
                    <Navigation />
                    <DialogHost />
                  </ToastProvider>
                </SettingsAwarePlayer>
              </QueryCacheBoundary>
            </QueryClientProvider>
          </AuthProvider>
        </AuraThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

/** Last-resort fallback if the app shell itself crashes (screens have their own boundaries). */
export const ErrorBoundary = AppErrorBoundary;

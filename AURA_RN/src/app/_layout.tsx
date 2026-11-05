import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuraText } from '@/components/ui';
import { AuthProvider, useAuth } from '@/core/auth-context';
import { QueryCacheBoundary } from '@/core/query-cache-boundary';
import { queryClient } from '@/core/query-client';
import { PlayerProvider } from '@/core/player';
import { CROSSFADE_SECONDS, SettingsProvider, useSettings } from '@/core/settings';
import { AuraThemeProvider, useAuraTheme } from '@/core/theme';
import { MiniPlayer } from '@/features/player/components/MiniPlayer';

function Navigation() {
  const { colors, mode } = useAuraTheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // An invite link opened while signed out is resumed after signing in.
  const pendingInvite = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'login' || segments[0] === 'signup';
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
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.accent} />
        <AuraText>Opening your atmosphere…</AuraText>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="mood" options={{ presentation: 'modal' }} />
        <Stack.Screen name="now-playing" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="album/[id]" />
        <Stack.Screen name="album/create" />
        <Stack.Screen name="liked" />
        <Stack.Screen name="history" />
        <Stack.Screen name="playlists" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="artist-dashboard" />
        <Stack.Screen name="upload" />
        <Stack.Screen name="add-to-playlist" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite/[code]" options={{ presentation: 'modal' }} />
      </Stack>
      <GlobalMiniPlayer route={segments[0]} />
    </>
  );
}

const routesWithoutMiniPlayer = new Set(['index', 'login', 'signup', 'now-playing', 'mood', 'add-to-playlist', 'invite']);

/** Keeps the mini-player on every screen except auth, Now Playing and modals. */
function GlobalMiniPlayer({ route }: { route: string | undefined }) {
  const insets = useSafeAreaInsets();
  if (!route || routesWithoutMiniPlayer.has(route)) return null;
  const aboveTabBar = route === '(tabs)';
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: aboveTabBar ? 72 + insets.bottom : 8 + insets.bottom }}>
      <MiniPlayer />
    </View>
  );
}

/** The player reads the crossfade preference from settings. */
function SettingsAwarePlayer({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  return <PlayerProvider crossfadeSeconds={settings.crossfade ? CROSSFADE_SECONDS : 0}>{children}</PlayerProvider>;
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
                  <Navigation />
                </SettingsAwarePlayer>
              </QueryCacheBoundary>
            </QueryClientProvider>
          </AuthProvider>
        </AuraThemeProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

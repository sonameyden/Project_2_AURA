export { default } from '@/features/player/NowPlayingScreen';

// A crash on this screen shows a recoverable error screen instead of blanking the app.
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ui';

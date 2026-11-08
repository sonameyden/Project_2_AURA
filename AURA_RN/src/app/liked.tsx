import { SongListScreen } from '@/features/library/SongListScreen';

export default function LikedSongsRoute() {
  return <SongListScreen kind="liked" />;
}

// A crash on this screen shows a recoverable error screen instead of blanking the app.
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ui';

import { SongListScreen } from '@/features/library/SongListScreen';

export default function HistoryRoute() {
  return <SongListScreen kind="history" />;
}

// A crash on this screen shows a recoverable error screen instead of blanking the app.
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ui';

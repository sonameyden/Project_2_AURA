import { Redirect } from 'expo-router';

import { useAuth } from '@/core/auth-context';

export default function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}

// A crash on this screen shows a recoverable error screen instead of blanking the app.
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ui';

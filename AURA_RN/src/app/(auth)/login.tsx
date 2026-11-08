import { AuthScreen } from '@/features/auth/AuthScreen';

export default function LoginRoute() {
  return <AuthScreen />;
}

// A crash on this screen shows a recoverable error screen instead of blanking the app.
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ui';

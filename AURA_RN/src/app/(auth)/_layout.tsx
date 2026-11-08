import { Stack } from 'expo-router';

import { AuthBackdrop } from '@/features/auth/components/AuthBackground';

/**
 * Login and sign-up share one aurora background (drawn here, once). The
 * screens are transparent, so switching between them only crossfades the
 * form while the background keeps flowing.
 */
export default function AuthLayout() {
  return (
    <AuthBackdrop>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
    </AuthBackdrop>
  );
}

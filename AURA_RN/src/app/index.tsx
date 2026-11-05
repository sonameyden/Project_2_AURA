import { Redirect } from 'expo-router';

import { useAuth } from '@/core/auth-context';

export default function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}

import { auraApi } from '@/core/api';
import { useAuraQuery } from '@/core/use-aura-query';

/** The signed-in user's own profile (name, photo, bio). Shared by Home, Settings and Profile. */
export function useUserProfile() {
  return useAuraQuery(['library', 'profile'], (token) => auraApi.profile(token));
}

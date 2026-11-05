import { useMutation, useQueryClient } from '@tanstack/react-query';

import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import type { UserProfile } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

/** Anyone's public profile; `'me'` for the signed-in user's own. */
export function usePublicProfile(userId: string | undefined) {
  return useAuraQuery(['profile', userId], (token) => auraApi.publicProfile(token, userId ?? 'me'), Boolean(userId));
}

/** Writes the returned profile straight into the cache so every screen updates. */
function useProfileMutation<TVariables>(mutate: (token: string, variables: TVariables) => Promise<UserProfile>) {
  const { getToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => mutate(await getToken(), variables),
    onSuccess: (profile) => {
      queryClient.setQueryData(['library', 'profile', user?.uid], profile);
      return queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export const useUpdateProfile = () =>
  useProfileMutation((token, changes: { displayName?: string; bio?: string | null; showListening?: boolean }) =>
    auraApi.updateProfile(token, changes),
  );

export const useUploadProfileImage = () =>
  useProfileMutation((token, form: FormData) => auraApi.uploadProfileImage(token, form));

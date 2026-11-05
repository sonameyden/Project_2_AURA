import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useAuth } from './auth-context';

type ExtraOptions<T> = Pick<UseQueryOptions<T>, 'refetchInterval' | 'refetchIntervalInBackground' | 'staleTime'>;

/**
 * Server data for the signed-in user. The user's id is appended to the key so
 * one account never sees another's cached data.
 */
export function useAuraQuery<T>(
  key: readonly unknown[],
  fetcher: (token: string) => Promise<T>,
  enabled = true,
  options: ExtraOptions<T> = {},
) {
  const { getToken, user } = useAuth();

  return useQuery({
    queryKey: [...key, user?.uid],
    queryFn: async () => fetcher(await getToken()),
    enabled: Boolean(user) && enabled,
    ...options,
  });
}

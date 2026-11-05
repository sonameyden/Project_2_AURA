import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import type { SearchHistoryEntry, SearchResults } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

import { looksDescriptive } from '../lib/query-kind';

export { looksDescriptive };

export const emptySearchResults: SearchResults = {
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
};

/** Title / artist / album / playlist matches. */
export function useCatalogSearch(term: string) {
  const { getToken, user } = useAuth();
  const normalizedTerm = term.trim();

  return useQuery({
    queryKey: ['catalog', 'search', user?.uid, normalizedTerm],
    queryFn: async ({ signal }) => auraApi.search(await getToken(), normalizedTerm, signal),
    enabled: Boolean(user) && normalizedTerm.length > 0,
  });
}

/** Natural-language "vibe" search, interpreted by the backend. */
export function useNaturalSearch(term: string) {
  const { getToken, user } = useAuth();
  const normalizedTerm = term.trim();

  return useQuery({
    queryKey: ['discover', 'search', user?.uid, normalizedTerm.toLowerCase()],
    queryFn: async ({ signal }) => auraApi.naturalSearch(await getToken(), normalizedTerm, signal),
    enabled: Boolean(user) && looksDescriptive(normalizedTerm),
    // Interpretations are cached server-side too; results change slowly.
    staleTime: 5 * 60_000,
  });
}

export function useSearchHistory() {
  return useAuraQuery(['library', 'search-history'], (token) => auraApi.searchHistory(token));
}

export function useSearchHistoryMutations() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['library', 'search-history'] });

  const record = useMutation({
    mutationFn: async (entry: {
      query: string;
      resultType: SearchHistoryEntry['result_type'];
      resultId: string | null;
      resultTitle: string | null;
    }) => auraApi.addSearchHistory(await getToken(), entry),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: number | undefined) => auraApi.deleteSearchHistory(await getToken(), id),
    onSuccess: invalidate,
  });

  return { record, remove };
}

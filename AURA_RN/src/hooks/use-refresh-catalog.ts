import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Marks everything that shows catalog content as out of date after an artist
 * changes it (uploads a song, creates or edits an album, changes artwork…):
 * artist pages, albums, the artist's songs, search, and Home's sections.
 *
 * Screens that are still mounted underneath (e.g. the artist page you came
 * from) refetch straight away, so the change is there when you go back; the
 * returned promise resolves once those refetches finish.
 */
export function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['discover'] }),
      ]).then(() => undefined),
    [queryClient],
  );
}

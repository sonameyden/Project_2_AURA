import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api';
import { connectQueryClientToDevice } from './network';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && (error.status === 401 || error.status === 403)) && failureCount < 1,
    },
  },
});

// Pause requests while offline (resuming on reconnect) and refresh stale data when the app returns to the foreground.
connectQueryClientToDevice();

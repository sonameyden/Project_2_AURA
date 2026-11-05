import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type PropsWithChildren } from 'react';

import { useAuth } from './auth-context';

export function QueryCacheBoundary({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef(user?.uid);

  useEffect(() => {
    if (previousUserId.current !== user?.uid) {
      queryClient.clear();
      previousUserId.current = user?.uid;
    }
  }, [queryClient, user?.uid]);

  return children;
}

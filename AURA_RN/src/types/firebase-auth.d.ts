import type { initializeAuth } from '@firebase/auth';

type ReactNativeAuthStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

declare module '@firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAuthStorage,
  ): NonNullable<Parameters<typeof initializeAuth>[1]>['persistence'];
}

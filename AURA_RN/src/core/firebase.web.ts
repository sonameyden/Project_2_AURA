import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';

import { firebaseConfig, hasFirebaseConfig } from './config';

let firebaseAuth: Auth | null = null;

if (hasFirebaseConfig) {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    firebaseAuth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch (error) {
    if (!isAlreadyInitialized(error)) throw error;
    firebaseAuth = getAuth(app);
  }
}

function isAlreadyInitialized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/already-initialized';
}

export { firebaseAuth };

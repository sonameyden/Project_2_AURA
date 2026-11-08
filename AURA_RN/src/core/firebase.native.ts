import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as SecureStore from 'expo-secure-store';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from '@firebase/auth';

import { firebaseConfig, hasFirebaseConfig } from './config';

function secureStoreKey(firebaseKey: string): string {
  const encodedKey = firebaseKey
    .split('')
    .map((character) => character.charCodeAt(0).toString(16))
    .join('_');

  return `firebase-auth-${encodedKey}`;
}

const secureAuthStorage = {
  getItem: async (key: string) => {
    const storageKey = secureStoreKey(key);
    const storedValue = await SecureStore.getItemAsync(storageKey);
    if (storedValue !== null) return storedValue;

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;

    await SecureStore.setItemAsync(storageKey, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },
  setItem: (key: string, value: string) => SecureStore.setItemAsync(secureStoreKey(key), value),
  removeItem: async (key: string) => {
    await Promise.all([SecureStore.deleteItemAsync(secureStoreKey(key)), AsyncStorage.removeItem(key)]);
  },
};

let firebaseAuth: Auth | null = null;

if (hasFirebaseConfig) {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(secureAuthStorage),
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

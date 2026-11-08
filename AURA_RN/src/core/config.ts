const defaultApiUrl = 'https://aura-backend.sonameydenaura.workers.dev';

export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL?.trim() || defaultApiUrl).replace(/\/+$/, '');

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

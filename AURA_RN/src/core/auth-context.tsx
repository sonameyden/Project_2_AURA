import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from '@firebase/auth';

import { hasFirebaseConfig } from './config';
import { firebaseAuth } from './firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configurationReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Pass `true` to get a brand-new token (e.g. right after confirming the password). */
  getToken: (forceRefresh?: boolean) => Promise<string>;
  /**
   * Signs in again with the current password, without logging out. Firebase only
   * allows sensitive actions such as deleting the account shortly after a sign-in.
   */
  confirmPassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(
      firebaseAuth,
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      (error) => {
        console.error('Firebase authentication state could not be loaded.', error);
        setLoading(false);
      },
    );
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase is not configured. See the AURA_RN setup guide.');
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase is not configured. See the AURA_RN setup guide.');
    await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  }, []);

  const logout = useCallback(async () => {
    if (!firebaseAuth) throw new Error('Firebase is not configured.');
    await signOut(firebaseAuth);
  }, []);

  const getToken = useCallback(
    async (forceRefresh = false) => {
      if (!user) throw new Error('Sign in to continue.');
      return user.getIdToken(forceRefresh);
    },
    [user],
  );

  const confirmPassword = useCallback(
    async (password: string) => {
      if (!user?.email) throw new Error('Sign in to continue.');
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      } catch (error) {
        throw new Error(passwordErrorMessage(error));
      }
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, configurationReady: hasFirebaseConfig, login, signup, logout, getToken, confirmPassword }),
    [user, loading, login, signup, logout, getToken, confirmPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}

/** Plain-language reasons a password confirmation failed (exported for tests). */
export function passwordErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return "That password isn't right.";
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    default:
      return error instanceof Error ? error.message : 'Your password could not be confirmed.';
  }
}

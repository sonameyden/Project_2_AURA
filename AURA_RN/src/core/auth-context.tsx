import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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
  getToken: () => Promise<string>;
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

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Sign in to continue.');
    return user.getIdToken();
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, configurationReady: hasFirebaseConfig, login, signup, logout, getToken }),
    [user, loading, login, signup, logout, getToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}

import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, AuraText, Field, Page } from '@/components/ui';
import { useAuth } from '@/core/auth-context';
import { useAuraTheme } from '@/core/theme';

import { useAuthBackdrop } from './components/AuthBackground';

export function AuthScreen({ signUp = false }: { signUp?: boolean }) {
  const { colors } = useAuraTheme();
  const { configurationReady, login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // The aurora behind login and sign-up is shared (see app/(auth)/_layout.tsx):
  // each keystroke makes it glow, and it breathes while signing in.
  const backdrop = useAuthBackdrop();
  const typed = (setValue: (value: string) => void) => (value: string) => {
    setValue(value);
    backdrop.pulse();
  };
  useEffect(() => {
    backdrop.setBusy(working);
  }, [backdrop, working]);

  const submit = async () => {
    setFormError(null);
    if (!email.trim() || !password) {
      setFormError('Enter your email and password to continue.');
      return;
    }
    if (signUp && password !== confirmPassword) {
      setFormError('Passwords do not match. Check both fields and try again.');
      return;
    }
    setWorking(true);
    try {
      if (signUp) await signup(email, password);
      else await login(email, password);
      // No navigation here: the root layout moves signed-in users to Home (or a pending
      // invite) as soon as the account changes. Navigating here too made two transitions.
    } catch (error) {
      setFormError(messageFor(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,13,18,0.22)' }]}
      />
      <Page
        scroll={false}
        transparent
        safeAreaEdges={['top', 'bottom']}
        style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingTop: signUp ? 8 : 24,
          paddingBottom: signUp ? 36 : 24,
        }}
      >
        <View style={{ alignItems: 'center', gap: 5 }}>
          <AuraText style={{ color: colors.accent, fontSize: 28, fontWeight: '800', letterSpacing: 8 }}>
            AURA
          </AuraText>
          {!signUp ? (
            <AuraText style={{ color: '#FFFFFFB3', fontSize: 14 }}>Discover your sonic atmosphere.</AuraText>
          ) : null}
        </View>
        <View style={{ flex: 1, width: '100%', justifyContent: 'center', paddingVertical: signUp ? 8 : 16 }}>
          <View
            style={{
              padding: signUp ? 18 : 24,
              gap: signUp ? 8 : 12,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <AuraText style={{ color: colors.accent, fontSize: 25, fontWeight: '700' }}>
              {signUp ? 'Create Account' : 'Sign In'}
            </AuraText>
            <Field
              label="Email"
              value={email}
              onChangeText={typed(setEmail)}
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              style={{ backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12 }}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={typed(setPassword)}
              placeholder="Password"
              secureTextEntry
              autoComplete={signUp ? 'new-password' : 'current-password'}
              textContentType={signUp ? 'newPassword' : 'password'}
              style={{ backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12 }}
            />
            {signUp ? (
              <Field
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={typed(setConfirmPassword)}
                placeholder="Confirm Password"
                secureTextEntry
                textContentType="newPassword"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,0.3)',
                  borderRadius: 12,
                }}
              />
            ) : null}
            {!configurationReady ? (
              <AuraText style={{ color: colors.muted, fontSize: 12 }}>
                Firebase configuration is required. See the README setup instructions.
              </AuraText>
            ) : null}
            {formError ? (
              <AuraText accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>
                {formError}
              </AuraText>
            ) : null}
            <ActionButton
              title={signUp ? 'Sign Up' : 'Sign In'}
              onPress={() => void submit()}
              loading={working}
              disabled={!configurationReady}
              style={{ marginTop: 6, borderRadius: 12 }}
            />
          </View>
        </View>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          {/* Replace rather than push, so switching back and forth doesn't stack screens. */}
          <Link href={signUp ? '/login' : '/signup'} replace asChild>
            <Pressable accessibilityRole="button">
              <AuraText style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {signUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </AuraText>
            </Pressable>
          </Link>
        </View>
      </Page>
    </View>
  );
}

function messageFor(error: unknown) {
  if (!(error instanceof Error)) return 'Please try again.';
  if (error.message.includes('auth/invalid-credential')) return 'The email or password is incorrect.';
  if (error.message.includes('auth/email-already-in-use')) return 'An account already uses this email.';
  if (error.message.includes('auth/weak-password')) return 'Choose a stronger password (at least 6 characters).';
  return error.message;
}

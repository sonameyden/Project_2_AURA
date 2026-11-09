import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, AuraText, Card, Field } from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { useAuraTheme } from '@/core/theme';

/**
 * "Delete account" with the password asked right here. Firebase only deletes an
 * account shortly after a sign-in, so confirming the password signs you in again
 * on the spot: no logging out and back in first, however old the session is.
 */
export function DeleteAccountCard() {
  const { colors } = useAuraTheme();
  const { user, confirmPassword, getToken, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setPassword('');
    setError(null);
  };

  const deleteAccount = async () => {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await confirmPassword(password);
      // A fresh token carries the new sign-in time the server checks.
      await auraApi.deleteAccount(await getToken(true));
      await logout().catch(() => undefined);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Your account could not be deleted.');
      setWorking(false);
    }
  };

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ alignItems: 'center', paddingVertical: 8 }}>
        <AuraText style={{ color: colors.danger, fontWeight: '600' }}>Delete Account Permanently</AuraText>
      </Pressable>
    );
  }

  return (
    <Card style={{ gap: 12, borderColor: colors.danger }}>
      <AuraText style={{ fontSize: 17, fontWeight: '800' }}>Delete your account?</AuraText>
      <AuraText style={{ color: colors.muted, fontSize: 13 }}>
        This permanently removes your AURA account, playlists, likes, history and any artist page. It cannot be undone.
      </AuraText>
      <Field
        label={user?.email ? `Password for ${user.email}` : 'Password'}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError(null);
        }}
        placeholder="Enter your password"
        accessibilityLabel="Password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void deleteAccount()}
      />
      {error ? <AuraText style={{ color: colors.danger, fontSize: 13 }}>{error}</AuraText> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ActionButton title="Cancel" variant="secondary" onPress={close} disabled={working} style={{ flex: 1 }} />
        <ActionButton
          title="Delete forever"
          variant="danger"
          onPress={() => void deleteAccount()}
          loading={working}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

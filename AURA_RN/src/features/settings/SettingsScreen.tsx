import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  ActionButton,
  AuraText,
  Card,
  ErrorMessage,
  Heading,
  Page,
  SegmentedRow,
  SwitchRow,
  showAlert,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import {
  useSettings,
  type AppSettings,
  type CrossfadeLength,
  type TextSize,
  type VisualIntensity,
} from '@/core/settings';
import { useAuraTheme } from '@/core/theme';
import { useUserProfile } from '@/hooks/use-user-profile';

import { SettingsSection } from './components/SettingsSection';

const intensityOptions: { value: VisualIntensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const textSizeOptions: { value: TextSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'extraLarge', label: 'X-Large' },
];

const crossfadeOptions: { value: CrossfadeLength; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '3', label: '3s' },
  { value: '5', label: '5s' },
  { value: '8', label: '8s' },
];

export default function SettingsScreenFeature() {
  const router = useRouter();
  const { colors, mode, setMode } = useAuraTheme();
  const { settings, update } = useSettings();
  const { user, getToken, logout } = useAuth();
  const [working, setWorking] = useState(false);
  const profileQuery = useUserProfile();

  const save = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    void update(key, value).catch((error: unknown) =>
      showAlert('Could not save setting', error instanceof Error ? error.message : 'Please try again.'),
    );
  };

  const deleteAccount = () =>
    showAlert(
      'Delete your account?',
      'This permanently removes your AURA account and library. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            void getToken()
              .then((token) => auraApi.deleteAccount(token))
              .then(() => logout())
              .catch((error: unknown) =>
                showAlert('Could not delete account', error instanceof Error ? error.message : 'Please try again.'),
              )
              .finally(() => setWorking(false));
          },
        },
      ],
    );

  const imageUri = profileQuery.data?.imageUrl || user?.photoURL || null;

  return (
    <Page style={{ gap: 24 }}>
      <Heading title="Settings" />
      <Card
        onPress={() => router.push('/profile')}
        accessibilityLabel="View and edit profile"
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: colors.border }}
          />
        ) : (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accentSoft,
            }}>
            <Ionicons name="person" size={30} color={colors.accentEnd} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <AuraText style={{ fontWeight: '700' }}>
            {profileQuery.data?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Your profile'}
          </AuraText>
          <AuraText style={{ color: colors.muted, fontSize: 13 }}>View and edit profile</AuraText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Card>
      {profileQuery.error instanceof Error ? (
        <ErrorMessage message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
      ) : null}

      <SettingsSection title="Visual Experience" icon="color-palette">
        <SwitchRow
          label="Dark mode"
          value={mode === 'dark'}
          onChange={(enabled) => {
            void setMode(enabled ? 'dark' : 'light').catch((error: unknown) =>
              showAlert('Could not update appearance', error instanceof Error ? error.message : 'Please try again.'),
            );
          }}
        />
        <SegmentedRow
          label="Visual intensity"
          description="How busy the Now Playing world is. Low also saves battery."
          value={settings.visualIntensity}
          options={intensityOptions}
          onChange={(value) => save('visualIntensity', value)}
        />
        <SwitchRow label="Show companion cat" value={settings.showCat} onChange={(value) => save('showCat', value)} />
      </SettingsSection>

      <SettingsSection title="Accessibility" icon="accessibility">
        <SwitchRow
          label="Reduce motion"
          description="Slows visuals to a gentle drift and turns off flashes and bouncing."
          value={settings.reducedMotion}
          onChange={(value) => save('reducedMotion', value)}
        />
        <SegmentedRow
          label="Text size"
          value={settings.textSize}
          options={textSizeOptions}
          onChange={(value) => save('textSize', value)}
        />
        <SwitchRow
          label="High contrast"
          description="Solid backgrounds and stronger text colours."
          value={settings.highContrast}
          onChange={(value) => save('highContrast', value)}
        />
      </SettingsSection>

      <SettingsSection title="Playback" icon="musical-notes">
        <SegmentedRow
          label="Crossfade between songs"
          description="When a song ends, blend it into the next one, with the visuals morphing too. Skipping always switches straight away."
          value={settings.crossfade}
          options={crossfadeOptions}
          onChange={(value) => save('crossfade', value)}
        />
      </SettingsSection>

      <SettingsSection title="For Creators" icon="star">
        <Card onPress={() => router.push('/artist/me')} accessibilityLabel="Artist dashboard" style={{ gap: 4 }}>
          <AuraText style={{ fontWeight: '700' }}>Artist Dashboard</AuraText>
          <AuraText style={{ color: colors.muted, fontSize: 12 }}>Manage your music and profile.</AuraText>
        </Card>
      </SettingsSection>

      <ActionButton
        title="Log out"
        variant="danger"
        onPress={() => {
          void logout().catch((error: unknown) =>
            showAlert('Log out failed', error instanceof Error ? error.message : 'Please try again.'),
          );
        }}
      />
      <Pressable
        accessibilityRole="button"
        disabled={working}
        onPress={deleteAccount}
        style={{ alignItems: 'center', paddingVertical: 8, opacity: working ? 0.6 : 1 }}>
        <AuraText style={{ color: colors.danger, fontWeight: '600' }}>
          {working ? 'Deleting account…' : 'Delete Account Permanently'}
        </AuraText>
      </Pressable>
    </Page>
  );
}

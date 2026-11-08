import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';

import {
  BackButton,
  ActionButton,
  AuraText,
  Card,
  ErrorMessage,
  Field,
  LoadingState,
  Page,
  SectionTitle,
  SwitchRow,
} from '@/components/ui';
import { useAuth } from '@/core/auth-context';
import { IMAGE_MAX_SIZE, pickImageForm } from '@/core/pick-image';
import { useAuraTheme } from '@/core/theme';
import { useUserProfile } from '@/hooks/use-user-profile';

import { ProfileHeader } from './components/ProfileHeader';
import { ProfileSections } from './components/ProfileSections';
import { usePublicProfile, useUpdateProfile, useUploadProfileImage } from './hooks/use-profile';

const NAME_MAX = 50;
const BIO_MAX = 300;

/** The signed-in user's own profile: shown as others see it, with an edit mode. */
export default function ProfileScreenFeature() {
  const { user } = useAuth();
  const { colors } = useAuraTheme();
  const profileQuery = useUserProfile();
  const publicQuery = usePublicProfile('me');
  const update = useUpdateProfile();
  const upload = useUploadProfileImage();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');

  const profile = profileQuery.data;
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'AURA listener';
  const bio = profile?.bio?.trim() || null;
  const loadError = profileQuery.error instanceof Error ? profileQuery.error.message : null;
  const actionError =
    update.error instanceof Error ? update.error.message : upload.error instanceof Error ? upload.error.message : null;

  const startEditing = () => {
    update.reset();
    setNameDraft(profile?.displayName ?? user?.displayName ?? '');
    setBioDraft(profile?.bio ?? '');
    setEditing(true);
  };

  const save = () => {
    const name = nameDraft.trim();
    if (!name) return;
    update.mutate({ displayName: name, bio: bioDraft.trim() || null }, { onSuccess: () => setEditing(false) });
  };

  const chooseImage = async () => {
    const form = await pickImageForm('file', { fallbackName: 'profile.jpg', maxSize: IMAGE_MAX_SIZE.avatar });
    if (form) upload.mutate(form);
  };

  return (
    <Page style={{ gap: 24 }}>
      <BackButton />
      {loadError ? <ErrorMessage message={loadError} onRetry={() => void profileQuery.refetch()} /> : null}
      {actionError && !editing ? <ErrorMessage message={actionError} /> : null}

      <ProfileHeader
        imageUrl={profile?.imageUrl ?? user?.photoURL ?? null}
        name={displayName}
        subtitle={user?.email ?? undefined}
        bio={editing ? null : bio}
        onChangePhoto={() => void chooseImage()}
        uploading={upload.isPending}
        emptyBio={
          editing ? null : (
            <Card onPress={startEditing} accessibilityLabel="Add a bio" style={{ alignItems: 'center', paddingVertical: 14 }}>
              <AuraText style={{ color: colors.muted, textAlign: 'center' }}>
                Add a bio so people know what you&apos;re into →
              </AuraText>
            </Card>
          )
        }
      />

      {editing ? (
        <Card style={{ gap: 14 }}>
          <Field
            label="Display name"
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="How should we call you?"
            maxLength={NAME_MAX}
            autoCapitalize="words"
          />
          <View style={{ gap: 6 }}>
            <Field
              label="Bio"
              value={bioDraft}
              onChangeText={setBioDraft}
              placeholder="A line about you and your music"
              maxLength={BIO_MAX}
              multiline
              style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 14 }}
            />
            <AuraText style={{ color: colors.muted, fontSize: 12, alignSelf: 'flex-end' }}>
              {bioDraft.length}/{BIO_MAX}
            </AuraText>
          </View>
          {actionError ? <AuraText style={{ color: colors.danger, fontSize: 13 }}>{actionError}</AuraText> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionButton
              title="Cancel"
              variant="secondary"
              onPress={() => setEditing(false)}
              disabled={update.isPending}
              style={{ flex: 1 }}
            />
            <ActionButton
              title="Save"
              onPress={save}
              loading={update.isPending}
              disabled={!nameDraft.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ) : (
        <ActionButton
          title="Edit profile"
          variant="secondary"
          onPress={startEditing}
          icon={<Ionicons name="create-outline" size={18} color={colors.text} />}
        />
      )}

      <View style={{ gap: 10 }}>
        <SectionTitle title="Privacy" />
        <SwitchRow
          label="Show my listening"
          description="Let others see your recent plays and top genres on your profile."
          value={profile?.showListening !== false}
          onChange={(showListening) => update.mutateAsync({ showListening })}
        />
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Your public profile" />
        {publicQuery.isPending ? <LoadingState label="Loading your profile…" /> : null}
        {publicQuery.error instanceof Error ? (
          <ErrorMessage message={publicQuery.error.message} onRetry={() => void publicQuery.refetch()} />
        ) : null}
        {publicQuery.data ? <ProfileSections profile={publicQuery.data} /> : null}
      </View>
    </Page>
  );
}

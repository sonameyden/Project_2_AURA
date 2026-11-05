import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ActionButton, Artwork, ErrorMessage, Field, GradientText, Heading, LoadingState, Page, SwitchRow } from '@/components/ui';
import { useAuth } from '@/core/auth-context';
import { pickImageForm } from '@/core/pick-image';
import { useUserProfile } from '@/hooks/use-user-profile';

import { ProfileSections } from './components/ProfileSections';
import { usePublicProfile, useUpdateProfile, useUploadProfileImage } from './hooks/use-profile';

/** The signed-in user's own profile: edit details, then see what others see. */
export default function ProfileScreenFeature() {
  const { user } = useAuth();
  const profileQuery = useUserProfile();
  const publicQuery = usePublicProfile('me');
  const update = useUpdateProfile();
  const upload = useUploadProfileImage();
  const [editedName, setEditedName] = useState<string | null>(null);
  const [editedBio, setEditedBio] = useState<string | null>(null);

  const profile = profileQuery.data;
  const displayName = editedName ?? profile?.displayName ?? user?.displayName ?? '';
  const bio = editedBio ?? profile?.bio ?? '';
  const dirty = editedName !== null || editedBio !== null;
  const loadError = profileQuery.error instanceof Error ? profileQuery.error.message : null;
  const actionError =
    update.error instanceof Error ? update.error.message : upload.error instanceof Error ? upload.error.message : null;

  const save = () =>
    update.mutate(
      { displayName: displayName.trim(), bio: bio.trim() || null },
      {
        onSuccess: () => {
          setEditedName(null);
          setEditedBio(null);
          Alert.alert('Profile saved', 'Your profile has been updated.');
        },
      },
    );

  const chooseImage = async () => {
    const form = await pickImageForm('file', { fallbackName: 'profile.jpg' });
    if (form) upload.mutate(form);
  };

  return (
    <Page>
      <Heading title="Your profile" subtitle={user?.email ?? ''} />
      {loadError ? <ErrorMessage message={loadError} onRetry={() => void profileQuery.refetch()} /> : null}
      {actionError ? <ErrorMessage message={actionError} /> : null}
      <Pressable
        onPress={() => void chooseImage()}
        disabled={upload.isPending}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        style={{ alignSelf: 'center', alignItems: 'center', gap: 8, opacity: upload.isPending ? 0.6 : 1 }}>
        <Artwork uri={profile?.imageUrl ?? user?.photoURL ?? null} size={104} rounded={52} />
        <GradientText style={{ fontWeight: '700' }}>{upload.isPending ? 'Uploading…' : 'Change photo'}</GradientText>
      </Pressable>
      <Field
        label="Display name"
        value={displayName}
        onChangeText={setEditedName}
        placeholder="How should we call you?"
        maxLength={50}
        autoCapitalize="words"
      />
      <Field
        label="Bio"
        value={bio}
        onChangeText={setEditedBio}
        placeholder="A line about you and your music"
        maxLength={300}
        multiline
        style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 14 }}
      />
      <ActionButton title="Save changes" onPress={save} loading={update.isPending} disabled={!dirty} />
      <SwitchRow
        label="Show my listening"
        description="Let others see your recent plays and top genres on your profile."
        value={profile?.showListening !== false}
        onChange={(showListening) => update.mutate({ showListening })}
      />

      <View style={{ gap: 12 }}>
        <GradientText style={{ fontSize: 19, fontWeight: '800' }}>What others see</GradientText>
        {publicQuery.isPending ? <LoadingState label="Loading your profile…" /> : null}
        {publicQuery.error instanceof Error ? (
          <ErrorMessage message={publicQuery.error.message} onRetry={() => void publicQuery.refetch()} />
        ) : null}
        {publicQuery.data ? <ProfileSections profile={publicQuery.data} /> : null}
      </View>
    </Page>
  );
}

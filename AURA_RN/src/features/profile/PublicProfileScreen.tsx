import { useLocalSearchParams } from 'expo-router';

import { BackButton, ErrorMessage, LoadingState, Page } from '@/components/ui';

import { ProfileHeader } from './components/ProfileHeader';
import { ProfileSections } from './components/ProfileSections';
import { usePublicProfile } from './hooks/use-profile';

/** Another listener's profile, opened from a playlist's owner or collaborators. */
export default function PublicProfileScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileQuery = usePublicProfile(id);
  const profile = profileQuery.data;

  return (
    <Page style={{ gap: 24 }}>
      <BackButton />
      {profileQuery.isPending ? <LoadingState label="Loading profile…" /> : null}
      {profileQuery.error instanceof Error ? (
        <ErrorMessage message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
      ) : null}
      {profile ? (
        <>
          <ProfileHeader
            imageUrl={profile.imageUrl}
            name={profile.displayName ?? 'AURA listener'}
            bio={profile.bio?.trim() || null}
          />
          <ProfileSections profile={profile} />
        </>
      ) : null}
    </Page>
  );
}

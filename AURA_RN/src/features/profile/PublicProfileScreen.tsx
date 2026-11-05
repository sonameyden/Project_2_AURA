import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Artwork, AuraText, ErrorMessage, Heading, LoadingState, Page } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';

import { ProfileSections } from './components/ProfileSections';
import { usePublicProfile } from './hooks/use-profile';

/** Another listener's profile, opened from a playlist's owner or collaborators. */
export default function PublicProfileScreenFeature() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAuraTheme();
  const profileQuery = usePublicProfile(id);
  const profile = profileQuery.data;

  return (
    <Page>
      {profileQuery.isPending ? <LoadingState label="Loading profile…" /> : null}
      {profileQuery.error instanceof Error ? (
        <ErrorMessage message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} />
      ) : null}
      {profile ? (
        <>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Artwork uri={profile.imageUrl} size={104} rounded={52} />
            <Heading title={profile.displayName ?? 'AURA listener'} />
            {profile.bio ? <AuraText style={{ color: colors.muted, textAlign: 'center' }}>{profile.bio}</AuraText> : null}
          </View>
          <ProfileSections profile={profile} />
        </>
      ) : null}
    </Page>
  );
}

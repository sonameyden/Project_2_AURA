import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActionButton,
  BackButton,
  Card,
  ErrorMessage,
  Field,
  Heading,
  LoadingState,
  Page,
  showAlert,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { useRefreshCatalog } from '@/hooks/use-refresh-catalog';

import { useMyArtist } from './hooks/use-my-artist';

/**
 * "Become an artist" setup. Artists are sent straight to their own artist page,
 * which is where they manage their music, profile and account.
 */
export default function ArtistDashboardScreenFeature() {
  const router = useRouter();
  const { getToken } = useAuth();
  const refreshCatalog = useRefreshCatalog();
  const myArtist = useMyArtist();
  const [artistName, setArtistName] = useState('');
  const [bio, setBio] = useState('');
  const [working, setWorking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const artist = myArtist.data ?? null;
  useEffect(() => {
    if (artist) router.replace({ pathname: '/artist/[id]', params: { id: 'me' } });
  }, [artist, router]);

  const becomeArtist = async () => {
    if (!artistName.trim()) {
      showAlert('Add an artist name', 'Your artist name is required to continue.');
      return;
    }
    setWorking(true);
    setSaveError(null);
    try {
      await auraApi.createArtist(await getToken(), { name: artistName.trim(), bio: bio.trim() || null });
      // Refetching "my artist" finds the new profile, which moves on to the artist page.
      await refreshCatalog();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Artist profile could not be created.');
    } finally {
      setWorking(false);
    }
  };

  if (myArtist.isPending || artist) {
    return (
      <Page style={{ justifyContent: 'center' }}>
        <LoadingState label={artist ? 'Opening your artist page…' : 'Loading your creator dashboard…'} />
      </Page>
    );
  }

  const loadError = myArtist.error instanceof Error ? myArtist.error.message : null;
  return (
    <Page>
      <BackButton />
      <Heading title="Become an artist" subtitle="Share your music with the AURA community." />
      {loadError ? <ErrorMessage message={loadError} onRetry={() => void myArtist.refetch()} /> : null}
      {saveError ? <ErrorMessage message={saveError} /> : null}
      <Card>
        <Field label="Artist name" value={artistName} onChangeText={setArtistName} placeholder="Your stage name" />
        <Field
          label="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell listeners about your sound"
          multiline
        />
        <ActionButton title="Create artist profile" onPress={() => void becomeArtist()} loading={working} />
      </Card>
    </Page>
  );
}

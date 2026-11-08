import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { BackButton, ActionButton, Artwork, ErrorMessage, Field, Heading, Page, AuraText } from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { appendUploadFile, type SelectedUpload } from '@/core/native-upload';
import { IMAGE_MAX_SIZE, pickImageUpload } from '@/core/pick-image';
import { useAuraTheme } from '@/core/theme';
import { useRefreshCatalog } from '@/hooks/use-refresh-catalog';

export default function CreateAlbumScreenFeature() {
  const router = useRouter();
  const refreshCatalog = useRefreshCatalog();
  const { getToken } = useAuth();
  const [title, setTitle] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [artwork, setArtwork] = useState<SelectedUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const chooseArtwork = async () => {
    const image = await pickImageUpload({ fallbackName: 'album-cover.jpg', maxSize: IMAGE_MAX_SIZE.artwork });
    if (image) setArtwork(image);
  };

  const create = async () => {
    if (!title.trim()) {
      setError('Album title is required.');
      return;
    }
    if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
      setError('Use YYYY-MM-DD for the release date.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append('title', title.trim());
      form.append('releaseDate', releaseDate.trim());
      if (artwork) appendUploadFile(form, 'artwork', artwork);
      const album = await auraApi.createAlbum(token, form);
      // The new album shows up on the artist page and Home without waiting for their cache to expire.
      void refreshCatalog();
      router.replace({ pathname: '/album/[id]', params: { id: album.id } });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Album could not be created.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Page>
      <BackButton />
      <Heading title="Create an album" subtitle="Give your tracks a place to live together." />
      {error ? <ErrorMessage message={error} /> : null}
      <PressableArtwork onPress={() => void chooseArtwork()} uri={artwork?.uri ?? null} />
      <Field label="Album title" value={title} onChangeText={setTitle} placeholder="Album name" />
      <Field
        label="Release date (optional)"
        value={releaseDate}
        onChangeText={setReleaseDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      <ActionButton title="Create album" onPress={() => void create()} loading={working} />
    </Page>
  );
}

function PressableArtwork({ onPress, uri }: { onPress: () => void; uri: string | null }) {
  const { colors } = useAuraTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}>
      <Artwork uri={uri} size={132} rounded={22} />
      <AuraText style={{ color: colors.accent, fontWeight: '700' }}>Change artwork</AuraText>
    </Pressable>
  );
}

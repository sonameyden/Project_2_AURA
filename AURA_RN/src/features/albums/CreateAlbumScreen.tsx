import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { ActionButton, Artwork, ErrorMessage, Field, Heading, Page, AuraText } from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { appendUploadFile, type SelectedUpload } from '@/core/native-upload';
import { useAuraTheme } from '@/core/theme';

export default function CreateAlbumScreenFeature() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [title, setTitle] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [artwork, setArtwork] = useState<SelectedUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const chooseArtwork = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const image = result.assets[0];
    if (!image) return;
    setArtwork({
      uri: image.uri,
      name: image.fileName ?? 'album-cover.jpg',
      mimeType: image.mimeType ?? 'image/jpeg',
      size: image.fileSize,
    });
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
      router.replace({ pathname: '/album/[id]', params: { id: album.id } });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Album could not be created.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Page>
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
    <Pressable onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}>
      <Artwork uri={uri} size={132} rounded={22} />
      <AuraText style={{ color: colors.accent, fontWeight: '700' }}>Change artwork</AuraText>
    </Pressable>
  );
}

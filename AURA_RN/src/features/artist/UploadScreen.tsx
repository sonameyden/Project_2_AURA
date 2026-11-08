import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import {
  BackButton,
  ActionButton,
  Artwork,
  AuraText,
  ErrorMessage,
  Field,
  Heading,
  Page,
  useToast,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { appendUploadFile, type SelectedUpload } from '@/core/native-upload';
import { audioMime } from '@/core/audio-mime';
import { IMAGE_MAX_SIZE, pickImageUpload } from '@/core/pick-image';
import { useAuraTheme } from '@/core/theme';
import { useRefreshCatalog } from '@/hooks/use-refresh-catalog';
import { readAudioDuration } from '@/core/read-audio-duration';

import { useMyArtist } from './hooks/use-my-artist';

const maximumAudioSize = 50 * 1024 * 1024;

export default function UploadScreenFeature() {
  const { albumId } = useLocalSearchParams<{ albumId?: string }>();
  const router = useRouter();
  const toast = useToast();
  const refreshCatalog = useRefreshCatalog();
  const { getToken } = useAuth();
  const { colors } = useAuraTheme();
  // Prefilled from the artist profile (shared, cached query); editable for features or aliases.
  const myArtist = useMyArtist();
  const [editedArtistName, setArtistName] = useState<string | null>(null);
  const artistName = editedArtistName ?? myArtist.data?.name ?? '';
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [audio, setAudio] = useState<SelectedUpload | null>(null);
  const [artwork, setArtwork] = useState<SelectedUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const selectAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file) return;
    if (file.size !== undefined && file.size > maximumAudioSize) {
      setError('Audio files must be 50 MB or smaller.');
      return;
    }
    setAudio({
      uri: file.uri,
      name: file.name,
      // Android sometimes labels audio as application/octet-stream, which the backend rejects.
      mimeType: file.mimeType?.startsWith('audio/') ? file.mimeType : audioMime(file.name),
      size: file.size,
    });
    setError(null);
    // Fill in the duration automatically; the field stays editable as a fallback.
    setDetecting(true);
    void readAudioDuration(file.uri)
      .then((seconds) => {
        if (seconds) setDurationSeconds(String(Math.round(seconds)));
      })
      .finally(() => setDetecting(false));
  };

  const selectArtwork = async () => {
    const image = await pickImageUpload({ fallbackName: 'artwork.jpg', maxSize: IMAGE_MAX_SIZE.artwork });
    if (image) setArtwork(image);
  };

  const upload = async () => {
    const duration = Number(durationSeconds);
    if (!audio || !title.trim() || !artistName.trim() || !Number.isFinite(duration) || duration <= 0) {
      toast.show({
        title: 'Complete the track details',
        message: 'Add a title, an audio file and the track duration (artwork is optional).',
        variant: 'error',
      });
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const token = await getToken();
      const form = new FormData();
      appendUploadFile(form, 'file', audio);
      if (artwork) appendUploadFile(form, 'artwork', artwork);
      form.append('title', title.trim());
      form.append('artistName', artistName.trim());
      form.append('genre', genre.trim());
      form.append('durationMs', String(Math.round(duration * 1000)));
      if (albumId) form.append('albumId', albumId);
      await auraApi.uploadSong(token, form);
      // Refresh the artist page, album and Home before going back, so the new song is already there.
      await refreshCatalog().catch(() => undefined);
      toast.show({ title: 'Upload successful', message: `${title.trim()} is now in the AURA catalog.` });
      router.back();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Track upload failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Page>
      <BackButton />
      <Heading
        title="Upload music"
        subtitle={albumId ? 'Add a new track to your album.' : 'Share a new experience with AURA listeners.'}
      />
      {error ? <ErrorMessage message={error} /> : null}
      {myArtist.error instanceof Error ? (
        <ErrorMessage message={myArtist.error.message} onRetry={() => void myArtist.refetch()} />
      ) : null}
      <Pressable onPress={() => void selectArtwork()} style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}>
        <Artwork uri={artwork?.uri ?? null} size={132} rounded={22} />
        <AuraText style={{ color: colors.accent, fontWeight: '700' }}>Choose track artwork</AuraText>
      </Pressable>
      <Field label="Song title" value={title} onChangeText={setTitle} placeholder="Track title" />
      <Field label="Artist name" value={artistName} onChangeText={setArtistName} placeholder="Artist name" />
      <Field label="Genre" value={genre} onChangeText={setGenre} placeholder="Ambient, lo-fi…" />
      <Field
        label={detecting ? 'Duration (reading file…)' : 'Duration (seconds, filled in from the file)'}
        value={durationSeconds}
        onChangeText={setDurationSeconds}
        placeholder="e.g. 214"
        keyboardType="number-pad"
      />
      <Pressable
        onPress={() => void selectAudio()}
        style={{
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.accent,
          borderRadius: 16,
          padding: 18,
          alignItems: 'center',
        }}>
        <AuraText style={{ fontWeight: '700' }}>{audio?.name ?? 'Select audio file'}</AuraText>
        <AuraText style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>MP3, WAV or FLAC · up to 50 MB</AuraText>
      </Pressable>
      <ActionButton title="Upload track" onPress={() => void upload()} loading={working} />
    </Page>
  );
}

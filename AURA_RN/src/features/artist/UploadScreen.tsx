import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { ActionButton, Artwork, AuraText, ErrorMessage, Field, Heading, Page } from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { appendUploadFile, type SelectedUpload } from '@/core/native-upload';
import { useAuraTheme } from '@/core/theme';
import { readAudioDuration } from '@/core/read-audio-duration';

const maximumAudioSize = 50 * 1024 * 1024;

export default function UploadScreenFeature() {
  const { albumId } = useLocalSearchParams<{ albumId?: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const { colors } = useAuraTheme();
  const [artistName, setArtistName] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [audio, setAudio] = useState<SelectedUpload | null>(null);
  const [artwork, setArtwork] = useState<SelectedUpload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void getToken()
      .then((token) => auraApi.getMyArtist(token))
      .then((artist) => {
        if (active) setArtistName(artist.name);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Artist profile could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [getToken]);

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
      mimeType: file.mimeType ?? audioMime(file.name),
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
      name: image.fileName ?? 'artwork.jpg',
      mimeType: image.mimeType ?? 'image/jpeg',
      size: image.fileSize,
    });
  };

  const upload = async () => {
    const duration = Number(durationSeconds);
    if (!audio || !title.trim() || !artistName.trim() || !Number.isFinite(duration) || duration <= 0) {
      Alert.alert('Complete the track details', 'Add artwork (optional), a title, an audio file and the track duration.');
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
      Alert.alert('Upload successful', 'Your track is now in the AURA catalog.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Track upload failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Page>
      <Heading title="Upload music" subtitle={albumId ? 'Add a new track to your album.' : 'Share a new experience with AURA listeners.'} />
      {error ? <ErrorMessage message={error} /> : null}
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
        style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: 16, padding: 18, alignItems: 'center' }}>
        <AuraText style={{ fontWeight: '700' }}>{audio?.name ?? 'Select audio file'}</AuraText>
        <AuraText style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>
          MP3, WAV or FLAC · up to 50 MB
        </AuraText>
      </Pressable>
      <ActionButton title="Upload track" onPress={() => void upload()} loading={working} />
    </Page>
  );
}

function audioMime(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'm4a') return 'audio/mp4';
  return 'audio/mpeg';
}

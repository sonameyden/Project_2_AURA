import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  ActionButton,
  AuraText,
  Card,
  ErrorMessage,
  Field,
  Heading,
  Page,
  SectionTitle,
  TrackRow,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { Album, Artist, Song } from '@/core/types';

export default function ArtistDashboardScreenFeature() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { colors } = useAuraTheme();
  const { playSong } = usePlayer();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artistName, setArtistName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [profile, tracks, collections] = await Promise.all([
        auraApi.getMyArtist(token),
        auraApi.myArtistSongs(token),
        auraApi.albums(token),
      ]);
      setArtist(profile);
      setArtistName(profile.name);
      setBio(profile.bio ?? '');
      setSongs(tracks);
      setAlbums(collections);
      setError(null);
    } catch (loadError) {
      setArtist(null);
      if (loadError instanceof Error && !('status' in loadError && loadError.status === 404)) {
        setError(loadError.message);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (artist) {
      router.replace({ pathname: '/artist/[id]', params: { id: artist.id } });
    }
  }, [artist, router]);

  const becomeArtist = async () => {
    if (!artistName.trim()) {
      Alert.alert('Add an artist name', 'Your artist name is required to continue.');
      return;
    }
    setWorking(true);
    try {
      const token = await getToken();
      await auraApi.createArtist(token, { name: artistName.trim(), bio: bio.trim() });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Artist profile could not be created.');
    } finally {
      setWorking(false);
    }
  };

  const removeArtist = () =>
    Alert.alert(
      'Delete artist account?',
      'This permanently removes your artist profile, albums and uploaded songs. Your listener account remains.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete artist account',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            void getToken()
              .then((token) => auraApi.deleteArtist(token))
              .then(() => {
                setArtist(null);
                setSongs([]);
                setAlbums([]);
              })
              .catch((deleteError: unknown) =>
                Alert.alert('Could not delete artist account', deleteError instanceof Error ? deleteError.message : 'Please try again.'),
              )
              .finally(() => setWorking(false));
          },
        },
      ],
    );

  if (loading) {
    return <Page><AuraText>Loading your creator dashboard…</AuraText></Page>;
  }

  if (!artist) {
    return (
      <Page>
        <Heading title="Become an artist" subtitle="Share your music with the AURA community." />
        {error ? <ErrorMessage message={error} onRetry={() => void load()} /> : null}
        <Card>
          <Field label="Artist name" value={artistName} onChangeText={setArtistName} placeholder="Your stage name" />
          <Field label="Bio (optional)" value={bio} onChangeText={setBio} placeholder="Tell listeners about your sound" multiline />
          <ActionButton title="Create artist profile" onPress={() => void becomeArtist()} loading={working} />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Heading title="Artist dashboard" subtitle={`Welcome, ${artist.name}.`} />
      {error ? <ErrorMessage message={error} onRetry={() => void load()} /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <AuraText style={{ color: colors.muted, fontSize: 12 }}>MONTHLY LISTENERS</AuraText>
          <AuraText style={{ fontSize: 22, fontWeight: '800' }}>{artist.monthlyListeners.toLocaleString()}</AuraText>
        </Card>
        <Card style={{ flex: 1 }}>
          <AuraText style={{ color: colors.muted, fontSize: 12 }}>ATMOSPHERE LIKES</AuraText>
          <AuraText style={{ fontSize: 22, fontWeight: '800' }}>{artist.followerCount.toLocaleString()}</AuraText>
        </Card>
      </View>
      <ActionButton title="Upload new experience" onPress={() => router.push('/upload')} icon={<Ionicons name="cloud-upload-outline" size={19} color="#FFFFFF" />} />
      <ActionButton title="Create new album" variant="secondary" onPress={() => router.push('/album/create')} />
      <View style={{ gap: 10 }}>
        <SectionTitle title="Albums" />
        {albums.map((album) => (
          <Pressable
            key={album.id}
            onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
            style={{ padding: 14, borderRadius: 15, backgroundColor: colors.surface }}>
            <AuraText style={{ fontWeight: '700' }}>{album.title}</AuraText>
            <AuraText style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{album.songIds.length} tracks</AuraText>
          </Pressable>
        ))}
        {!albums.length ? <AuraText style={{ color: colors.muted }}>Your albums will appear here.</AuraText> : null}
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Top songs" />
        {songs.slice(0, 5).map((song) => (
          <TrackRow key={song.id} song={song} onPress={() => void playSong(song, songs).then(() => router.push('/now-playing'))} />
        ))}
      </View>
      <ActionButton title="Delete artist account" variant="danger" onPress={removeArtist} loading={working} />
    </Page>
  );
}

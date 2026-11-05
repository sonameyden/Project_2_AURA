import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Artwork, AuraText, Card, ErrorMessage, Field, Page, SectionTitle, TrackRow } from '@/components/ui';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { SearchHistoryEntry, Song } from '@/core/types';
import { useOpenAddToPlaylist } from '@/hooks/use-open-add-to-playlist';

import {
  emptySearchResults,
  looksDescriptive,
  useCatalogSearch,
  useNaturalSearch,
  useSearchHistory,
  useSearchHistoryMutations,
} from './hooks/use-search';
import { RecentSearches } from './components/RecentSearches';

const examples = ['calm songs for studying at night', 'upbeat songs for a morning run', 'sad slow songs like rain'];

export default function SearchScreenFeature() {
  const router = useRouter();
  const { colors } = useAuraTheme();
  const { playSong, song: playing } = usePlayer();
  const openAddToPlaylist = useOpenAddToPlaylist();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    // Descriptive queries wait a little longer, so the AI search runs once per thought.
    const delay = looksDescriptive(query) ? 600 : 300;
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), delay);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useCatalogSearch(debouncedQuery);
  const vibe = useNaturalSearch(debouncedQuery);
  const history = useSearchHistory();
  const { record, remove } = useSearchHistoryMutations();

  const trimmed = query.trim();
  const results = trimmed ? search.data ?? emptySearchResults : emptySearchResults;
  const vibeResults = trimmed && vibe.data?.isDescriptive ? vibe.data.results : [];
  const error = search.error instanceof Error ? search.error.message : null;
  const vibeError = vibe.error instanceof Error ? vibe.error.message : null;
  const pending = trimmed.length > 0 && trimmed !== debouncedQuery;
  const loading = (search.isFetching || vibe.isFetching) && trimmed.length > 0;
  const hasResults = vibeResults.length > 0 || Object.values(results).some((section) => section.length > 0);

  const remember = (resultType: SearchHistoryEntry['result_type'], resultId: string, resultTitle: string) => {
    if (trimmed) record.mutate({ query: trimmed, resultType, resultId, resultTitle });
  };
  const playFrom = (song: Song, queue: Song[]) => {
    remember('song', song.id, song.title);
    void playSong(song, queue).then(() => router.push('/now-playing'));
  };

  return (
    <Page>
      <SectionTitle title="Search" />
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="A song, an artist, or a feeling…"
        returnKeyType="search"
        autoCapitalize="none"
        accessibilityLabel="Search songs, artists, or describe a mood"
        accessibilityHint="Try a description such as calm songs for studying at night"
      />
      {error ? <ErrorMessage message={error} onRetry={() => void search.refetch()} /> : null}
      {loading || pending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} size="small" />
          <AuraText style={{ color: colors.muted }}>
            {looksDescriptive(query) ? 'Finding music that matches…' : 'Searching AURA…'}
          </AuraText>
        </View>
      ) : null}

      {!trimmed ? (
        <>
          <Card style={{ gap: 10 }}>
            <Ionicons name="sparkles-outline" size={24} color={colors.accent} />
            <AuraText style={{ fontWeight: '700' }}>Search by title — or by feeling</AuraText>
            <AuraText style={{ color: colors.muted }}>Describe what you want to hear and AURA will find it.</AuraText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {examples.map((example) => (
                <Pressable
                  key={example}
                  onPress={() => setQuery(example)}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${example}`}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.accentSoft }}>
                  <AuraText style={{ fontSize: 12, color: colors.text }}>{example}</AuraText>
                </Pressable>
              ))}
            </View>
          </Card>
          <RecentSearches
            entries={history.data ?? []}
            onSelect={(entry) => setQuery(entry.query)}
            onDelete={(entry) => {
              // Remove every stored row for this query, since the list shows it once.
              for (const row of history.data ?? []) if (row.query === entry.query) remove.mutate(row.id);
            }}
            onClear={() => remove.mutate(undefined)}
          />
        </>
      ) : null}

      {vibeResults.length > 0 && vibe.data ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title="Matches your vibe" />
          <AuraText style={{ color: colors.muted, fontSize: 13 }}>
            {vibe.data.summary}
            {vibe.data.source === 'keywords' ? ' · quick match' : ''}
          </AuraText>
          {vibeResults.map(({ song, reason }) => (
            <View key={song.id}>
              <TrackRow
                song={song}
                active={playing?.id === song.id}
                onPress={() => playFrom(song, vibeResults.map((item) => item.song))}
                onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: song.artistId } })}
                onMore={() => openAddToPlaylist(song)}
              />
              {reason ? (
                <AuraText style={{ color: colors.muted, fontSize: 11, marginLeft: 64, marginTop: -2 }}>{reason}</AuraText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {vibeError && trimmed ? <ErrorMessage message={`Mood search: ${vibeError}`} onRetry={() => void vibe.refetch()} /> : null}

      {results.songs.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionTitle title={vibeResults.length ? 'Title & artist matches' : 'Songs'} />
          {results.songs.map((song) => (
            <TrackRow
              key={song.id}
              song={song}
              active={playing?.id === song.id}
              onPress={() => playFrom(song, results.songs)}
              onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: song.artistId } })}
              onMore={() => openAddToPlaylist(song)}
            />
          ))}
        </View>
      ) : null}
      {results.artists.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Artists" />
          {results.artists.map((artist) => (
            <Pressable
              key={artist.id}
              onPress={() => {
                remember('artist', artist.id, artist.name);
                router.push({ pathname: '/artist/[id]', params: { id: artist.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${artist.name}${artist.isVerified ? ', verified artist' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Artwork uri={artist.imageUrl} size={46} rounded={23} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AuraText style={{ fontWeight: '700' }}>{artist.name}</AuraText>
                  {artist.isVerified ? <Ionicons name="checkmark-circle" size={15} color={colors.accentBlue} /> : null}
                </View>
                <AuraText style={{ color: colors.muted, fontSize: 12 }}>
                  {artist.followerCount.toLocaleString()} followers
                </AuraText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {results.albums.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Albums" />
          {results.albums.map((album) => (
            <Pressable
              key={album.id}
              onPress={() => {
                remember('album', album.id, album.title);
                router.push({ pathname: '/album/[id]', params: { id: album.id } });
              }}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Artwork uri={album.artworkUrl} size={46} rounded={12} />
              <View style={{ flex: 1 }}>
                <AuraText style={{ fontWeight: '700' }}>{album.title}</AuraText>
                <AuraText style={{ color: colors.muted, fontSize: 12 }}>{album.songIds.length} tracks</AuraText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {results.playlists.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Playlists" />
          {results.playlists.map((playlist) => (
            <Card
              key={playlist.id}
              onPress={() => {
                remember('playlist', playlist.id, playlist.title);
                router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } });
              }}
              accessibilityLabel={`Playlist ${playlist.title}`}
              style={{ padding: 14 }}>
              <AuraText style={{ fontWeight: '700' }}>{playlist.title}</AuraText>
            </Card>
          ))}
        </View>
      ) : null}
      {trimmed && !loading && !pending && !error && !hasResults ? (
        <AuraText style={{ color: colors.muted }}>
          No matches yet. Try another title, an artist, or describe the mood you want.
        </AuraText>
      ) : null}
    </Page>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AuraText, Card, SectionTitle, TrackRow } from '@/components/ui';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { PublicProfile } from '@/core/types';

/** Stats, top genres, recent listening, public playlists and artist link. */
export function ProfileSections({ profile }: { profile: PublicProfile }) {
  const router = useRouter();
  const { colors } = useAuraTheme();
  const { playSong, song: playing } = usePlayer();

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Public playlists" value={profile.stats.publicPlaylists} />
        <Stat label="Following" value={profile.stats.following} />
        <Stat label="Liked songs" value={profile.stats.likedSongs} />
      </View>

      {profile.artist ? (
        <Card
          onPress={() =>
            router.push({ pathname: '/artist/[id]', params: { id: profile.isSelf ? 'me' : profile.artist!.id } })
          }
          accessibilityLabel={`Artist page: ${profile.artist.name}`}
          style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="mic-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <AuraText style={{ fontWeight: '700' }}>Also an artist</AuraText>
            <AuraText style={{ color: colors.muted, fontSize: 12 }}>{profile.artist.name}</AuraText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      ) : null}

      {profile.listeningHidden ? (
        <AuraText style={{ color: colors.muted }}>
          {profile.displayName ?? 'This listener'} keeps their listening private.
        </AuraText>
      ) : (
        <>
          {profile.topGenres.length ? (
            <View style={{ gap: 10 }}>
              <SectionTitle title="Top genres" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {profile.topGenres.map((genre) => (
                  <View
                    key={genre}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 14,
                      backgroundColor: colors.accentSoft,
                    }}>
                    <AuraText style={{ fontSize: 13, textTransform: 'capitalize' }}>{genre}</AuraText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {profile.recentListening.length ? (
            <View style={{ gap: 6 }}>
              <SectionTitle title="Recently played" />
              {profile.recentListening.slice(0, 6).map((song) => (
                <TrackRow
                  key={song.id}
                  song={song}
                  active={playing?.id === song.id}
                  onPress={() => void playSong(song, profile.recentListening).then(() => router.push('/now-playing'))}
                  onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: song.artistId } })}
                />
              ))}
            </View>
          ) : null}
        </>
      )}

      <View style={{ gap: 10 }}>
        <SectionTitle title="Public playlists" />
        {profile.publicPlaylists.length ? (
          profile.publicPlaylists.map((playlist) => (
            <Card
              key={playlist.id}
              onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
              accessibilityLabel={`Playlist ${playlist.title}, ${playlist.songIds.length} songs`}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <Ionicons name="musical-notes" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <AuraText style={{ fontWeight: '700' }}>{playlist.title}</AuraText>
                <AuraText style={{ color: colors.muted, fontSize: 12 }}>{playlist.songIds.length} songs</AuraText>
              </View>
            </Card>
          ))
        ) : (
          <AuraText style={{ color: colors.muted }}>
            {profile.isSelf ? 'Make a playlist public to show it here.' : 'No public playlists yet.'}
          </AuraText>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors } = useAuraTheme();
  return (
    <Card style={{ flex: 1, padding: 12, gap: 2, alignItems: 'center' }}>
      <AuraText style={{ fontSize: 20, fontWeight: '800' }}>{value.toLocaleString()}</AuraText>
      <AuraText style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>{label}</AuraText>
    </Card>
  );
}

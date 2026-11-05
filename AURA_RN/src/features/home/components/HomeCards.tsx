import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Artwork, AuraText, GradientText } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { Album, Artist, Song } from '@/core/types';

export function HorizontalSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { colors } = useAuraTheme();
  return (
    <View style={{ marginTop: 20 }}>
      <GradientText style={{ fontSize: 20, fontWeight: '700' }}>{title}</GradientText>
      {subtitle ? <AuraText style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</AuraText> : null}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingTop: 8, paddingBottom: 10 }}>
        {children}
      </ScrollView>
    </View>
  );
}

export function SongCard({
  song,
  reason,
  playing,
  onPress,
  onArtistPress,
  onMore,
}: {
  song: Song;
  /** "Because you like calm indie" for Made-for-you cards. */
  reason?: string;
  playing: boolean;
  onPress: () => void;
  onArtistPress: () => void;
  onMore: () => void;
}) {
  const { colors } = useAuraTheme();
  return (
    <View style={{ width: 160, gap: 6 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Play ${song.title} by ${song.artistName}${playing ? ', now playing' : ''}${reason ? `. ${reason}` : ''}`}
        style={[
          styles.cover,
          { backgroundColor: colors.surface, borderColor: playing ? colors.accent : colors.border, borderWidth: playing ? 2 : 1 },
        ]}>
        <Artwork uri={song.artworkUrl} size={1} rounded={20} style={{ width: '100%', height: '100%' }} />
        {playing ? (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Ionicons name="volume-high" size={14} color="#FFFFFF" />
          </View>
        ) : null}
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel={`Add ${song.title} to a playlist`}
          hitSlop={8}
          style={styles.more}>
          <Ionicons name="ellipsis-horizontal" size={16} color="#FFFFFF" />
        </Pressable>
      </Pressable>
      <AuraText numberOfLines={1} style={{ fontWeight: '700', paddingHorizontal: 3 }}>
        {song.title}
      </AuraText>
      <Pressable onPress={onArtistPress} accessibilityRole="link">
        <AuraText numberOfLines={1} style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 3 }}>
          {song.artistName}
        </AuraText>
      </Pressable>
      {reason ? (
        <AuraText numberOfLines={2} style={{ color: colors.accent, fontSize: 11, paddingHorizontal: 3 }}>
          {reason}
        </AuraText>
      ) : null}
    </View>
  );
}

export function ArtistCard({ artist, onPress }: { artist: Artist; onPress: () => void }) {
  const { colors } = useAuraTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}${artist.isVerified ? ', verified' : ''}`}
      style={{ width: 92, alignItems: 'center', gap: 7 }}>
      <Artwork uri={artist.imageUrl} size={74} rounded={37} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 92 }}>
        <AuraText numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', flexShrink: 1 }}>
          {artist.name}
        </AuraText>
        {artist.isVerified ? <Ionicons name="checkmark-circle" size={12} color={colors.accentBlue} /> : null}
      </View>
    </Pressable>
  );
}

export function AlbumCard({ album, onPress }: { album: Album; onPress: () => void }) {
  const { colors } = useAuraTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Album ${album.title}`} style={{ width: 160, gap: 6 }}>
      <View style={[styles.cover, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <Artwork uri={album.artworkUrl} size={1} rounded={20} style={{ width: '100%', height: '100%' }} />
      </View>
      <AuraText numberOfLines={1} style={{ fontWeight: '700', paddingHorizontal: 3 }}>
        {album.title}
      </AuraText>
      <AuraText numberOfLines={1} style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 3 }}>
        {album.releaseDate ?? 'AURA release'}
      </AuraText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { width: 160, height: 160, borderRadius: 24, padding: 5 },
  badge: { position: 'absolute', left: 12, top: 12, borderRadius: 12, padding: 5 },
  more: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000066',
  },
});

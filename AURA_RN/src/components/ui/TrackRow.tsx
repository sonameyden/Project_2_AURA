import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuraTheme } from '@/core/theme';
import type { Song } from '@/core/types';

import { Artwork } from './Artwork';
import { AuraText } from './Text';

/**
 * One song in a list. `onMore` shows a "more options" button (for example
 * add-to-playlist); without it no decorative menu icon is drawn.
 */
export function TrackRow({
  song,
  onPress,
  onArtistPress,
  onMore,
  trailing,
  active = false,
}: {
  song: Song;
  onPress: () => void;
  onArtistPress?: () => void;
  onMore?: () => void;
  trailing?: ReactNode;
  active?: boolean;
}) {
  const { colors } = useAuraTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${song.title} by ${song.artistName}${active ? ', now playing' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.trackRow, pressed && styles.pressed]}>
      <Artwork uri={song.artworkUrl} size={52} rounded={14} />
      <View style={styles.trackDetails}>
        <AuraText numberOfLines={1} style={[styles.trackTitle, active && { color: colors.accent }]}>
          {song.title}
        </AuraText>
        <Pressable onPress={onArtistPress} disabled={!onArtistPress} hitSlop={8}>
          <AuraText numberOfLines={1} style={[styles.trackArtist, { color: colors.muted }]}>
            {song.artistName}
          </AuraText>
        </Pressable>
      </View>
      {active ? <Ionicons name="volume-high" size={16} color={colors.accent} /> : null}
      {trailing}
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${song.title}`}
          hitSlop={10}
          style={styles.more}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  trackDetails: { flex: 1, gap: 4, minWidth: 0 },
  trackTitle: { fontSize: 15, fontWeight: '700' },
  trackArtist: { fontSize: 13 },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});

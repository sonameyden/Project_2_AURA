import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Artwork, AuraText, GradientText } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';

const AVATAR_SIZE = 104;

/**
 * Photo, name and bio at the top of a profile. Shared by your own profile and
 * other listeners' so both look the same.
 */
export function ProfileHeader({
  imageUrl,
  name,
  subtitle,
  bio,
  emptyBio,
  onChangePhoto,
  uploading = false,
}: {
  imageUrl: string | null;
  name: string;
  subtitle?: string;
  bio: string | null;
  /** Shown instead of the bio when there isn't one (e.g. an "Add a bio" prompt). */
  emptyBio?: React.ReactNode;
  /** When set, the photo becomes a button with a camera badge. */
  onChangePhoto?: () => void;
  uploading?: boolean;
}) {
  const { colors } = useAuraTheme();
  const avatar = <Artwork uri={imageUrl} size={AVATAR_SIZE} rounded={AVATAR_SIZE / 2} />;

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      {onChangePhoto ? (
        <Pressable
          onPress={onChangePhoto}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={uploading ? 'Uploading profile photo' : 'Change profile photo'}
          style={{ opacity: uploading ? 0.6 : 1, marginBottom: 8 }}>
          {avatar}
          <View
            style={{
              position: 'absolute',
              right: 2,
              bottom: 2,
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              borderWidth: 3,
              borderColor: colors.background,
            }}>
            <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={15} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : (
        <View style={{ marginBottom: 8 }}>{avatar}</View>
      )}

      <GradientText style={{ fontSize: 26, lineHeight: 34, fontWeight: '800', textAlign: 'center' }}>
        {name}
      </GradientText>
      {subtitle ? (
        <AuraText style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>{subtitle}</AuraText>
      ) : null}

      {bio ? (
        <AuraText
          style={{
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
            textAlign: 'center',
            marginTop: 8,
            maxWidth: 420,
          }}>
          {bio}
        </AuraText>
      ) : emptyBio ? (
        <View style={{ marginTop: 8, alignSelf: 'stretch' }}>{emptyBio}</View>
      ) : null}
    </View>
  );
}

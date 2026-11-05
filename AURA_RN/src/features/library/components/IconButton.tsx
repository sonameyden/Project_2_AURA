import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useAuraTheme } from '@/core/theme';

/** Small icon-only button used for the playlist edit controls. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const { colors } = useAuraTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <Ionicons name={icon} size={20} color={color ?? colors.text} />
    </Pressable>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useAuraTheme } from '@/core/theme';
import { useGoBack } from '@/core/use-go-back';

/**
 * The round back (or close) button at the top of pushed screens and pop-ups,
 * so leaving a screen never depends on the phone's own back button. If there
 * is nothing to go back to (e.g. the screen was opened from a link), it goes
 * Home instead.
 */
export function BackButton({
  variant = 'back',
  style,
}: {
  /** 'close' (an ×) for screens that pop up over another, such as Add to playlist. */
  variant?: 'back' | 'close';
  style?: StyleProp<ViewStyle>;
}) {
  const goBack = useGoBack();
  const { colors, mode } = useAuraTheme();

  return (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel={variant === 'close' ? 'Close' : 'Go back'}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: mode === 'light' ? '#0000000D' : '#FFFFFF1A',
          opacity: pressed ? 0.7 : 1,
          alignSelf: 'flex-start',
        },
        style,
      ]}>
      <Ionicons name={variant === 'close' ? 'close' : 'arrow-back'} size={22} color={colors.text} />
    </Pressable>
  );
}

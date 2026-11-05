import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { useScaledTextStyle } from './use-scaled-text';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  title,
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useAuraTheme();
  const background =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.elevated
          : 'transparent';
  const foreground = variant === 'quiet' ? colors.accent : '#FFFFFF';
  const labelStyle = useScaledTextStyle({
    color: variant === 'secondary' ? colors.text : foreground,
    fontWeight: '700',
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: pressed || disabled ? 0.72 : 1 },
        style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon}
          <Text style={labelStyle} maxFontSizeMultiplier={2}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});

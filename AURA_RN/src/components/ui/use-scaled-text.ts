import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { useSettings } from '@/core/settings';

/** React Native's default font size when a style does not set one. */
const DEFAULT_FONT_SIZE = 14;

/**
 * Applies the user's text-size setting on top of a style. The system font
 * scale still applies as well, because `allowFontScaling` stays on.
 */
export function useScaledTextStyle(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const { textScale } = useSettings();
  if (textScale === 1) return style;
  const flat = StyleSheet.flatten(style) ?? {};
  return [
    style,
    {
      fontSize: (flat.fontSize ?? DEFAULT_FONT_SIZE) * textScale,
      ...(flat.lineHeight ? { lineHeight: flat.lineHeight * textScale } : null),
    },
  ];
}

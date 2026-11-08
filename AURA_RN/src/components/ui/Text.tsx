import { Pressable, StyleSheet, Text, View, type TextProps, type TextStyle } from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { useScaledTextStyle } from './use-scaled-text';

export function AuraText({ style, ...props }: TextProps) {
  const { colors } = useAuraTheme();
  const scaled = useScaledTextStyle(style);
  return <Text maxFontSizeMultiplier={2} {...props} style={[{ color: colors.text }, scaled]} />;
}

export function GradientText({
  children,
  style,
  numberOfLines,
}: {
  children: string;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { colors } = useAuraTheme();
  const gradient = [colors.accent, colors.accentBlue, colors.accentCyan];
  const characters = Array.from(children);
  const scaled = useScaledTextStyle(style);
  return (
    <Text numberOfLines={numberOfLines} style={scaled} accessibilityLabel={children} maxFontSizeMultiplier={2}>
      {characters.map((character, index) => (
        <Text key={index} style={{ color: colorAtPosition(gradient, index / Math.max(1, characters.length - 1)) }}>
          {character}
        </Text>
      ))}
    </Text>
  );
}

function colorAtPosition(colors: string[], position: number) {
  const segment = Math.min(colors.length - 2, Math.floor(position * (colors.length - 1)));
  const amount = position * (colors.length - 1) - segment;
  const start = colors[segment];
  const end = colors[segment + 1];
  const channel = (offset: number) => {
    const from = Number.parseInt(start.slice(offset, offset + 2), 16);
    const to = Number.parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useAuraTheme();
  return (
    <View style={styles.heading}>
      <GradientText style={styles.headingTitle}>{title}</GradientText>
      {subtitle ? <AuraText style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</AuraText> : null}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useAuraTheme();
  return (
    <View style={styles.sectionTitle}>
      <GradientText style={styles.sectionHeading}>{title}</GradientText>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <AuraText style={{ color: colors.accent, fontWeight: '700' }}>{action}</AuraText>
        </Pressable>
      ) : null}
    </View>
  );
}

export const textStyles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  heading: { gap: 6 },
  headingTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: textStyles.subtitle,
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { fontSize: 19, fontWeight: '800' },
});

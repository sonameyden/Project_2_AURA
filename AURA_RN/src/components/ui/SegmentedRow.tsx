import { Pressable, StyleSheet, View } from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { Card } from './Card';
import { AuraText } from './Text';

/** A labelled row with a choice between a few options. */
export function SegmentedRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useAuraTheme();
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ gap: 3 }}>
        <AuraText style={{ fontWeight: '600' }}>{label}</AuraText>
        {description ? <AuraText style={{ color: colors.muted, fontSize: 12 }}>{description}</AuraText> : null}
      </View>
      <View
        style={[styles.segments, { borderColor: colors.border }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label}: ${option.label}`}
              style={[styles.segment, selected && { backgroundColor: colors.accent }]}>
              <AuraText
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: selected ? '700' : '500',
                  color: selected ? '#FFFFFF' : colors.text,
                }}>
                {option.label}
              </AuraText>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});

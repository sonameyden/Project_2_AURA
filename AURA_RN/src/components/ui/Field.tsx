import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { AuraText } from './Text';
import { useScaledTextStyle } from './use-scaled-text';

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const { colors } = useAuraTheme();
  const inputStyle = useScaledTextStyle([
    styles.field,
    { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
    style,
  ]);
  return (
    <View style={styles.fieldWrap}>
      {label ? <AuraText style={[styles.fieldLabel, { color: colors.muted }]}>{label}</AuraText> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        accessibilityLabel={props.accessibilityLabel ?? label}
        maxFontSizeMultiplier={2}
        style={inputStyle}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  field: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 16,
  },
});

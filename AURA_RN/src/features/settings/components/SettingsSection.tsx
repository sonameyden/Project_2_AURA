import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { GradientText } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';

/** A titled group of settings rows. */
export function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useAuraTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="header">
        <Ionicons name={icon} size={20} color={colors.accent} />
        <GradientText style={{ fontWeight: '700' }}>{title}</GradientText>
      </View>
      {children}
    </View>
  );
}

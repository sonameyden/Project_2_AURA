import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { Card } from './Card';
import { AuraText, textStyles } from './Text';

export function EmptyState({
  title,
  description,
  icon = 'sparkles-outline',
}: {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useAuraTheme();
  return (
    <Card style={styles.emptyState}>
      <Ionicons name={icon} size={30} color={colors.accent} />
      <AuraText style={styles.emptyTitle}>{title}</AuraText>
      <AuraText style={[textStyles.subtitle, { color: colors.muted, textAlign: 'center' }]}>{description}</AuraText>
    </Card>
  );
}

export function LoadingState({ label = 'Finding your atmosphere…' }: { label?: string }) {
  const { colors } = useAuraTheme();
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.accent} />
      <AuraText style={{ color: colors.muted }}>{label}</AuraText>
    </View>
  );
}

export function ErrorMessage({
  message,
  onRetry,
  actionLabel = 'Retry',
}: {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}) {
  const { colors } = useAuraTheme();
  return (
    <Card style={styles.errorCard}>
      <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
      <AuraText style={{ color: colors.danger, flex: 1 }} accessibilityLiveRegion="polite">
        {message}
      </AuraText>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <AuraText style={{ color: colors.accent, fontWeight: '700' }}>{actionLabel}</AuraText>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorCard: { flexDirection: 'row', alignItems: 'center' },
});

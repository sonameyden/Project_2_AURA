import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AuraText, SectionTitle } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';
import type { SearchHistoryEntry } from '@/core/types';

/** Recent searches shown when the search box is empty; each query appears once. */
export function RecentSearches({
  entries,
  onSelect,
  onDelete,
  onClear,
}: {
  entries: SearchHistoryEntry[];
  onSelect: (entry: SearchHistoryEntry) => void;
  onDelete: (entry: SearchHistoryEntry) => void;
  onClear: () => void;
}) {
  const { colors } = useAuraTheme();
  if (!entries.length) return null;
  // The same query is stored once per result tapped; show each query once.
  const unique = entries.filter((entry, index) => entries.findIndex((other) => other.query === entry.query) === index);
  return (
    <View style={{ gap: 6 }}>
      <SectionTitle title="Recent searches" action="Clear all" onAction={onClear} />
      {unique.slice(0, 8).map((entry) => (
        <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => onSelect(entry)}
            accessibilityRole="button"
            accessibilityLabel={`Search again for ${entry.query}`}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <Ionicons name="time-outline" size={18} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <AuraText numberOfLines={1}>{entry.query}</AuraText>
              {entry.result_title ? (
                <AuraText numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                  {entry.result_title}
                </AuraText>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => onDelete(entry)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${entry.query} from recent searches`}
            hitSlop={10}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Artwork, AuraText } from '@/components/ui';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';

export function QueueSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAuraTheme();
  const { queue, queueIndex, playQueueIndex } = usePlayer();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close queue" />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <AuraText style={{ fontSize: 22, fontWeight: '700' }}>Up Next</AuraText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close queue" hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            initialScrollIndex={queue.length > 0 ? Math.min(queueIndex, queue.length - 1) : undefined}
            getItemLayout={(_, index) => ({ length: 66, offset: 66 * index, index })}
            renderItem={({ item, index }) => {
              const current = index === queueIndex;
              return (
                <Pressable
                  onPress={() => {
                    onClose();
                    if (!current) void playQueueIndex(index);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} by ${item.artistName}${current ? ', now playing' : ''}`}
                  style={[styles.row, { backgroundColor: current ? colors.elevated : 'transparent' }]}>
                  <AuraText style={{ width: 20, color: colors.muted }}>{index + 1}</AuraText>
                  <Artwork uri={item.artworkUrl} size={40} rounded={10} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AuraText numberOfLines={1} style={{ fontWeight: '700' }}>
                      {item.title}
                    </AuraText>
                    <AuraText numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                      {item.artistName}
                    </AuraText>
                  </View>
                  {current ? <Ionicons name="volume-high" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '72%',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  row: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, borderRadius: 12 },
});

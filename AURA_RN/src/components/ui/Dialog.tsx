import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAuraTheme } from '@/core/theme';

import { AuraText } from './Text';

/** Same shape as React Native's Alert buttons, so `showAlert` is a drop-in replacement for `Alert.alert`. */
export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type DialogRequest = { id: number; title: string; message?: string; buttons: DialogButton[] };

let nextId = 0;
let enqueue: ((request: DialogRequest) => void) | null = null;

/**
 * Shows a dialog in AURA's own colours instead of the phone's system popup.
 * Takes the same arguments as `Alert.alert(title, message, buttons)`.
 * Dialogs queue: one opened from another's button appears after it closes.
 */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]) {
  const request: DialogRequest = {
    id: (nextId += 1),
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK' }],
  };
  // Before the host has mounted (very early in start-up), fall back to the system dialog.
  if (enqueue) enqueue(request);
  else Alert.alert(title, message, buttons);
}

/** Renders queued dialogs. Mounted once at the app root. */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    enqueue = (request) => setQueue((current) => [...current, request]);
    return () => {
      enqueue = null;
    };
  }, []);

  const current = queue[0];
  const close = (button?: DialogButton) => {
    setQueue((items) => items.slice(1));
    // Run the action after this dialog is removed, so a follow-up dialog queues behind it.
    if (button?.onPress) setTimeout(button.onPress, 0);
  };

  return (
    <Modal
      visible={Boolean(current)}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android's back button acts like Cancel (or the only button), as with system dialogs.
      onRequestClose={() => close(current?.buttons.find((button) => button.style === 'cancel') ?? (current?.buttons.length === 1 ? current.buttons[0] : undefined))}>
      {current ? <DialogCard key={current.id} request={current} onClose={close} /> : null}
    </Modal>
  );
}

function DialogCard({ request, onClose }: { request: DialogRequest; onClose: (button?: DialogButton) => void }) {
  const { colors, mode } = useAuraTheme();
  // Two buttons sit side by side (cancel first); three or more stack like an action menu, cancel last.
  const stacked = request.buttons.length > 2;
  const cancel = request.buttons.filter((button) => button.style === 'cancel');
  const others = request.buttons.filter((button) => button.style !== 'cancel');
  const ordered = stacked ? [...others, ...cancel] : [...cancel, ...others];

  return (
    <View style={styles.backdrop}>
      <View
        accessibilityViewIsModal
        accessibilityRole="alert"
        style={[
          styles.card,
          {
            backgroundColor: mode === 'dark' ? '#1C1A2E' : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}>
        <AuraText style={[styles.title, { color: colors.text }]}>{request.title}</AuraText>
        {request.message ? <AuraText style={[styles.message, { color: colors.muted }]}>{request.message}</AuraText> : null}
        <View style={[styles.buttons, stacked ? styles.stacked : styles.row]}>
          {ordered.map((button) => {
            const destructive = button.style === 'destructive';
            const isCancel = button.style === 'cancel';
            const primary = !isCancel && !destructive && ordered.length <= 2;
            return (
              <Pressable
                key={button.text}
                onPress={() => onClose(button)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  !stacked && { flex: 1 },
                  {
                    backgroundColor: destructive
                      ? colors.danger
                      : primary
                        ? colors.accent
                        : mode === 'dark'
                          ? '#FFFFFF14'
                          : '#1C192510',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <AuraText
                  style={{
                    fontWeight: '700',
                    fontSize: 15,
                    textAlign: 'center',
                    color: destructive || primary ? '#FFFFFF' : colors.text,
                  }}>
                  {button.text}
                </AuraText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#00000099' },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  title: { fontSize: 18, fontWeight: '800' },
  message: { fontSize: 14, lineHeight: 20 },
  buttons: { marginTop: 10, gap: 10 },
  row: { flexDirection: 'row' },
  stacked: { flexDirection: 'column' },
  button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});

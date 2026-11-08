import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useAuraTheme } from '@/core/theme';

export function Page({
  children,
  scroll = true,
  style,
  transparent = false,
  safeAreaEdges = ['top'],
}: PropsWithChildren<{
  scroll?: boolean;
  style?: ViewStyle;
  transparent?: boolean;
  safeAreaEdges?: Edge[];
}>) {
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.pageContent, style]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.pageContent, styles.fill, style]}>{children}</View>
  );

  return (
    <PageFrame transparent={transparent} safeAreaEdges={safeAreaEdges}>
      {content}
    </PageFrame>
  );
}

/**
 * A `Page` whose main content is a list that can grow long (a playlist's or
 * album's songs, an artist's songs, your playlists). Backed by a `FlatList`, so
 * only the rows on screen are rendered. Content above the list goes in
 * `header`, content below it in `footer`; spacing and padding match `Page`.
 */
export function PageList<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  footer,
  extraData,
  itemSpacing,
  style,
  transparent = false,
  safeAreaEdges = ['top'],
}: {
  data: readonly T[];
  /** Anything else the rows depend on (e.g. edit mode, the playing song): rows re-render when it changes. */
  extraData?: unknown;
  /** Space between rows; defaults to the page's gap (20). */
  itemSpacing?: number;
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  header?: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
  transparent?: boolean;
  safeAreaEdges?: Edge[];
}) {
  const gap = Number(style?.gap ?? styles.pageContent.gap);
  const rowGap = itemSpacing ?? gap;
  return (
    <PageFrame transparent={transparent} safeAreaEdges={safeAreaEdges}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={extraData}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        // Spacing is applied explicitly (header, rows, footer) so rows can sit closer than sections.
        contentContainerStyle={[styles.pageContent, style, { gap: 0 }]}
        ListHeaderComponent={
          header ? <View style={{ gap, marginBottom: data.length ? gap : 0 }}>{header}</View> : undefined
        }
        ItemSeparatorComponent={() => <View style={{ height: rowGap }} />}
        ListFooterComponent={footer ? <View style={{ gap, marginTop: gap }}>{footer}</View> : undefined}
      />
    </PageFrame>
  );
}

/** Safe area, background and keyboard handling shared by `Page` and `PageList`. */
function PageFrame({
  children,
  transparent,
  safeAreaEdges,
}: PropsWithChildren<{ transparent: boolean; safeAreaEdges: Edge[] }>) {
  const { colors, mode } = useAuraTheme();
  return (
    <SafeAreaView
      style={[styles.page, { backgroundColor: transparent ? 'transparent' : colors.background }]}
      edges={safeAreaEdges}>
      <View style={styles.fill}>
        {!transparent ? <AmbientBackground light={mode === 'light'} /> : null}
        {/* Leaves room for the keyboard. With Android's edge-to-edge layout the window no longer
            resizes for the keyboard on its own, so fields near the bottom would be covered. */}
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          {children}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

function AmbientBackground({ light }: { light: boolean }) {
  const colors = light
    ? ([
        ['#F3E8FF99', '#F3E8FF00'],
        ['#E0F2FE80', '#E0F2FE00'],
        ['#FEF3C766', '#FEF3C700'],
      ] as const)
    : ([
        ['#1A183066', '#1A183000'],
        ['#13383B55', '#13383B00'],
        ['#6366F122', '#6366F100'],
      ] as const);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={colors[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '58%' }}
      />
      <LinearGradient
        colors={colors[1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, width: '76%', height: '72%' }}
      />
      <LinearGradient
        colors={colors[2]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', bottom: 0, left: 0, width: '88%', height: '46%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  // Bottom padding leaves room for the floating mini-player and tab bar.
  pageContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 132, gap: 20 },
  fill: { flex: 1 },
});

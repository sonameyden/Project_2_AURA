import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuraTheme } from '@/core/theme';

export default function MainTabs() {
  const { colors } = useAuraTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          // Switching tabs crossfades instead of cutting, over the app's own background.
          animation: 'fade',
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: 'transparent',
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 32,
            marginHorizontal: 16,
            marginBottom: 8 + insets.bottom,
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={String(color)} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}

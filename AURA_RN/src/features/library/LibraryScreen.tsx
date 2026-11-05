import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AuraText, Card, Heading, Page } from '@/components/ui';
import { useAuraTheme } from '@/core/theme';

export default function LibraryScreenFeature() {
  const router = useRouter();
  const { colors } = useAuraTheme();

  const items = [
    { title: 'Liked Songs', icon: 'heart', route: '/liked' },
    { title: 'Playlists', icon: 'list', route: '/playlists' },
    { title: 'History', icon: 'time', route: '/history' },
  ] as const;

  return (
    <Page style={{ gap: 16 }}>
      <Heading title="Library" />
      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <Pressable key={item.title} onPress={() => router.push(item.route)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
              <Ionicons name={item.icon} size={24} color={colors.accent} />
              <AuraText style={{ marginLeft: 16, fontWeight: '600' }}>{item.title}</AuraText>
            </Card>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}

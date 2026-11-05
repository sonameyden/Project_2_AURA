import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import {
  AuraText,
  ErrorMessage,
  Field,
  GradientText,
  Page,
  TrackRow,
} from '@/components/ui';
import { auraApi } from '@/core/api';
import { useAuth } from '@/core/auth-context';
import { usePlayer } from '@/core/player';
import { useAuraTheme } from '@/core/theme';
import type { MoodResponse } from '@/core/types';
import { useAuraQuery } from '@/core/use-aura-query';

const suggestions = ['Worry (Ultra Slowed)', 'Something hopeful', 'A quiet moment'];

export default function MoodScreenFeature() {
  const router = useRouter();
  const { colors, mode } = useAuraTheme();
  const { getToken } = useAuth();
  const { playSong } = usePlayer();
  const [mood, setMood] = useState('');
  const [response, setResponse] = useState<MoodResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const historyQuery = useAuraQuery(['library', 'history'], (token) => auraApi.history(token));

  const discover = async () => {
    if (!mood.trim()) {
      Alert.alert('Describe your mood', 'Write a little about how you feel to get started.');
      return;
    }
    setWorking(true);
    setError(null);
    setResponse(null);
    try {
      const token = await getToken();
      // Recent plays let the backend suggest something you haven't just heard.
      const recentIds = [...new Set((historyQuery.data ?? []).map((song) => song.id))].slice(0, 20);
      const result = await auraApi.mood(token, mood.trim(), recentIds);
      setResponse(result);
      if (result.mode === 'direct_play' && result.song) {
        await playSong(result.song, result.songs, result.atmosphereProfile);
        router.replace('/now-playing');
      }
    } catch (discoverError) {
      setError(discoverError instanceof Error ? discoverError.message : 'Mood discovery failed.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Page style={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, gap: 0 }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: mode === 'light' ? '#0000000D' : '#FFFFFF1A',
        }}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <View style={{ alignItems: 'center', marginTop: 36, marginBottom: 30 }}>
        <GradientText
          style={{
            fontSize: 28,
            lineHeight: 36,
            fontWeight: '700',
            textAlign: 'center',
          }}>
          How are you feeling?
        </GradientText>
        <AuraText
          style={{
            color: mode === 'light' ? '#77717A' : '#FFFFFFB3',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 8,
          }}>
          AURA&apos;s AI will find the perfect world for you.
        </AuraText>
      </View>

      <Field
        value={mood}
        onChangeText={setMood}
        placeholder="I feel lonely and peaceful..."
        multiline
        maxLength={500}
        accessibilityLabel="Describe how you feel"
        style={{
          minHeight: 132,
          textAlignVertical: 'top',
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: mode === 'light' ? '#0000001A' : '#FFFFFF4D',
          backgroundColor: 'transparent',
        }}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 20 }}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => setMood(suggestion)}
            accessibilityRole="button"
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.surface,
            }}>
            <AuraText style={{ color: colors.muted, fontSize: 12 }}>{suggestion}</AuraText>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => void discover()}
        disabled={working}
        accessibilityRole="button"
        accessibilityLabel={working ? 'AURA is thinking' : 'Discover my world'}
        style={({ pressed }) => ({
          height: 56,
          borderRadius: 16,
          overflow: 'hidden',
          opacity: pressed || working ? 0.78 : 1,
          shadowColor: colors.accent,
          shadowOpacity: mode === 'light' ? 0.3 : 0,
          shadowRadius: 8,
          elevation: mode === 'light' ? 4 : 0,
        })}>
        <LinearGradient
          colors={[colors.accent, colors.accentBlue, colors.accentCyan]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {working ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <AuraText style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>AI is thinking...</AuraText>
            </>
          ) : (
            <>
              <AuraText style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>Discover my world</AuraText>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </LinearGradient>
      </Pressable>

      {error ? (
        <View style={{ marginTop: 16 }}>
          <ErrorMessage message={error} />
        </View>
      ) : null}
      {response && response.mode === 'recommendations' ? (
        <View style={{ gap: 10, paddingTop: 30, paddingBottom: 24 }}>
          <AuraText style={{ color: colors.text, fontSize: 16, fontStyle: 'italic', marginBottom: 4 }}>
            {response.reply}
          </AuraText>
          <AuraText style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>
            Try these environments:
          </AuraText>
          {response.songs.map((song) => (
            <TrackRow
              key={song.id}
              song={song}
              onPress={() => {
                void playSong(song, response.songs, response.atmosphereProfile).then(() =>
                  router.replace('/now-playing'),
                );
              }}
            />
          ))}
        </View>
      ) : null}
    </Page>
  );
}

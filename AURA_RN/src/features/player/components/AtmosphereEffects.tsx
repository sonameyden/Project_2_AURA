import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useVisualTier } from '@/core/settings';
import type { AtmosphereProfile } from '@/core/types';

import { isHexColor as isColor } from '../lib/visual-utils';

type EffectKind = 'leaf' | 'petal' | 'mote' | 'star' | 'bubble' | 'rain' | 'spark';

const effectByEnvironment: Record<AtmosphereProfile['environment'], EffectKind> = {
  Heaven: 'mote',
  Nature: 'leaf',
  Ocean: 'bubble',
  Dream: 'star',
  Romantic: 'petal',
  Melancholic: 'rain',
  Hopeful: 'mote',
  Energetic: 'spark',
};

const effectColors: Record<EffectKind, string> = {
  leaf: '#A8C77A',
  petal: '#F3A5C0',
  mote: '#FFF1B0',
  star: '#E8E6FF',
  bubble: '#B9F4FF',
  rain: '#A7B8E8',
  spark: '#FFD18D',
};

export function AtmosphereEffects({ atmosphere, playing }: { atmosphere: AtmosphereProfile | null; playing: boolean }) {
  const { height } = useWindowDimensions();
  const environment = atmosphere?.environment ?? 'Nature';
  const kind = atmosphere ? effectByEnvironment[environment] : 'mote';
  const energy = Math.max(0, Math.min(1, atmosphere?.energy ?? 0.35));
  const { particleCount } = useVisualTier();
  // Counts were tuned for the Medium tier (28 kaleidoscope particles).
  const count = Math.round(
    (kind === 'star' ? 22 : kind === 'leaf' || kind === 'petal' ? 14 : 16) * (particleCount / 28),
  );
  const colors = atmosphere?.secondaryColorHexes ?? [];
  const tint = isColor(atmosphere?.primaryColorHex) ? atmosphere.primaryColorHex : effectColors[kind];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {environment === 'Heaven' || environment === 'Hopeful' ? <LightRays color={tint} energy={energy} /> : null}
      {environment === 'Nature'
        ? Array.from({ length: 7 }, (_, index) => (
            <AtmosphereParticle
              key={`firefly-${index}`}
              index={index + 17}
              kind="mote"
              tint="#DCEDC8"
              height={height}
              energy={energy}
              playing={playing}
              grounded
            />
          ))
        : null}
      {environment === 'Dream'
        ? Array.from({ length: 5 }, (_, index) => (
            <AtmosphereParticle
              key={`dream-orb-${index}`}
              index={index + 23}
              kind="bubble"
              tint={index % 2 ? '#E6D8FF' : '#C9E9FF'}
              height={height}
              energy={energy}
              playing={playing}
            />
          ))
        : null}
      {kind === 'spark' ? <EnergyRings color={tint} energy={energy} playing={playing} /> : null}
      {Array.from({ length: count }, (_, index) => (
        <AtmosphereParticle
          key={`${environment}-${index}`}
          index={index}
          kind={kind}
          tint={
            index % 4 === 0 && isColor(colors[index % Math.max(colors.length, 1)])
              ? colors[index % colors.length]
              : effectColors[kind]
          }
          height={height}
          energy={energy}
          playing={playing}
        />
      ))}
    </View>
  );
}

function AtmosphereParticle({
  index,
  kind,
  tint,
  height,
  energy,
  playing,
  grounded = false,
}: {
  index: number;
  kind: EffectKind;
  tint: string;
  height: number;
  energy: number;
  playing: boolean;
  grounded?: boolean;
}) {
  const [progress] = useState(() => new Animated.Value((index % 7) / 7));
  const { motion } = useVisualTier();
  // Reduced motion slows particles to a gentle drift instead of stopping them.
  const duration = Math.round(((kind === 'rain' ? 1700 : 6500) - energy * (kind === 'rain' ? 500 : 2400)) / motion);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: playing ? duration : duration * 1.6,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [duration, playing, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: kind === 'rain' ? [-height * 0.16, height * 1.15] : [-height * 0.18, height * 0.8],
  });
  const drift = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-18, 20, -12],
  });
  const rotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-35deg', '325deg'],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.88, 1],
    outputRange: [0, kind === 'star' ? 0.72 : 0.52, 0.52, 0],
  });
  const left = `${((index * 47 + 11) % 94) + 3}%`;
  const top = grounded ? `${((index * 9 + 2) % 25) + 68}%` : `${((index * 31 + 9) % 68) + 4}%`;
  const size = kind === 'leaf' || kind === 'petal' ? 20 + (index % 3) * 4 : 5 + (index % 3) * 2;

  if (kind === 'bubble') {
    return (
      <Animated.View
        style={[
          styles.particle,
          {
            left,
            top,
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            borderWidth: 1,
            borderColor: tint,
            transform: [{ translateY }, { translateX: drift }],
            opacity,
          },
        ]}
      />
    );
  }

  if (kind === 'leaf' || kind === 'petal') {
    return (
      <Animated.View
        style={[
          styles.particle,
          {
            left,
            top,
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateY }, { translateX: drift }, { rotate: rotation }],
            opacity,
          },
        ]}>
        <Ionicons name={kind === 'leaf' ? 'leaf' : 'flower'} size={size} color={tint} />
      </Animated.View>
    );
  }

  if (kind === 'rain') {
    return (
      <Animated.View
        style={[
          styles.particle,
          {
            left,
            top,
            transform: [{ translateY }, { translateX: drift }, { rotate: '16deg' }],
            opacity,
          },
        ]}>
        <Ionicons name="water" size={size + 5} color={tint} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left,
          top,
          width: size + 8,
          height: size + 8,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateY }, { translateX: drift }, { rotate: rotation }],
          opacity,
        },
      ]}>
      {kind === 'star' ? (
        <Ionicons name="sparkles" size={size + 6} color={tint} />
      ) : kind === 'spark' ? (
        <MaterialCommunityIcons name="lightning-bolt" size={size + 5} color={tint} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size, backgroundColor: tint }} />
      )}
    </Animated.View>
  );
}

function LightRays({ color, energy }: { color: string; energy: number }) {
  const rayColors: [string, string] = [`${color}${Math.round(20 + energy * 18).toString(16)}`, `${color}00`];
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: '8%',
        left: '8%',
        right: '8%',
        height: '72%',
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        opacity: 0.55,
      }}>
      {[-22, -14, -7, 0, 7, 14, 22].map((angle) => (
        <LinearGradient
          key={angle}
          colors={rayColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            width: 10,
            height: '100%',
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      ))}
    </View>
  );
}

function EnergyRings({ color, energy, playing }: { color: string; energy: number; playing: boolean }) {
  const [rotation] = useState(() => new Animated.Value(0));
  const { motion } = useVisualTier();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: Math.round((6000 - energy * 2000) / motion),
        useNativeDriver: true,
      }),
    );
    if (playing) animation.start();
    else rotation.stopAnimation();
    return () => animation.stop();
  }, [energy, motion, playing, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[0, 1, 2, 3].map((index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: `${18 + index * 8}%`,
            top: `${24 + index * 6}%`,
            width: `${64 - index * 16}%`,
            height: `${52 - index * 12}%`,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.16 + energy * 0.1,
            transform: [
              {
                rotate:
                  index % 2 ? rotate : rotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }),
              },
            ],
          }}>
          <MaterialCommunityIcons name="hexagon-outline" size={230 - index * 36} color={color} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
  },
});

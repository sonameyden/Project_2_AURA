import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';

type DisplayedLyric = { id: string; text: string; resonant: boolean };

/**
 * Current lyric line with a fade/slide between lines. Resonant lines (picked by
 * the atmosphere engine for the listener's mood) are larger, bold, glow and
 * gently pulse. Under reduced motion lines still fade, but don't slide or pulse.
 */
export function LyricsOverlay({
  lineId,
  text,
  resonant,
  reducedMotion = false,
  fontScale = 1,
}: {
  lineId: string | null;
  text: string;
  resonant: boolean;
  reducedMotion?: boolean;
  fontScale?: number;
}) {
  const [shownLine, setShownLine] = useState<DisplayedLyric | null>(null);
  const shownLineRef = useRef<DisplayedLyric | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(10));
  const [scale] = useState(() => new Animated.Value(1));
  // Reduced motion keeps the fade (it isn't movement) and drops the slide.
  const duration = reducedMotion ? 260 : 200;
  const slide = reducedMotion ? 0 : 10;

  useEffect(() => {
    if (shownLineRef.current?.id === lineId) {
      if (shownLineRef.current && shownLineRef.current.resonant !== resonant) {
        const updatedLine = { ...shownLineRef.current, resonant };
        shownLineRef.current = updatedLine;
        setShownLine(updatedLine);
      }
      return;
    }

    let active = true;
    const fadeOut = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -slide, duration, useNativeDriver: true }),
    ]);
    fadeOut.start(({ finished }) => {
      if (!finished || !active) return;
      const nextLine: DisplayedLyric | null = lineId === null ? null : { id: lineId, text, resonant };
      shownLineRef.current = nextLine;
      setShownLine(nextLine);
      if (!nextLine) return;
      translateY.setValue(slide);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
      ]).start();
    });

    return () => {
      active = false;
      fadeOut.stop();
    };
  }, [duration, lineId, opacity, resonant, slide, text, translateY]);

  useEffect(() => {
    if (!shownLine?.resonant || reducedMotion) {
      scale.stopAnimation();
      scale.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [reducedMotion, scale, shownLine?.id, shownLine?.resonant]);

  return (
    <View style={{ minHeight: 50 * fontScale, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite">
      {shownLine ? (
        <Animated.Text
          numberOfLines={3}
          accessibilityLabel={shownLine.resonant ? `Highlighted lyric: ${shownLine.text}` : shownLine.text}
          style={{
            width: '100%',
            color: '#FFFFFF',
            textAlign: 'center',
            fontSize: (shownLine.resonant ? 22 : 19) * fontScale,
            lineHeight: (shownLine.resonant ? 30 : 26) * fontScale,
            fontWeight: shownLine.resonant ? '700' : '500',
            opacity,
            transform: [{ translateY }, { scale }],
            textShadowColor: shownLine.resonant ? '#FFFFFFA0' : '#00000080',
            textShadowRadius: shownLine.resonant ? 12 : 4,
          }}>
          {shownLine.text}
        </Animated.Text>
      ) : null}
    </View>
  );
}

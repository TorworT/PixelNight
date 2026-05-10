import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

const RAINBOW_COLORS = [
  '#f97316', '#ef4444', '#eab308', '#22c55e',
  '#3b82f6', '#a855f7', '#ec4899',
];

function getFlameColor(serie: number): string {
  if (serie >= 30) return '#fbbf24'; // gold (overridden by rainbow cycling)
  if (serie >= 7)  return '#ef4444'; // red
  return '#f97316';                  // orange
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  serie: number;
  /** true = grande version (ProfileScreen), false = compacte (header GameScreen) */
  large?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FlameStreak({ serie, large = false }: Props) {
  const anim         = useRef(new Animated.Value(1)).current;
  const loopRef      = useRef<Animated.CompositeAnimation | null>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rainbowIdx, setRainbowIdx] = useState(0);

  // ── Pulse animation ────────────────────────────────────────────────────────
  useEffect(() => {
    loopRef.current?.stop();
    anim.setValue(1);

    if (serie < 3) return;

    const intensity = serie >= 30 ? 1.20 : serie >= 7 ? 1.14 : 1.08;

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: intensity, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,         duration: 550, useNativeDriver: true }),
      ]),
    );
    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
    };
  }, [serie]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rainbow cycling for 30+ days ──────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (serie < 30) return;

    intervalRef.current = setInterval(() => {
      setRainbowIdx((i) => (i + 1) % RAINBOW_COLORS.length);
    }, 400);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [serie]);

  if (serie < 3) return null;

  const color     = serie >= 30 ? RAINBOW_COLORS[rainbowIdx] : getFlameColor(serie);
  const flameSize = large ? 38 : 20;
  const numSize   = large ? 34 : 16;

  return (
    <View style={[styles.container, large && styles.containerLarge]}>
      <Animated.Text
        style={[
          styles.flame,
          { fontSize: flameSize, transform: [{ scale: anim }] },
        ]}
      >
        🔥
      </Animated.Text>
      <View style={styles.textCol}>
        <Text style={[styles.num, { fontSize: numSize, color }]}>
          {serie}
        </Text>
        {large && (
          <Text style={[styles.label, { color }]}>jours</Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  containerLarge: {
    gap: 10,
  },
  flame: {
    // lineHeight intentionally unset — let the OS decide per platform
  },
  textCol: {
    alignItems: 'flex-start',
  },
  num: {
    fontWeight: '900',
    lineHeight: 36,
  },
  label: {
    fontSize:   11,
    fontWeight: '600',
    marginTop:  -4,
    lineHeight: 14,
  },
});

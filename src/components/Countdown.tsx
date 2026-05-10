import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { msUntilReset } from '../utils/dateUtils';

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Countdown() {
  const [ms, setMs] = useState<number>(msUntilReset);
  const pulse = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;

  // Tick chaque seconde
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilReset()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pulse douce sur le bloc
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clignotement des ":" pour effet horloge pixel
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const parts = formatMs(ms).split(':'); // ['HH', 'MM', 'SS']

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
        <Text style={styles.label}>Prochain jeu dans</Text>
      </View>

      <Animated.View style={[styles.timerBox, { transform: [{ scale: pulse }] }]}>
        {/* HH */}
        <Text style={styles.digit}>{parts[0]}</Text>
        <Animated.Text style={[styles.sep, { opacity: dotOpacity }]}>:</Animated.Text>
        {/* MM */}
        <Text style={styles.digit}>{parts[1]}</Text>
        <Animated.Text style={[styles.sep, { opacity: dotOpacity }]}>:</Animated.Text>
        {/* SS */}
        <Text style={[styles.digit, styles.digitSec]}>{parts[2]}</Text>
      </Animated.View>

      <Text style={styles.sub}>Nouveau jeu chaque jour à 7h</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.accent + '50',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  digit: {
    color: COLORS.accent,
    fontSize: FONTS.size.xxl,
    fontWeight: FONTS.weight.black,
    fontFamily: 'monospace',
    letterSpacing: 2,
    minWidth: 38,
    textAlign: 'center',
  },
  digitSec: {
    // les secondes en légèrement plus discret
    opacity: 0.8,
  },
  sep: {
    color: COLORS.accent,
    fontSize: FONTS.size.xxl,
    fontWeight: FONTS.weight.black,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  sub: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontStyle: 'italic',
  },
});

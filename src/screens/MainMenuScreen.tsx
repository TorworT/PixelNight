import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useStreak } from '../hooks/useStreak';
import { PixelCorner } from '../components/PixelCorner';
import { getDisplayDate } from '../utils/dateUtils';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthContext';
import type { ThemeColors } from '../constants/appearances';

interface Props {
  onPlay: () => void;
}

const { width: W } = Dimensions.get('window');

// ─── Background pixel grid ────────────────────────────────────────────────────

function PixelGrid() {
  const CELL = 28;
  const cols = Math.ceil(W / CELL) + 1;
  // Fixed row count for perf (no dynamic height needed)
  const rows = 36;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: cols }, (_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            left: i * CELL,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.025)',
          }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            top: i * CELL,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.025)',
          }}
        />
      ))}
    </View>
  );
}

// ─── Streak stat block ────────────────────────────────────────────────────────

function createStreakStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      width: '100%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    half: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      gap: 2,
    },
    divider: {
      width: 1,
      backgroundColor: colors.border,
      marginVertical: SPACING.sm,
    },
    fire: { fontSize: 22 },
    trophy: { fontSize: 22 },
    count: {
      color: colors.text,
      fontSize: FONTS.size.xxl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      lineHeight: 30,
    },
    label: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      textAlign: 'center',
    },
  });
}

function StreakBlock({ streak, bestStreak }: { streak: number; bestStreak: number }) {
  const { colors, fontFamily } = useTheme();
  const streak_s = useMemo(() => createStreakStyles(colors, fontFamily), [colors, fontFamily]);

  return (
    <View style={streak_s.container}>
      {/* Left — current streak */}
      <View style={streak_s.half}>
        <Text style={streak_s.fire}>🔥</Text>
        <Text style={streak_s.count}>{streak}</Text>
        <Text style={streak_s.label}>
          {streak <= 1 ? 'jour de suite' : 'jours de suite'}
        </Text>
      </View>

      <View style={streak_s.divider} />

      {/* Right — best streak */}
      <View style={streak_s.half}>
        <Text style={streak_s.trophy}>🏆</Text>
        <Text style={streak_s.count}>{bestStreak}</Text>
        <Text style={streak_s.label}>meilleur record</Text>
      </View>
    </View>
  );
}

// ─── Main styles factory ──────────────────────────────────────────────────────

const CORNER_OFFSET = SPACING.xl;

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.xxl,
    },

    // CRT scan-line
    scanline: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 80,
      backgroundColor: 'rgba(255,255,255,0.025)',
    },

    // Corner brackets
    cornerTL: { position: 'absolute', top: CORNER_OFFSET,     left: CORNER_OFFSET },
    cornerTR: { position: 'absolute', top: CORNER_OFFSET,     right: CORNER_OFFSET },
    cornerBL: { position: 'absolute', bottom: CORNER_OFFSET,  left: CORNER_OFFSET },
    cornerBR: { position: 'absolute', bottom: CORNER_OFFSET,  right: CORNER_OFFSET },

    // Center column
    center: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.lg,
    },

    // Logo
    logoArea: {
      alignItems: 'center',
      width: '100%',
      paddingVertical: SPACING.md,
    },
    glow: {
      position: 'absolute',
      width: '90%',
      height: 120,
      backgroundColor: colors.accent,
      borderRadius: 9999,
      // Android elevation for colored glow simulation
      top: '50%',
      marginTop: -60,
      elevation: 0,
      // Layered opacity does the trick
    },
    logoDeco: {
      width: '75%',
      height: 3,
      backgroundColor: colors.accent,
    },
    logoDecoTop:    { marginBottom: SPACING.xs },
    logoDecoBottom: { marginTop: SPACING.xs },

    wordPIXEL: {
      color: colors.text,
      fontSize: 56,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 10,
      lineHeight: 64,
      textShadowColor: colors.accent,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    wordNIGHT: {
      color: colors.accent,
      fontSize: 56,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 10,
      lineHeight: 64,
      textShadowColor: colors.accent,
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 8,
    },

    // Subtitle
    subtitle: {
      color: colors.textSecondary,
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 3,
      textAlign: 'center',
    },
    cursor: {
      color: colors.accent,
    },

    // Date
    date: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      textTransform: 'capitalize',
      letterSpacing: 1,
    },

    // JOUER button
    playWrapper: { width: '100%' },
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
      backgroundColor: colors.accent,
      borderRadius: 2,
      paddingVertical: SPACING.lg,
      // Sharp "pixel" border effect
      borderWidth: 2,
      borderColor: '#ff6b85',
      borderBottomColor: '#9e1a2e',
      borderRightColor: '#9e1a2e',
    },
    btnDot: {
      position: 'absolute',
      width: 6,
      height: 6,
      backgroundColor: colors.background,
    },
    playText: {
      color: colors.text,
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 6,
    },

    // Sign-out button — inline, below JOUER
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.xs,
    },
    signOutText: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      fontFamily: ff ?? 'monospace',
    },

    // Bottom bar
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    bottomDot: {
      width: 4,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    bottomText: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
    },
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function MainMenuScreen({ onPlay }: Props) {
  const { streak, bestStreak } = useStreak();
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const { session, isGuest, signOut } = useAuthContext();

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // ── Animation refs ──────────────────────────────────────────────────────────
  const pixelX    = useRef(new Animated.Value(-70)).current;
  const nightX    = useRef(new Animated.Value(70)).current;
  const pixelOp   = useRef(new Animated.Value(0)).current;
  const nightOp   = useRef(new Animated.Value(0)).current;
  const contentOp = useRef(new Animated.Value(0)).current;
  const cornerOp  = useRef(new Animated.Value(0)).current;
  const playScale = useRef(new Animated.Value(1)).current;
  const glowOp    = useRef(new Animated.Value(0.15)).current;
  const scanlineY = useRef(new Animated.Value(-80)).current;

  // Blinking cursor
  const [cursor, setCursor] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  // ── Intro sequence ──────────────────────────────────────────────────────────
  useEffect(() => {
    const ease = Easing.out(Easing.quad);

    Animated.sequence([
      Animated.delay(250),

      // "PIXEL" slides in from left
      Animated.parallel([
        Animated.timing(pixelX,  { toValue: 0, duration: 480, easing: ease, useNativeDriver: true }),
        Animated.timing(pixelOp, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),

      Animated.delay(80),

      // "NIGHT" slides in from right
      Animated.parallel([
        Animated.timing(nightX,  { toValue: 0, duration: 480, easing: ease, useNativeDriver: true }),
        Animated.timing(nightOp, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),

      Animated.delay(280),

      // Corners + content fade in
      Animated.parallel([
        Animated.timing(contentOp, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(cornerOp,  { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Pulse the play button
      Animated.loop(
        Animated.sequence([
          Animated.timing(playScale, { toValue: 1.045, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(playScale, { toValue: 1,     duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ).start();

      // Breathe the logo glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOp, { toValue: 0.4, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.12, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ).start();

      // Scan-line sweep
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanlineY, { toValue: 1000, duration: 4500, easing: Easing.linear, useNativeDriver: true }),
          Animated.delay(800),
          Animated.timing(scanlineY, { toValue: -80, duration: 0, useNativeDriver: true }),
          Animated.delay(600),
        ]),
      ).start();
    });
  }, [pixelX, nightX, pixelOp, nightOp, contentOp, cornerOp, playScale, glowOp, scanlineY]);

  // ── Play handler ────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(playScale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.timing(playScale, { toValue: 1,    duration: 90, useNativeDriver: true }),
    ]).start(() => onPlay());
  }, [onPlay, playScale]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Subtle pixel grid */}
      <PixelGrid />

      {/* CRT scan-line sweep */}
      <Animated.View
        style={[styles.scanline, { transform: [{ translateY: scanlineY }] }]}
        pointerEvents="none"
      />

      {/* Corner brackets — appear after intro */}
      <Animated.View style={[styles.cornerTL, { opacity: cornerOp }]}>
        <PixelCorner position="tl" size={32} thickness={3} />
      </Animated.View>
      <Animated.View style={[styles.cornerTR, { opacity: cornerOp }]}>
        <PixelCorner position="tr" size={32} thickness={3} />
      </Animated.View>
      <Animated.View style={[styles.cornerBL, { opacity: cornerOp }]}>
        <PixelCorner position="bl" size={32} thickness={3} />
      </Animated.View>
      <Animated.View style={[styles.cornerBR, { opacity: cornerOp }]}>
        <PixelCorner position="br" size={32} thickness={3} />
      </Animated.View>

      {/* ── Center content ── */}
      <View style={styles.center}>

        {/* Logo */}
        <View style={styles.logoArea}>
          {/* Glow halo behind the text */}
          <Animated.View style={[styles.glow, { opacity: glowOp }]} />

          {/* Top pixel bar */}
          <Animated.View style={[styles.logoDeco, styles.logoDecoTop, { opacity: contentOp }]} />

          {/* PIXEL */}
          <Animated.Text
            style={[
              styles.wordPIXEL,
              { opacity: pixelOp, transform: [{ translateX: pixelX }] },
            ]}
          >
            PIXEL
          </Animated.Text>

          {/* NIGHT */}
          <Animated.Text
            style={[
              styles.wordNIGHT,
              { opacity: nightOp, transform: [{ translateX: nightX }] },
            ]}
          >
            NIGHT
          </Animated.Text>

          {/* Bottom pixel bar */}
          <Animated.View style={[styles.logoDeco, styles.logoDecoBottom, { opacity: contentOp }]} />
        </View>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: contentOp }]}>
          DEVINE L'IMAGE DU JOUR
          <Text style={styles.cursor}>{cursor ? '█' : ' '}</Text>
        </Animated.Text>

        {/* Date */}
        <Animated.Text style={[styles.date, { opacity: contentOp }]}>
          {getDisplayDate()}
        </Animated.Text>

        {/* Streak */}
        <Animated.View style={[{ width: '100%' }, { opacity: contentOp }]}>
          <StreakBlock streak={streak} bestStreak={bestStreak} />
        </Animated.View>

        {/* ── JOUER ── */}
        <Animated.View
          style={[
            styles.playWrapper,
            { opacity: contentOp, transform: [{ scale: playScale }] },
          ]}
        >
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handlePlay}
            activeOpacity={0.85}
          >
            {/* Pixel corner dots on the button */}
            <View style={[styles.btnDot, { top: 0, left: 0 }]} />
            <View style={[styles.btnDot, { top: 0, right: 0 }]} />
            <View style={[styles.btnDot, { bottom: 0, left: 0 }]} />
            <View style={[styles.btnDot, { bottom: 0, right: 0 }]} />

            <Ionicons name="play" size={24} color={colors.text} />
            <Text style={styles.playText}>JOUER</Text>
          </TouchableOpacity>

          {/* Discreet sign-out — below JOUER button */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.5}
            hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
          >
            <Ionicons name="log-out-outline" size={13} color={colors.textMuted} />
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>

      {/* Bottom bar */}
      <Animated.View style={[styles.bottomBar, { opacity: contentOp }]}>
        <View style={styles.bottomDot} />
        <Text style={styles.bottomText}>v1.0.2</Text>
        <View style={styles.bottomDot} />
      </Animated.View>
    </View>
  );
}

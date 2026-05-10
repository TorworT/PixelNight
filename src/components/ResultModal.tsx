import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Game } from '../constants/games';
import { GameStatus, Attempt } from '../hooks/useGameState';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { shareResult } from '../utils/shareResult';
import { Countdown } from './Countdown';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function censorTitle(title: string): string {
  return title
    .split(' ')
    .map((word) => {
      if (word.length <= 2 || /^\d+$/.test(word)) return word;
      return word[0] + '*'.repeat(word.length - 1);
    })
    .join(' ');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  status: GameStatus;
  game: Game;
  attemptsUsed: number;
  canGetExtra: boolean;
  /** true quand le joueur a explicitement accepté la défaite (révèle image + nom). */
  defeatAccepted: boolean;
  onWatchAdForExtra: () => void;
  onAcceptDefeat: () => void;   // appelé quand l'utilisateur accepte la défaite → révèle tout
  onDismiss: () => void;
  attempts: Attempt[];
  hintsRevealed: number;
  hasWatchedAdForExtra: boolean;
  serie: number;
  coinsEarned?: number;
}

// ─── createStyles ─────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      width: '100%',
      maxWidth: 380,
      maxHeight: '90%',
      overflow: 'hidden',
    },

    // Banner
    banner: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    bannerWon:     { backgroundColor: colors.warningDim },
    bannerLost:    { backgroundColor: colors.accentDim },
    bannerSkipped: { backgroundColor: colors.successDim },
    bannerTitle:   { fontSize: FONTS.size.xxxl, fontWeight: FONTS.weight.black },
    wonColor:      { color: colors.warning },
    lostColor:     { color: colors.accent },
    skippedColor:  { color: colors.success },
    bannerSub:     { color: colors.textSecondary, fontSize: FONTS.size.md },

    // Coins earned
    coinsRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
      backgroundColor: colors.warningDim, borderRadius: RADIUS.full,
      paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md,
      borderWidth: 1, borderColor: colors.warning + '55',
    },
    coinsEmoji: { fontSize: 16 },
    coinsText:  { color: colors.warning, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },

    // Game info
    gameSection: { padding: SPACING.lg, gap: SPACING.md },
    image: {
      width: '100%', height: 160, borderRadius: RADIUS.md, backgroundColor: colors.cardAlt,
    },
    gameTitle: {
      color: colors.text, fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, lineHeight: 28,
    },
    chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    chip:     {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.cardAlt, borderRadius: RADIUS.full,
      paddingVertical: 4, paddingHorizontal: SPACING.sm,
      borderWidth: 1, borderColor: colors.border,
    },
    chipText: { color: colors.textMuted, fontSize: FONTS.size.xs },

    // Share button
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
      backgroundColor: colors.accent,
      marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
      paddingVertical: SPACING.md, borderRadius: RADIUS.sm,
      borderWidth: 1.5, borderColor: '#f07080',
      borderBottomColor: '#9b1c30', borderRightColor: '#9b1c30',
    },
    shareText: {
      color: colors.text, fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace', letterSpacing: 1,
    },

    // Extra chance
    extraBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
      backgroundColor: colors.adButton,
      marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
      paddingVertical: SPACING.md, borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: '#9f5cff',
    },
    extraText: { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },

    // Close
    closeBtn: {
      alignItems: 'center', marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
      paddingVertical: SPACING.md, borderRadius: RADIUS.full, backgroundColor: colors.border,
    },
    closeText: { color: colors.textSecondary, fontSize: FONTS.size.md, fontWeight: FONTS.weight.medium },
  });
}

function createGridStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row:      { flexDirection: 'row', gap: SPACING.xs, justifyContent: 'center' },
    cell:     { width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    cellWon:  { backgroundColor: '#1a4a2e', borderColor: '#4ade80' },
    cellLost: { backgroundColor: colors.cardAlt, borderColor: colors.border },
    emoji:    { fontSize: 20 },
  });
}

function createRevealStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 1 },
    letter: {
      color: colors.text,
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.bold,
      lineHeight: 32,
    },
    space:  { width: 8 },
  });
}

// ─── AttemptGrid ──────────────────────────────────────────────────────────────

function AttemptGrid({ attempts, won }: { attempts: Attempt[]; won: boolean }) {
  const { colors } = useTheme();
  const grid = useMemo(() => createGridStyles(colors), [colors]);

  if (attempts.length === 0) return null;
  return (
    <View style={grid.row}>
      {attempts.map((a, i) => (
        <View
          key={i}
          style={[grid.cell, a.isCorrect ? grid.cellWon : grid.cellLost]}
        >
          <Text style={grid.emoji}>{a.isCorrect ? '🟩' : '⬛'}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── LetterReveal ─────────────────────────────────────────────────────────────
// Révèle le titre lettre par lettre avec un effet machine à écrire.

interface LetterRevealProps {
  title: string;
  playing: boolean; // déclenche l'animation quand true
}

function LetterReveal({ title, playing }: LetterRevealProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset
    setRevealedCount(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (startRef.current)    clearTimeout(startRef.current);

    if (!playing) return;

    // Délai avant de commencer (laisse le modal s'ouvrir)
    startRef.current = setTimeout(() => {
      let count = 0;
      intervalRef.current = setInterval(() => {
        count++;
        setRevealedCount(count);
        if (count >= title.length) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
        }
      }, 70);
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (startRef.current)    clearTimeout(startRef.current);
    };
  }, [playing, title]);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
      {title.split('').map((char, i) => {
        const visible = i < revealedCount;
        return (
          <LetterChar key={i} char={char} visible={visible} index={i} />
        );
      })}
    </View>
  );
}

// Chaque lettre apparaît avec un petit pop
function LetterChar({ char, visible, index }: { char: string; visible: boolean; index: number }) {
  const { colors } = useTheme();
  const reveal = useMemo(() => createRevealStyles(colors), [colors]);

  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const prevVisible = useRef(false);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      prevVisible.current = true;
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, tension: 220, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    } else if (!visible && prevVisible.current) {
      prevVisible.current = false;
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (char === ' ') {
    return <View style={reveal.space} />;
  }

  return (
    <Animated.Text
      style={[
        reveal.letter,
        { transform: [{ scale }], opacity },
      ]}
    >
      {visible ? char : '·'}
    </Animated.Text>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResultModal({
  visible, status, game, attemptsUsed, canGetExtra, defeatAccepted,
  onWatchAdForExtra, onAcceptDefeat, onDismiss,
  attempts, hintsRevealed, hasWatchedAdForExtra, serie,
  coinsEarned = 0,
}: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const won     = status === 'won';
  const skipped = status === 'skipped';

  const handleShare = useCallback(() => {
    shareResult({ status, attempts, hintsRevealed, hasWatchedAdForExtra, serie, imageUrl: game.imageUrl });
  }, [status, attempts, hintsRevealed, hasWatchedAdForExtra, serie, game.imageUrl]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* ── Banner ───────────────────────────────────────────────────── */}
            <View style={[
              styles.banner,
              won ? styles.bannerWon : skipped ? styles.bannerSkipped : styles.bannerLost,
            ]}>
              <Ionicons
                name={won ? 'trophy' : skipped ? 'play-skip-forward' : 'skull-outline'}
                size={42}
                color={won ? colors.warning : skipped ? colors.success : colors.accent}
              />
              <Text style={[
                styles.bannerTitle,
                won ? styles.wonColor : skipped ? styles.skippedColor : styles.lostColor,
              ]}>
                {won ? 'Bravo !' : skipped ? 'Passé !' : 'Perdu !'}
              </Text>
              <Text style={styles.bannerSub}>
                {won
                  ? `Trouvé en ${attemptsUsed} ${attemptsUsed === 1 ? 'essai' : 'essais'} !`
                  : skipped
                  ? 'Vous avez utilisé le pouvoir "Passer le jeu".'
                  : "Vous n'avez pas trouvé ce jeu."}
              </Text>

              {/* Pièces gagnées (victoire uniquement) */}
              {won && coinsEarned > 0 && (
                <View style={styles.coinsRow}>
                  <Text style={styles.coinsEmoji}>🪙</Text>
                  <Text style={styles.coinsText}>+{coinsEarned} pièces gagnées !</Text>
                </View>
              )}

              {/* Grille emoji */}
              <AttemptGrid attempts={attempts} won={won} />
            </View>

            {/* ── Game info ────────────────────────────────────────────────── */}
            <View style={styles.gameSection}>
              <Image source={{ uri: game.imageUrl }} style={styles.image} resizeMode="cover" />

              {/* Titre : révélation lettre par lettre si victoire,
                   censuré si le joueur peut encore regarder une pub. */}
              {won ? (
                <LetterReveal title={game.title} playing={visible && won} />
              ) : (
                <Text style={styles.gameTitle}>
                  {canGetExtra ? censorTitle(game.title) : game.title}
                </Text>
              )}

              <View style={styles.chips}>
                <Chip icon="calendar-outline"        label={String(game.year)} />
                <Chip icon="game-controller-outline" label={game.genre} />
                <Chip icon="construct-outline"       label={game.developer} />
              </View>
            </View>

            {/* ── Compte à rebours ─────────────────────────────────────────── */}
            <Countdown />

            {/* ── Bouton Partager ───────────────────────────────────────────── */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.text} />
              <Text style={styles.shareText}>Partager mon résultat</Text>
            </TouchableOpacity>

            {/* ── Chance bonus (perdu seulement) ───────────────────────────── */}
            {!won && canGetExtra && (
              <TouchableOpacity style={styles.extraBtn} onPress={onWatchAdForExtra} activeOpacity={0.85}>
                <Ionicons name="play-circle-outline" size={19} color={colors.text} />
                <Text style={styles.extraText}>Regarder une pub pour 1 chance de plus</Text>
              </TouchableOpacity>
            )}

            {/* ── Fermer / Accepter la défaite ─────────────────────────────── */}
            {/* Le bouton dit "Accepter la défaite" tant que defeatAccepted=false,
                 qu'il reste ou non une chance de pub (canGetExtra). Après acceptation,
                 il dit simplement "Fermer". */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                if (!won && !skipped && !defeatAccepted) onAcceptDefeat();
                onDismiss();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.closeText}>
                {won || skipped || defeatAccepted ? 'Fermer' : 'Accepter la défaite'}
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ icon, label }: { icon: string; label: string }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  if (!label || label === '0') return null;
  return (
    <View style={styles.chip}>
      <Ionicons name={icon as any} size={11} color={colors.textMuted} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

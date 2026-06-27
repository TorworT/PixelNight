import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Game } from '../constants/games';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

interface Props {
  game: Game;
  hintsRevealed: number;
  canGetHint: boolean;
  onRequestHint: () => void;
  adFree?: boolean;
}

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      gap: SPACING.sm,
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    headerLabel: {
      flex: 1,
      color: colors.warning,
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    headerCount: { color: colors.textMuted, fontSize: FONTS.size.xs },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: colors.warningDim,
      borderRadius: RADIUS.sm,
      padding: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    hintBadge: {
      width: 20, height: 20, borderRadius: 4,
      backgroundColor: colors.warning,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
    },
    hintBadgeText: { color: '#000', fontSize: FONTS.size.xs, fontWeight: FONTS.weight.black },
    hintText: { color: colors.text, fontSize: FONTS.size.sm, flex: 1, lineHeight: 20 },

    adBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.adButton,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: '#9f5cff',
    },
    adBtnText: { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, flex: 1 },

    costBadgeFree: {
      backgroundColor: '#16a34a',
      borderRadius: RADIUS.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    costBadgePub: {
      backgroundColor: '#7c3aed',
      borderRadius: RADIUS.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    costBadgeText: {
      color: '#fff',
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
    },

    allDone: {
      color: colors.textMuted, fontSize: FONTS.size.xs, textAlign: 'center', fontStyle: 'italic',
    },
  });
}

export function HintPanel({ game, hintsRevealed, canGetHint, onRequestHint, adFree = false }: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  // Indice 1 & 2 → gratuit ; indice 3 → pub (sauf abonné)
  const nextHintIsFree = adFree || hintsRevealed < 2;

  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={15} color={colors.warning} />
        <Text style={styles.headerLabel}>Indices</Text>
        <Text style={styles.headerCount}>{hintsRevealed}/{game.hints.length}</Text>
      </View>

      {game.hints.slice(0, hintsRevealed).map((hint, i) => (
        <View key={i} style={styles.hintRow}>
          <View style={styles.hintBadge}>
            <Text style={styles.hintBadgeText}>{i + 1}</Text>
          </View>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ))}

      {canGetHint && (
        <TouchableOpacity style={styles.adBtn} onPress={onRequestHint} activeOpacity={0.8}>
          <Ionicons
            name={nextHintIsFree ? 'bulb-outline' : 'play-circle-outline'}
            size={17}
            color={colors.text}
          />
          <Text style={styles.adBtnText}>Révéler un indice</Text>
          <Animated.View
            style={[
              nextHintIsFree ? styles.costBadgeFree : styles.costBadgePub,
              { transform: [{ scale }] },
            ]}
          >
            <Text style={styles.costBadgeText}>
              {nextHintIsFree ? 'Gratuit' : 'Pub'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      {!canGetHint && hintsRevealed >= game.hints.length && (
        <Text style={styles.allDone}>Tous les indices révélés</Text>
      )}
    </View>
  );
}

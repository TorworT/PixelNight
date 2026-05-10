import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Attempt } from '../hooks/useGameState';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

interface Props {
  attempts: Attempt[];
}

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    list: { gap: SPACING.sm, width: '100%' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderWidth: 1.5,
    },
    rowOk: { backgroundColor: colors.successDim, borderColor: colors.success },
    rowWrong: { backgroundColor: colors.accentDim, borderColor: colors.accent },
    badge: {
      width: 24, height: 24, borderRadius: 4,
      alignItems: 'center', justifyContent: 'center',
    },
    badgeOk: { backgroundColor: colors.success },
    badgeWrong: { backgroundColor: colors.accent },
    badgeText: { color: colors.text, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    text: { flex: 1, fontSize: FONTS.size.md, fontWeight: FONTS.weight.medium },
    textOk: { color: colors.success },
    textWrong: { color: colors.text },
  });
}

export function AttemptsList({ attempts }: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  if (attempts.length === 0) return null;
  return (
    <View style={styles.list}>
      {attempts.map((a, i) => (
        <AttemptRow key={i} attempt={a} number={i + 1} />
      ))}
    </View>
  );
}

function AttemptRow({ attempt, number }: { attempt: Attempt; number: number }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const ok = attempt.isCorrect;
  return (
    <View style={[styles.row, ok ? styles.rowOk : styles.rowWrong]}>
      <View style={[styles.badge, ok ? styles.badgeOk : styles.badgeWrong]}>
        <Text style={styles.badgeText}>{number}</Text>
      </View>
      <Text style={[styles.text, ok ? styles.textOk : styles.textWrong]} numberOfLines={1}>
        {attempt.text}
      </Text>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={22}
        color={ok ? colors.success : colors.accent}
      />
    </View>
  );
}

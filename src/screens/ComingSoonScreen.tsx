import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface Props {
  label: string;
  icon: string;
  launchDate?: string;
  onBack?: () => void;
}

export function ComingSoonScreen({ label, icon, launchDate, onBack }: Props) {
  return (
    <View style={styles.root}>
      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textMuted} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <Ionicons name={icon as any} size={64} color={COLORS.border} />
        <Text style={styles.category}>{label}</Text>
        <Text style={styles.title}>Bientôt disponible</Text>
        <Text style={styles.sub}>
          Ce mode est en cours de développement.{'\n'}Revenez bientôt !
        </Text>
        {launchDate && (
          <View style={styles.badge}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.warning} />
            <Text style={styles.badgeText}>Disponible le {launchDate}</Text>
          </View>
        )}
        {!launchDate && (
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={13} color={COLORS.warning} />
            <Text style={styles.badgeText}>À venir</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  backText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  category: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: FONTS.size.xxl,
    fontWeight: FONTS.weight.black,
    textAlign: 'center',
  },
  sub: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.warningDim,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.warning,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  badgeText: {
    color: COLORS.warning,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
  },
});

/**
 * ThemedButton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bouton principal dont l'apparence change selon le style sélectionné dans
 * ThemeContext (Classique / Aquarelle / Pixel Art / Glassmorphism / Néon).
 *
 * Usage :
 *   <ThemedButton onPress={handleSubmit} loading={loading}>
 *     DEVINER
 *   </ThemedButton>
 *
 * Props :
 *   children   — contenu du bouton (texte, icônes…)
 *   onPress    — callback au tap
 *   disabled   — désactivé
 *   loading    — remplace le contenu par un spinner
 *   variant    — 'primary' (accent) | 'secondary' (border-only)
 *   style      — style supplémentaire appliqué à la View externe
 */

import React from 'react';
import {
  TouchableOpacity, View, Text, ActivityIndicator,
  StyleSheet, ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS } from '../constants/theme';

interface ThemedButtonProps {
  children:  React.ReactNode;
  onPress:   () => void;
  disabled?: boolean;
  loading?:  boolean;
  variant?:  'primary' | 'secondary';
  style?:    ViewStyle;
}

export function ThemedButton({
  children, onPress, disabled = false, loading = false,
  variant = 'primary', style,
}: ThemedButtonProps) {
  const { colors, prefs } = useTheme();
  const btnStyle = prefs.buttonStyleId;

  const isPrimary = variant === 'primary';

  // ── Style commun de base ──────────────────────────────────────────────────
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    opacity: disabled ? 0.5 : 1,
  };

  // ── Variantes ─────────────────────────────────────────────────────────────
  let btnVariant: ViewStyle;
  switch (btnStyle) {
    // ── Aquarelle ─ coins très arrondis, légère opacité ──────────────────
    case 'retro':
      btnVariant = {
        backgroundColor: isPrimary
          ? colors.accent + 'cc'          // 80% opacité
          : 'transparent',
        borderRadius: 24,
        borderWidth: isPrimary ? 0 : 1.5,
        borderColor: colors.accent + '99',
      };
      break;

    // ── Pixel Art ─ carré, bordure épaisse 8-bit ─────────────────────────
    case 'pixel':
      btnVariant = {
        backgroundColor: isPrimary ? colors.accent : 'transparent',
        borderRadius: 0,
        borderWidth: isPrimary ? 3 : 2,
        borderColor: isPrimary
          ? lighten(colors.accent)        // highlight haut/gauche
          : colors.accent,
        borderBottomColor: isPrimary ? darken(colors.accent) : colors.accent,
        borderRightColor:  isPrimary ? darken(colors.accent) : colors.accent,
        // Pas de pixel-corner dots ici, on garde la simplicité
      };
      break;

    // ── Glassmorphism ─ fond semi-transparent ────────────────────────────
    case 'minimal':
      btnVariant = {
        backgroundColor: isPrimary
          ? 'rgba(255,255,255,0.10)'
          : 'transparent',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: isPrimary
          ? 'rgba(255,255,255,0.30)'
          : colors.accent + '60',
      };
      break;

    // ── Néon ─ lueur colorée via shadow ──────────────────────────────────
    case 'neonbtn':
      btnVariant = {
        backgroundColor: isPrimary ? colors.accent : 'transparent',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: colors.accent,
        shadowColor: colors.accent,
        shadowOpacity: 0.75,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
      };
      break;

    // ── Classique (défaut) ─ style pixel-art avec coins percés ───────────
    default:
      btnVariant = {
        backgroundColor: isPrimary ? colors.accent : 'transparent',
        borderRadius: 2,
        borderWidth: isPrimary ? 2 : 1.5,
        borderColor: isPrimary
          ? lighten(colors.accent)
          : colors.border,
        borderBottomColor: isPrimary ? darken(colors.accent) : colors.border,
        borderRightColor:  isPrimary ? darken(colors.accent) : colors.border,
      };
  }

  const textColor = isPrimary && btnStyle !== 'minimal'
    ? colors.text
    : btnStyle === 'minimal'
      ? (isPrimary ? 'rgba(255,255,255,0.9)' : colors.accent)
      : colors.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[base, btnVariant, style]}
    >
      {/* Pixel corner dots pour les styles Classique et Pixel Art */}
      {(btnStyle === 'classic' || btnStyle === 'pixel') && isPrimary && (
        <>
          <View style={[s.dot, { top: 0,    left: 0,  backgroundColor: colors.background }]} />
          <View style={[s.dot, { top: 0,    right: 0, backgroundColor: colors.background }]} />
          <View style={[s.dot, { bottom: 0, left: 0,  backgroundColor: colors.background }]} />
          <View style={[s.dot, { bottom: 0, right: 0, backgroundColor: colors.background }]} />
        </>
      )}

      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        typeof children === 'string' ? (
          <Text style={[s.text, { color: textColor }]}>{children}</Text>
        ) : (
          children
        )
      )}
    </TouchableOpacity>
  );
}

// ─── Helpers couleur ──────────────────────────────────────────────────────────

/** Éclaircit légèrement une couleur hex (highlight) */
function lighten(hex: string): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((n >> 16) & 0xff) + 40);
    const g = Math.min(255, ((n >> 8)  & 0xff) + 40);
    const b = Math.min(255, ( n        & 0xff) + 40);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return hex; }
}

/** Assombrit légèrement une couleur hex (ombre) */
function darken(hex: string): string {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - 60);
    const g = Math.max(0, ((n >> 8)  & 0xff) - 60);
    const b = Math.max(0, ( n        & 0xff) - 60);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return hex; }
}

// ─── Styles statiques (layout uniquement, pas de couleur) ────────────────────

const s = StyleSheet.create({
  dot: {
    position: 'absolute',
    width: 5,
    height: 5,
  },
  text: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.black,
    letterSpacing: 2,
  },
});

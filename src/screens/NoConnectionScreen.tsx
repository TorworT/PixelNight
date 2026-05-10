/**
 * NoConnectionScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Affiché au démarrage quand il n'y a pas de connexion internet ET pas de
 * session en cache. Garantit que l'utilisateur voit toujours quelque chose.
 *
 * Deux chemins :
 *  • "Réessayer"      → tente de se reconnecter à Supabase
 *  • "Jouer quand même" → mode invité avec jeu de secours local
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useAuthContext } from '../context/AuthContext';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

// ─── Styles factory ───────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      gap: SPACING.xl,
    },

    iconWrap: {
      position: 'relative',
      width: 100,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    title: {
      color: colors.text,
      fontSize: FONTS.size.xxl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: FONTS.size.md,
      textAlign: 'center',
      lineHeight: 22,
    },

    errorPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.accentDim,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.accent,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.md,
    },
    errorText: {
      color: colors.accent,
      fontSize: FONTS.size.sm,
    },

    btnGroup: {
      width: '100%',
      gap: SPACING.md,
      marginTop: SPACING.sm,
    },

    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.accent,
      borderRadius: 2,
      paddingVertical: SPACING.lg,
      borderWidth: 2,
      borderColor: '#ff6b85',
      borderBottomColor: '#9e1a2e',
      borderRightColor: '#9e1a2e',
      minHeight: 52,
    },
    btnPrimaryText: {
      color: colors.text,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 2,
    },
    dot: {
      position: 'absolute',
      width: 5,
      height: 5,
      backgroundColor: colors.background,
    },

    btnSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.card,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 48,
    },
    btnSecondaryText: {
      color: colors.textSecondary,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.medium,
    },

    note: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      textAlign: 'center',
      lineHeight: 18,
      opacity: 0.75,
      marginTop: SPACING.sm,
    },
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NoConnectionScreen() {
  const { retryStartup, continueAsGuest } = useAuthContext();
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const [retrying, setRetrying]     = useState(false);
  const [noNetMsg,  setNoNetMsg]    = useState(false);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setNoNetMsg(false);

    const netState = await NetInfo.fetch();
    if (netState.isConnected === false) {
      // Toujours hors ligne : informer l'utilisateur
      setNoNetMsg(true);
      setRetrying(false);
      return;
    }

    // Connexion rétablie → relancer le démarrage (met authLoading à true)
    await retryStartup();
    setRetrying(false);
  }, [retryStartup]);

  const handlePlayAnyway = useCallback(async () => {
    await continueAsGuest();
  }, [continueAsGuest]);

  return (
    <View style={styles.root}>
      {/* Icône */}
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={72} color={colors.textMuted} />
        <View style={styles.iconBadge}>
          <Ionicons name="wifi-outline" size={22} color={colors.accent} />
        </View>
      </View>

      {/* Titre */}
      <Text style={styles.title}>Pas de connexion</Text>
      <Text style={styles.subtitle}>
        PixelNight nécessite internet pour charger{'\n'}
        ton compte et le jeu du jour.
      </Text>

      {/* Message "toujours hors ligne" */}
      {noNetMsg && (
        <View style={styles.errorPill}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.accent} />
          <Text style={styles.errorText}>Toujours pas de connexion…</Text>
        </View>
      )}

      {/* Boutons */}
      <View style={styles.btnGroup}>
        {/* Réessayer */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.85}
        >
          {retrying ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={colors.text} />
              <Text style={styles.btnPrimaryText}>Réessayer</Text>
            </>
          )}
          <View style={[styles.dot, { top: 0,    left:  0 }]} />
          <View style={[styles.dot, { top: 0,    right: 0 }]} />
          <View style={[styles.dot, { bottom: 0, left:  0 }]} />
          <View style={[styles.dot, { bottom: 0, right: 0 }]} />
        </TouchableOpacity>

        {/* Jouer quand même */}
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={handlePlayAnyway}
          disabled={retrying}
          activeOpacity={0.75}
        >
          <Ionicons name="game-controller-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.btnSecondaryText}>Jouer quand même</Text>
        </TouchableOpacity>
      </View>

      {/* Note bas de page */}
      <Text style={styles.note}>
        En mode hors ligne, tes stats sont sauvegardées localement.{'\n'}
        Elles seront synchronisées à ta prochaine connexion.
      </Text>
    </View>
  );
}

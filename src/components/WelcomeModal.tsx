import React, { useRef, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

// ─── Contenu des cadeaux ──────────────────────────────────────────────────────

const BONUSES: { emoji: string; label: string }[] = [
  { emoji: '🪙', label: '50 pièces' },
  { emoji: '🔤', label: '1 Première lettre' },
  { emoji: '🔍', label: '1 Zone HD' },
  { emoji: '❤️', label: '1 Vie supplémentaire' },
  { emoji: '⏱️', label: 'Mode infini 24h' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * Appelé au clic sur "Récupérer mes cadeaux !".
   * Doit appeler la RPC Supabase puis rafraîchir le profil.
   * Le modal se ferme automatiquement une fois le profil mis à jour
   * (le parent ne le montage plus quand welcome_bonus_claimed = true).
   */
  onClaim: () => Promise<void>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
    },
    card: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      borderColor: colors.warning + '55',
      padding: SPACING.xl,
      gap: SPACING.lg,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.6,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 20,
    },

    // En-tête
    giftIcon: { fontSize: 44, marginBottom: SPACING.xs },
    title: {
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: FONTS.size.sm,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Liste des bonus
    bonusList: {
      width: '100%',
      gap: SPACING.xs,
    },
    bonusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      backgroundColor: colors.cardAlt,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bonusEmoji: { fontSize: 18, width: 26, textAlign: 'center' },
    bonusLabel: {
      flex: 1,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.medium,
    },

    // Bouton CTA
    btn: {
      width: '100%',
      paddingVertical: SPACING.md + 2,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: SPACING.sm,
      minHeight: 50,
    },
    btnClaimed: { opacity: 0.75 },
    btnText: {
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.black,
      color: '#fff',
      letterSpacing: 0.3,
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WelcomeModal({ onClaim }: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const [claiming, setClaiming] = useState(false);
  const [claimed,  setClaimed]  = useState(false);

  const scale   = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1, useNativeDriver: true, damping: 15, stiffness: 170,
      }),
      Animated.timing(opacity, {
        toValue: 1, useNativeDriver: true, duration: 200,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClaim = async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      await onClaim();
      // Le parent rafraîchit le profil → welcome_bonus_claimed passe à true
      // → ce composant est démonté. On affiche brièvement "✓ Récupéré !" le temps
      // que le state parent se propage.
      setClaimed(true);
    } catch (err: any) {
      // Si déjà réclamé (rare — double-tap ou session dupliquée) : on ferme quand même.
      // Pour toute autre erreur on log mais on ne bloque pas le joueur.
      if (__DEV__) console.warn('[WelcomeModal] claimWelcomeBonus error:', err?.message ?? err);
      setClaimed(true); // évite une boucle infinie si la RPC échoue
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>

          {/* Icône */}
          <Text style={styles.giftIcon}>🎁</Text>

          {/* Titre */}
          <Text style={[styles.title, { color: colors.text, fontFamily: fontFamily ?? 'monospace' }]}>
            Bienvenue sur PixelNight ! 🎮
          </Text>

          {/* Sous-titre */}
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Pour vous accueillir, voici vos cadeaux de bienvenue :
          </Text>

          {/* Liste des cadeaux */}
          <View style={styles.bonusList}>
            {BONUSES.map((b, i) => (
              <View key={i} style={styles.bonusRow}>
                <Text style={styles.bonusEmoji}>{b.emoji}</Text>
                <Text style={[styles.bonusLabel, { color: colors.text }]}>{b.label}</Text>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: claimed ? colors.success : colors.warning },
              claimed && styles.btnClaimed,
            ]}
            onPress={handleClaim}
            disabled={claiming || claimed}
            activeOpacity={0.85}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : claimed ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.btnText}>Cadeaux récupérés !</Text>
              </>
            ) : (
              <>
                <Ionicons name="gift-outline" size={18} color="#fff" />
                <Text style={[styles.btnText, { color: colors.background }]}>
                  Récupérer mes cadeaux !
                </Text>
              </>
            )}
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

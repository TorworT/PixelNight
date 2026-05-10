import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  purchaseSubscription,
  restorePurchases,
  type SubscriptionTier,
} from '../lib/subscription';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible:   boolean;
  onDismiss: () => void;
}

// ─── Catalogue des paliers ────────────────────────────────────────────────────

interface TierDef {
  id:       Exclude<SubscriptionTier, 'free'>;
  label:    string;
  price:    string;
  color:    string;
  icon:     string;
  badge?:   string;
  perks:    string[];
}

const TIERS: TierDef[] = [
  {
    id:    'basic',
    label: 'Basic',
    price: '1,99 €/mois',
    color: '#60a5fa',   // info
    icon:  'star-outline',
    perks: [
      'Sans publicités',
      'Badge exclusif Basic dans le classement',
    ],
  },
  {
    id:    'pro',
    label: 'Pro',
    price: '3,99 €/mois',
    color: '#a78bfa',   // violet
    icon:  'flash-outline',
    badge: 'Populaire',
    perks: [
      'Tout le palier Basic',
      '+2 chances supplémentaires par jour',
      'Mode Infini — rejoue tous les jeux passés',
      'Badge Pro animé dans le classement',
      'Accès aux nouvelles catégories 1 semaine avant tout le monde',
    ],
  },
  {
    id:    'legend',
    label: 'Legend',
    price: '5,99 €/mois',
    color: '#fbbf24',   // warning/gold
    icon:  'trophy-outline',
    badge: 'Ultime',
    perks: [
      'Tout le palier Pro',
      'Chances illimitées · chaque essai bonus = +50 🪙',
      '50 🪙 offerts chaque jour',
      'Badge Legend doré animé dans le classement',
      'Support prioritaire',
    ],
  },
];

// ─── createStyles ─────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    // Modal
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.88)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius:  RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderBottomWidth: 0,
      maxHeight: '93%',
      paddingTop: SPACING.sm,
    },
    handle: {
      width: 40, height: 4,
      backgroundColor: colors.border,
      borderRadius: RADIUS.full,
      alignSelf: 'center',
      marginBottom: SPACING.md,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.lg,
    },
    headerLeft: { gap: 2 },
    headerTitle: {
      color: colors.text,
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
    },
    closeBtn: {
      padding: SPACING.xs,
    },

    // Current tier banner
    currentBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
    },
    currentBannerText: {
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.bold,
      flex: 1,
    },

    // Scroll content
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxl,
      gap: SPACING.md,
    },

    // Tier card
    card: {
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      overflow: 'hidden',
    },
    cardActive: {
      borderWidth: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
    },
    cardIconBox: {
      width: 44, height: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    cardMeta: { flex: 1, gap: 2 },
    cardLabel: {
      fontSize: FONTS.size.lg,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
    },
    cardPrice: {
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.medium,
    },
    popularBadge: {
      borderRadius: RADIUS.full,
      paddingVertical: 3,
      paddingHorizontal: SPACING.sm,
      borderWidth: 1,
    },
    popularBadgeText: {
      fontSize: 10,
      fontWeight: FONTS.weight.black,
      letterSpacing: 0.5,
    },

    // Perks
    perksBox: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.lg,
      gap: SPACING.sm,
    },
    perkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    perkText: {
      color: colors.textSecondary,
      fontSize: FONTS.size.sm,
      lineHeight: 20,
      flex: 1,
    },

    // CTA button
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.sm,
      borderWidth: 1.5,
    },
    ctaBtnText: {
      color: colors.text,
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
    },
    ctaBtnOwned: {
      backgroundColor: colors.successDim,
      borderColor: colors.success,
    },
    ctaBtnOwnedText: {
      color: colors.success,
    },

    // Restore button
    restoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginTop: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardAlt,
    },
    restoreText: {
      color: colors.textMuted,
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.medium,
    },

    // Toast
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.md,
      borderWidth: 1,
    },
    toastOk:   { backgroundColor: colors.successDim, borderColor: colors.success },
    toastErr:  { backgroundColor: colors.accentDim,  borderColor: colors.accent  },
    toastText: { fontSize: FONTS.size.sm, flex: 1 },
    toastOkText:  { color: colors.success },
    toastErrText: { color: colors.accent  },

    // Legal
    legal: {
      color: colors.textMuted,
      fontSize: 10,
      textAlign: 'center',
      lineHeight: 14,
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.xl,
      marginTop: SPACING.sm,
    },
  });
}

// ─── TierCard ─────────────────────────────────────────────────────────────────

interface TierCardProps {
  tier:        TierDef;
  currentTier: SubscriptionTier;
  purchasing:  Exclude<SubscriptionTier, 'free'> | null;
  onPurchase:  (id: Exclude<SubscriptionTier, 'free'>) => void;
}

function TierCard({ tier, currentTier, purchasing, onPurchase }: TierCardProps) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const isOwned   = currentTier === tier.id;
  const isLoading = purchasing === tier.id;
  const isBlocked = purchasing !== null && !isLoading;

  // Hierarchy: legend > pro > basic
  const RANK: Record<SubscriptionTier, number> = { free: 0, basic: 1, pro: 2, legend: 3 };
  const isDowngrade = RANK[currentTier] > RANK[tier.id];

  const bgColor  = tier.color + '14'; // ~8 % opacité
  const dimColor = tier.color + '28';

  return (
    <View style={[
      styles.card,
      { backgroundColor: bgColor, borderColor: isOwned ? tier.color : tier.color + '44' },
      isOwned && styles.cardActive,
    ]}>
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconBox, { backgroundColor: dimColor, borderColor: tier.color + '66' }]}>
          <Ionicons name={tier.icon as any} size={22} color={tier.color} />
        </View>

        <View style={styles.cardMeta}>
          <Text style={[styles.cardLabel, { color: tier.color }]}>{tier.label}</Text>
          <Text style={[styles.cardPrice, { color: colors.textSecondary }]}>{tier.price}</Text>
        </View>

        {tier.badge && (
          <View style={[styles.popularBadge, { backgroundColor: tier.color + '22', borderColor: tier.color + '66' }]}>
            <Text style={[styles.popularBadgeText, { color: tier.color }]}>{tier.badge}</Text>
          </View>
        )}
      </View>

      {/* ── Avantages ────────────────────────────────────────────────────── */}
      <View style={styles.perksBox}>
        {tier.perks.map((perk, i) => (
          <View key={i} style={styles.perkRow}>
            <Ionicons name="checkmark-circle" size={15} color={tier.color} style={{ marginTop: 2 }} />
            <Text style={styles.perkText}>{perk}</Text>
          </View>
        ))}
      </View>

      {/* ── Bouton CTA ───────────────────────────────────────────────────── */}
      {isOwned ? (
        <View style={[styles.ctaBtn, styles.ctaBtnOwned]}>
          <Ionicons name="checkmark-circle" size={17} color={colors.success} />
          <Text style={[styles.ctaBtnText, styles.ctaBtnOwnedText]}>Abonnement actif</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            {
              backgroundColor: isBlocked ? 'transparent' : tier.color + '22',
              borderColor:     isBlocked ? colors.border  : tier.color,
              opacity: isBlocked ? 0.5 : 1,
            },
          ]}
          onPress={() => !isBlocked && onPurchase(tier.id)}
          activeOpacity={0.8}
          disabled={isBlocked}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={tier.color} />
          ) : (
            <>
              <Ionicons
                name={isDowngrade ? 'arrow-down-circle-outline' : 'card-outline'}
                size={17}
                color={isBlocked ? colors.textMuted : tier.color}
              />
              <Text style={[styles.ctaBtnText, { color: isBlocked ? colors.textMuted : tier.color }]}>
                {isDowngrade ? 'Changer de palier' : 'Souscrire'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── SubscriptionScreen ───────────────────────────────────────────────────────

export function SubscriptionScreen({ visible, onDismiss }: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const { profile, refreshProfile } = useAuthContext();

  const slideY  = useRef(new Animated.Value(600)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Tier lu depuis le profil Supabase — pas d'appel RevenueCat au chargement.
  const currentTier: SubscriptionTier = profile?.subscription_tier ?? 'free';

  const [purchasing,  setPurchasing]  = useState<Exclude<SubscriptionTier, 'free'> | null>(null);
  const [restoring,   setRestoring]   = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animation entrée / sortie ───────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY,  { toValue: 0,   tension: 70, friction: 11, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      // Rafraîchit le profil à l'ouverture pour afficher le tier à jour
      refreshProfile().catch(() => {});
    } else {
      slideY.setValue(600);
      opacity.setValue(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toast helper ────────────────────────────────────────────────────────
  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Achat ───────────────────────────────────────────────────────────────
  const handlePurchase = useCallback(async (tier: Exclude<SubscriptionTier, 'free'>) => {
    setPurchasing(tier);
    try {
      const ok = await purchaseSubscription(tier);
      if (ok) {
        // Synchronise le nouveau tier vers Supabase (bloquant),
        // puis rafraîchit le profil local pour mettre à jour currentTier.
        await supabase.rpc('sync_subscription_tier', { p_tier: tier }).catch(() => {});
        await refreshProfile();
        showToast('ok', `Abonnement ${tier} activé ! Merci pour ton soutien 🎉`);
      }
      // ok=false → annulation utilisateur, pas de toast
    } catch (err: any) {
      showToast('err', err?.message ?? 'Une erreur est survenue lors de l\'achat.');
    } finally {
      setPurchasing(null);
    }
  }, [showToast, refreshProfile]);

  // ── Restauration ────────────────────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const tier = await restorePurchases();
      // Synchronise le tier restauré vers Supabase (bloquant),
      // puis rafraîchit le profil local pour mettre à jour currentTier.
      await supabase.rpc('sync_subscription_tier', { p_tier: tier }).catch(() => {});
      await refreshProfile();
      if (tier !== 'free') {
        showToast('ok', `Abonnement ${tier} restauré avec succès !`);
      } else {
        showToast('err', 'Aucun abonnement actif trouvé à restaurer.');
      }
    } catch {
      showToast('err', 'Impossible de restaurer les achats. Réessaie plus tard.');
    } finally {
      setRestoring(false);
    }
  }, [showToast, refreshProfile]);

  // ── Bannière abonnement actif ────────────────────────────────────────────
  const activeTier = currentTier !== 'free'
    ? TIERS.find((t) => t.id === currentTier)
    : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        {/* Fond cliquable */}
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }], opacity }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Abonnements</Text>
              <Text style={styles.headerSub}>Débloque tout le potentiel de PixelNight</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Bannière abonnement actif */}
          {activeTier && (
            <View style={[styles.currentBanner, { backgroundColor: activeTier.color + '18', borderColor: activeTier.color + '55' }]}>
              <Ionicons name={activeTier.icon as any} size={18} color={activeTier.color} />
              <Text style={[styles.currentBannerText, { color: activeTier.color }]}>
                Abonnement {activeTier.label} actif
              </Text>
              <Ionicons name="checkmark-circle" size={18} color={activeTier.color} />
            </View>
          )}

          {/* Toast */}
          {toast && (
            <View style={[styles.toast, toast.type === 'ok' ? styles.toastOk : styles.toastErr]}>
              <Ionicons
                name={toast.type === 'ok' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={toast.type === 'ok' ? colors.success : colors.accent}
              />
              <Text style={[styles.toastText, toast.type === 'ok' ? styles.toastOkText : styles.toastErrText]}>
                {toast.msg}
              </Text>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Cartes paliers */}
            {TIERS.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                currentTier={currentTier}
                purchasing={purchasing}
                onPurchase={handlePurchase}
              />
            ))}

            {/* Bouton Restaurer */}
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestore}
              activeOpacity={0.75}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
              )}
              <Text style={styles.restoreText}>
                {restoring ? 'Restauration…' : 'Restaurer mes achats'}
              </Text>
            </TouchableOpacity>

            {/* Mention légale */}
            <Text style={styles.legal}>
              L'abonnement est renouvelé automatiquement sauf résiliation 24h avant la fin de la période.
              Gérable depuis les paramètres Google Play ou App Store.
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

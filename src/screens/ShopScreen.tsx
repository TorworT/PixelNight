import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { addCoins, buyItem, InventoryItemType } from '../lib/profiles';
import Purchases from 'react-native-purchases';
import { getTitles, getMyTitles, buyTitle, Title } from '../lib/titles';
import { AdModal } from '../components/AdModal';
import { IS_EXPO_GO, showRewardedAdCoins } from '../lib/admob';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { buyGuestItem, addGuestCoins } from '../lib/guestProfile';
import { AppearanceScreen } from './AppearanceScreen';
import { SubscriptionScreen } from './SubscriptionScreen';
import { type SubscriptionTier } from '../lib/subscription';
import { AVATARS } from '../constants/appearances';
import type { ThemeColors } from '../constants/appearances';

// ─── Lootbox ──────────────────────────────────────────────────────────────────

const LOOTBOX_COOLDOWN_MS = 48 * 60 * 60 * 1000;

function lootboxStatus(lastClaimed: string | null): { available: boolean; remainingMs: number } {
  if (!lastClaimed) return { available: true, remainingMs: 0 };
  const rem = new Date(lastClaimed).getTime() + LOOTBOX_COOLDOWN_MS - Date.now();
  return { available: rem <= 0, remainingMs: Math.max(0, rem) };
}

function formatLootboxRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ─── Paliers Premium ──────────────────────────────────────────────────────────

interface TierDef {
  id:     Exclude<SubscriptionTier, 'free'>;
  label:  string;
  price:  string;
  color:  string;
  icon:   string;
  badge?: string;
  perks:  string[];
}

const PREMIUM_TIERS: TierDef[] = [
  {
    id: 'basic', label: 'Basic', price: '1,99 €/mois',
    color: '#60a5fa', icon: 'star-outline',
    perks: ['Sans publicités', 'Badge exclusif dans le classement'],
  },
  {
    id: 'pro', label: 'Pro', price: '3,99 €/mois',
    color: '#a78bfa', icon: 'flash-outline', badge: 'Populaire',
    perks: ['Tout Basic', '+2 chances/jour', 'Mode Infini', 'Accès anticipé catégories'],
  },
  {
    id: 'legend', label: 'Legend', price: '5,99 €/mois',
    color: '#fbbf24', icon: 'trophy-outline', badge: 'Ultime',
    perks: ['Tout Pro', 'Chances illimitées', '+50 🪙/jour', 'Coffre toutes les 24h'],
  },
];

// ─── Catalogue des items ──────────────────────────────────────────────────────

interface ShopItem {
  type:       InventoryItemType;
  label:      string;
  icon:       string;
  cost:       number;
  color:      string;
  desc:       string;
  /** Clé sur l'objet Profile pour lire le stock. */
  profileKey: 'hint_letter' | 'hint_zone' | 'extra_life' | 'skip';
}

// Note: item.color values in SHOP_ITEMS reference fixed palette colors (info, warning, success)
// These are intentionally kept as static hex strings since they are item-specific accent colors.
const SHOP_ITEMS: ShopItem[] = [
  {
    type: 'hint_letter', profileKey: 'hint_letter',
    label: 'Première lettre', icon: 'text-outline',
    cost: 300, color: '#38bdf8',
    desc: 'Révèle la première lettre du titre du jeu pendant la partie.',
  },
  {
    type: 'hint_zone', profileKey: 'hint_zone',
    label: 'Zone HD', icon: 'scan-outline',
    cost: 500, color: '#f59e0b',
    desc: 'Déflou la zone centrale de l\'image pour mieux identifier le jeu.',
  },
  {
    type: 'extra_life', profileKey: 'extra_life',
    label: '+1 Vie', icon: 'heart-outline',
    cost: 400, color: '#f87171',
    desc: 'Ajoute une tentative supplémentaire si vous avez perdu la partie.',
  },
  {
    type: 'skip', profileKey: 'skip',
    label: 'Passer le jeu', icon: 'play-skip-forward-outline',
    cost: 150, color: '#4ade80',
    desc: 'Passe le jeu du jour sans comptabiliser de défaite.',
  },
];

// ─── Pack de pièces ───────────────────────────────────────────────────────────

interface CoinPack {
  productId: string;
  coins:     number;
  price:     string;
  popular?:  boolean;
}

const COIN_PACKS: CoinPack[] = [
  { productId: 'coins_500',  coins: 500,  price: '0,99 €' },
  { productId: 'coins_1200', coins: 1200, price: '1,99 €', popular: true },
  { productId: 'coins_3000', coins: 3000, price: '3,99 €' },
];

// ─── createStyles ─────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: colors.background },
    scroll:  { flex: 1 },
    content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.lg, alignItems: 'center' },

    header:      { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft:  { flex: 1 },
    title:       { color: colors.text, fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.black, letterSpacing: 2, fontFamily: ff ?? 'monospace' },
    titleAccent: { color: colors.warning },

    // Bouton Premium
    premiumBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
      borderRadius: RADIUS.full, borderWidth: 1.5,
      paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md,
    },
    premiumBtnText: {
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace', letterSpacing: 1,
    },

    // Toast
    toast:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md, width: '100%' },
    toastOk:  { backgroundColor: colors.successDim, borderColor: colors.success },
    toastErr: { backgroundColor: colors.accentDim, borderColor: colors.accent },
    toastText:{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, flex: 1 },

    // Balance
    balanceCard: {
      backgroundColor: colors.card, borderRadius: RADIUS.xl,
      borderWidth: 1.5, borderColor: colors.warning + '55',
      paddingVertical: SPACING.xl, paddingHorizontal: SPACING.xxl,
      alignItems: 'center', gap: SPACING.xs, width: '100%',
    },
    balanceEmoji:  { fontSize: 40 },
    balanceAmount: { color: colors.warning, fontSize: 40, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace' },
    balanceLabel:  { color: colors.textSecondary, fontSize: FONTS.size.sm },

    // Inventaire
    inventoryCard: {
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border, width: '100%', overflow: 'hidden',
    },
    invRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
    invRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    invIcon: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
    invLabel: { flex: 1, color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },
    invQtyBadge: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderWidth: 1, minWidth: 32, alignItems: 'center' },
    invQtyHas:   { backgroundColor: colors.successDim, borderColor: colors.success },
    invQtyEmpty: { backgroundColor: colors.card, borderColor: colors.border },
    invQty:      { fontSize: FONTS.size.sm, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace' },
    invQtyColorHas:   { color: colors.success },
    invQtyColorEmpty: { color: colors.textMuted },
    invEmpty: { color: colors.textMuted, fontSize: FONTS.size.xs, textAlign: 'center', padding: SPACING.md, fontStyle: 'italic' },

    // Apparences
    appearanceCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1.5, borderColor: colors.accent + '55',
      padding: SPACING.md, width: '100%',
      gap: SPACING.md,
    },
    appearanceLeft: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1,
    },
    appearanceAvatar: { fontSize: 32 },
    appearanceInfo:   { flex: 1, gap: 3 },
    appearanceTitle:  { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
    appearanceDesc:   { color: colors.textSecondary, fontSize: FONTS.size.xs },

    // Earn
    earnCard: { backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md, width: '100%' },
    earnRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    earnIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: colors.adButton + '22', alignItems: 'center', justifyContent: 'center' },
    earnInfo: { flex: 1, gap: 3 },
    earnLabel:{ color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
    earnDesc: { color: colors.textSecondary, fontSize: FONTS.size.xs },
    earnBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.adButton, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, minWidth: 52, justifyContent: 'center' },
    earnBtnText: { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.black },
    coinMini:    { fontSize: 14 },
    earnNote: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: colors.cardAlt, borderRadius: RADIUS.md, padding: SPACING.md, width: '100%' },
    earnNoteText: { color: colors.textMuted, fontSize: FONTS.size.xs, lineHeight: 18, flex: 1 },

    // Titres achetables
    titleCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
      borderLeftWidth: 3,
      padding: SPACING.md, gap: SPACING.md,
      width: '100%',
    },
    titleColorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    titleBody:     { flex: 1, gap: 3 },
    titleLabel:    { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
    titleDesc:     { color: colors.textSecondary, fontSize: FONTS.size.xs, lineHeight: 16 },
    titlePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    titleCoinMini: { fontSize: 12 },
    titlePrice:    { color: colors.warning, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold },
    titlePriceInsuf: { color: colors.textMuted },
    titleOwnedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: RADIUS.full, paddingVertical: 5, paddingHorizontal: SPACING.sm,
      borderWidth: 1, minWidth: 80, justifyContent: 'center',
    },
    titleOwnedText: { fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    titleBuyBtn: {
      backgroundColor: colors.accent,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      minWidth: 80, alignItems: 'center', justifyContent: 'center',
      minHeight: 36,
    },
    titleBuyBtnInsuf: { backgroundColor: colors.border },
    titleBuyBtnText:  { color: colors.text, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    titleEmptyNote: {
      width: '100%', alignItems: 'center', gap: SPACING.xs,
      paddingVertical: SPACING.lg,
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
    },
    titleEmptyText: { color: colors.textMuted, fontSize: FONTS.size.sm, fontStyle: 'italic' },

    // Pack de pièces
    packRow: {
      flexDirection: 'row', gap: SPACING.sm, width: '100%',
    },
    packCard: {
      flex: 1, alignItems: 'center',
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1.5, borderColor: colors.border,
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
      gap: SPACING.xs, position: 'relative' as const, overflow: 'hidden',
    },
    packCardPopular: {
      borderColor: colors.warning + '99',
      backgroundColor: colors.warningDim,
    },
    packPopularBadge: {
      position: 'absolute' as const, top: 0, right: 0,
      backgroundColor: colors.warning,
      borderBottomLeftRadius: RADIUS.sm,
      paddingHorizontal: SPACING.xs, paddingVertical: 2,
    },
    packPopularText: { color: '#000', fontSize: 9, fontWeight: FONTS.weight.black },
    packEmoji: { fontSize: 28 },
    packCoins: {
      color: colors.warning, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
    },
    packCoinsLabel: { color: colors.textMuted, fontSize: FONTS.size.xs },
    packPrice: {
      color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold,
    },
    packBtn: {
      marginTop: SPACING.xs,
      backgroundColor: colors.accent, borderRadius: RADIUS.sm,
      paddingVertical: 6, paddingHorizontal: SPACING.sm,
      minWidth: 64, alignItems: 'center', justifyContent: 'center', minHeight: 32,
    },
    packBtnText: { color: colors.text, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },

    // ── Section Premium ───────────────────────────────────────────────────────
    tierCard: {
      width: '100%',
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      padding: SPACING.md,
      gap: SPACING.sm,
      overflow: 'hidden' as const,
      position: 'relative' as const,
    },
    tierHeader: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    },
    tierIcon: {
      width: 38, height: 38, borderRadius: RADIUS.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    tierInfo: { flex: 1 },
    tierLabel: {
      fontSize: FONTS.size.md, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace', letterSpacing: 0.5,
    },
    tierPrice: {
      fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 1,
    },
    tierBadge: {
      position: 'absolute' as const, top: 0, right: 0,
      borderBottomLeftRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm, paddingVertical: 2,
    },
    tierBadgeText: { fontSize: 9, fontWeight: FONTS.weight.black, color: '#000' },
    tierPerks: { gap: 4 },
    tierPerk: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    },
    tierPerkText: {
      color: colors.textSecondary, fontSize: FONTS.size.xs, flex: 1,
    },
    tierBtn: {
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      alignItems: 'center', justifyContent: 'center',
      marginTop: SPACING.xs,
    },
    tierBtnText: {
      fontSize: FONTS.size.sm, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
    },
    tierActiveBadge: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.xs,
      borderRadius: RADIUS.sm, paddingVertical: SPACING.sm,
      marginTop: SPACING.xs, borderWidth: 1,
    },
    tierActiveText: {
      fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold,
    },

    // ── Section Lootbox ───────────────────────────────────────────────────────
    lootboxCard: {
      width: '100%',
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      padding: SPACING.md, gap: SPACING.md,
    },
    lootboxIconBox: {
      width: 52, height: 52, borderRadius: RADIUS.md,
      alignItems: 'center', justifyContent: 'center',
    },
    lootboxEmoji: { fontSize: 30 },
    lootboxBody: { flex: 1, gap: 3 },
    lootboxTitle: {
      color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold,
    },
    lootboxDesc: {
      color: colors.textSecondary, fontSize: FONTS.size.xs, lineHeight: 16,
    },
    lootboxBadgeAvail: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: colors.successDim, borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: colors.success + '66',
      paddingVertical: 2, paddingHorizontal: SPACING.sm,
    },
    lootboxBadgeCool: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      alignSelf: 'flex-start',
      backgroundColor: colors.cardAlt, borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: colors.border,
      paddingVertical: 2, paddingHorizontal: SPACING.sm,
    },
    lootboxBadgeText: {
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
    },
  });
}

// ─── createSecStyles ──────────────────────────────────────────────────────────

function createSecStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, width: '100%' },
    text: { color: colors.textMuted, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, letterSpacing: 1.5, textTransform: 'uppercase' },
    line: { flex: 1, height: 1, backgroundColor: colors.border },
  });
}

// ─── createCardStyles ─────────────────────────────────────────────────────────

function createCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
      borderLeftWidth: 3,
      padding: SPACING.md, gap: SPACING.md,
      width: '100%',
    },
    iconBox: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
    body:    { flex: 1, gap: 3 },
    label:   { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
    desc:    { color: colors.textSecondary, fontSize: FONTS.size.xs, lineHeight: 16 },
    priceRow:{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    coinMini:{ fontSize: 12 },
    price:   { color: colors.warning, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold },
    priceInsuf: { color: colors.textMuted },
    btn: {
      backgroundColor: colors.accent,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      minWidth: 80, alignItems: 'center', justifyContent: 'center',
      minHeight: 36,
    },
    btnInsuf: { backgroundColor: colors.border },
    btnText:  { color: colors.text, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
  });
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ShopScreen() {
  const { profile, refreshProfile, isGuest, guestProfile, refreshGuestProfile } = useAuthContext();
  const { prefs, colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const [watchingAd,        setWatchingAd]        = useState(false);
  const [adLoading,         setAdLoading]          = useState(false);
  const [buyingType,        setBuyingType]         = useState<InventoryItemType | null>(null);
  const [buyingPackId,      setBuyingPackId]       = useState<string | null>(null);
  const [showAppearances,   setShowAppearances]    = useState(false);
  const [showSubscription,  setShowSubscription]   = useState(false);
  const [toast,             setToast]              = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Titres achetables ───────────────────────────────────────────────────────
  const [purchasableTitles, setPurchasableTitles] = useState<Title[]>([]);
  const [myTitleIds,        setMyTitleIds]        = useState<Set<string>>(new Set());
  const [buyingTitleId,     setBuyingTitleId]     = useState<string | null>(null);
  const [titlesLoading,     setTitlesLoading]     = useState(false);

  const isOnline = useNetworkStatus();
  const coins = isGuest ? (guestProfile?.coins ?? 0) : (profile?.coins ?? 0);
  const avatarEmoji = AVATARS.find((a) => a.id === prefs.avatarId)?.emoji ?? '🎮';
  // Tier lu directement depuis le profil Supabase — pas d'appel RevenueCat.
  const subscriptionTier: SubscriptionTier = profile?.subscription_tier ?? 'free';

  // Rafraîchit le profil à chaque montage pour afficher le stock réel
  useEffect(() => {
    refreshProfile();
    if (!isGuest) loadTitlesSection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTitlesSection = useCallback(async () => {
    if (!profile?.id && !isGuest) return;
    setTitlesLoading(true);
    try {
      const [all, my] = await Promise.all([
        getTitles(),
        profile?.id ? getMyTitles(profile.id) : Promise.resolve([]),
      ]);
      // Filtre les titres achetables en boutique (type 'shop')
      setPurchasableTitles(all.filter((t) => t.type === 'shop'));
      setMyTitleIds(new Set(my.map((pt) => pt.title_id)));
    } catch (err) {
      if (__DEV__) console.warn('[ShopScreen] loadTitlesSection:', err);
    } finally {
      setTitlesLoading(false);
    }
  }, [profile?.id, isGuest]);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Achat d'un titre ────────────────────────────────────────────────────────
  const handleBuyTitle = useCallback(async (title: Title) => {
    if (!isOnline) { showToast('Achat impossible hors ligne 📵', false); return; }
    if (coins < title.cost) { showToast('Pas assez de pièces 🪙', false); return; }
    setBuyingTitleId(title.id);
    try {
      await buyTitle(title.id, title.cost);
      await refreshProfile();
      // Recharge les titres débloqués pour mettre à jour l'état "Déjà obtenu"
      if (profile?.id) {
        const my = await getMyTitles(profile.id);
        setMyTitleIds(new Set(my.map((pt) => pt.title_id)));
      }
      showToast(`Titre "${title.label}" débloqué ! 🎉`, true);
    } catch (err: any) {
      if (err?.message?.includes('insufficient_coins')) {
        showToast('Pas assez de pièces 🪙', false);
      } else {
        showToast('Achat échoué — réessaie plus tard', false);
      }
    } finally {
      setBuyingTitleId(null);
    }
  }, [isOnline, coins, refreshProfile, showToast, profile?.id]);

  // ── Achat d'un item ─────────────────────────────────────────────────────────
  const handleBuy = useCallback(async (item: ShopItem) => {
    if (!isOnline) {
      showToast('Achat impossible hors ligne 📵', false);
      return;
    }
    if (coins < item.cost) {
      showToast('Pas assez de pièces 🪙', false);
      return;
    }
    setBuyingType(item.type);
    try {
      if (isGuest) {
        await buyGuestItem(item.type, item.cost);
        await refreshGuestProfile();
      } else {
        await buyItem(item.type, item.cost);
        await refreshProfile();
      }
      showToast(`${item.label} ajouté à l'inventaire !`, true);
    } catch (err: any) {
      if (err?.message?.includes('insufficient_coins')) {
        showToast('Pas assez de pièces 🪙', false);
      } else {
        showToast('Achat échoué — vérifiez Supabase (inventory.sql)', false);
      }
    } finally {
      setBuyingType(null);
    }
  }, [coins, refreshProfile, showToast]);

  // ── Achat d'un pack de pièces via RevenueCat ───────────────────────────────
  const handleBuyCoinPack = useCallback(async (pack: CoinPack) => {
    if (!isOnline) { showToast('Achat impossible hors ligne 📵', false); return; }
    if (isGuest)   { showToast('Créez un compte pour acheter des pièces', false); return; }

    setBuyingPackId(pack.productId);
    try {
      await Purchases.purchaseProduct(pack.productId);
      // Crédit les pièces côté Supabase
      await addCoins(pack.coins);
      await refreshProfile();
      showToast(`+${pack.coins} pièces créditées ! 🪙`, true);
    } catch (err: any) {
      // Code 1 = annulé par l'utilisateur — silencieux
      if (err?.code !== 1) {
        showToast('Achat annulé ou échoué', false);
      }
    } finally {
      setBuyingPackId(null);
    }
  }, [isOnline, isGuest, refreshProfile, showToast]);

  // ── Pub pour gagner des pièces ──────────────────────────────────────────────

  /** Crédite 25 pièces après confirmation que la pub a été vue jusqu'au bout. */
  const creditAdReward = useCallback(async () => {
    try {
      if (isGuest) {
        await addGuestCoins(25);
        await refreshGuestProfile();
      } else {
        await addCoins(25);
        await refreshProfile();
      }
      showToast('+25 pièces créditées ! 🪙', true);
    } catch {
      showToast('Erreur — pièces non créditées.', false);
    }
  }, [isGuest, refreshProfile, refreshGuestProfile, showToast]);

  /** Appelé par AdModal (Expo Go) quand le joueur clique "Récupérer". */
  const handleAdComplete = useCallback(async () => {
    setWatchingAd(false);
    setAdLoading(true);
    await creditAdReward();
    setAdLoading(false);
  }, [creditAdReward]);

  /** Lancé quand le joueur appuie sur "+25 🪙". */
  const handleWatchAd = useCallback(async () => {
    if (!isOnline) return;

    if (IS_EXPO_GO) {
      // Expo Go : pub simulée via AdModal
      setWatchingAd(true);
      return;
    }

    // Build EAS : vraie pub AdMob
    setAdLoading(true);
    try {
      const rewarded = await showRewardedAdCoins();
      if (rewarded) {
        await creditAdReward();
      } else {
        showToast('Pub indisponible, réessaie plus tard 📵', false);
      }
    } finally {
      setAdLoading(false);
    }
  }, [isOnline, creditAdReward, showToast]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>
              {'<'}PIXEL <Text style={styles.titleAccent}>SHOP</Text>{'>'}
            </Text>
          </View>
          <PremiumButton
            tier={subscriptionTier}
            onPress={() => setShowSubscription(true)}
          />
        </View>

        {/* ── Toast ───────────────────────────────────────────────────────── */}
        {toast && (
          <View style={[styles.toast, toast.ok ? styles.toastOk : styles.toastErr]}>
            <Ionicons
              name={toast.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={15}
              color={toast.ok ? colors.success : colors.accent}
            />
            <Text style={[styles.toastText, { color: toast.ok ? colors.success : colors.accent }]}>
              {toast.msg}
            </Text>
          </View>
        )}

        {/* ── Solde ───────────────────────────────────────────────────────── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceEmoji}>🪙</Text>
          <Text style={styles.balanceAmount}>{coins.toLocaleString('fr-FR')}</Text>
          <Text style={styles.balanceLabel}>pièces disponibles</Text>
        </View>

        {/* ── Premium ─────────────────────────────────────────────────────── */}
        {!isGuest && (
          <>
            <SectionTitle icon="diamond-outline" label="Premium" />
            {PREMIUM_TIERS.map((tier) => (
              <PremiumTierCard
                key={tier.id}
                tier={tier}
                currentTier={subscriptionTier}
                onPress={() => setShowSubscription(true)}
              />
            ))}
          </>
        )}

        {/* ── Coffre gratuit ───────────────────────────────────────────────── */}
        {!isGuest && (
          <>
            <SectionTitle icon="gift-outline" label="Coffre gratuit" />
            <LootboxShopCard lastClaimed={profile?.last_lootbox_claimed_at ?? null} />
          </>
        )}

        {/* ── Apparences ──────────────────────────────────────────────────── */}
        <SectionTitle icon="color-palette-outline" label="Apparences" />

        <TouchableOpacity
          style={styles.appearanceCard}
          onPress={() => setShowAppearances(true)}
          activeOpacity={0.85}
        >
          <View style={styles.appearanceLeft}>
            <Text style={styles.appearanceAvatar}>{avatarEmoji}</Text>
            <View style={styles.appearanceInfo}>
              <Text style={styles.appearanceTitle}>Personnaliser l'app</Text>
              <Text style={styles.appearanceDesc}>
                Thèmes · Avatars · Effets · Boutons · Polices
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* ── Mon inventaire ───────────────────────────────────────────────── */}
        <SectionTitle icon="cube-outline" label="Mon inventaire" />

        <View style={styles.inventoryCard}>
          {SHOP_ITEMS.map((item, i) => {
            const qty = isGuest
              ? (guestProfile?.[item.profileKey] ?? 0)
              : (profile?.[item.profileKey] ?? 0);
            return (
              <View
                key={item.type}
                style={[styles.invRow, i < SHOP_ITEMS.length - 1 && styles.invRowBorder]}
              >
                <View style={[styles.invIcon, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.invLabel}>{item.label}</Text>
                <View style={[styles.invQtyBadge, qty > 0 ? styles.invQtyHas : styles.invQtyEmpty]}>
                  <Text style={[styles.invQty, qty > 0 ? styles.invQtyColorHas : styles.invQtyColorEmpty]}>
                    ×{qty}
                  </Text>
                </View>
              </View>
            );
          })}
          {SHOP_ITEMS.every((it) => (isGuest ? guestProfile?.[it.profileKey] : profile?.[it.profileKey]) === 0 || (isGuest ? guestProfile?.[it.profileKey] : profile?.[it.profileKey]) == null) && (
            <Text style={styles.invEmpty}>
              Votre inventaire est vide — achetez des items ci-dessous.
            </Text>
          )}
        </View>

        {/* ── Boutique ─────────────────────────────────────────────────────── */}
        <SectionTitle icon="bag-handle-outline" label="Boutique" />

        {SHOP_ITEMS.map((item) => (
          <ItemCard
            key={item.type}
            item={item}
            coins={coins}
            buying={buyingType === item.type}
            onBuy={() => handleBuy(item)}
          />
        ))}

        {/* ── Pack de pièces ───────────────────────────────────────────────── */}
        <SectionTitle icon="wallet-outline" label="Pack de pièces" />

        <View style={styles.packRow}>
          {COIN_PACKS.map((pack) => (
            <View
              key={pack.productId}
              style={[styles.packCard, pack.popular && styles.packCardPopular]}
            >
              {pack.popular && (
                <View style={styles.packPopularBadge}>
                  <Text style={styles.packPopularText}>POPULAIRE</Text>
                </View>
              )}
              <Text style={styles.packEmoji}>🪙</Text>
              <Text style={styles.packCoins}>{pack.coins}</Text>
              <Text style={styles.packCoinsLabel}>pièces</Text>
              <Text style={styles.packPrice}>{pack.price}</Text>
              <TouchableOpacity
                style={styles.packBtn}
                onPress={() => handleBuyCoinPack(pack)}
                activeOpacity={0.85}
                disabled={buyingPackId === pack.productId || !isOnline}
              >
                {buyingPackId === pack.productId ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={styles.packBtnText}>Acheter</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Titres ───────────────────────────────────────────────────────── */}
        {!isGuest && (
          <>
            <SectionTitle icon="ribbon-outline" label="Titres" />
            <TitlesShopSection
              titles={purchasableTitles}
              myTitleIds={myTitleIds}
              coins={coins}
              loading={titlesLoading}
              buyingTitleId={buyingTitleId}
              onBuy={handleBuyTitle}
            />
          </>
        )}

        {/* ── Gagner des pièces ────────────────────────────────────────────── */}
        <SectionTitle icon="gift-outline" label="Gagner des pièces" />

        <View style={styles.earnCard}>
          <View style={styles.earnRow}>
            <View style={styles.earnIcon}>
              <Ionicons name="play-circle-outline" size={24} color={colors.adButton} />
            </View>
            <View style={styles.earnInfo}>
              <Text style={styles.earnLabel}>Regarder une publicité</Text>
              <Text style={styles.earnDesc}>Gagnez 25 pièces par visionnage</Text>
            </View>
            <TouchableOpacity
              style={[styles.earnBtn, !isOnline && { opacity: 0.4 }]}
              onPress={handleWatchAd}
              activeOpacity={0.85}
              disabled={adLoading || !isOnline}
            >
              {adLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <Text style={styles.earnBtnText}>+25</Text>
                  <Text style={styles.coinMini}>🪙</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.earnNote}>
          <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
          <Text style={styles.earnNoteText}>
            Vous gagnez aussi des pièces en gagnant chaque jour.{'\n'}
            Bonus : +200🪙 à 7 jours · +500🪙 à 30 jours consécutifs !
          </Text>
        </View>

        <View style={{ height: SPACING.xxl * 2 }} />
      </ScrollView>

      <AdModal
        visible={watchingAd}
        type="coins"
        onComplete={handleAdComplete}
        onDismiss={() => setWatchingAd(false)}
      />

      <AppearanceScreen
        visible={showAppearances}
        onDismiss={() => setShowAppearances(false)}
      />

      <SubscriptionScreen
        visible={showSubscription}
        onDismiss={() => {
          setShowSubscription(false);
          // Rafraîchit le profil pour refléter le nouveau tier dans le badge
          refreshProfile().catch(() => {});
        }}
      />
    </View>
  );
}

// ─── Sub-composants ───────────────────────────────────────────────────────────

// ─── TitlesShopSection ────────────────────────────────────────────────────────

function TitlesShopSection({
  titles, myTitleIds, coins, loading, buyingTitleId, onBuy,
}: {
  titles:        Title[];
  myTitleIds:    Set<string>;
  coins:         number;
  loading:       boolean;
  buyingTitleId: string | null;
  onBuy:         (title: Title) => void;
}) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={{ marginVertical: SPACING.lg }} />;
  }

  if (titles.length === 0) {
    return (
      <View style={styles.titleEmptyNote}>
        <Ionicons name="ribbon-outline" size={24} color={colors.textMuted} />
        <Text style={styles.titleEmptyText}>Aucun titre disponible pour l'instant.</Text>
      </View>
    );
  }

  return (
    <>
      {titles.map((title) => (
        <TitleShopCard
          key={title.id}
          title={title}
          owned={myTitleIds.has(title.id)}
          coins={coins}
          buying={buyingTitleId === title.id}
          disabled={buyingTitleId !== null}
          onBuy={() => onBuy(title)}
        />
      ))}
    </>
  );
}

function TitleShopCard({
  title, owned, coins, buying, disabled, onBuy,
}: {
  title:    Title;
  owned:    boolean;
  coins:    number;
  buying:   boolean;
  disabled: boolean;
  onBuy:    () => void;
}) {
  const { colors, fontFamily } = useTheme();
  const styles   = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const canAfford = coins >= title.cost;

  return (
    <View style={[styles.titleCard, { borderLeftColor: title.color }]}>
      {/* Point de couleur */}
      <View style={[styles.titleColorDot, { backgroundColor: title.color }]} />

      {/* Infos */}
      <View style={styles.titleBody}>
        <Text style={styles.titleLabel}>{title.label}</Text>
        <Text style={styles.titleDesc}>{title.description}</Text>
        {!owned && (
          <View style={styles.titlePriceRow}>
            <Text style={styles.titleCoinMini}>🪙</Text>
            <Text style={[styles.titlePrice, !canAfford && styles.titlePriceInsuf]}>
              {title.cost.toLocaleString('fr-FR')}
            </Text>
          </View>
        )}
      </View>

      {/* Bouton / badge Débloqué */}
      {owned ? (
        <View style={[
          styles.titleOwnedBadge,
          { backgroundColor: title.color + '1a', borderColor: title.color + '60' },
        ]}>
          <Ionicons name="checkmark-circle" size={14} color={title.color} />
          <Text style={[styles.titleOwnedText, { color: title.color }]}>Débloqué</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.titleBuyBtn, !canAfford && styles.titleBuyBtnInsuf]}
          onPress={onBuy}
          disabled={buying || disabled || !canAfford}
          activeOpacity={0.8}
        >
          {buying ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.titleBuyBtnText}>
              {canAfford ? 'Acheter' : 'Insuffisant'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── PremiumButton ────────────────────────────────────────────────────────────

const TIER_META: Record<Exclude<SubscriptionTier, 'free'>, { label: string; color: string; icon: string }> = {
  basic:  { label: 'Basic',  color: '#60a5fa', icon: 'star-outline'    },
  pro:    { label: 'Pro',    color: '#a78bfa', icon: 'flash-outline'   },
  legend: { label: 'Legend', color: '#fbbf24', icon: 'trophy-outline'  },
};

function PremiumButton({ tier, onPress }: { tier: SubscriptionTier; onPress: () => void }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const meta = tier !== 'free' ? TIER_META[tier] : null;
  const color = meta?.color ?? '#a78bfa';

  return (
    <TouchableOpacity
      style={[
        styles.premiumBtn,
        {
          backgroundColor: color + '18',
          borderColor:     color + '66',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={(meta?.icon ?? 'diamond-outline') as any}
        size={13}
        color={color}
      />
      <Text style={[styles.premiumBtnText, { color }]}>
        {meta ? meta.label : 'Premium'}
      </Text>
      {!meta && (
        <Ionicons name="chevron-forward" size={11} color={color} />
      )}
      {meta && (
        <Ionicons name="checkmark-circle" size={13} color={color} />
      )}
    </TouchableOpacity>
  );
}

function SectionTitle({ icon, label }: { icon: string; label: string }) {
  const { colors } = useTheme();
  const sec = useMemo(() => createSecStyles(colors), [colors]);
  return (
    <View style={sec.row}>
      <Ionicons name={icon as any} size={14} color={colors.textMuted} />
      <Text style={sec.text}>{label}</Text>
      <View style={sec.line} />
    </View>
  );
}

// ─── PremiumTierCard ──────────────────────────────────────────────────────────

function PremiumTierCard({
  tier, currentTier, onPress,
}: {
  tier:        TierDef;
  currentTier: SubscriptionTier;
  onPress:     () => void;
}) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const isActive = currentTier === tier.id;

  return (
    <View style={[
      styles.tierCard,
      { borderColor: tier.color + (isActive ? 'cc' : '44'),
        backgroundColor: tier.color + (isActive ? '18' : '0a') },
    ]}>
      {/* Badge populaire / ultime */}
      {tier.badge && (
        <View style={[styles.tierBadge, { backgroundColor: tier.color }]}>
          <Text style={styles.tierBadgeText}>{tier.badge.toUpperCase()}</Text>
        </View>
      )}

      {/* Header : icône + nom + prix */}
      <View style={styles.tierHeader}>
        <View style={[styles.tierIcon, { backgroundColor: tier.color + '22' }]}>
          <Ionicons name={tier.icon as any} size={20} color={tier.color} />
        </View>
        <View style={styles.tierInfo}>
          <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
          <Text style={styles.tierPrice}>{tier.price}</Text>
        </View>
      </View>

      {/* Avantages */}
      <View style={styles.tierPerks}>
        {tier.perks.map((perk) => (
          <View key={perk} style={styles.tierPerk}>
            <Ionicons name="checkmark" size={12} color={tier.color} />
            <Text style={styles.tierPerkText}>{perk}</Text>
          </View>
        ))}
      </View>

      {/* Bouton */}
      {isActive ? (
        <View style={[styles.tierActiveBadge,
          { backgroundColor: tier.color + '18', borderColor: tier.color + '55' }]}>
          <Ionicons name="checkmark-circle" size={15} color={tier.color} />
          <Text style={[styles.tierActiveText, { color: tier.color }]}>Abonnement actif</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.tierBtn, { backgroundColor: tier.color }]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.tierBtnText, { color: '#000' }]}>S'abonner</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── LootboxShopCard ──────────────────────────────────────────────────────────

function LootboxShopCard({ lastClaimed }: { lastClaimed: string | null }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const [tick, setTick] = useState(0);

  // Rafraîchit l'affichage du cooldown chaque minute
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { available, remainingMs } = useMemo(
    () => lootboxStatus(lastClaimed),
    [lastClaimed, tick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View style={[
      styles.lootboxCard,
      { borderColor: available ? colors.warning + '88' : colors.border },
    ]}>
      {/* Icône */}
      <View style={[
        styles.lootboxIconBox,
        { backgroundColor: available ? colors.warningDim : colors.cardAlt },
      ]}>
        <Text style={styles.lootboxEmoji}>{available ? '🎁' : '⌛'}</Text>
      </View>

      {/* Texte + statut */}
      <View style={styles.lootboxBody}>
        <Text style={styles.lootboxTitle}>Coffre gratuit</Text>
        <Text style={styles.lootboxDesc}>
          Ouvre un coffre toutes les 48h pendant le jeu pour gagner des pièces.
        </Text>
        {available ? (
          <View style={styles.lootboxBadgeAvail}>
            <Ionicons name="checkmark-circle" size={11} color={colors.success} />
            <Text style={[styles.lootboxBadgeText, { color: colors.success }]}>
              Disponible maintenant !
            </Text>
          </View>
        ) : (
          <View style={styles.lootboxBadgeCool}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
            <Text style={[styles.lootboxBadgeText, { color: colors.textMuted }]}>
              Prochain coffre dans {formatLootboxRemaining(remainingMs)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item, coins, buying, onBuy,
}: { item: ShopItem; coins: number; buying: boolean; onBuy: () => void }) {
  const { colors } = useTheme();
  const card = useMemo(() => createCardStyles(colors), [colors]);
  const canAfford = coins >= item.cost;
  return (
    <View style={[card.root, { borderLeftColor: item.color }]}>
      <View style={[card.iconBox, { backgroundColor: item.color + '22' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color} />
      </View>
      <View style={card.body}>
        <Text style={card.label}>{item.label}</Text>
        <Text style={card.desc}>{item.desc}</Text>
        <View style={card.priceRow}>
          <Text style={card.coinMini}>🪙</Text>
          <Text style={[card.price, !canAfford && card.priceInsuf]}>{item.cost}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[card.btn, !canAfford && card.btnInsuf]}
        onPress={onBuy}
        disabled={buying || !canAfford}
        activeOpacity={0.8}
      >
        {buying ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <Text style={card.btnText}>{canAfford ? 'Acheter' : 'Insuffisant'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

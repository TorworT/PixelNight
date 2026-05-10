import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';

import { useGameStateContext } from '../context/GameStateContext';
import { PixelImage } from '../components/PixelImage';
import { GuessInput } from '../components/GuessInput';
import { AttemptsList } from '../components/AttemptsList';
import { HintPanel } from '../components/HintPanel';
import { AdModal } from '../components/AdModal';
import { IS_EXPO_GO, showRewardedAdCoins, showRewardedAdHint } from '../lib/admob';
import { ResultModal } from '../components/ResultModal';
import { getDisplayDate } from '../utils/dateUtils';
import { playVictorySound, playDefeatSound } from '../utils/pixelSound';
import { skipTodayNotification, scheduleStreakNotification } from '../lib/notifications';
import NetInfo from '@react-native-community/netinfo';
import { recordGameHistory } from '../lib/gameHistory';
import { trackWinAndCheckReview } from '../lib/reviewPrompt';
import { enqueueGameResult } from '../lib/offlineQueue';
import {
  updateGuestOnWin as guestWin,
  updateGuestOnLoss as guestLoss,
  useGuestItem,
} from '../lib/guestProfile';
import { ReviewModal } from '../components/ReviewModal';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';
import {
  calculateScore, calculateCoins, submitGameResult,
  addCoins, useItem, InventoryItemType,
} from '../lib/profiles';
import { GAMES } from '../constants/games';
import { PowerupType } from '../hooks/useGameState';
import { supabase } from '../lib/supabase';
import { Profile } from '../lib/profiles';
import { FlameStreak } from '../components/FlameStreak';

// Cache module-level : évite de requêter Supabase à chaque switch d'onglet.
// Clé = nom de la catégorie, valeur = liste des game_name.
const _titlesByCategory = new Map<string, string[]>();

type AdContext = 'hint' | 'extra' | 'coins' | null;

interface GameScreenProps {
  onBack?: () => void;
}

// ─── Powerup config ───────────────────────────────────────────────────────────

interface PowerupDef {
  type:         PowerupType;
  inventoryKey: InventoryItemType;
  label:        string;
  icon:         string;
  color:        string;
}

// NOTE: POWERUP_DEFS colors are semantic power-up colors, not theme colors — kept as-is
import { COLORS } from '../constants/theme';

const POWERUP_DEFS: PowerupDef[] = [
  { type: 'firstLetter', inventoryKey: 'hint_letter', label: '1re lettre', icon: 'text-outline',              color: COLORS.info    },
  { type: 'revealZone',  inventoryKey: 'hint_zone',   label: 'Zone HD',    icon: 'scan-outline',              color: COLORS.warning },
  { type: 'extraLife',   inventoryKey: 'extra_life',  label: '+1 Vie',     icon: 'heart-outline',             color: '#f87171'      },
  { type: 'skip',        inventoryKey: 'skip',        label: 'Passer',     icon: 'play-skip-forward-outline', color: COLORS.success },
];

// Couleurs de confettis selon l'effet de victoire
// CONFETTI_PRESETS uses static COLORS — confetti colors don't need to be live-reactive
const CONFETTI_PRESETS: Record<string, { colors: string[]; count: number; explosionSpeed: number; fallSpeed: number }> = {
  confetti: {
    colors: [COLORS.accent, COLORS.warning, '#ffffff', COLORS.info, COLORS.success],
    count: 180, explosionSpeed: 380, fallSpeed: 2800,
  },
  fireworks: {
    colors: [COLORS.accent, COLORS.warning, '#ff4444', '#ffffff', COLORS.info, '#ff88ff'],
    count: 240, explosionSpeed: 600, fallSpeed: 2200,
  },
  pixelrain: {
    colors: [COLORS.success, '#00ff88', '#44ff44', '#88ff44', '#ffffff'],
    count: 200, explosionSpeed: 200, fallSpeed: 3500,
  },
  golden: {
    colors: ['#ffd700', '#fbbf24', '#ffaa00', '#fff3a0', '#f59e0b'],
    count: 220, explosionSpeed: 420, fallSpeed: 3000,
  },
};

function getStock(profile: Profile | null, key: InventoryItemType): number {
  if (!profile) return 0;
  return (profile[key] as number) ?? 0;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.background },
    centered:    { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    loadingText: { color: colors.textMuted, fontSize: FONTS.size.md },
    scroll:      { flex: 1 },
    content:     { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.lg, alignItems: 'center' },

    // Overlay rouge défaite
    defeatOverlay: { backgroundColor: colors.accent, zIndex: 10 },

    header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' },
    headerLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    backBtn: {
      marginTop: SPACING.xs,
      padding: SPACING.sm,
      backgroundColor: colors.card + 'cc',
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title:       { color: colors.text, fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.black, letterSpacing: 2, fontFamily: ff ?? 'monospace' },
    titleAccent: { color: colors.accent },
    dateLabel:   { color: colors.textMuted, fontSize: FONTS.size.xs, marginTop: 2, textTransform: 'capitalize' },

    coinBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.warning + '55', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
    coinEmoji:   { fontSize: 13 },
    coinCount:   { color: colors.warning, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace' },
    pixelBadge:  { backgroundColor: colors.card, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
    pixelBadgeText: { color: colors.accent, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace' },

    coinPopup:     { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
    coinPopupText: { color: colors.warning, fontWeight: FONTS.weight.black, fontSize: FONTS.size.lg, backgroundColor: colors.warningDim, borderRadius: RADIUS.full, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: colors.warning, overflow: 'hidden' },

    firstLetterBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: colors.infoDim, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.info, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md, alignSelf: 'center' },
    firstLetterText:  { color: colors.info, fontSize: FONTS.size.sm },
    firstLetterChar:  { fontWeight: FONTS.weight.black, fontSize: FONTS.size.lg },

    toast:     { backgroundColor: colors.cardAlt, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.lg, alignSelf: 'center' },
    toastText: { color: colors.text, fontSize: FONTS.size.sm },

    hintCta:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, backgroundColor: colors.warningDim, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.warning, alignSelf: 'center' },
    hintCtaText: { color: colors.warning, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },

    revealBanner:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.accentDim, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.accent, padding: SPACING.md, width: '100%' },
    revealBannerSkipped:  { backgroundColor: colors.successDim, borderColor: colors.success },
    // Nom censuré après premier échec — bordure en pointillés visuels + opacité réduite
    revealBannerCensored: { backgroundColor: colors.accentDim + '88', borderStyle: 'dashed' as const },
    revealText:          { color: colors.text, fontSize: FONTS.size.sm, flex: 1 },
    revealGame:          { fontWeight: FONTS.weight.bold, color: colors.accent },


    // Streak badge inline (à côté de la barre de clarté)
    streakInlineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      backgroundColor: colors.card,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: '#f97316' + '55',
      paddingVertical: 3,
      paddingHorizontal: SPACING.sm,
    },
    streakInlineText: {
      color: '#f97316',
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
    },

    fab: {
      position: 'absolute', bottom: SPACING.xl, right: SPACING.xl,
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.card,
      borderRadius: RADIUS.full,
      borderWidth: 2,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: SPACING.xl,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    fabText: { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Censure un titre de jeu pour ne montrer que la première lettre de chaque mot.
 * Les chiffres et les mots de 1-2 caractères sont conservés tels quels.
 * Ex : "The Sims 2" → "T** S*** 2"
 */
function censorTitle(title: string): string {
  return title
    .split(' ')
    .map((word) => {
      if (word.length <= 2 || /^\d+$/.test(word)) return word;
      return word[0] + '*'.repeat(word.length - 1);
    })
    .join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GameScreen({ onBack }: GameScreenProps) {
  const { width } = useWindowDimensions();
  const imgW = Math.min(width - SPACING.xl * 2, 480);
  const imgH = Math.round(imgW * 0.48);

  const { session, profile, refreshProfile, isGuest, guestProfile, refreshGuestProfile } = useAuthContext();
  const { prefs, colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const confettiPreset = CONFETTI_PRESETS[prefs.victoryEffectId] ?? CONFETTI_PRESETS.confetti;

  const {
    game, state, isLoading, blurRadius, attemptsLeft, category,
    canGetHint, canGetExtra, submitGuess, markScoreSubmitted,
    watchAdForHint, watchAdForExtraChance, acceptDefeat, activatePowerup,
  } = useGameStateContext();

  const [adCtx, setAdCtx]               = useState<AdContext>(null);
  const [showResult, setShowResult]      = useState(false);
  const [showReview, setShowReview]      = useState(false);
  const [toast, setToast]               = useState<string | null>(null);
  const [coinsAwarded, setCoinsAwarded]  = useState(0);
  const [usingPowerup, setUsingPowerup] = useState<PowerupType | null>(null);
  const [categoryTitles, setCategoryTitles] = useState<string[]>([]);

  // Abonnement actif : lu directement depuis profile.subscription_tier (Supabase).
  // Toute valeur non-free (basic/pro/legend) supprime les publicités.
  const isSubscribed = (profile?.subscription_tier ?? 'free') !== 'free';

  // Charge les titres de la catégorie courante pour l'autocomplétion.
  // - Reset immédiat au changement de catégorie (évite les suggestions parasites)
  // - Cache par catégorie : zéro requête si déjà chargé
  useEffect(() => {
    if (!category) return;

    // ── Cache hit → suggestions disponibles instantanément ────────────────
    const cached = _titlesByCategory.get(category);
    if (cached) {
      setCategoryTitles(cached);
      return;
    }

    // ── Pas encore en cache → réinitialise + fetch ─────────────────────────
    setCategoryTitles([]);
    let cancelled = false;

    supabase
      .from('daily_games')
      .select('game_name')
      .eq('category', category)
      .then(({ data }) => {
        if (cancelled) return;
        const titles = (data ?? []).map((r: { game_name: string }) => r.game_name);
        _titlesByCategory.set(category, titles);
        setCategoryTitles(titles);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [category]);

  // Animations
  const shakeX           = useRef(new Animated.Value(0)).current;
  const coinPopupY       = useRef(new Animated.Value(0)).current;
  const coinPopupOpacity = useRef(new Animated.Value(0)).current;
  const redOverlay       = useRef(new Animated.Value(0)).current;
  const toastTimeout     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confetti ref
  const confettiRef = useRef<ConfettiCannon>(null);

  // ── Flash rouge (défaite) ──────────────────────────────────────────────────
  const flashDefeatRed = useCallback(() => {
    redOverlay.setValue(0);
    Animated.sequence([
      Animated.timing(redOverlay, { toValue: 0.28, duration: 120, useNativeDriver: true }),
      Animated.timing(redOverlay, { toValue: 0.12, duration: 200, useNativeDriver: true }),
      Animated.timing(redOverlay, { toValue: 0,    duration: 500, useNativeDriver: true }),
    ]).start();
  }, [redOverlay]);

  // ── Auto-show result when game ends ────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'won' || state.status === 'lost' || state.status === 'skipped') {
      const delay = state.status === 'won' ? 1400 : 800;
      const t = setTimeout(() => setShowResult(true), delay);
      return () => clearTimeout(t);
    }
  }, [state.status]);

  // ── Animations victoire / défaite ─────────────────────────────────────────
  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (prevStatus.current === state.status) return;
    prevStatus.current = state.status;

    if (state.status === 'won') {
      // Confettis
      setTimeout(() => confettiRef.current?.start(), 100);
      // Haptics victoire : double notification succès
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 350);
      // Son pixel art
      playVictorySound();
      // Notifications : annuler la notif du jour + streak
      skipTodayNotification().catch(() => {});
      const newSerie = (profile?.serie_actuelle ?? 0) + 1;
      scheduleStreakNotification(newSerie).catch(() => {});
    } else if (state.status === 'lost' || state.status === 'skipped') {
      if (state.status === 'lost') {
        // Effets visuels/sonores uniquement — la soumission du score est
        // gérée dans le useEffect dédié ci-dessous (avec garde scoreSubmitted).
        flashDefeatRed();
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
        playDefeatSound();
      }
      // Dans tous les cas (lost ou skipped) → annuler la notif du jour
      skipTodayNotification().catch(() => {});
    }
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Record defeat — score = 0, aucune pièce ───────────────────────────────
  // Même pattern que la victoire : useEffect séparé avec garde scoreSubmitted
  // pour éviter toute double soumission au rechargement de l'app.
  useEffect(() => {
    if (state.status !== 'lost' || state.scoreSubmitted) return;
    if (!session && !isGuest) return;

    // Marquer immédiatement — empêche tout re-déclenchement (rechargement, re-render)
    markScoreSubmitted();

    if (isGuest) {
      // Défaite invité : décrément de série local uniquement, score = 0
      guestLoss().then(() => refreshGuestProfile()).catch(() => {});
      return;
    }

    NetInfo.fetch().then(async (netState) => {
      if (netState.isConnected !== false) {
        // En ligne : enregistrer l'historique + notifier le serveur (score=0 forcé)
        recordGameHistory(false, state.attempts.length, 0, 0).catch(() => {});
        submitGameResult(0, false, 0).catch(() => {});
      } else {
        // Hors ligne : file d'attente ; le serveur traitera à la reconnexion
        enqueueGameResult({
          won:      false,
          attempts: state.attempts.length,
          score:    0,
          coins:    0,
          newSerie: 0,
        }).catch(() => {});
      }
    });
  }, [state.status, state.scoreSubmitted, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit score + award coins when won ────────────────────────────────────
  useEffect(() => {
    if (state.status !== 'won' || state.scoreSubmitted) return;
    if (!session && !isGuest) return;

    const attemptsSnap = state.attempts.length;
    const currentSerie = isGuest ? (guestProfile?.serie_actuelle ?? 0) : (profile?.serie_actuelle ?? 0);
    const score        = calculateScore(attemptsSnap);
    const newSerie     = currentSerie + 1;
    const coins        = calculateCoins(attemptsSnap, currentSerie, true);

    console.log(
      '[GameScreen] 🏆 victoire — attempts:', attemptsSnap,
      '| score:', score, '| coins:', coins, '| serie:', currentSerie, '→', newSerie,
      '| isGuest:', isGuest,
    );

    // ── Chemin invité : tout en local ──────────────────────────────────────
    if (isGuest) {
      // markScoreSubmitted en premier pour éviter la double soumission
      markScoreSubmitted();
      guestWin({ score, coins, newSerie })
        .then(() => {
          console.log('[GameScreen] guestWin OK, coins:', coins);
          setCoinsAwarded(coins);
          return refreshGuestProfile();
        })
        .catch((err) => {
          console.error('[GameScreen] guestWin ERROR:', err);
        });
      trackWinAndCheckReview()
        .then((should) => { if (should) setShowReview(true); })
        .catch(() => {});
      return;
    }

    // ── Chemin authentifié ────────────────────────────────────────────────
    NetInfo.fetch().then(async (netState) => {
      const online = netState.isConnected !== false;
      console.log('[GameScreen] NetInfo online:', online);

      if (online) {
        // ① Soumettre le score (ne lève jamais d'erreur — log interne seulement)
        await submitGameResult(score, true, newSerie);
        console.log('[GameScreen] submitGameResult OK');

        // ② Créditer les pièces — si ça échoue on tente quand même refreshProfile
        try {
          console.log('[GameScreen] addCoins →', coins, 'pièces…');
          await addCoins(coins);
          console.log('[GameScreen] addCoins OK');
          setCoinsAwarded(coins);
        } catch (coinsErr) {
          // La RPC add_coins a échoué : on met en file pour la prochaine synchro
          console.error('[GameScreen] addCoins ERREUR — coins non crédités :', coinsErr);
          // On affiche quand même le popup (les pièces arriveront via la queue)
          setCoinsAwarded(coins);
          enqueueGameResult({ won: true, attempts: attemptsSnap, score, coins, newSerie }).catch(() => {});
        }

        // ③ Historique (non bloquant)
        recordGameHistory(true, attemptsSnap, score, coins).catch(() => {});

        // ④ Marquer la soumission après que les opérations critiques sont terminées
        markScoreSubmitted();
        console.log('[GameScreen] markScoreSubmitted OK');

        // ⑤ Rafraîchir le profil pour mettre à jour coins + série affichés
        try {
          await refreshProfile();
          console.log('[GameScreen] refreshProfile OK');
        } catch (refreshErr) {
          console.warn('[GameScreen] refreshProfile ERREUR:', refreshErr);
        }

        // ⑥ Demande d'avis éventuelle
        trackWinAndCheckReview()
          .then((should) => { if (should) setShowReview(true); })
          .catch(() => {});

      } else {
        // Hors ligne : file d'attente ; pièces créditées à la reconnexion
        console.log('[GameScreen] hors ligne → enqueueGameResult, coins:', coins);
        enqueueGameResult({ won: true, attempts: attemptsSnap, score, coins, newSerie }).catch(() => {});
        setCoinsAwarded(coins);
        markScoreSubmitted();
        refreshProfile().catch(() => {});
      }
    });
  }, [state.status, state.scoreSubmitted, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Coin popup animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (coinsAwarded <= 0) return;
    coinPopupY.setValue(0);
    coinPopupOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(coinPopupY,       { toValue: -80, duration: 1800, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(coinPopupOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();
  }, [coinsAwarded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shake ──────────────────────────────────────────────────────────────────
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 12,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 4,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ── Guess ─────────────────────────────────────────────────────────────────
  const handleGuess = useCallback((guess: string) => {
    submitGuess(guess);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    shake();
  }, [submitGuess, shake]);

  // ── Ad ────────────────────────────────────────────────────────────────────

  /** Récompense accordée après la pub (appelé depuis AdModal ou AdMob SDK). */
  const applyAdReward = useCallback((ctx: AdContext) => {
    if (ctx === 'hint')        watchAdForHint();
    else if (ctx === 'extra') { watchAdForExtraChance(); setShowResult(false); }
    else if (ctx === 'coins')  addCoins(25).then(refreshProfile).catch(() => {});
  }, [watchAdForHint, watchAdForExtraChance, refreshProfile]);

  /** Appelé par AdModal (mode Expo Go) quand le joueur clique "Récupérer". */
  const handleAdComplete = useCallback(() => {
    const ctx = adCtx;
    setAdCtx(null);
    applyAdReward(ctx);
  }, [adCtx, applyAdReward]);

  /**
   * Déclenche une pub récompensée.
   * - Abonné (basic/pro/legend) → récompense directe, aucune pub affichée.
   * - Expo Go → ouvre AdModal (simulé 5 s).
   * - Build EAS → appelle le SDK AdMob ; crédite uniquement si EARNED_REWARD.
   */
  const requestAdForCtx = useCallback(async (ctx: NonNullable<AdContext>) => {
    // Abonnés : pas de pub, récompense immédiate.
    if (isSubscribed) {
      applyAdReward(ctx);
      return;
    }

    if (IS_EXPO_GO) {
      // Expo Go : fallback vers AdModal simulée (5 s countdown).
      setAdCtx(ctx);
      return;
    }

    try {
      // Indice → placement dédié ; pièces / vie supplémentaire → placement boutique.
      const rewarded = ctx === 'hint'
        ? await showRewardedAdHint()
        : await showRewardedAdCoins();

      if (rewarded) {
        applyAdReward(ctx);
      } else {
        showToast('Pub indisponible, réessaie plus tard 📵');
      }
    } catch {
      showToast('Pub indisponible, réessaie plus tard 📵');
    }
  }, [isSubscribed, applyAdReward, showToast]);

  // ── Utiliser un power-up depuis l'inventaire ──────────────────────────────
  const handlePowerup = useCallback(async (def: PowerupDef) => {
    const stock = getStock(effectiveProfile, def.inventoryKey);
    if (stock <= 0) {
      showToast('Aucun item — achetez-en en boutique 🛍️');
      return;
    }
    setUsingPowerup(def.type);
    try {
      if (isGuest) {
        await useGuestItem(def.inventoryKey);
        activatePowerup(def.type);
        await refreshGuestProfile();
      } else {
        await useItem(def.inventoryKey);
        activatePowerup(def.type);
        await refreshProfile();
      }
    } catch (err: any) {
      if (err?.message?.includes('item_not_available')) {
        showToast('Item épuisé — revenez en boutique 🛍️');
      } else {
        showToast('Erreur — réessayez');
      }
    } finally {
      setUsingPowerup(null);
    }
  }, [isGuest, effectiveProfile, activatePowerup, refreshProfile, refreshGuestProfile, showToast]);

  // ── Fallback image — AVANT le return anticipé (Rules of Hooks) ────────────
  const fallbackImageUri = React.useMemo(() => {
    if (!game) return undefined;
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    return GAMES.find((g) => norm(g.title) === norm(game.title))?.imageUrl;
  }, [game]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || !game) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Chargement du jeu du jour…</Text>
      </View>
    );
  }

  const isOver        = state.status !== 'playing';
  // blurRadius gère déjà tous les états (playing/lost/won/skipped)
  // dont le blur partiel lors du premier échec → on l'utilise directement
  const effectiveBlur = blurRadius;
  const coins         = isGuest ? (guestProfile?.coins ?? 0) : (profile?.coins ?? 0);
  const streakSerie   = isGuest ? (guestProfile?.serie_actuelle ?? 0) : (profile?.serie_actuelle ?? 0);

  // Profil effectif pour les power-ups (invité ou Supabase)
  const effectiveProfile = isGuest ? (guestProfile as unknown as Profile | null) : profile;

  // ── Disponibilité des power-ups ───────────────────────────────────────────
  const canUsePowerup = (def: PowerupDef): boolean => {
    const stock = getStock(effectiveProfile, def.inventoryKey);
    if (stock <= 0) return false;
    switch (def.type) {
      case 'firstLetter': return !state.powerups.firstLetter && state.status === 'playing';
      case 'revealZone':  return !state.powerups.revealZone  && state.status === 'playing';
      case 'extraLife':   return !state.powerups.extraLife   && state.status === 'lost';
      case 'skip':        return state.status === 'playing';
    }
  };

  const isPowerupActive = (def: PowerupDef): boolean => {
    switch (def.type) {
      case 'firstLetter': return state.powerups.firstLetter;
      case 'revealZone':  return state.powerups.revealZone;
      case 'extraLife':   return state.powerups.extraLife;
      case 'skip':        return state.status === 'skipped';
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Overlay rouge défaite ────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.defeatOverlay, { opacity: redOverlay }]}
        pointerEvents="none"
      />

      {/* ── Effet de victoire (thémé) ────────────────────────────────────── */}
      <ConfettiCannon
        ref={confettiRef}
        count={confettiPreset.count}
        origin={{ x: width / 2, y: -20 }}
        autoStart={false}
        fadeOut
        fallSpeed={confettiPreset.fallSpeed}
        explosionSpeed={confettiPreset.explosionSpeed}
        colors={confettiPreset.colors}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {onBack && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={onBack}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                activeOpacity={0.65}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.title}>
                {'<'}PIXEL<Text style={styles.titleAccent}>NIGHT</Text>{'>'}
              </Text>
              <Text style={styles.dateLabel}>{getDisplayDate()}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.coinBadge}>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.coinCount}>{coins.toLocaleString('fr-FR')}</Text>
            </View>
            <View style={styles.pixelBadge}>
              <Text style={styles.pixelBadgeText}>{blurToLabel(effectiveBlur)}</Text>
            </View>
          </View>
        </View>

        {/* Image */}
        <View>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <PixelImage
              uri={game.imageUrl}
              blurRadius={effectiveBlur}
              width={imgW}
              height={imgH}
              fallbackUri={fallbackImageUri}
              revealZone={state.powerups.revealZone}
            />
          </Animated.View>

          {/* Coin popup */}
          {coinsAwarded > 0 && (
            <Animated.View
              style={[styles.coinPopup, { transform: [{ translateY: coinPopupY }], opacity: coinPopupOpacity }]}
              pointerEvents="none"
            >
              <Text style={styles.coinPopupText}>+{coinsAwarded} 🪙</Text>
            </Animated.View>
          )}
        </View>

        {/* Clarity meter + streak */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
          <ClarityMeter blurRadius={effectiveBlur} />
          {streakSerie >= 2 && (
            <View style={styles.streakInlineBadge}>
              <FlameStreak serie={streakSerie} large={false} />
              <Text style={styles.streakInlineText}>
                victoire{streakSerie > 1 ? 's' : ''} d'affilée
              </Text>
            </View>
          )}
        </View>

        {/* Première lettre révélée */}
        {state.powerups.firstLetter && (
          <View style={styles.firstLetterBadge}>
            <Ionicons name="text-outline" size={13} color={colors.info} />
            <Text style={styles.firstLetterText}>
              Première lettre :{' '}
              <Text style={styles.firstLetterChar}>{game.title[0].toUpperCase()}</Text>
            </Text>
          </View>
        )}

        {/* Barre de power-ups (inventaire) */}
        <PowerupBar
          defs={POWERUP_DEFS}
          profile={effectiveProfile}
          canUsePowerup={canUsePowerup}
          isPowerupActive={isPowerupActive}
          usingPowerup={usingPowerup}
          onUse={handlePowerup}
        />

        {/* Toast */}
        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* Attempts */}
        <AttemptsList attempts={state.attempts} />

        {/* Input */}
        {!isOver && (
          <GuessInput
            onSubmit={handleGuess}
            attemptsLeft={attemptsLeft}
            extraTitles={categoryTitles}
          />
        )}

        {/* Hint panel */}
        {(state.hintsRevealed > 0 || canGetHint) && (
          <HintPanel
            game={game}
            hintsRevealed={state.hintsRevealed}
            canGetHint={canGetHint}
            onRequestHint={() => requestAdForCtx('hint')}
            adFree={isSubscribed}
          />
        )}

        {/* First-time hint CTA */}
        {state.hintsRevealed === 0 && canGetHint && state.attempts.length === 0 && (
          <TouchableOpacity style={styles.hintCta} onPress={() => requestAdForCtx('hint')} activeOpacity={0.8}>
            <Ionicons name="bulb-outline" size={15} color={colors.warning} />
            <Text style={styles.hintCtaText}>
              {isSubscribed ? 'Obtenir un indice' : 'Obtenir un indice (pub)'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Défaite — nom censuré tant que le joueur n'a pas accepté la défaite.
             Couvre les deux cas : 3 échecs (canGetExtra=true) et 4 échecs après pub
             (canGetExtra=false). L'image reste floue (BLUR_DEFEAT_PARTIAL). */}
        {state.status === 'lost' && !state.defeatAccepted && (
          <View style={[styles.revealBanner, styles.revealBannerCensored]}>
            <Ionicons name="eye-off-outline" size={17} color={colors.accent} />
            <Text style={styles.revealText}>
              C'était : <Text style={styles.revealGame}>{censorTitle(game.title)}</Text>
            </Text>
          </View>
        )}

        {/* Défaite acceptée : révélation complète (image + titre). */}
        {state.status === 'lost' && state.defeatAccepted && (
          <View style={styles.revealBanner}>
            <Ionicons name="skull-outline" size={17} color={colors.accent} />
            <Text style={styles.revealText}>
              C'était : <Text style={styles.revealGame}>{game.title}</Text>
            </Text>
          </View>
        )}

        {/* Passé */}
        {state.status === 'skipped' && (
          <View style={[styles.revealBanner, styles.revealBannerSkipped]}>
            <Ionicons name="play-skip-forward" size={17} color={colors.success} />
            <Text style={styles.revealText}>
              C'était : <Text style={[styles.revealGame, { color: colors.success }]}>{game.title}</Text>
            </Text>
          </View>
        )}

        <View style={{ height: SPACING.xxl * 2 }} />
      </ScrollView>

      {/* FAB résultat */}
      {isOver && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowResult(true)} activeOpacity={0.85}>
          <Ionicons
            name={state.status === 'won' ? 'trophy' : state.status === 'skipped' ? 'play-skip-forward' : 'information-circle-outline'}
            size={22}
            color={state.status === 'won' ? colors.warning : state.status === 'skipped' ? colors.success : colors.text}
          />
          <Text style={styles.fabText}>Voir le résultat</Text>
        </TouchableOpacity>
      )}

      <AdModal
        visible={adCtx !== null}
        type={adCtx ?? 'hint'}
        onComplete={handleAdComplete}
        onDismiss={() => setAdCtx(null)}
      />


      <ResultModal
        visible={showResult}
        status={state.status}
        game={game}
        attemptsUsed={state.attempts.length}
        canGetExtra={canGetExtra}
        defeatAccepted={state.defeatAccepted}
        onWatchAdForExtra={() => requestAdForCtx('extra')}
        onAcceptDefeat={() => { acceptDefeat(); setShowResult(false); }}
        onDismiss={() => setShowResult(false)}
        attempts={state.attempts}
        hintsRevealed={state.hintsRevealed}
        hasWatchedAdForExtra={state.hasWatchedAdForExtra}
        serie={profile?.serie_actuelle ?? 0}
        coinsEarned={coinsAwarded}
      />

      {/* Popup demande d'avis — après la 3e victoire */}
      <ReviewModal
        visible={showReview}
        onDismiss={() => setShowReview(false)}
      />

    </View>
  );
}

// ─── PowerupBar ───────────────────────────────────────────────────────────────

interface PowerupBarProps {
  defs:            PowerupDef[];
  profile:         Profile | null;
  canUsePowerup:   (def: PowerupDef) => boolean;
  isPowerupActive: (def: PowerupDef) => boolean;
  usingPowerup:    PowerupType | null;
  onUse:           (def: PowerupDef) => void;
}

function createPwStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    scroll:   { width: '100%' },
    row:      { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: 2 },
    btn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
      paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.full, borderWidth: 1,
      minWidth: 88,
    },
    btnActive: { backgroundColor: 'transparent' },
    btnUsable: { backgroundColor: colors.card, borderColor: colors.border },
    btnDim:    { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.4 },
    label:     { fontSize: FONTS.size.xs, fontWeight: FONTS.weight.medium, flex: 1 },
    labelUsable:{ color: colors.textSecondary },
    labelDim:  { color: colors.textMuted },
    stockBadge:{ borderRadius: RADIUS.full, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1 },
    stockHas:  { backgroundColor: 'transparent', borderColor: colors.border },
    stockEmpty:{ backgroundColor: 'transparent', borderColor: colors.border },
    stockText: { fontSize: 10, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace' },
    stockTextEmpty: { color: colors.textMuted },
  });
}

function PowerupBar({ defs, profile, canUsePowerup, isPowerupActive, usingPowerup, onUse }: PowerupBarProps) {
  const { colors, fontFamily } = useTheme();
  const pw = useMemo(() => createPwStyles(colors, fontFamily), [colors, fontFamily]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={pw.scroll}
      contentContainerStyle={pw.row}
    >
      {defs.map((def) => {
        const active  = isPowerupActive(def);
        const usable  = canUsePowerup(def);
        const stock   = getStock(profile, def.inventoryKey);
        const loading = usingPowerup === def.type;

        return (
          <TouchableOpacity
            key={def.type}
            style={[
              pw.btn,
              active  ? [pw.btnActive, { borderColor: def.color }] :
              usable  ? pw.btnUsable :
              pw.btnDim,
            ]}
            onPress={usable && !loading ? () => onUse(def) : undefined}
            activeOpacity={usable ? 0.75 : 1}
          >
            {loading ? (
              <ActivityIndicator size="small" color={def.color} />
            ) : (
              <Ionicons
                name={def.icon as any}
                size={15}
                color={active ? def.color : usable ? colors.textSecondary : colors.textMuted}
              />
            )}
            <Text style={[pw.label, active ? { color: def.color } : usable ? pw.labelUsable : pw.labelDim]}>
              {def.label}
            </Text>
            {active ? (
              <Ionicons name="checkmark-circle" size={12} color={def.color} />
            ) : (
              <View style={[pw.stockBadge, stock > 0 ? pw.stockHas : pw.stockEmpty]}>
                <Text style={[pw.stockText, stock > 0 ? { color: def.color } : pw.stockTextEmpty]}>
                  ×{stock}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── ClarityMeter ─────────────────────────────────────────────────────────────

function createMeterStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start' },
    label: { color: colors.textMuted, fontSize: FONTS.size.xs },
    track: { flexDirection: 'row', gap: 2 },
    seg:   { width: 14, height: 6, borderRadius: 2 },
    segOn: { backgroundColor: colors.success },
    segOff:{ backgroundColor: colors.border },
    pct:   { color: colors.textMuted, fontSize: FONTS.size.xs, width: 32 },
  });
}

function ClarityMeter({ blurRadius }: { blurRadius: number }) {
  const { colors, fontFamily } = useTheme();
  const meter = useMemo(() => createMeterStyles(colors), [colors]);

  const clarity = Math.max(0, Math.min(1, 1 - blurRadius / 28));
  const segs = 8;
  return (
    <View style={meter.row}>
      <Ionicons name="eye-outline" size={12} color={colors.textMuted} />
      <Text style={meter.label}>Clarté</Text>
      <View style={meter.track}>
        {Array.from({ length: segs }, (_, i) => (
          <View key={i} style={[meter.seg, i / segs < clarity ? meter.segOn : meter.segOff]} />
        ))}
      </View>
      <Text style={meter.pct}>{Math.round(clarity * 100)}%</Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blurToLabel(blur: number): string {
  if (blur <= 2)   return 'HD';
  if (blur >= 22)  return '8px';
  if (blur >= 16)  return '16px';
  if (blur >= 10)  return '32px';
  return '64px';
}

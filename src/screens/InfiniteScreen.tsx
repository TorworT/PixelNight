import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { supabase, DailyGameRow, resolveImageUrl } from '../lib/supabase';
import { SubscriptionScreen } from './SubscriptionScreen';
import { PixelImage } from '../components/PixelImage';
import { GuessInput } from '../components/GuessInput';
import { AttemptsList } from '../components/AttemptsList';
import { HintPanel } from '../components/HintPanel';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';
import { useAuthContext } from '../context/AuthContext';
import { addCoins } from '../lib/profiles';
import { loadJSON, saveJSON } from '../utils/storage';
import { getDateString } from '../utils/dateUtils';
import type { Game } from '../constants/games';
import type { Attempt, GameStatus } from '../hooks/useGameState';
import { playVictorySound, playDefeatSound } from '../utils/pixelSound';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InfiniteGameState {
  attempts:             Attempt[];
  maxAttempts:          number;
  hintsRevealed:        number;
  status:               GameStatus;
  hasWatchedAdForExtra: boolean;
  defeatAccepted:       boolean;
}

interface PlayedResult {
  status:   'won' | 'lost';
  attempts: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS     = 3;
const MAX_HINTS        = 3;
const MAX_COINS_REWARD = 10;

const BLUR_MAX            = 28;
const BLUR_MIN            = 4;
const BLUR_DEFEAT_PARTIAL = 14;

/** Métadonnées par catégorie : libellé, emoji, couleur d'accent. */
const CATEGORY_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  games:        { label: 'Jeux Vidéo',   emoji: '🎮', color: '#e94560' },
  anime:        { label: 'Animé',        emoji: '⭐', color: '#a855f7' },
  dessinsanime: { label: 'Dessin Animé', emoji: '🎨', color: '#f97316' },
};

/** Catégories récupérées depuis Supabase. */
const ALL_CATEGORIES = ['games', 'anime', 'dessinsanime'] as const;

const INITIAL_GS: InfiniteGameState = {
  attempts:             [],
  maxAttempts:          MAX_ATTEMPTS,
  hintsRevealed:        0,
  status:               'playing',
  hasWatchedAdForExtra: false,
  defeatAccepted:       false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function computeBlur(gs: InfiniteGameState): number {
  if (gs.status === 'playing') {
    const step = (BLUR_MAX - BLUR_MIN) / Math.max(gs.maxAttempts, 1);
    return Math.max(BLUR_MIN, Math.round(BLUR_MAX - gs.attempts.length * step));
  }
  if (gs.status === 'lost') return gs.defeatAccepted ? 0 : BLUR_DEFEAT_PARTIAL;
  return 0; // won
}

function censorTitle(title: string): string {
  return title
    .split(' ')
    .map((w) => {
      if (w.length <= 2 || /^\d+$/.test(w)) return w;
      return w[0] + '*'.repeat(w.length - 1);
    })
    .join(' ');
}

function rowToGame(row: DailyGameRow): Game {
  return {
    id:        row.id,
    title:     row.game_name,
    imageUrl:  resolveImageUrl(row.image_url, row.category),
    hints:     [row.hint1, row.hint2, row.hint3],
    year:      0,
    genre:     row.category,
    developer: '',
    aliases:   row.aliases ?? [],
  };
}

/** "lundi 3 mars 2025" */
function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** "Mars 2025" — en-tête de section */
function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** "2025" */
function getYear(dateStr: string): string {
  return dateStr.slice(0, 4);
}

function playedKey(gameId: string): string {
  return `infinite_result_${gameId}`;
}

/** Coins : 1 essai → 10, 2 → 7, 3 → 4, 4+ → 1. */
function computeCoins(attempts: number): number {
  return Math.min(MAX_COINS_REWARD, Math.max(1, MAX_COINS_REWARD - (attempts - 1) * 3));
}

// ─── Cache module-level ───────────────────────────────────────────────────────
// Persiste en mémoire tant que l'app est active — évite les rechargements
// inutiles lors de la navigation entre écrans.

interface GameCache {
  rows:      DailyGameRow[];
  titles:    string[];
  fetchedAt: number;
}

let _gameCache: GameCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

// ─── Hook shimmer ─────────────────────────────────────────────────────────────

function useShimmer(): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return anim;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.background },
    centered:    { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    loadingText: { color: colors.textMuted, fontSize: FONTS.size.md },

    // ── Header commun ──
    header: {
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.sm,
    },
    headerLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
    backBtn:     { paddingTop: 3 },
    titleBlock:  { gap: 2 },
    title:       { color: colors.text, fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.black, letterSpacing: 2, fontFamily: ff ?? 'monospace' },
    titleAccent: { color: colors.accent },
    dateLabel:   { color: colors.textMuted, fontSize: FONTS.size.xs, textTransform: 'capitalize' as const },
    modeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: '#a78bfa22',
      borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#a78bfa',
      paddingHorizontal: SPACING.sm, paddingVertical: 3,
    },
    modeBadgeText: {
      color: '#a78bfa', fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.black, letterSpacing: 1,
      fontFamily: ff ?? 'monospace',
    },

    // ── Sélecteur d'année (vue ④ — accueil infini) ──
    yearPickerScroll:        { flex: 1 },
    yearPickerContent:       { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: SPACING.xxl * 2, gap: SPACING.md },
    yearCard:                { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' as const, flexDirection: 'row' as const },
    yearCardAccent:          { width: 4, backgroundColor: '#a78bfa' },
    yearCardBody:            { flex: 1, padding: SPACING.lg, gap: SPACING.sm },
    yearCardRow:             { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    yearCardYear:            { color: colors.text, fontSize: 52, fontWeight: FONTS.weight.black, lineHeight: 56, letterSpacing: -1, fontFamily: ff ?? 'monospace' },
    yearCardSub:             { color: colors.textMuted, fontSize: FONTS.size.sm },
    yearCardCatRow:          { flexDirection: 'row' as const, gap: SPACING.sm, flexWrap: 'wrap' as const },
    yearCardProgressRow:     { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.sm, marginTop: 2 },
    yearCardProgressTrack:   { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: RADIUS.full, overflow: 'hidden' as const },
    yearCardProgressFill:    { height: 5, backgroundColor: '#a78bfa', borderRadius: RADIUS.full },
    yearCardProgressLabel:   { color: colors.textMuted, fontSize: FONTS.size.xs, fontFamily: ff ?? 'monospace', minWidth: 52, textAlign: 'right' as const },

    // ── En-tête liste de jeux d'une année (vue ⑤) ──
    listHeader:     { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.sm, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
    listHeaderBack: { padding: SPACING.xs },
    listHeaderYear: { flex: 1, color: colors.text, fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace', letterSpacing: 2 },

    // ── Liste ──
    listContent: {
      paddingHorizontal: SPACING.xl, paddingTop: SPACING.xs,
      paddingBottom: SPACING.xxl * 2, gap: SPACING.sm,
    },
    sectionHeader: {
      color: colors.textMuted, fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold, letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginTop: SPACING.md, marginBottom: SPACING.xs,
    },

    card:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md },
    cardThumb:  { borderRadius: RADIUS.sm, overflow: 'hidden' as const },
    cardBody:   { flex: 1, gap: 4 },
    cardDate:   { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, textTransform: 'capitalize' as const },
    cardSub:    { color: colors.textMuted, fontSize: FONTS.size.xs },

    // Badge catégorie sur la carte
    catBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' as const, borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
    catBadgeText: { fontSize: 10, fontWeight: FONTS.weight.bold },

    wonBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' as const, backgroundColor: colors.successDim, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.success, paddingHorizontal: 8, paddingVertical: 2 },
    wonText:   { color: colors.success, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    lostBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' as const, backgroundColor: colors.accentDim, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2 },
    lostText:  { color: colors.accent, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },

    emptyBlock: { alignItems: 'center' as const, paddingTop: SPACING.xxl, gap: SPACING.md },
    emptyText:  { color: colors.textMuted, fontSize: FONTS.size.sm },

    // ── Vue de jeu ──
    scroll:  { flex: 1 },
    content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.lg, alignItems: 'center' as const },

    toast:     { backgroundColor: colors.cardAlt, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.border, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.lg, alignSelf: 'center' as const },
    toastText: { color: colors.text, fontSize: FONTS.size.sm },

    revealBanner:         { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.accentDim, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.accent, padding: SPACING.md, width: '100%' },
    revealBannerWon:      { backgroundColor: colors.successDim, borderColor: colors.success },
    revealBannerCensored: { backgroundColor: colors.accentDim + '88', borderStyle: 'dashed' as const },
    revealText:           { color: colors.text, fontSize: FONTS.size.sm, flex: 1 },
    revealGame:           { fontWeight: FONTS.weight.bold, color: colors.accent },
    revealGameWon:        { color: colors.success },

    // ── Panneau résultat inline ──
    resultPanel:     { width: '100%', backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1.5, padding: SPACING.lg, gap: SPACING.md, alignItems: 'center' as const },
    resultPanelWon:  { borderColor: '#fbbf2466' },
    resultPanelLost: { borderColor: colors.accent + '66' },
    resultEmoji:     { fontSize: 36, textAlign: 'center' as const },
    resultTitle:     { color: colors.text, fontSize: FONTS.size.xl, fontWeight: FONTS.weight.black, textAlign: 'center' as const, fontFamily: ff ?? 'monospace' },
    resultSubtitle:  { color: colors.textMuted, fontSize: FONTS.size.sm, textAlign: 'center' as const },
    resultCoinsRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.warningDim, borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.warning, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
    resultCoinsText: { color: colors.warning, fontSize: FONTS.size.md, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace' },
    resultCoinsCap:  { color: colors.textMuted, fontSize: FONTS.size.xs },
    resultBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.cardAlt, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md, width: '100%' },
    resultBtnText:   { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },

    // ── Boutons défaite ──
    defeatBtns:          { width: '100%', gap: SPACING.sm },
    extraChanceBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: '#a78bfa22', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#a78bfa', padding: SPACING.md },
    extraChanceBtnText:  { color: '#a78bfa', fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },
    acceptDefeatBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.accentDim, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.accent, padding: SPACING.md },
    acceptDefeatBtnText: { color: colors.accent, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },

    // ── Mur de mise à niveau ──
    upgradeRoot:      { flex: 1, backgroundColor: colors.background, alignItems: 'center' as const, justifyContent: 'center' as const, padding: SPACING.xl, gap: SPACING.lg },
    upgradeEmoji:     { fontSize: 56, textAlign: 'center' as const },
    upgradeTitle:     { color: colors.text, fontSize: FONTS.size.xl, fontWeight: FONTS.weight.black, textAlign: 'center' as const, fontFamily: ff ?? 'monospace', letterSpacing: 1 },
    upgradeSub:       { color: colors.textMuted, fontSize: FONTS.size.sm, textAlign: 'center' as const, lineHeight: 20 },
    upgradePerksBox:  { width: '100%', backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#a78bfa44', padding: SPACING.md, gap: SPACING.sm },
    upgradePerk:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    upgradePerkText:  { color: colors.textSecondary, fontSize: FONTS.size.sm },
    upgradeBtn:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#a78bfa', borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
    upgradeBtnText:   { color: '#ffffff', fontSize: FONTS.size.md, fontWeight: FONTS.weight.black },
    upgradeTierNote:  { color: colors.textMuted, fontSize: FONTS.size.xs },
    upgradeRetryBtn:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: 'transparent', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#a78bfa66', paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md },
    upgradeRetryText: { color: '#a78bfa', fontSize: FONTS.size.xs, fontWeight: FONTS.weight.medium },

    // ── Badge centré sous le header ──
    headerBadgeRow: { alignItems: 'center' as const, paddingBottom: SPACING.sm },

    // ── Squelettes de chargement (skeleton loader) ──
    skeletonYearNum:  { width: 120, height: 52, borderRadius: 8,          backgroundColor: colors.border },
    skeletonLine:     { height: 12,  borderRadius: 6,                     backgroundColor: colors.border },
    skeletonBadge:    { width: 52,  height: 22,  borderRadius: RADIUS.sm, backgroundColor: colors.border },
    skeletonProgress: { height: 5,  borderRadius: RADIUS.full,            backgroundColor: colors.border },
    skeletonThumb:    { width: 64,  height: 44,  borderRadius: RADIUS.sm, backgroundColor: colors.border },
  });
}

// ─── InfiniteScreen ───────────────────────────────────────────────────────────

export function InfiniteScreen() {
  const { colors, fontFamily } = useTheme();
  const styles  = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const shimmer = useShimmer();
  const { width } = useWindowDimensions();
  const { profile, refreshProfile, isGuest } = useAuthContext();

  // ── Vérification de l'abonnement ─────────────────────────────────────────
  const [showSub,    setShowSub]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRetry = useCallback(() => {
    setRefreshing(true);
    refreshProfile()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refreshProfile]);

  const hasAccess = !isGuest
    && (profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'legend');

  // ── Données de la liste ───────────────────────────────────────────────────
  // Initialisées depuis le cache module-level : zéro flash au retour sur l'écran.
  const [pastGames,   setPastGames]   = useState<DailyGameRow[]>(() => _gameCache?.rows    ?? []);
  const [allTitles,   setAllTitles]   = useState<string[]>(      () => _gameCache?.titles  ?? []);
  // Skeleton affiché uniquement s'il n'y a encore aucune donnée en cache.
  const [loadingList, setLoadingList] = useState<boolean>(() => _gameCache === null);
  const [playedMap,   setPlayedMap]   = useState<Record<string, PlayedResult>>({});

  // Onglet année sélectionné (null = sélecteur d'années affiché)
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAccess) { setLoadingList(false); return; }

    // ── Cache frais → données déjà en state, rien à faire ──────────────────
    if (_gameCache && Date.now() - _gameCache.fetchedAt < CACHE_TTL_MS) {
      setPastGames(_gameCache.rows);
      setAllTitles(_gameCache.titles);
      setLoadingList(false);
      return;
    }

    // ── Pas de cache → skeleton visible ────────────────────────────────────
    // ── Cache périmé → rafraîchissement silencieux (stale-while-revalidate) ─
    if (!_gameCache) setLoadingList(true);

    let cancelled = false;

    // Jeux passés (requête principale)
    supabase
      .from('daily_games')
      .select('*')
      .in('category', [...ALL_CATEGORIES])
      .lt('date', getDateString())
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as DailyGameRow[];
        _gameCache = { rows, titles: _gameCache?.titles ?? [], fetchedAt: Date.now() };
        setPastGames(rows);
        setLoadingList(false);
      })
      .catch(() => { if (!cancelled) setLoadingList(false); });

    // Titres pour l'autocomplétion (requête secondaire, non bloquante)
    supabase
      .from('daily_games')
      .select('game_name')
      .in('category', [...ALL_CATEGORIES])
      .then(({ data }) => {
        if (cancelled) return;
        const titles = (data ?? []).map((r: { game_name: string }) => r.game_name);
        if (_gameCache) _gameCache.titles = titles;
        else _gameCache = { rows: [], titles, fetchedAt: 0 };
        setAllTitles(titles);
      })
      .catch(() => {});

    // Annule les mises à jour si le composant est démonté entre-temps
    return () => { cancelled = true; };
  }, [hasAccess]);

  // Charge les résultats sauvegardés dès que la liste est disponible
  useEffect(() => {
    if (pastGames.length === 0) return;
    Promise.all(
      pastGames.map((row) =>
        loadJSON<PlayedResult>(playedKey(row.id)).then((r) => ({ id: row.id, r })),
      ),
    ).then((entries) => {
      const map: Record<string, PlayedResult> = {};
      for (const { id, r } of entries) { if (r) map[id] = r; }
      setPlayedMap(map);
    });
  }, [pastGames]);

  // ── Années disponibles (triées décroissantes) ─────────────────────────────
  const years = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const row of pastGames) set.add(getYear(row.date));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [pastGames]);

  // Réinitialise selectedYear si les données changent et qu'elle n'est plus valide
  useEffect(() => {
    if (selectedYear !== null && years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(null);
    }
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Statistiques par année (totaux, joués, trouvés, par catégorie) ──────────
  const yearStats = useMemo<
    Record<string, { total: number; played: number; won: number; cats: Record<string, number> }>
  >(() => {
    const stats: Record<string, { total: number; played: number; won: number; cats: Record<string, number> }> = {};
    for (const row of pastGames) {
      const y = getYear(row.date);
      if (!stats[y]) stats[y] = { total: 0, played: 0, won: 0, cats: {} };
      stats[y].total++;
      stats[y].cats[row.category] = (stats[y].cats[row.category] ?? 0) + 1;
      const result = playedMap[row.id];
      if (result) {
        stats[y].played++;
        if (result.status === 'won') stats[y].won++;
      }
    }
    return stats;
  }, [pastGames, playedMap]);

  // ── Sections (filtrées par année, groupées par mois décroissant) ──────────
  const sections = useMemo(() => {
    if (!selectedYear) return [];
    const filtered = pastGames.filter((row) => getYear(row.date) === selectedYear);
    // pastGames est déjà trié date DESC depuis Supabase
    const map = new Map<string, DailyGameRow[]>();
    for (const row of filtered) {
      const key = formatMonth(row.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [pastGames, selectedYear]);

  // ── État de la partie en cours ────────────────────────────────────────────
  const [selectedRow,  setSelectedRow]  = useState<DailyGameRow | null>(null);
  const [gs,           setGs]           = useState<InfiniteGameState>(INITIAL_GS);
  const [coinsAwarded, setCoinsAwarded] = useState(0);
  const [toast,        setToast]        = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeX     = useRef(new Animated.Value(0)).current;

  // ── Animations ────────────────────────────────────────────────────────────
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue:  12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   4, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ── Sélectionner un jeu passé ─────────────────────────────────────────────
  const handleSelectGame = useCallback((row: DailyGameRow) => {
    setSelectedRow(row);
    setGs(INITIAL_GS);
    setCoinsAwarded(0);
    setToast(null);
  }, []);

  const game = useMemo(() => selectedRow ? rowToGame(selectedRow) : null, [selectedRow]);

  // ── Soumettre une réponse ──────────────────────────────────────────────────
  const handleGuess = useCallback((guess: string) => {
    if (!game || !selectedRow || gs.status !== 'playing') return;
    if (gs.attempts.length >= gs.maxAttempts) return;

    const isCorrect =
      normalize(guess) === normalize(game.title) ||
      (game.aliases ?? []).some((a) => normalize(guess) === normalize(a));

    const newAttempts: Attempt[] = [...gs.attempts, { text: guess, isCorrect }];

    let newStatus: GameStatus = 'playing';
    if (isCorrect) newStatus = 'won';
    else if (newAttempts.length >= gs.maxAttempts) newStatus = 'lost';

    const newDefeatAccepted =
      gs.defeatAccepted ||
      (newStatus === 'lost' && gs.hasWatchedAdForExtra);

    setGs({ ...gs, attempts: newAttempts, status: newStatus, defeatAccepted: newDefeatAccepted });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    shake();

    if (newStatus === 'won') {
      playVictorySound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const coins = computeCoins(newAttempts.length);
      setCoinsAwarded(coins);
      if (!isGuest) addCoins(coins).then(() => refreshProfile()).catch(() => {});
      const result: PlayedResult = { status: 'won', attempts: newAttempts.length };
      saveJSON(playedKey(selectedRow.id), result);
      setPlayedMap((prev) => ({ ...prev, [selectedRow.id]: result }));
    } else if (newStatus === 'lost' && newDefeatAccepted) {
      playDefeatSound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const result: PlayedResult = { status: 'lost', attempts: newAttempts.length };
      saveJSON(playedKey(selectedRow.id), result);
      setPlayedMap((prev) => ({ ...prev, [selectedRow.id]: result }));
    }
  }, [game, selectedRow, gs, shake, isGuest, refreshProfile]);

  // ── Indice (gratuit pour les abonnés) ─────────────────────────────────────
  const handleRequestHint = useCallback(() => {
    if (gs.hintsRevealed >= MAX_HINTS || gs.status !== 'playing') return;
    setGs((prev) => ({ ...prev, hintsRevealed: prev.hintsRevealed + 1 }));
  }, [gs.hintsRevealed, gs.status]);

  // ── Chance supplémentaire (gratuite en mode infini) ───────────────────────
  const handleExtraChance = useCallback(() => {
    if (gs.status !== 'lost' || gs.hasWatchedAdForExtra) return;
    setGs((prev) => ({
      ...prev,
      status:               'playing',
      maxAttempts:          prev.maxAttempts + 1,
      hasWatchedAdForExtra: true,
      defeatAccepted:       false,
    }));
  }, [gs.status, gs.hasWatchedAdForExtra]);

  // ── Accepter la défaite ────────────────────────────────────────────────────
  const handleAcceptDefeat = useCallback(() => {
    if (!selectedRow || gs.status !== 'lost' || gs.defeatAccepted) return;
    setGs((prev) => ({ ...prev, defeatAccepted: true }));
    playDefeatSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const result: PlayedResult = { status: 'lost', attempts: gs.attempts.length };
    saveJSON(playedKey(selectedRow.id), result);
    setPlayedMap((prev) => ({ ...prev, [selectedRow.id]: result }));
  }, [selectedRow, gs]);

  // ─────────────────────────────────────────────────────────────────────────
  // ① Profil en cours de chargement
  // ─────────────────────────────────────────────────────────────────────────
  if (!isGuest && profile === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ② Mur de mise à niveau (free / basic)
  // ─────────────────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <View style={styles.upgradeRoot}>
        <Text style={styles.upgradeEmoji}>♾️</Text>

        <View style={styles.modeBadge}>
          <Ionicons name="infinite" size={12} color="#a78bfa" />
          <Text style={styles.modeBadgeText}>MODE INFINI</Text>
        </View>

        <Text style={styles.upgradeTitle}>Rejoue le passé</Text>
        <Text style={styles.upgradeSub}>
          Accède à tous les jeux déjà proposés et rejoue-les sans limite.{'\n'}
          Disponible avec les abonnements Pro et Legend.
        </Text>

        <View style={styles.upgradePerksBox}>
          {[
            'Toutes catégories : Jeux, Animé, Dessin Animé',
            'Chance supplémentaire gratuite par partie',
            'Indices gratuits, sans publicités',
            'Résultats sauvegardés par partie',
          ].map((perk) => (
            <View key={perk} style={styles.upgradePerk}>
              <Ionicons name="checkmark-circle" size={15} color="#a78bfa" />
              <Text style={styles.upgradePerkText}>{perk}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.upgradeBtn} onPress={() => setShowSub(true)} activeOpacity={0.85}>
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.upgradeBtnText}>Passer à Pro</Text>
        </TouchableOpacity>

        <Text style={styles.upgradeTierNote}>À partir de 3,99 €/mois · Annulable à tout moment</Text>

        <TouchableOpacity
          style={styles.upgradeRetryBtn}
          onPress={handleRetry}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={13} color="#a78bfa" />
          <Text style={styles.upgradeRetryText}>
            {refreshing ? 'Actualisation…' : 'Vérifier mon abonnement'}
          </Text>
        </TouchableOpacity>

        <SubscriptionScreen
          visible={showSub}
          onDismiss={() => {
            setShowSub(false);
            refreshProfile().catch(() => {});
          }}
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ③ Vue de jeu (un jeu passé sélectionné)
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedRow && game) {
    const blurRadius   = computeBlur(gs);
    const imgW         = Math.min(width - SPACING.xl * 2, 480);
    const imgH         = Math.round(imgW * 0.48);
    const isOver       = gs.status !== 'playing';
    const canGetHint   = gs.hintsRevealed < MAX_HINTS && gs.status === 'playing';
    const canGetExtra  = gs.status === 'lost' && !gs.hasWatchedAdForExtra && !gs.defeatAccepted;
    const attemptsLeft = Math.max(0, gs.maxAttempts - gs.attempts.length);
    const showResult   = isOver && (gs.status === 'won' || (gs.status === 'lost' && gs.defeatAccepted));
    const catInfo      = CATEGORY_INFO[selectedRow.category] ?? CATEGORY_INFO.games;

    return (
      <View style={styles.root}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setSelectedRow(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>
                {'<'}PIXEL<Text style={styles.titleAccent}>NIGHT</Text>{'>'}
              </Text>
              <Text style={styles.dateLabel}>{formatDateLong(selectedRow.date)}</Text>
            </View>
          </View>
        </View>

        {/* ── Badge MODE INFINI centré — toujours visible ───────────────── */}
        <View style={styles.headerBadgeRow}>
          <View style={styles.modeBadge}>
            <Ionicons name="infinite" size={12} color="#a78bfa" />
            <Text style={styles.modeBadgeText}>MODE INFINI</Text>
          </View>
        </View>

        {/* ── Contenu scrollable ───────────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Image */}
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <PixelImage
              uri={game.imageUrl}
              blurRadius={blurRadius}
              width={imgW}
              height={imgH}
            />
          </Animated.View>

          {/* Toast */}
          {toast !== null && (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          )}

          {/* Tentatives */}
          <AttemptsList attempts={gs.attempts} />

          {/* Saisie */}
          {!isOver && (
            <GuessInput
              onSubmit={handleGuess}
              attemptsLeft={attemptsLeft}
              extraTitles={allTitles}
            />
          )}

          {/* Indices gratuits pour les abonnés */}
          {(gs.hintsRevealed > 0 || canGetHint) && (
            <HintPanel
              game={game}
              hintsRevealed={gs.hintsRevealed}
              canGetHint={canGetHint}
              onRequestHint={handleRequestHint}
              adFree={true}
            />
          )}

          {/* Nom censuré après 3 échecs */}
          {gs.status === 'lost' && !gs.defeatAccepted && (
            <View style={[styles.revealBanner, styles.revealBannerCensored]}>
              <Ionicons name="eye-off-outline" size={17} color={colors.accent} />
              <Text style={styles.revealText}>
                C'était : <Text style={styles.revealGame}>{censorTitle(game.title)}</Text>
              </Text>
            </View>
          )}

          {/* Défaite acceptée — titre révélé */}
          {gs.status === 'lost' && gs.defeatAccepted && (
            <View style={styles.revealBanner}>
              <Ionicons name="skull-outline" size={17} color={colors.accent} />
              <Text style={styles.revealText}>
                C'était : <Text style={styles.revealGame}>{game.title}</Text>
              </Text>
            </View>
          )}

          {/* Victoire — titre révélé */}
          {gs.status === 'won' && (
            <View style={[styles.revealBanner, styles.revealBannerWon]}>
              <Ionicons name="trophy-outline" size={17} color={colors.success} />
              <Text style={styles.revealText}>
                C'était :{' '}
                <Text style={[styles.revealGame, styles.revealGameWon]}>{game.title}</Text>
              </Text>
            </View>
          )}

          {/* Boutons défaite (avant acceptation) */}
          {gs.status === 'lost' && !gs.defeatAccepted && (
            <View style={styles.defeatBtns}>
              {canGetExtra && (
                <TouchableOpacity style={styles.extraChanceBtn} onPress={handleExtraChance} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={16} color="#a78bfa" />
                  <Text style={styles.extraChanceBtnText}>Obtenir une chance supplémentaire</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.acceptDefeatBtn} onPress={handleAcceptDefeat} activeOpacity={0.8}>
                <Ionicons name="flag-outline" size={16} color={colors.accent} />
                <Text style={styles.acceptDefeatBtnText}>Accepter la défaite</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Panneau résultat final */}
          {showResult && (
            <View style={[styles.resultPanel, gs.status === 'won' ? styles.resultPanelWon : styles.resultPanelLost]}>
              <Text style={styles.resultEmoji}>{gs.status === 'won' ? '🏆' : '💀'}</Text>
              <Text style={styles.resultTitle}>
                {gs.status === 'won' ? 'Bien joué !' : 'Dommage !'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {gs.status === 'won'
                  ? `Trouvé en ${gs.attempts.length} essai${gs.attempts.length > 1 ? 's' : ''}`
                  : `Score non comptabilisé · mode infini`}
              </Text>

              {gs.status === 'won' && coinsAwarded > 0 && (
                <View style={styles.resultCoinsRow}>
                  <Text style={styles.resultCoinsText}>+{coinsAwarded} 🪙</Text>
                  <Text style={styles.resultCoinsCap}>· max {MAX_COINS_REWARD} / partie</Text>
                </View>
              )}

              <TouchableOpacity style={styles.resultBtn} onPress={() => setSelectedRow(null)} activeOpacity={0.8}>
                <Ionicons name="list-outline" size={16} color={colors.text} />
                <Text style={styles.resultBtnText}>Choisir un autre jour</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: SPACING.xxl * 2 }} />
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ④ Liste des jeux d'une année sélectionnée
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedYear !== null) {
    return (
      <View style={styles.root}>

        {/* ── En-tête avec retour ────────────────────────────────────────── */}
        <View style={styles.listHeader}>
          <TouchableOpacity
            style={styles.listHeaderBack}
            onPress={() => setSelectedYear(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.listHeaderYear}>{selectedYear}</Text>
          <View style={styles.modeBadge}>
            <Ionicons name="infinite" size={11} color="#a78bfa" />
            <Text style={styles.modeBadgeText}>MODE INFINI</Text>
          </View>
        </View>

        {/* ── Liste des jeux ─────────────────────────────────────────────── */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <PastGameCard
              row={item}
              result={playedMap[item.id]}
              onPress={() => handleSelectGame(item)}
              styles={styles}
              colors={colors}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucun jeu pour {selectedYear}</Text>
            </View>
          }
        />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ⑤ Sélecteur d'année (accueil du mode infini)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {'<'}PIXEL<Text style={styles.titleAccent}>NIGHT</Text>{'>'}
          </Text>
          <Text style={styles.dateLabel}>Jeux du passé</Text>
        </View>
      </View>

      {/* ── Badge MODE INFINI centré ────────────────────────────────────── */}
      <View style={styles.headerBadgeRow}>
        <View style={styles.modeBadge}>
          <Ionicons name="infinite" size={12} color="#a78bfa" />
          <Text style={styles.modeBadgeText}>MODE INFINI</Text>
        </View>
      </View>

      {/* ── Contenu ────────────────────────────────────────────────────── */}
      {loadingList ? (
        /* Skeleton : 3 cartes fantôme animées pendant le premier chargement */
        <ScrollView
          style={styles.yearPickerScroll}
          contentContainerStyle={styles.yearPickerContent}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonYearCard shimmer={shimmer} styles={styles} />
          <SkeletonYearCard shimmer={shimmer} styles={styles} />
          <SkeletonYearCard shimmer={shimmer} styles={styles} />
        </ScrollView>
      ) : years.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Aucun jeu passé disponible</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.yearPickerScroll}
          contentContainerStyle={styles.yearPickerContent}
          showsVerticalScrollIndicator={false}
        >
          {years.map((year) => (
            <YearCard
              key={year}
              year={year}
              stats={yearStats[year] ?? { total: 0, played: 0, won: 0, cats: {} }}
              onPress={() => {
                setSelectedYear(year);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              styles={styles}
              colors={colors}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── SkeletonYearCard ─────────────────────────────────────────────────────────

interface SkeletonYearCardProps {
  shimmer: Animated.Value;
  styles:  ReturnType<typeof createStyles>;
}

function SkeletonYearCard({ shimmer, styles }: SkeletonYearCardProps) {
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.72] });
  return (
    <Animated.View style={[styles.yearCard, { opacity }]}>
      {/* Barre accent atténuée */}
      <View style={[styles.yearCardAccent, { backgroundColor: '#a78bfa44' }]} />

      <View style={styles.yearCardBody}>
        {/* Placeholder : année */}
        <View style={styles.yearCardRow}>
          <View style={styles.skeletonYearNum} />
        </View>
        {/* Placeholder : sous-titre */}
        <View style={[styles.skeletonLine, { width: '58%' }]} />
        {/* Placeholder : badges catégories */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={styles.skeletonBadge} />
          <View style={styles.skeletonBadge} />
          <View style={styles.skeletonBadge} />
        </View>
        {/* Placeholder : barre de progression */}
        <View style={styles.skeletonProgress} />
      </View>
    </Animated.View>
  );
}

// ─── YearCard ─────────────────────────────────────────────────────────────────

interface YearCardProps {
  year:    string;
  stats:   { total: number; played: number; won: number; cats: Record<string, number> };
  onPress: () => void;
  styles:  ReturnType<typeof createStyles>;
  colors:  ThemeColors;
}

function YearCard({ year, stats, onPress, styles, colors }: YearCardProps) {
  const progress = stats.total > 0 ? stats.won / stats.total : 0;
  // Percentage string pour la barre de progression (React Native accepte les % en inline style)
  const fillWidth = `${Math.round(progress * 100)}%` as any;

  return (
    <TouchableOpacity style={styles.yearCard} onPress={onPress} activeOpacity={0.8}>
      {/* Barre d'accent violette à gauche */}
      <View style={styles.yearCardAccent} />

      <View style={styles.yearCardBody}>
        {/* Année + chevron */}
        <View style={styles.yearCardRow}>
          <Text style={styles.yearCardYear}>{year}</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
        </View>

        {/* Nombre de jeux */}
        <Text style={styles.yearCardSub}>
          {stats.total} jeu{stats.total > 1 ? 'x' : ''} disponible{stats.total > 1 ? 's' : ''}
        </Text>

        {/* Badges catégories avec compteur */}
        <View style={styles.yearCardCatRow}>
          {(Object.entries(stats.cats) as [string, number][]).map(([cat, count]) => {
            const info = CATEGORY_INFO[cat] ?? CATEGORY_INFO.games;
            return (
              <View
                key={cat}
                style={[styles.catBadge, { borderColor: info.color + '55', backgroundColor: info.color + '18' }]}
              >
                <Text style={{ fontSize: 10 }}>{info.emoji}</Text>
                <Text style={[styles.catBadgeText, { color: info.color }]}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Barre de progression trouvés / total */}
        <View style={styles.yearCardProgressRow}>
          <View style={styles.yearCardProgressTrack}>
            <View style={[styles.yearCardProgressFill, { width: fillWidth }]} />
          </View>
          <Text style={styles.yearCardProgressLabel}>
            {stats.won}/{stats.total} ✓
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── PastGameCard ─────────────────────────────────────────────────────────────

interface PastGameCardProps {
  row:     DailyGameRow;
  result?: PlayedResult;
  onPress: () => void;
  styles:  ReturnType<typeof createStyles>;
  colors:  ThemeColors;
}

function PastGameCard({ row, result, onPress, styles, colors }: PastGameCardProps) {
  const catInfo = CATEGORY_INFO[row.category] ?? CATEGORY_INFO.games;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>

      {/* Miniature — floue si pas encore jouée, nette si déjà vue */}
      <View style={styles.cardThumb}>
        <PixelImage
          uri={resolveImageUrl(row.image_url, row.category)}
          blurRadius={result ? 0 : 22}
          width={64}
          height={44}
        />
      </View>

      <View style={styles.cardBody}>
        {/* Badge catégorie */}
        <View style={[styles.catBadge, { borderColor: catInfo.color + '55', backgroundColor: catInfo.color + '18' }]}>
          <Text style={{ fontSize: 10 }}>{catInfo.emoji}</Text>
          <Text style={[styles.catBadgeText, { color: catInfo.color }]}>{catInfo.label}</Text>
        </View>

        {/* Date */}
        <Text style={styles.cardDate}>{formatDateLong(row.date)}</Text>

        {/* Nom du jeu révélé uniquement si déjà joué */}
        <Text style={styles.cardSub}>
          {result ? row.game_name : 'Mystère…'}
        </Text>

        {/* Badge de résultat */}
        {result && (
          result.status === 'won' ? (
            <View style={styles.wonBadge}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={styles.wonText}>
                Trouvé · {result.attempts} essai{result.attempts > 1 ? 's' : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.lostBadge}>
              <Ionicons name="close-circle" size={12} color={colors.accent} />
              <Text style={styles.lostText}>Non trouvé</Text>
            </View>
          )
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

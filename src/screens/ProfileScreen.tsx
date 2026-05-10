import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { pickAndUploadAvatar } from '../lib/avatarStorage';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import {
  getRecentHistory,
  computeWinDistribution,
  computeCalendarWeek,
  GameHistoryEntry,
  WinDistributionItem,
  CalendarDay,
} from '../lib/gameHistory';
import { SettingsModal } from '../components/SettingsModal';
import { CountryPicker } from '../components/CountryPicker';
import { flagEmoji, findCountry } from '../constants/countries';
import { updateCountryCode } from '../lib/profiles';
import {
  getTitles,
  getMyTitles,
  checkAndUnlockTitles,
  setActiveTitle,
  Title,
} from '../lib/titles';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { GuestProfile } from '../lib/guestProfile';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';
import { FlameStreak } from '../components/FlameStreak';
import { shareReferralCode, ensureReferralCode } from '../lib/referral';

// ─── Rang ─────────────────────────────────────────────────────────────────────

interface Rank {
  emoji: string;
  label: string;
  color: string;
  min:   number;
}

const RANKS: Rank[] = [
  { min: 10000, emoji: '👑', label: 'Légende',  color: '#fbbf24' },
  { min: 5001,  emoji: '💎', label: 'Maître',   color: '#c084fc' },
  { min: 2001,  emoji: '⭐', label: 'Expert',   color: '#60a5fa' },
  { min: 501,   emoji: '🎮', label: 'Gamer',    color: '#4ade80' },
  { min: 0,     emoji: '🌱', label: 'Débutant', color: '#6b7280' },
];

function getRank(score: number): Rank {
  return RANKS.find((r) => score >= r.min) ?? RANKS[RANKS.length - 1];
}

// ─── createStyles ─────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FONTS.size.lg,
      fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
    },
    gearBtn: {
      padding: SPACING.xs,
    },

    scroll: { flex: 1 },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      gap: SPACING.md,
      alignItems: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      width: '100%',
    },

    coinsRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start',
    },
    coinsText:  { color: colors.textMuted, fontSize: FONTS.size.xs, fontStyle: 'italic' },
    coinsValue: { color: colors.warning, fontWeight: FONTS.weight.bold, fontStyle: 'normal' },

    sectionTitle: {
      color: colors.textMuted, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
      letterSpacing: 1.2, fontFamily: ff ?? 'monospace', alignSelf: 'flex-start', marginTop: SPACING.xs,
    },

    // Parrainage
    referralCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1.5,
      borderColor: colors.warning + '44',
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    referralHeader: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           SPACING.sm,
    },
    referralTitle: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.bold,
    },
    referralDesc: {
      color:      colors.textSecondary,
      fontSize:   FONTS.size.xs,
      lineHeight: 18,
    },
    referralCodeBox: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardAlt,
      borderRadius:   RADIUS.md,
      borderWidth:    1,
      borderColor:    colors.border,
      paddingVertical:   SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    referralCodeText: {
      color:       colors.warning,
      fontSize:    FONTS.size.xxl,
      fontWeight:  FONTS.weight.black,
      fontFamily:  ff ?? 'monospace',
      letterSpacing: 6,
    },
    referralShareBtn: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            SPACING.sm,
      backgroundColor: colors.warning,
      borderRadius:   RADIUS.sm,
      paddingVertical:   SPACING.md,
    },
    referralShareText: {
      color:      '#000',
      fontSize:   FONTS.size.md,
      fontWeight: FONTS.weight.bold,
    },
    referralBonusPill: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            SPACING.xs,
      alignSelf:      'flex-start',
      backgroundColor: colors.warningDim,
      borderRadius:   RADIUS.full,
      borderWidth:    1,
      borderColor:    colors.warning + '55',
      paddingVertical:   SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    referralBonusText: {
      color:      colors.warning,
      fontSize:   FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
    },

    // Bouton "Copier" dans la boîte du code
    copyBtn: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            4,
      paddingVertical:   SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius:   RADIUS.sm,
      borderWidth:    1,
      borderColor:    colors.border,
      backgroundColor: colors.cardAlt,
    },
    copyBtnText: {
      fontSize:   FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
      color:      colors.textMuted,
    },
  });
}

function createCardStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    container: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1.5,
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
    },
    avatarWrapper: {
      position: 'relative',
      marginBottom: SPACING.xs,
    },
    avatar: {
      width: 76, height: 76,
      borderRadius: 38,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    avatarEmoji: {
      fontSize: 32,
    },
    editAvatarBtn: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    pseudo: {
      color: colors.text,
      fontSize: FONTS.size.xxl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
    },
    activeTitleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderWidth: 1.5,
    },
    activeTitleText: {
      fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 0.5,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.xs,
    },
    scoreText: {
      color: colors.warning,
      fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
    },
    // Utilisé uniquement dans GuestProfileView ("Mode invité")
    rankBadge: {
      flexDirection: 'row', alignItems: 'center',
      gap: SPACING.xs,
      paddingVertical: 5, paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full, borderWidth: 1.5,
    },
    rankEmoji: { fontSize: 16 },
    rankLabel: {
      fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
    },

    countryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      marginTop: SPACING.xs, paddingVertical: 4,
      paddingHorizontal: SPACING.sm, borderRadius: RADIUS.full,
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    },
    countryFlag: { fontSize: 14 },
    countryName: { color: colors.textMuted, fontSize: FONTS.size.xs },
    countryEdit: { color: colors.accent, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
  });
}

function createStatStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    cell: {
      flex: 1, minWidth: '45%',
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center',
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
      gap: SPACING.xs,
    },
    value: {
      color: colors.text,
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      textAlign: 'center',
    },
    prefix: { fontSize: FONTS.size.md },
    label:  { color: colors.textMuted, fontSize: FONTS.size.xs, textAlign: 'center' },
  });
}

function createDistStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    container: {
      width: '100%', backgroundColor: colors.card,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
      padding: SPACING.md, gap: SPACING.sm,
    },
    row:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    rowLabel: { color: colors.textSecondary, fontSize: FONTS.size.xs, width: 58, textAlign: 'right' },
    track: { flex: 1, height: 20, backgroundColor: colors.cardAlt, borderRadius: RADIUS.sm, overflow: 'hidden', justifyContent: 'center' },
    bar:   { height: '100%', borderRadius: RADIUS.sm },
    rowCount: { fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace', width: 70, textAlign: 'right' },
    rowPct:   { fontWeight: FONTS.weight.regular, color: colors.textMuted },
    empty: {
      width: '100%', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.xl, backgroundColor: colors.card,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
    },
    emptyText: { color: colors.textMuted, fontSize: FONTS.size.sm, fontStyle: 'italic' },
  });
}

function createCalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container:    { flexDirection: 'row', width: '100%', gap: SPACING.xs },
    cell: {
      flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.card, gap: 3, position: 'relative',
    },
    cellToday:    { borderColor: colors.accent, backgroundColor: colors.accentDim },
    cellWon:      { borderColor: colors.success + '66', backgroundColor: '#1a4a2e' },
    cellLost:     { borderColor: colors.accent + '55',  backgroundColor: colors.accentDim },
    dayLabel:     { color: colors.textMuted, fontSize: 9, fontWeight: FONTS.weight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayLabelToday:{ color: colors.accent },
    icon:         { fontSize: 15 },
    todayDot:     { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  });
}

function createTitleStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    // Badge titre actif dans la PlayerCard
    activeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm,
      borderWidth: 1,
    },
    activeBadgeText: {
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace', letterSpacing: 0.5,
    },

    // Liste des titres débloqués
    listContainer: {
      width: '100%', gap: SPACING.sm,
    },
    titleRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
      padding: SPACING.md, gap: SPACING.sm,
    },
    titleRowActive: {
      borderWidth: 1.5,
    },
    colorDot: {
      width: 10, height: 10, borderRadius: 5, flexShrink: 0,
    },
    titleInfo: { flex: 1, gap: 2 },
    titleLabel: {
      fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
    },
    titleDesc: {
      fontSize: FONTS.size.xs, color: colors.textMuted, lineHeight: 16,
    },
    typeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: colors.cardAlt, borderRadius: RADIUS.full,
      paddingVertical: 2, paddingHorizontal: 6,
      borderWidth: 1, borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    typeBadgeText: { color: colors.textMuted, fontSize: 10 },

    // Bouton activer
    activateBtn: {
      paddingVertical: 6, paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', minWidth: 64,
    },
    activateBtnText: {
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
      color: colors.textSecondary,
    },
    activeCheck: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },

    // État vide
    emptyTitles: {
      width: '100%', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.xl,
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
    },
    emptyTitlesText: {
      color: colors.textMuted, fontSize: FONTS.size.sm,
      fontStyle: 'italic', textAlign: 'center', lineHeight: 20,
    },
  });
}

function createGuestStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.infoDim ?? colors.cardAlt,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.info + '55',
      padding: SPACING.md, width: '100%',
    },
    bannerTitle: { color: colors.info, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold },
    bannerSub:   { color: colors.info, fontSize: FONTS.size.xs, opacity: 0.8, marginTop: 2, lineHeight: 16 },
    signUpCard: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.accent, borderRadius: RADIUS.sm,
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
      justifyContent: 'center', width: '100%',
    },
    signUpText: { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
    note: { color: colors.textMuted, fontSize: FONTS.size.xs, textAlign: 'center', lineHeight: 18 },
  });
}

// ─── Vue invité ───────────────────────────────────────────────────────────────

function GuestProfileView({ gp, onSignUp }: { gp: GuestProfile; onSignUp: () => void }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const card   = useMemo(() => createCardStyles(colors, fontFamily), [colors, fontFamily]);
  const guest  = useMemo(() => createGuestStyles(colors), [colors]);

  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const winPct = gp.parties_jouees > 0
    ? Math.round((gp.parties_gagnees / gp.parties_jouees) * 100)
    : 0;

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Bannière upgrade */}
        <TouchableOpacity style={guest.banner} onPress={onSignUp} activeOpacity={0.85}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.info} />
          <View style={{ flex: 1 }}>
            <Text style={guest.bannerTitle}>Crée un compte pour sauvegarder ☁️</Text>
            {(gp.coins > 0 || gp.serie_actuelle > 0) && (
              <Text style={guest.bannerSub}>
                {gp.coins > 0 ? `🪙 ${gp.coins} pièces` : ''}
                {gp.coins > 0 && gp.serie_actuelle > 0 ? ' · ' : ''}
                {gp.serie_actuelle > 0 ? `🔥 ${gp.serie_actuelle}j de série` : ''}
                {' — transfert automatique !'}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.info} />
        </TouchableOpacity>

        {/* Avatar invité */}
        <View style={[card.container, { borderColor: '#6b7280' + '44' }]}>
          <View style={[card.avatar, { backgroundColor: '#6b7280' + '20', borderColor: '#6b7280' + '60' }]}>
            <Ionicons name="person-outline" size={28} color="#6b7280" />
          </View>
          <Text style={card.pseudo}>Joueur invité</Text>
          <View style={[card.rankBadge, { backgroundColor: '#6b7280' + '18', borderColor: '#6b7280' + '50' }]}>
            <Text style={card.rankEmoji}>🌱</Text>
            <Text style={[card.rankLabel, { color: '#6b7280' }]}>Mode invité</Text>
          </View>
          <View style={card.scoreRow}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={card.scoreText}>{gp.score_total.toLocaleString('fr-FR')} pts</Text>
          </View>
        </View>

        {/* Stats locales */}
        <SectionTitle label="Statistiques locales" />
        <View style={styles.statsGrid}>
          <StatCell icon="game-controller-outline" label="Jeux joués"   value={String(gp.parties_jouees)} />
          <StatCell icon="trophy-outline"          label="Victoires"     value={String(gp.parties_gagnees)} color={colors.warning} />
          <StatCell icon="pie-chart-outline"       label="% victoires"  value={`${winPct}%`}
            color={winPct >= 70 ? colors.success : winPct >= 40 ? colors.warning : colors.accent} />
          <StatCell icon="medal-outline"           label="Meilleure série" value={`${gp.meilleure_serie}j`} color={colors.info} />
          {gp.serie_actuelle >= 3 ? (
            <FlameStatCell serie={gp.serie_actuelle} />
          ) : (
            <StatCell
              icon="flame-outline"
              label="Série actuelle"
              value={`${gp.serie_actuelle}j`}
              color={colors.textSecondary}
            />
          )}
          <StatCell icon="wallet-outline" label="Pièces" value={gp.coins.toLocaleString('fr-FR')} color={colors.warning} prefix="🪙" />
        </View>

        {/* CTA inscription */}
        <TouchableOpacity style={guest.signUpCard} onPress={onSignUp} activeOpacity={0.85}>
          <Ionicons name="person-add-outline" size={18} color={colors.text} />
          <Text style={guest.signUpText}>S'inscrire gratuitement</Text>
        </TouchableOpacity>

        <Text style={guest.note}>
          Tes stats, pièces et série seront transférées automatiquement vers ton nouveau compte.
        </Text>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </Animated.View>
  );
}

// ─── Component (onglet, pas Modal) ────────────────────────────────────────────

export function ProfileScreen() {
  const { profile, authLoading, isGuest, guestProfile, exitGuest, refreshProfile } = useAuthContext();
  const { avatarEmoji, colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  // Mode invité
  if (isGuest && guestProfile) {
    return <GuestProfileView gp={guestProfile} onSignUp={exitGuest} />;
  }

  const opacity = useRef(new Animated.Value(0)).current;

  const [history,       setHistory]       = useState<GameHistoryEntry[]>([]);
  const [loadingHist,   setLoadingHist]   = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showCountry,   setShowCountry]   = useState(false);
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  // ── Titres ─────────────────────────────────────────────
  const [allTitles,     setAllTitles]     = useState<Title[]>([]);
  const [myTitleIds,    setMyTitleIds]    = useState<Set<string>>(new Set());
  const [activeTitleId, setActiveTitleId] = useState<string | null>(null);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [settingTitle,  setSettingTitle]  = useState<string | null>(null);

  const loadTitles = useCallback(async (p: typeof profile) => {
    if (!p) return;
    setTitlesLoading(true);
    try {
      const [all, my] = await Promise.all([getTitles(), getMyTitles(p.id)]);
      setAllTitles(all);
      setMyTitleIds(new Set(my.map((pt) => pt.title_id)));

      // Vérifie et débloque automatiquement les titres éligibles
      const newlyUnlocked = await checkAndUnlockTitles(p);
      if (newlyUnlocked.length > 0) {
        const updated = await getMyTitles(p.id);
        setMyTitleIds(new Set(updated.map((pt) => pt.title_id)));
      }
    } catch (err) {
      if (__DEV__) console.warn('[ProfileScreen] loadTitles:', err);
    } finally {
      setTitlesLoading(false);
    }
  }, []);

  const handleSetActiveTitle = useCallback(async (titleId: string | null) => {
    const next = activeTitleId === titleId ? null : titleId; // toggle
    setSettingTitle(next ?? '__clear__');
    try {
      await setActiveTitle(next);
      setActiveTitleId(next);
    } catch (err) {
      if (__DEV__) console.warn('[ProfileScreen] setActiveTitle:', err);
    } finally {
      setSettingTitle(null);
    }
  }, [activeTitleId]);

  // Fade-in sur mount + chargement de l'historique
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Chargement des titres dès que le profil est disponible
  useEffect(() => {
    if (!profile) return;
    setActiveTitleId(profile.active_title ?? null);
    loadTitles(profile);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // If profile is still null 10 seconds after auth resolves, show error
  useEffect(() => {
    if (profile) {
      setProfileTimedOut(false);
      return;
    }
    if (authLoading) return; // still loading — don't start timer yet
    console.log('[ProfileScreen] profile is null after authLoading resolved — starting 10s timeout');
    const timer = setTimeout(() => {
      console.warn('[ProfileScreen] 10s elapsed with no profile — showing error state');
      setProfileTimedOut(true);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [profile, authLoading]);

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    const h = await getRecentHistory();
    setHistory(h);
    setLoadingHist(false);
  }, []);

  const handleCountryChange = useCallback(async (code: string) => {
    try {
      await updateCountryCode(code);
      await refreshProfile();
    } catch (e) {
      if (__DEV__) console.warn('[ProfileScreen] updateCountryCode:', e);
    }
  }, [refreshProfile]);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleEditAvatar = useCallback(async () => {
    if (!profile) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(profile.id);
      if (url) await refreshProfile();
    } catch (err) {
      if (__DEV__) console.warn('[ProfileScreen] avatar upload:', err);
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile, refreshProfile]);

  const distColors = useMemo(
    () => [colors.success, colors.info, colors.warning, colors.accent],
    [colors],
  );

  if (!profile) {
    // Header with gear icon always accessible, even without profile data
    const headerWithGear = (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <TouchableOpacity
          style={styles.gearBtn}
          onPress={() => setShowSettings(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={21} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );

    if (profileTimedOut) {
      // Profile failed to load — show error + retry, but gear (= logout) stays accessible
      return (
        <View style={styles.root}>
          {headerWithGear}
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.border} />
            <Text style={profileErrorStyle.title}>Profil indisponible</Text>
            <Text style={profileErrorStyle.sub}>
              Impossible de charger les données.{'\n'}Vérifie ta connexion internet.
            </Text>
            <TouchableOpacity
              style={profileErrorStyle.btn}
              onPress={() => { setProfileTimedOut(false); refreshProfile(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.text} />
              <Text style={profileErrorStyle.btnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
          <SettingsModal visible={showSettings} onDismiss={() => setShowSettings(false)} />
        </View>
      );
    }
    return (
      <View style={styles.root}>
        {headerWithGear}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
          <Text style={profileErrorStyle.loadingText}>Chargement du profil…</Text>
        </View>
        <SettingsModal visible={showSettings} onDismiss={() => setShowSettings(false)} />
      </View>
    );
  }

  const rank           = getRank(profile.score_total);
  const winPct         = profile.parties_jouees > 0
    ? Math.round((profile.parties_gagnees / profile.parties_jouees) * 100)
    : 0;
  const distribution   = computeWinDistribution(history);
  const calendarDays   = computeCalendarWeek(history);
  const totalDistCount = distribution.reduce((s, d) => s + d.count, 0);

  return (
    <Animated.View style={[styles.root, { opacity }]}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <TouchableOpacity
          style={styles.gearBtn}
          onPress={() => setShowSettings(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={21} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Carte Joueur ────────────────────────────────────── */}
        <PlayerCard
          pseudo={profile.pseudo}
          avatarEmoji={avatarEmoji}
          avatarUrl={profile.avatar_url ?? null}
          rank={rank}
          scoreTotal={profile.score_total}
          countryCode={profile.country_code ?? 'FR'}
          onChangeCountry={() => setShowCountry(true)}
          activeTitle={allTitles.find((t) => t.id === activeTitleId) ?? null}
          onEditAvatar={handleEditAvatar}
          uploadingAvatar={uploadingAvatar}
        />

        {/* ── Stats ───────────────────────────────────────────── */}
        <SectionTitle label="Statistiques" />
        <View style={styles.statsGrid}>
          <StatCell
            icon="game-controller-outline"
            label="Jeux joués"
            value={String(profile.parties_jouees)}
          />
          <StatCell
            icon="trophy-outline"
            label="Victoires"
            value={String(profile.parties_gagnees)}
            color={colors.warning}
          />
          <StatCell
            icon="pie-chart-outline"
            label="% victoires"
            value={`${winPct}%`}
            color={winPct >= 70 ? colors.success : winPct >= 40 ? colors.warning : colors.accent}
          />
          <StatCell
            icon="medal-outline"
            label="Meilleure série"
            value={`${profile.meilleure_serie}j`}
            color={colors.info}
          />
          {profile.serie_actuelle >= 3 ? (
            <FlameStatCell serie={profile.serie_actuelle} />
          ) : (
            <StatCell
              icon="flame-outline"
              label="Série actuelle"
              value={`${profile.serie_actuelle}j`}
              color={colors.textSecondary}
            />
          )}
          <StatCell
            icon="wallet-outline"
            label="Pièces"
            value={profile.coins.toLocaleString('fr-FR')}
            color={colors.warning}
            prefix="🪙"
          />
        </View>

        {/* ── Répartition ─────────────────────────────────────── */}
        <SectionTitle label="Répartition des résultats" />
        {loadingHist ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: SPACING.lg }} />
        ) : (
          <WinDistributionChart
            items={distribution}
            colors={distColors}
            total={totalDistCount}
          />
        )}

        {/* ── Calendrier ──────────────────────────────────────── */}
        <SectionTitle label="7 derniers jours" />
        {loadingHist ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: SPACING.lg }} />
        ) : (
          <WeekCalendar days={calendarDays} />
        )}

        {/* ── Mes Titres ──────────────────────────────────────── */}
        <SectionTitle label="Mes Titres" />
        <TitlesSection
          allTitles={allTitles}
          myTitleIds={myTitleIds}
          activeTitleId={activeTitleId}
          loading={titlesLoading}
          settingTitle={settingTitle}
          onSelect={handleSetActiveTitle}
        />

        {/* ── Parrainage ──────────────────────────────────────────── */}
        <SectionTitle label="Parrainage" />
        <ReferralCard code={profile.referral_code} />

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* ── Paramètres (Modal) ──────────────────────────────────────── */}
      <SettingsModal
        visible={showSettings}
        onDismiss={() => setShowSettings(false)}
      />

      {/* ── Sélecteur de pays ──────────────────────────────────────── */}
      <CountryPicker
        visible={showCountry}
        selected={profile.country_code ?? 'FR'}
        onSelect={handleCountryChange}
        onClose={() => setShowCountry(false)}
      />
    </Animated.View>
  );
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  pseudo, avatarEmoji, avatarUrl, rank, scoreTotal,
  countryCode, onChangeCountry, activeTitle,
  onEditAvatar, uploadingAvatar,
}: {
  pseudo:           string;
  avatarEmoji:      string;
  avatarUrl?:       string | null;
  rank:             Rank;
  scoreTotal:       number;
  countryCode:      string;
  onChangeCountry:  () => void;
  activeTitle:      Title | null;
  onEditAvatar?:    () => void;
  uploadingAvatar?: boolean;
}) {
  const { colors, fontFamily } = useTheme();
  const card    = useMemo(() => createCardStyles(colors, fontFamily), [colors, fontFamily]);
  const country = findCountry(countryCode);
  const hasImg  = !!(avatarUrl && avatarUrl.startsWith('http'));

  return (
    <View style={[card.container, { borderColor: rank.color + '44' }]}>

      {/* ── Avatar + bouton modifier ─────────────────────── */}
      <View style={card.avatarWrapper}>
        <View style={[card.avatar, { backgroundColor: rank.color + '20', borderColor: rank.color + '60' }]}>
          {hasImg
            ? <Image source={{ uri: avatarUrl! }} style={card.avatarImage} />
            : <Text style={card.avatarEmoji}>{avatarEmoji}</Text>
          }
        </View>
        {onEditAvatar && (
          <TouchableOpacity
            style={card.editAvatarBtn}
            onPress={onEditAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.75}
          >
            {uploadingAvatar
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera-outline" size={13} color="#fff" />
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Pseudo */}
      <Text style={card.pseudo} numberOfLines={1}>{pseudo}</Text>

      {/* ── Titre actif mis en valeur ─────────────────────── */}
      {activeTitle ? (
        <View style={[
          card.activeTitleCard,
          { backgroundColor: activeTitle.color + '18', borderColor: activeTitle.color + '66' },
        ]}>
          <Ionicons name="ribbon" size={16} color={activeTitle.color} />
          <Text style={[card.activeTitleText, { color: activeTitle.color }]}>
            {activeTitle.label}
          </Text>
        </View>
      ) : null}

      {/* Score */}
      <View style={card.scoreRow}>
        <Ionicons name="star" size={13} color={colors.warning} />
        <Text style={card.scoreText}>{scoreTotal.toLocaleString('fr-FR')} pts</Text>
      </View>

      {/* Drapeau + bouton changer de pays */}
      <TouchableOpacity style={card.countryBtn} onPress={onChangeCountry} activeOpacity={0.7}>
        <Text style={card.countryFlag}>{flagEmoji(countryCode)}</Text>
        <Text style={card.countryName}>{country.name}</Text>
        <Ionicons name="pencil-outline" size={11} color={colors.accent} />
        <Text style={card.countryEdit}>Modifier</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ReferralCard ─────────────────────────────────────────────────────────────

function ReferralCard({ code: initialCode }: { code: string | null }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  // Gère le code localement pour pouvoir l'afficher dès qu'il est généré,
  // sans attendre un refreshProfile() complet sur le profil parent.
  const [code,        setCode]        = useState<string | null>(initialCode);
  const [generating,  setGenerating]  = useState(false);
  const [genFailed,   setGenFailed]   = useState(false);
  const [copied,      setCopied]      = useState(false);
  const hasTriedRef   = useRef(false);
  const copyTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage du timer au démontage
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
    } catch {
      // Fallback silencieux (ne devrait pas arriver avec expo-clipboard)
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // Synchronise si le parent recharge le profil avec un code désormais présent
  useEffect(() => {
    if (initialCode && !code) setCode(initialCode);
  }, [initialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Génère le code côté serveur dès que le composant monte avec code=null
  useEffect(() => {
    if (code !== null)        return; // déjà présent
    if (hasTriedRef.current)  return; // tentative déjà faite
    hasTriedRef.current = true;

    setGenerating(true);
    ensureReferralCode()
      .then((generated) => {
        if (generated) {
          setCode(generated);
        } else {
          setGenFailed(true);
        }
      })
      .catch(() => setGenFailed(true))
      .finally(() => setGenerating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.referralCard}>
      {/* En-tête */}
      <View style={styles.referralHeader}>
        <Ionicons name="gift-outline" size={20} color={colors.warning} />
        <Text style={styles.referralTitle}>Parraine un(e) ami(e)</Text>
        {code && (
          <View style={styles.referralBonusPill}>
            <Text style={styles.referralBonusText}>+50 🪙 chacun</Text>
          </View>
        )}
      </View>

      <Text style={styles.referralDesc}>
        Partage ton code unique. Quand un ami s'inscrit avec ton code, vous recevez chacun 50 pièces ! 🎁
      </Text>

      {/* Code — 3 états : génération / échec / affiché */}
      {generating ? (
        <View style={[styles.referralCodeBox, { justifyContent: 'center', gap: 10 }]}>
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={{ color: colors.textMuted, fontSize: FONTS.size.sm }}>
            Génération de ton code…
          </Text>
        </View>
      ) : genFailed ? (
        <View style={[styles.referralCodeBox, { justifyContent: 'center' }]}>
          <Ionicons name="wifi-outline" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: FONTS.size.sm, flex: 1 }}>
            Connexion requise pour afficher ton code
          </Text>
        </View>
      ) : code ? (
        <View style={styles.referralCodeBox}>
          <Text style={styles.referralCodeText}>{code}</Text>
          <TouchableOpacity
            style={[styles.copyBtn, copied && { borderColor: colors.success + '80' }]}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={14}
              color={copied ? colors.success : colors.textMuted}
            />
            <Text style={[styles.copyBtnText, copied && { color: colors.success }]}>
              {copied ? 'Copié ✓' : 'Copier'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bouton partage — masqué tant que le code n'est pas disponible */}
      <TouchableOpacity
        style={[styles.referralShareBtn, !code && { opacity: 0.4 }]}
        onPress={() => code && shareReferralCode(code)}
        activeOpacity={0.85}
        disabled={!code}
      >
        <Ionicons name="share-social-outline" size={18} color="#000" />
        <Text style={styles.referralShareText}>Partager mon code</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── FlameStatCell ────────────────────────────────────────────────────────────

/** Cellule stat dédiée à la série — affiche FlameStreak animée en large. */
function FlameStatCell({ serie }: { serie: number }) {
  const { colors } = useTheme();
  const stat = useMemo(() => createStatStyles(colors, undefined), [colors]);
  return (
    <View style={stat.cell}>
      <FlameStreak serie={serie} large={true} />
      <Text style={stat.label}>Série actuelle</Text>
    </View>
  );
}

// ─── StatCell ─────────────────────────────────────────────────────────────────

function StatCell({
  icon, label, value, color, prefix,
}: { icon: string; label: string; value: string; color?: string; prefix?: string }) {
  const { colors, fontFamily } = useTheme();
  const stat = useMemo(() => createStatStyles(colors, fontFamily), [colors, fontFamily]);
  return (
    <View style={stat.cell}>
      <Ionicons name={icon as any} size={17} color={color ?? colors.textMuted} />
      <Text style={[stat.value, color ? { color } : {}]}>
        {prefix ? <Text style={stat.prefix}>{prefix} </Text> : null}{value}
      </Text>
      <Text style={stat.label}>{label}</Text>
    </View>
  );
}

// ─── WinDistributionChart ─────────────────────────────────────────────────────

function WinDistributionChart({
  items, colors: distColors, total,
}: { items: WinDistributionItem[]; colors: string[]; total: number }) {
  const { colors, fontFamily } = useTheme();
  const dist = useMemo(() => createDistStyles(colors, fontFamily), [colors, fontFamily]);

  if (total === 0) {
    return (
      <View style={dist.empty}>
        <Ionicons name="bar-chart-outline" size={28} color={colors.textMuted} />
        <Text style={dist.emptyText}>Pas encore de parties enregistrées</Text>
      </View>
    );
  }
  return (
    <View style={dist.container}>
      {items.map((item, i) => {
        const pct   = total > 0 ? item.count / total : 0;
        const color = distColors[i];
        return (
          <View key={item.label} style={dist.row}>
            <Text style={dist.rowLabel}>{item.label}</Text>
            <View style={dist.track}>
              <View
                style={[
                  dist.bar,
                  { width: pct > 0 ? (`${Math.max(pct * 100, 2)}%` as any) : 3,
                    backgroundColor: pct > 0 ? color : colors.border },
                ]}
              />
            </View>
            <Text style={[dist.rowCount, { color: pct > 0 ? color : colors.textMuted }]}>
              {item.count}<Text style={dist.rowPct}> ({Math.round(pct * 100)}%)</Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── WeekCalendar ─────────────────────────────────────────────────────────────

function WeekCalendar({ days }: { days: CalendarDay[] }) {
  const { colors } = useTheme();
  const cal = useMemo(() => createCalStyles(colors), [colors]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <View style={cal.container}>
      {days.map((day) => {
        const isToday = day.date === today;
        const icon    = day.played ? (day.won ? '✅' : '❌') : '⬜';
        return (
          <View
            key={day.date}
            style={[
              cal.cell,
              isToday && cal.cellToday,
              day.played && day.won  && cal.cellWon,
              day.played && !day.won && cal.cellLost,
            ]}
          >
            <Text style={[cal.dayLabel, isToday && cal.dayLabelToday]}>{day.label}</Text>
            <Text style={cal.icon}>{icon}</Text>
            {isToday && <View style={cal.todayDot} />}
          </View>
        );
      })}
    </View>
  );
}

// ─── TitlesSection ────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: string; label: string }> = {
  streak_win:  { icon: 'flame-outline',    label: 'Série victoires' },
  streak_loss: { icon: 'skull-outline',    label: 'Série défaites'  },
  achievement: { icon: 'trophy-outline',   label: 'Succès'          },
  shop:        { icon: 'bag-handle-outline', label: 'Boutique'      },
};

function TitlesSection({
  allTitles, myTitleIds, activeTitleId, loading, settingTitle, onSelect,
}: {
  allTitles:     Title[];
  myTitleIds:    Set<string>;
  activeTitleId: string | null;
  loading:       boolean;
  settingTitle:  string | null;
  onSelect:      (id: string | null) => void;
}) {
  const { colors, fontFamily } = useTheme();
  const ts = useMemo(() => createTitleStyles(colors, fontFamily), [colors, fontFamily]);

  const unlocked = useMemo(
    () => allTitles.filter((t) => myTitleIds.has(t.id)),
    [allTitles, myTitleIds],
  );

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={{ marginVertical: SPACING.lg }} />;
  }

  if (unlocked.length === 0) {
    return (
      <View style={ts.emptyTitles}>
        <Ionicons name="ribbon-outline" size={28} color={colors.textMuted} />
        <Text style={ts.emptyTitlesText}>
          Aucun titre débloqué pour l'instant.{'\n'}Continue à jouer pour en gagner !
        </Text>
      </View>
    );
  }

  return (
    <View style={ts.listContainer}>
      {unlocked.map((title) => {
        const isActive  = title.id === activeTitleId;
        const isBusy    = settingTitle === title.id || (settingTitle === '__clear__' && isActive);
        const meta      = TYPE_META[title.type] ?? TYPE_META.achievement;

        return (
          <View
            key={title.id}
            style={[
              ts.titleRow,
              isActive && [ts.titleRowActive, { borderColor: title.color + '88' }],
            ]}
          >
            {/* Point de couleur */}
            <View style={[ts.colorDot, { backgroundColor: title.color }]} />

            {/* Infos */}
            <View style={ts.titleInfo}>
              <Text style={[ts.titleLabel, { color: isActive ? title.color : colors.text }]}>
                {title.label}
              </Text>
              <Text style={ts.titleDesc}>{title.description}</Text>
              {/* Badge type */}
              <View style={ts.typeBadge}>
                <Ionicons name={meta.icon as any} size={10} color={colors.textMuted} />
                <Text style={ts.typeBadgeText}>{meta.label}</Text>
              </View>
            </View>

            {/* Bouton activer / désactiver */}
            {isActive ? (
              <TouchableOpacity
                style={[ts.activeCheck, { backgroundColor: title.color + '25' }]}
                onPress={() => onSelect(null)}
                disabled={isBusy}
                activeOpacity={0.7}
              >
                {isBusy
                  ? <ActivityIndicator size="small" color={title.color} />
                  : <Ionicons name="checkmark-circle" size={26} color={title.color} />
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={ts.activateBtn}
                onPress={() => onSelect(title.id)}
                disabled={isBusy || settingTitle !== null}
                activeOpacity={0.75}
              >
                {isBusy
                  ? <ActivityIndicator size="small" color={colors.textSecondary} />
                  : <Text style={ts.activateBtnText}>Activer</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  return <Text style={styles.sectionTitle}>{label.toUpperCase()}</Text>;
}

// ─── profileErrorStyle ────────────────────────────────────────────────────────

const profileErrorStyle = StyleSheet.create({
  title: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  sub: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SPACING.xs,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  btnText: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.md,
  },
});

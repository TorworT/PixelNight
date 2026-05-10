import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Profile, getLeaderboard } from '../lib/profiles';
import { getTitles, Title } from '../lib/titles';
import { flagEmoji } from '../constants/countries';
import { useAuthContext } from '../context/AuthContext';
import { getGuestTransferSummary } from '../lib/guestProfile';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { loadJSON, saveJSON } from '../utils/storage';
import { supabase } from '../lib/supabase';

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

const LOAD_TIMEOUT_MS = 10_000;

// ─── Cache ────────────────────────────────────────────────────────────────────

const LEADERBOARD_CACHE_KEY = 'pn_leaderboard_cache_v3';

interface LeaderboardCache {
  data:     Profile[];
  cachedAt: number;
}

function formatCacheAge(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1)  return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

// ─── Subscription badge ───────────────────────────────────────────────────────

const TIER_BADGE = {
  legend: { emoji: '🏆', color: '#fbbf24' },
  pro:    { emoji: '⚡', color: '#a78bfa' },
  basic:  { emoji: '⭐', color: '#60a5fa' },
} as const;

type BadgeTier = keyof typeof TIER_BADGE;

function SubscriptionBadge({ tier }: { tier?: string | null }) {
  if (!tier || !(tier in TIER_BADGE)) return null;
  const { emoji, color } = TIER_BADGE[tier as BadgeTier];
  return (
    <View style={{
      backgroundColor: color + '20',
      borderRadius:    4,
      borderWidth:     1,
      borderColor:     color + '60',
      paddingHorizontal: 4,
      paddingVertical:   1,
    }}>
      <Text style={{ fontSize: 11, lineHeight: 15 }}>{emoji}</Text>
    </View>
  );
}

// ─── Medal helpers ────────────────────────────────────────────────────────────

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function rankColor(rank: number, colors: ThemeColors): string {
  if (rank === 1) return '#ffd700';
  if (rank === 2) return '#c0c0c0';
  if (rank === 3) return '#cd7f32';
  return colors.textMuted;
}

// ─── Row styles ───────────────────────────────────────────────────────────────

function createRowStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    containerMe:  { backgroundColor: colors.accentDim },
    containerTop: { backgroundColor: colors.cardAlt },
    rankCol:  { width: 36, alignItems: 'center' },
    medal:    { fontSize: 20 },
    rankNum:  { fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace' },
    avatar: {
      width: 36, height: 36, borderRadius: 4,
      backgroundColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarMe:   { backgroundColor: colors.accent },
    avatarText: { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.black },
    info:       { flex: 1 },
    pseudoRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
    flag:       { fontSize: 14 },
    pseudo:     { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold },
    pseudoMe:   { color: colors.accent },
    titleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    titleText:  { fontSize: 10, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace' },
    sub:        { color: colors.textMuted, fontSize: 10, marginTop: 2 },
    score: {
      color: colors.warning, fontSize: FONTS.size.md,
      fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace',
    },
    scoreMe: { color: colors.accent },
  });
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  profile:    Profile;
  rank:       number;
  isMe:       boolean;
  titlesMap?: Map<string, Title>;
  onPress?:   () => void;
}

function LeaderboardRow({ profile, rank, isMe, titlesMap, onPress }: RowProps) {
  const { colors, fontFamily } = useTheme();
  const row   = useMemo(() => createRowStyles(colors, fontFamily), [colors, fontFamily]);
  const medal = rankMedal(rank);

  const activeTitle = profile.active_title && titlesMap
    ? titlesMap.get(profile.active_title) ?? null
    : null;

  return (
    <TouchableOpacity
      style={[row.container, isMe && row.containerMe, rank <= 3 && row.containerTop]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={row.rankCol}>
        {medal
          ? <Text style={row.medal}>{medal}</Text>
          : <Text style={[row.rankNum, { color: rankColor(rank, colors) }]}>#{rank}</Text>
        }
      </View>
      <View style={[row.avatar, isMe && row.avatarMe]}>
        {profile.avatar_url && profile.avatar_url.startsWith('http')
          ? <Image source={{ uri: profile.avatar_url }} style={{ width: 36, height: 36, borderRadius: 4 }} />
          : <Text style={row.avatarText}>{profile.pseudo.slice(0, 2).toUpperCase()}</Text>
        }
      </View>
      <View style={row.info}>
        <View style={row.pseudoRow}>
          <Text style={row.flag}>{flagEmoji(profile.country_code ?? 'FR')}</Text>
          <Text style={[row.pseudo, isMe && row.pseudoMe]} numberOfLines={1}>
            {profile.pseudo}{isMe ? ' (vous)' : ''}
          </Text>
          <SubscriptionBadge tier={profile.subscription_tier} />
        </View>
        {/* Titre actif du joueur */}
        {activeTitle ? (
          <View style={row.titleBadge}>
            <Ionicons name="ribbon-outline" size={9} color={activeTitle.color} />
            <Text style={[row.titleText, { color: activeTitle.color }]} numberOfLines={1}>
              {activeTitle.label}
            </Text>
          </View>
        ) : null}
        <Text style={row.sub}>
          {profile.parties_gagnees}V · {profile.parties_jouees}J
          {profile.meilleure_serie > 0 ? ` · 🔥${profile.meilleure_serie}` : ''}
        </Text>
      </View>
      <Text style={[row.score, isMe && row.scoreMe]}>
        {profile.score_total.toLocaleString('fr-FR')}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Séparateur "Votre position" ──────────────────────────────────────────────

function MySeparator() {
  const { colors, fontFamily } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{
        color: colors.textMuted, fontSize: 10,
        fontWeight: FONTS.weight.bold,
        fontFamily: fontFamily ?? 'monospace',
        paddingHorizontal: SPACING.sm,
      }}>
        VOTRE POSITION
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

// ─── Guest placeholder ────────────────────────────────────────────────────────

function createGuestStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    motivPill: {
      backgroundColor: colors.warningDim ?? colors.cardAlt,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.warning + '55',
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      alignItems: 'center',
    },
    motivText: { color: colors.warning, fontSize: FONTS.size.xs, textAlign: 'center', lineHeight: 18 },
    signUpBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.accent, borderRadius: RADIUS.sm,
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    },
    signUpText: { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
  });
}

function GuestLeaderboardPlaceholder({ onSignUp }: { onSignUp: () => void }) {
  const { colors, fontFamily } = useTheme();
  const styles      = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const guestStyles = useMemo(() => createGuestStyles(colors, fontFamily), [colors, fontFamily]);
  const [summary, setSummary] = React.useState({ coins: 0, serie: 0, hasData: false });

  React.useEffect(() => { getGuestTransferSummary().then(setSummary); }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="trophy" size={24} color={colors.warning} />
          <Text style={styles.title}>CLASSEMENT</Text>
        </View>
        <Text style={styles.subtitle}>Top 50 mondial • Score total</Text>
      </View>
      <View style={styles.center}>
        <Text style={{ fontSize: 52 }}>🏆</Text>
        <Text style={styles.emptyTitle}>Classement mondial</Text>
        <Text style={styles.emptyText}>
          Crée un compte pour accéder au classement mondial et voir ta place parmi tous les joueurs.
        </Text>
        {summary.hasData && (
          <View style={guestStyles.motivPill}>
            <Text style={guestStyles.motivText}>
              🪙 {summary.coins} pièces · 🔥 {summary.serie}j de série — sauvegarde ta progression !
            </Text>
          </View>
        )}
        <TouchableOpacity style={guestStyles.signUpBtn} onPress={onSignUp} activeOpacity={0.85}>
          <Ionicons name="person-add-outline" size={16} color={colors.text} />
          <Text style={guestStyles.signUpText}>S'inscrire gratuitement</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Rang du joueur ───────────────────────────────────────────────────────────

const PLAYER_RANKS = [
  { min: 10000, emoji: '👑', label: 'Légende',  color: '#fbbf24' },
  { min: 5001,  emoji: '💎', label: 'Maître',   color: '#c084fc' },
  { min: 2001,  emoji: '⭐', label: 'Expert',   color: '#60a5fa' },
  { min: 501,   emoji: '🎮', label: 'Gamer',    color: '#4ade80' },
  { min: 0,     emoji: '🌱', label: 'Débutant', color: '#6b7280' },
] as const;

function getPlayerRank(score: number) {
  return PLAYER_RANKS.find((r) => score >= r.min) ?? PLAYER_RANKS[PLAYER_RANKS.length - 1];
}

// ─── PlayerProfileModal styles ────────────────────────────────────────────────

function createModalStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.88)',
      // Pas de justifyContent: 'flex-end' ici — c'est le backdrop (flex:1)
      // qui pousse le sheet vers le bas naturellement.
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '90%',
      overflow: 'hidden',
    },

    // Handle
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
    },

    // Header barre
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
      letterSpacing: 1.5,
      fontFamily: ff ?? 'monospace',
    },
    closeBtn: { padding: SPACING.xs },

    // Scroll content
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxl * 2,
      gap: SPACING.lg,
      alignItems: 'center',
    },

    // Carte identité
    identityCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1.5,
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
    },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: FONTS.size.xxl,
      fontWeight: FONTS.weight.black,
    },
    pseudo: {
      color: colors.text,
      fontSize: FONTS.size.xxl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 1,
    },
    rankBadge: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
      paddingVertical: 5, paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full, borderWidth: 1.5,
    },
    rankEmoji: { fontSize: 16 },
    rankLabel: {
      fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
    },
    titleBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACING.sm,
      borderWidth: 1,
    },
    titleBadgeText: {
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace', letterSpacing: 0.5,
    },
    flagRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    flagEmoji: { fontSize: 16 },
    scoreRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    },
    scoreText: {
      color: colors.warning, fontSize: FONTS.size.sm,
      fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace',
    },

    // Section label
    sectionLabel: {
      color: colors.textMuted, fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.bold, letterSpacing: 1.2,
      fontFamily: ff ?? 'monospace', alignSelf: 'flex-start',
    },

    // Stats grid
    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, width: '100%',
    },
    statCell: {
      flex: 1, minWidth: '45%',
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center',
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
      gap: SPACING.xs,
    },
    statValue: {
      color: colors.text, fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace',
    },
    statLabel: { color: colors.textMuted, fontSize: FONTS.size.xs, textAlign: 'center' },

    // Répartition
    distContainer: {
      width: '100%', backgroundColor: colors.card,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
      padding: SPACING.md, gap: SPACING.sm,
    },
    distRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    distLabel: { color: colors.textSecondary, fontSize: FONTS.size.xs, width: 68, textAlign: 'right' },
    distTrack: {
      flex: 1, height: 20, backgroundColor: colors.cardAlt,
      borderRadius: RADIUS.sm, overflow: 'hidden', justifyContent: 'center',
    },
    distBar:   { height: '100%', borderRadius: RADIUS.sm },
    distCount: {
      fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace', width: 70, textAlign: 'right',
    },
    distPct: { fontWeight: FONTS.weight.regular, color: colors.textMuted },
    distEmpty: {
      width: '100%', alignItems: 'center',
      paddingVertical: SPACING.lg, backgroundColor: colors.card,
      borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
    },
    distEmptyText: { color: colors.textMuted, fontSize: FONTS.size.sm, fontStyle: 'italic' },
  });
}

// ─── PlayerProfileModal ───────────────────────────────────────────────────────

interface PlayerProfileModalProps {
  visible:   boolean;
  player:    Profile | null;
  titlesMap: Map<string, Title>;
  onClose:   () => void;
}

function PlayerProfileModal({ visible, player, titlesMap, onClose }: PlayerProfileModalProps) {
  const { colors, fontFamily } = useTheme();
  const s = useMemo(() => createModalStyles(colors, fontFamily), [colors, fontFamily]);

  if (!player) return null;

  const rank      = getPlayerRank(player.score_total);
  const winPct    = player.parties_jouees > 0
    ? Math.round((player.parties_gagnees / player.parties_jouees) * 100)
    : 0;
  const losses    = Math.max(0, player.parties_jouees - player.parties_gagnees);
  const total     = player.parties_jouees;
  const activeTitle = player.active_title ? titlesMap.get(player.active_title) ?? null : null;

  // Couleur avatar = couleur du rang
  const avatarColor = rank.color;

  const distItems = [
    { label: 'Victoires', count: player.parties_gagnees, color: colors.success },
    { label: 'Défaites',  count: losses,                 color: colors.accent  },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        {/*
          Backdrop : zone transparente AU-DESSUS du sheet.
          flex:1 pousse le sheet vers le bas et cette zone vers le haut.
          onPress ici ferme la modal — complètement isolé du ScrollView.
        */}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        {/* Sheet scrollable — aucun lien avec le TouchableOpacity ci-dessus */}
        <ScrollView
          style={[s.sheet, { borderColor: rank.color + '44', borderWidth: 1.5 }]}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Poignée */}
          <View style={[s.handle, { alignSelf: 'center' }]} />

          {/* Barre titre */}
          <View style={[s.sheetHeader, { width: '100%' }]}>
            <Text style={s.sheetTitle}>PROFIL PUBLIC</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Contenu scrollable ──────────────────────────────── */}

              {/* ── Carte identité ────────────────────────────────── */}
              <View style={[s.identityCard, { borderColor: rank.color + '44' }]}>
                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: avatarColor + '30', borderColor: avatarColor + '70' }]}>
                  {player.avatar_url && player.avatar_url.startsWith('http')
                    ? <Image source={{ uri: player.avatar_url }} style={{ width: 68, height: 68, borderRadius: 34 }} />
                    : <Text style={[s.avatarText, { color: avatarColor }]}>
                        {player.pseudo.slice(0, 2).toUpperCase()}
                      </Text>
                  }
                </View>

                {/* Pseudo + drapeau */}
                <View style={s.flagRow}>
                  <Text style={s.flagEmoji}>{flagEmoji(player.country_code ?? 'FR')}</Text>
                  <Text style={s.pseudo} numberOfLines={1}>{player.pseudo}</Text>
                  <SubscriptionBadge tier={player.subscription_tier} />
                </View>

                {/* Titre actif */}
                {activeTitle && (
                  <View style={[s.titleBadge, { backgroundColor: activeTitle.color + '1a', borderColor: activeTitle.color + '60' }]}>
                    <Ionicons name="ribbon-outline" size={12} color={activeTitle.color} />
                    <Text style={[s.titleBadgeText, { color: activeTitle.color }]}>
                      {activeTitle.label}
                    </Text>
                  </View>
                )}

                {/* Rang */}
                <View style={[s.rankBadge, { backgroundColor: rank.color + '18', borderColor: rank.color + '50' }]}>
                  <Text style={s.rankEmoji}>{rank.emoji}</Text>
                  <Text style={[s.rankLabel, { color: rank.color }]}>{rank.label}</Text>
                </View>

                {/* Score total */}
                <View style={s.scoreRow}>
                  <Ionicons name="star" size={13} color={colors.warning} />
                  <Text style={s.scoreText}>{player.score_total.toLocaleString('fr-FR')} pts</Text>
                </View>
              </View>

              {/* ── Statistiques ──────────────────────────────────── */}
              <Text style={s.sectionLabel}>STATISTIQUES</Text>
              <View style={s.statsGrid}>
                {/* Parties jouées */}
                <View style={s.statCell}>
                  <Ionicons name="game-controller-outline" size={17} color={colors.textMuted} />
                  <Text style={s.statValue}>{player.parties_jouees}</Text>
                  <Text style={s.statLabel}>Parties jouées</Text>
                </View>

                {/* Victoires */}
                <View style={s.statCell}>
                  <Ionicons name="trophy-outline" size={17} color={colors.warning} />
                  <Text style={[s.statValue, { color: colors.warning }]}>
                    {player.parties_gagnees}
                  </Text>
                  <Text style={s.statLabel}>Victoires</Text>
                </View>

                {/* % victoires */}
                <View style={s.statCell}>
                  <Ionicons
                    name="pie-chart-outline"
                    size={17}
                    color={winPct >= 70 ? colors.success : winPct >= 40 ? colors.warning : colors.accent}
                  />
                  <Text style={[s.statValue, {
                    color: winPct >= 70 ? colors.success : winPct >= 40 ? colors.warning : colors.accent,
                  }]}>
                    {winPct}%
                  </Text>
                  <Text style={s.statLabel}>% victoires</Text>
                </View>

                {/* Meilleure série */}
                <View style={s.statCell}>
                  <Ionicons name="flame-outline" size={17} color={colors.info} />
                  <Text style={[s.statValue, { color: colors.info }]}>
                    {player.meilleure_serie}j
                  </Text>
                  <Text style={s.statLabel}>Meilleure série</Text>
                </View>
              </View>

              {/* ── Répartition ───────────────────────────────────── */}
              <Text style={s.sectionLabel}>RÉPARTITION</Text>
              {total === 0 ? (
                <View style={s.distEmpty}>
                  <Text style={s.distEmptyText}>Pas encore de parties jouées</Text>
                </View>
              ) : (
                <View style={s.distContainer}>
                  {distItems.map((item) => {
                    const pct = total > 0 ? item.count / total : 0;
                    return (
                      <View key={item.label} style={s.distRow}>
                        <Text style={s.distLabel}>{item.label}</Text>
                        <View style={s.distTrack}>
                          <View style={[
                            s.distBar,
                            { width: pct > 0 ? (`${Math.max(pct * 100, 2)}%` as any) : 3,
                              backgroundColor: pct > 0 ? item.color : colors.border },
                          ]} />
                        </View>
                        <Text style={[s.distCount, { color: pct > 0 ? item.color : colors.textMuted }]}>
                          {item.count}<Text style={s.distPct}> ({Math.round(pct * 100)}%)</Text>
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main screen styles ───────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      padding: SPACING.lg, gap: SPACING.sm,
    },
    headerRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    title: {
      color: colors.text, fontSize: FONTS.size.xl, fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace', letterSpacing: 4,
    },
    subtitle: { color: colors.textMuted, fontSize: FONTS.size.xs },
    myRankPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      backgroundColor: colors.accentDim, borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: colors.accent,
      paddingVertical: 3, paddingHorizontal: SPACING.sm,
    },
    myRankText:  { color: colors.accent, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    refreshBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
    refreshText: { color: colors.textMuted, fontSize: FONTS.size.xs },
    colHeaders: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      backgroundColor: colors.cardAlt,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    colHead: { color: colors.textMuted, fontSize: 10, fontWeight: FONTS.weight.bold, fontFamily: ff ?? 'monospace' },
    cachePill: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      backgroundColor: colors.cardAlt, borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: colors.border,
      paddingVertical: 3, paddingHorizontal: SPACING.sm,
    },
    cacheText:    { color: colors.textMuted, fontSize: FONTS.size.xs },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    loadingText:  { color: colors.textMuted, fontSize: FONTS.size.sm },
    emptyTitle:   { color: colors.text, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, textAlign: 'center' },
    emptyText:    { color: colors.textMuted, fontSize: FONTS.size.sm, textAlign: 'center' },
    errorTitle:   { color: colors.text, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, textAlign: 'center' },
    errorText:    { color: colors.textMuted, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20 },
    retryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.accent, borderRadius: RADIUS.sm,
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    },
    retryBtnText: { color: colors.text, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold },

    // ── Joueur épinglé ──────────────────────────────────────────────────────
    pinnedWrapper: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
    },
    pinnedLabel: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: SPACING.md, paddingTop: SPACING.xs,
      backgroundColor: colors.accentDim,
    },
    pinnedLabelText: {
      color: colors.accent, fontSize: 10,
      fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
    },
  });
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function LeaderboardScreen() {
  const { session, isGuest, exitGuest } = useAuthContext();
  if (isGuest) return <GuestLeaderboardPlaceholder onSignUp={exitGuest} />;
  return <LeaderboardConnectedScreen session={session} />;
}

function LeaderboardConnectedScreen({ session }: { session: ReturnType<typeof useAuthContext>['session'] }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const isOnline = useNetworkStatus();
  const [data,           setData]           = useState<Profile[]>([]);
  const [myProfile,      setMyProfile]      = useState<Profile | null>(null);
  const [myRealRank,     setMyRealRank]     = useState<number>(0);
  const [loading,        setLoading]        = useState(true);
  const [cachedAt,       setCachedAt]       = useState<number | null>(null);
  const [loadError,      setLoadError]      = useState(false);
  const [errorMessage,   setErrorMessage]   = useState('');
  const [titlesMap,      setTitlesMap]      = useState<Map<string, Title>>(new Map());
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const hasMounted = useRef(false);

  // Charge les titres une seule fois pour affichage dans les rows
  useEffect(() => {
    getTitles()
      .then((all) => setTitlesMap(new Map(all.map((t) => [t.id, t]))))
      .catch(() => {});
  }, []);

  // ── Récupère le rang réel du joueur même hors top 50 ─────────────────────
  const fetchMyRank = useCallback(async () => {
    if (!session?.user.id) return;
    try {
      const { data: rankData } = await supabase
        .rpc('get_my_rank', { p_user_id: session.user.id });
      if (rankData) setMyRealRank(rankData);
    } catch {
      // Silencieux
    }
  }, [session?.user.id]);

  /**
   * Charge depuis le cache AsyncStorage en premier (affichage instantané),
   * puis rafraîchit silencieusement depuis Supabase si en ligne.
   */
  const load = useCallback(async (online: boolean, silent = false) => {
    let hasCachedData = false;

    if (!silent) {
      // Charge le cache immédiatement pour afficher sans spinner
      const cached = await loadJSON<LeaderboardCache>(LEADERBOARD_CACHE_KEY);
      if (cached && cached.data.length > 0) {
        hasCachedData = true;
        setData(cached.data);
        setCachedAt(cached.cachedAt);
        setLoading(false);
        const me = cached.data.find((p) => p.id === session?.user.id) ?? null;
        setMyProfile(me);
      } else {
        setLoading(true);
      }
    } else {
      // En mode silencieux, considère qu'on a déjà des données affichées
      hasCachedData = true;
    }

    setLoadError(false);
    setErrorMessage('');

    if (!online) {
      setLoading(false);
      return;
    }

    try {
      const list = await withTimeout(getLeaderboard(), LOAD_TIMEOUT_MS);

      if (list.length > 0) {
        const now = Date.now();
        saveJSON(LEADERBOARD_CACHE_KEY, { data: list, cachedAt: now } as LeaderboardCache).catch(() => {});
        setData(list);
        setCachedAt(null);

        const me = list.find((p) => p.id === session?.user.id) ?? null;
        setMyProfile(me);

        await fetchMyRank();
      }
    } catch (err) {
      // Si on a déjà des données affichées, on reste silencieux sur l'erreur réseau
      if (!hasCachedData) {
        const reason = err instanceof Error ? err.message : String(err);
        setLoadError(true);
        setErrorMessage(reason);
      }
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, fetchMyRank]);

  // Chargement initial (cache-first)
  useEffect(() => { load(isOnline, false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnexion → rafraîchit silencieusement
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    if (isOnline) load(true, true);
  }, [isOnline, load]);

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const id = setInterval(() => {
      if (isOnline) load(true, true);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, load]);

  // Rang dans le top 50
  const myTop50Rank = session?.user.id
    ? data.findIndex((p) => p.id === session.user.id) + 1
    : 0;

  // Rang affiché = rang réel si dispo, sinon rang top 50
  const displayRank = myRealRank > 0 ? myRealRank : myTop50Rank;

  // Est-ce que le joueur est hors top 50 ?
  const isOutsideTop50 = myRealRank > 50 || (myRealRank === 0 && myTop50Rank === 0);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="trophy" size={24} color={colors.warning} />
          <Text style={styles.title}>CLASSEMENT</Text>
        </View>
        <Text style={styles.subtitle}>Top 50 mondial • Score total</Text>

        {cachedAt !== null && (
          <View style={styles.cachePill}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={styles.cacheText}>Données en cache · {formatCacheAge(cachedAt)}</Text>
          </View>
        )}

        {displayRank > 0 && (
          <View style={styles.myRankPill}>
            <Ionicons name="person-outline" size={12} color={colors.accent} />
            <Text style={styles.myRankText}>Votre rang : #{displayRank}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => load(isOnline)}
          disabled={loading || !isOnline}
        >
          <Ionicons name="refresh-outline" size={16} color={isOnline ? colors.textMuted : colors.border} />
          <Text style={[styles.refreshText, !isOnline && { color: colors.border }]}>Actualiser</Text>
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View style={styles.colHeaders}>
        <Text style={[styles.colHead, { width: 36 }]}>RG</Text>
        <View style={{ width: 36 }} />
        <Text style={[styles.colHead, { flex: 1 }]}>JOUEUR</Text>
        <Text style={[styles.colHead, { textAlign: 'right' }]}>SCORE</Text>
      </View>

      {/* Content */}
      {!isOnline && data.length === 0 && !loading ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyText}>Le classement nécessite une connexion internet.</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.border} />
          <Text style={styles.errorTitle}>Impossible de charger le classement</Text>
          <Text style={styles.errorText}>Vérifie ta connexion et réessaie.</Text>
          {!!errorMessage && (
            <Text style={[styles.errorText, { fontSize: 10, opacity: 0.6, marginTop: 4 }]}>
              {errorMessage}
            </Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(isOnline)} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={16} color={colors.text} />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>Aucun joueur pour l'instant</Text>
          <Text style={styles.emptyText}>Sois le premier à apparaître ici !</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          // ── Joueur épinglé en haut s'il est hors top 50 ─────────────────
          ListHeaderComponent={
            isOutsideTop50 && myProfile ? (
              <View style={styles.pinnedWrapper}>
                <View style={styles.pinnedLabel}>
                  <Ionicons name="pin" size={10} color={colors.accent} />
                  <Text style={styles.pinnedLabelText}>VOTRE POSITION</Text>
                </View>
                <LeaderboardRow
                  profile={myProfile}
                  rank={displayRank}
                  isMe
                  titlesMap={titlesMap}
                  onPress={() => setSelectedPlayer(myProfile)}
                />
                <MySeparator />
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <LeaderboardRow
              profile={item}
              rank={index + 1}
              isMe={item.id === session?.user.id}
              titlesMap={titlesMap}
              onPress={() => setSelectedPlayer(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SPACING.xxl * 2 }}
        />
      )}

      {/* ── Modal profil public ─────────────────────────────────────────── */}
      <PlayerProfileModal
        visible={selectedPlayer !== null}
        player={selectedPlayer}
        titlesMap={titlesMap}
        onClose={() => setSelectedPlayer(null)}
      />
    </View>
  );
}
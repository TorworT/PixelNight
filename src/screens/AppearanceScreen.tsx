/**
 * AppearanceScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal plein écran pour personnaliser l'apparence de l'app.
 *
 * 4 onglets :
 *   🎨 Thèmes      — couleurs globales (+ prévisualisation 10 s)
 *   🎊 Victoire    — effet affiché quand on gagne
 *   😀 Avatars     — emoji de profil / classement
 *   🔤 Polices     — famille de police des titres
 *
 * Flux d'achat :
 *   1. Tap sur un item non possédé → modal de confirmation avec coût
 *   2. Confirmation → buyItem/buyGuestItem → markOwned → applyPrefs
 *   3. Item possédé → tap pour l'activer directement
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthContext';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import {
  THEMES, VICTORY_EFFECTS, AVATARS, FONTS_LIST,
  AppearanceCategory, ThemeId, ThemeColors,
} from '../constants/appearances';
import { spendCoins } from '../lib/profiles';
import { addGuestCoins } from '../lib/guestProfile';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppearanceScreenProps {
  visible:   boolean;
  onDismiss: () => void;
}

type TabId = 'theme' | 'victory' | 'avatar' | 'font';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'theme',   label: 'Thèmes',   icon: 'color-palette-outline' },
  { id: 'victory', label: 'Victoire', icon: 'sparkles-outline'      },
  { id: 'avatar',  label: 'Avatars',  icon: 'happy-outline'         },
  { id: 'font',    label: 'Polices',  icon: 'text-outline'          },
];

const { width: SW } = Dimensions.get('window');

// ─── Composant principal ──────────────────────────────────────────────────────

export function AppearanceScreen({ visible, onDismiss }: AppearanceScreenProps) {
  const { prefs, owned, previewThemeId, startPreview, cancelPreview, applyPrefs, markOwned, isOwned, colors, fontFamily } = useTheme();
  const { profile, refreshProfile, isGuest, guestProfile, refreshGuestProfile } = useAuthContext();
  const coins = isGuest ? (guestProfile?.coins ?? 0) : (profile?.coins ?? 0);
  const s = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const [activeTab,  setActiveTab]  = useState<TabId>('theme');
  const [buying,     setBuying]     = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Achat d'un item ─────────────────────────────────────────────────────────
  const handleBuy = useCallback(async (
    category: AppearanceCategory,
    id: string,
    cost: number,
    label: string,
  ) => {
    if (coins < cost) { showToast('Pas assez de pièces 🪙', false); return; }
    setBuying(id);
    try {
      if (isGuest) {
        // addGuestCoins accepte une valeur négative pour dépenser
        await addGuestCoins(-cost);
        await refreshGuestProfile();
      } else {
        await spendCoins(cost);
        await refreshProfile();
      }
      await markOwned(category, id);
      // Activer directement après l'achat
      await applyPrefs({
        ...(category === 'theme'   ? { themeId:         id as any } : {}),
        ...(category === 'victory' ? { victoryEffectId: id as any } : {}),
        ...(category === 'avatar'  ? { avatarId:        id as any } : {}),
        ...(category === 'font'    ? { fontId:          id as any } : {}),
      });
      showToast(`${label} débloqué et activé !`, true);
    } catch (err: any) {
      if (err?.message?.includes('insufficient_coins')) {
        showToast('Pas assez de pièces 🪙', false);
      } else {
        showToast('Achat échoué. Réessayez.', false);
      }
    } finally {
      setBuying(null);
    }
  }, [coins, isGuest, refreshProfile, refreshGuestProfile, markOwned, applyPrefs, showToast]);

  // ── Activation d'un item possédé ───────────────────────────────────────────
  const handleActivate = useCallback(async (
    category: AppearanceCategory,
    id: string,
  ) => {
    await applyPrefs({
      ...(category === 'theme'   ? { themeId:         id as any } : {}),
      ...(category === 'victory' ? { victoryEffectId: id as any } : {}),
      ...(category === 'avatar'  ? { avatarId:        id as any } : {}),
      ...(category === 'font'    ? { fontId:          id as any } : {}),
    });
  }, [applyPrefs]);

  // ── Prévisualisation thème ──────────────────────────────────────────────────
  const handlePreview = useCallback((id: ThemeId) => {
    if (previewThemeId === id) { cancelPreview(); return; }
    startPreview(id);
  }, [previewThemeId, startPreview, cancelPreview]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={s.root}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>
            {'<'}PIXEL <Text style={s.headerAccent}>LOOK</Text>{'>'}
          </Text>
          <TouchableOpacity onPress={onDismiss} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Solde ─────────────────────────────────────────────────────── */}
        <View style={s.balanceRow}>
          <Text style={s.balanceEmoji}>🪙</Text>
          <Text style={s.balanceAmt}>{coins.toLocaleString('fr-FR')}</Text>
          <Text style={s.balanceLbl}>pièces</Text>
        </View>

        {/* ── Toast ─────────────────────────────────────────────────────── */}
        {toast && (
          <View style={[s.toast, toast.ok ? s.toastOk : s.toastErr]}>
            <Ionicons name={toast.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={14}
              color={toast.ok ? colors.success : colors.accent} />
            <Text style={[s.toastText, { color: toast.ok ? colors.success : colors.accent }]}>
              {toast.msg}
            </Text>
          </View>
        )}

        {/* ── Preview banner ─────────────────────────────────────────────── */}
        {previewThemeId && (
          <TouchableOpacity style={s.previewBanner} onPress={cancelPreview} activeOpacity={0.85}>
            <Ionicons name="eye-outline" size={14} color={colors.warning} />
            <Text style={s.previewText}>
              Aperçu : {THEMES.find((t) => t.id === previewThemeId)?.label} — Tap pour annuler
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Onglets ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabsScroll}
          contentContainerStyle={s.tabsContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={activeTab === tab.id ? colors.accent : colors.textMuted}
              />
              <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Contenu de l'onglet ────────────────────────────────────────── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── THÈMES ────────────────────────────────────────────────── */}
          {activeTab === 'theme' && THEMES.map((theme) => {
            const owned_  = isOwned('theme', theme.id);
            const active  = prefs.themeId === theme.id;
            const preview = previewThemeId === theme.id;
            const loading = buying === theme.id;
            return (
              <View key={theme.id} style={[s.card, active && s.cardActive]}>
                {/* Swatch couleurs */}
                <View style={s.swatchRow}>
                  <View style={[s.swatch, { backgroundColor: theme.colors.background, borderColor: colors.border }]} />
                  <View style={[s.swatch, { backgroundColor: theme.colors.accent }]} />
                  <View style={[s.swatch, { backgroundColor: theme.colors.card }]} />
                  <View style={[s.swatch, { backgroundColor: theme.colors.text, opacity: 0.7 }]} />
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardTitleRow}>
                    <Text style={s.cardEmoji}>{theme.emoji}</Text>
                    <Text style={s.cardLabel}>{theme.label}</Text>
                    {active && (
                      <View style={s.activeBadge}>
                        <Text style={s.activeBadgeText}>Actif</Text>
                      </View>
                    )}
                    {owned_ && !active && (
                      <View style={s.ownedBadge}>
                        <Text style={s.ownedBadgeText}>Possédé</Text>
                      </View>
                    )}
                  </View>
                  {theme.cost === 0
                    ? <Text style={s.cardFree}>Gratuit</Text>
                    : <Text style={s.cardCost}>🪙 {theme.cost}</Text>}
                </View>

                <View style={s.cardActions}>
                  {/* Bouton Aperçu (seulement pour les thèmes non actifs) */}
                  {!active && (
                    <TouchableOpacity
                      style={[s.previewBtn, preview && s.previewBtnActive]}
                      onPress={() => handlePreview(theme.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={preview ? 'eye' : 'eye-outline'} size={14}
                        color={preview ? colors.warning : colors.textMuted} />
                    </TouchableOpacity>
                  )}

                  {/* Action principale */}
                  {active ? (
                    <View style={[s.actionBtn, s.actionBtnActive]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={[s.actionBtnText, { color: colors.success }]}>Activé</Text>
                    </View>
                  ) : owned_ ? (
                    <TouchableOpacity
                      style={s.actionBtn}
                      onPress={() => handleActivate('theme', theme.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.actionBtnText}>Activer</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnBuy, coins < theme.cost && s.actionBtnDisabled]}
                      onPress={() => handleBuy('theme', theme.id, theme.cost, theme.label)}
                      disabled={loading || coins < theme.cost}
                      activeOpacity={0.8}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.text} />
                      ) : (
                        <>
                          <Text style={s.coinMini}>🪙</Text>
                          <Text style={s.actionBtnText}>{theme.cost}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* ── EFFETS VICTOIRE ───────────────────────────────────────── */}
          {activeTab === 'victory' && VICTORY_EFFECTS.map((eff) => {
            const owned_ = isOwned('victory', eff.id);
            const active = prefs.victoryEffectId === eff.id;
            const loading = buying === eff.id;
            return (
              <View key={eff.id} style={[s.card, active && s.cardActive]}>
                <View style={s.effectPreview}>
                  <Text style={s.effectEmoji}>{eff.emoji}</Text>
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardTitleRow}>
                    <Text style={s.cardLabel}>{eff.label}</Text>
                    {active && <View style={s.activeBadge}><Text style={s.activeBadgeText}>Actif</Text></View>}
                    {owned_ && !active && <View style={s.ownedBadge}><Text style={s.ownedBadgeText}>Possédé</Text></View>}
                  </View>
                  <Text style={s.cardDesc}>{eff.desc}</Text>
                  {eff.cost === 0
                    ? <Text style={s.cardFree}>Gratuit</Text>
                    : <Text style={s.cardCost}>🪙 {eff.cost}</Text>}
                </View>

                <View style={s.cardActions}>
                  {active ? (
                    <View style={[s.actionBtn, s.actionBtnActive]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={[s.actionBtnText, { color: colors.success }]}>Activé</Text>
                    </View>
                  ) : owned_ ? (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleActivate('victory', eff.id)} activeOpacity={0.8}>
                      <Text style={s.actionBtnText}>Activer</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnBuy, coins < eff.cost && s.actionBtnDisabled]}
                      onPress={() => handleBuy('victory', eff.id, eff.cost, eff.label)}
                      disabled={loading || coins < eff.cost}
                      activeOpacity={0.8}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color={colors.text} />
                        : <><Text style={s.coinMini}>🪙</Text><Text style={s.actionBtnText}>{eff.cost}</Text></>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* ── AVATARS ───────────────────────────────────────────────── */}
          {activeTab === 'avatar' && (
            <View style={s.avatarGrid}>
              {AVATARS.map((av) => {
                const owned_ = isOwned('avatar', av.id);
                const active = prefs.avatarId === av.id;
                const loading = buying === av.id;
                return (
                  <TouchableOpacity
                    key={av.id}
                    style={[s.avatarCell, active && s.avatarCellActive]}
                    onPress={() => {
                      if (owned_) { handleActivate('avatar', av.id); }
                      else { handleBuy('avatar', av.id, av.cost, av.label); }
                    }}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={s.avatarEmoji}>{av.emoji}</Text>
                    )}
                    <Text style={s.avatarLabel}>{av.label}</Text>
                    {active && (
                      <View style={s.avatarActiveDot} />
                    )}
                    {!owned_ && !active && (
                      <View style={s.avatarLockBadge}>
                        <Text style={s.avatarLockText}>🪙{av.cost}</Text>
                      </View>
                    )}
                    {owned_ && !active && (
                      <View style={s.ownedBadge}>
                        <Text style={s.ownedBadgeText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── POLICES ───────────────────────────────────────────────── */}
          {activeTab === 'font' && FONTS_LIST.map((font) => {
            const owned_ = isOwned('font', font.id);
            const active = prefs.fontId === font.id;
            const loading = buying === font.id;
            return (
              <View key={font.id} style={[s.card, active && s.cardActive]}>
                <View style={s.fontPreview}>
                  <Text style={[s.fontSample, { fontFamily: font.family }]}>{font.sample}</Text>
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardTitleRow}>
                    <Text style={s.cardEmoji}>{font.emoji}</Text>
                    <Text style={s.cardLabel}>{font.label}</Text>
                    {active && <View style={s.activeBadge}><Text style={s.activeBadgeText}>Actif</Text></View>}
                    {owned_ && !active && <View style={s.ownedBadge}><Text style={s.ownedBadgeText}>Possédé</Text></View>}
                  </View>
                  {font.cost === 0
                    ? <Text style={s.cardFree}>Gratuit</Text>
                    : <Text style={s.cardCost}>🪙 {font.cost}</Text>}
                </View>

                <View style={s.cardActions}>
                  {active ? (
                    <View style={[s.actionBtn, s.actionBtnActive]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={[s.actionBtnText, { color: colors.success }]}>Activé</Text>
                    </View>
                  ) : owned_ ? (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleActivate('font', font.id)} activeOpacity={0.8}>
                      <Text style={s.actionBtnText}>Activer</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnBuy, coins < font.cost && s.actionBtnDisabled]}
                      onPress={() => handleBuy('font', font.id, font.cost, font.label)}
                      disabled={loading || coins < font.cost}
                      activeOpacity={0.8}
                    >
                      {loading
                        ? <ActivityIndicator size="small" color={colors.text} />
                        : <><Text style={s.coinMini}>🪙</Text><Text style={s.actionBtnText}>{font.cost}</Text></>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          <View style={{ height: SPACING.xxl * 2 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles (factory — réactif au thème) ─────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerTitle:  { color: colors.text, fontSize: FONTS.size.xxl, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace', letterSpacing: 2 },
    headerAccent: { color: colors.accent },
    closeBtn:     { padding: SPACING.xs },

    // Balance
    balanceRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
      paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
      backgroundColor: colors.cardAlt,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    balanceEmoji: { fontSize: 18 },
    balanceAmt:   { color: colors.warning, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.black, fontFamily: ff ?? 'monospace' },
    balanceLbl:   { color: colors.textMuted, fontSize: FONTS.size.sm },

    // Toast
    toast: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      marginHorizontal: SPACING.xl, marginTop: SPACING.sm,
      borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm,
    },
    toastOk:   { backgroundColor: colors.successDim, borderColor: colors.success },
    toastErr:  { backgroundColor: colors.accentDim,  borderColor: colors.accent  },
    toastText: { flex: 1, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium },

    // Preview banner
    previewBanner: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      marginHorizontal: SPACING.xl, marginTop: SPACING.sm,
      backgroundColor: colors.warningDim, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.warning,
      paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md,
    },
    previewText: { color: colors.warning, fontSize: FONTS.size.xs, flex: 1 },

    // Tabs
    tabsScroll:   { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabsContent:  { paddingHorizontal: SPACING.md, gap: SPACING.xs, alignItems: 'center' },
    tab: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
    },
    tabActive:      { backgroundColor: colors.accentDim },
    tabLabel:       { color: colors.textMuted, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.medium },
    tabLabelActive: { color: colors.accent, fontWeight: FONTS.weight.bold },

    // Scroll content
    scroll:  { flex: 1 },
    content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.md },

    // Card (item générique)
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
      padding: SPACING.md, gap: SPACING.md,
    },
    cardActive: { borderColor: colors.accent, backgroundColor: colors.accentDim + '44' },
    cardBody:   { flex: 1, gap: 4 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
    cardEmoji:  { fontSize: 20 },
    cardLabel:  { color: colors.text, fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
    cardDesc:   { color: colors.textSecondary, fontSize: FONTS.size.xs, lineHeight: 16 },
    cardFree:   { color: colors.success, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    cardCost:   { color: colors.warning, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    cardActions:{ alignItems: 'center', gap: SPACING.xs },

    // Badges
    activeBadge: {
      backgroundColor: colors.success + '22', borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: colors.success,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    activeBadgeText: { color: colors.success, fontSize: 9, fontWeight: FONTS.weight.bold },
    ownedBadge: {
      backgroundColor: colors.info + '22', borderRadius: RADIUS.full,
      borderWidth: 1, borderColor: colors.info,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    ownedBadgeText: { color: colors.info, fontSize: 9, fontWeight: FONTS.weight.bold },

    // Action buttons
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.border, borderRadius: RADIUS.sm,
      paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm,
      minWidth: 72, justifyContent: 'center', minHeight: 32,
    },
    actionBtnActive:   { backgroundColor: colors.successDim, borderWidth: 1, borderColor: colors.success },
    actionBtnBuy:      { backgroundColor: colors.accent },
    actionBtnDisabled: { opacity: 0.45 },
    actionBtnText:     { color: colors.text, fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold },
    coinMini:          { fontSize: 11 },

    // Thème swatches
    swatchRow: { flexDirection: 'column', gap: 3 },
    swatch: {
      width: 28, height: 14, borderRadius: 3,
      borderWidth: 1,
    },

    // Bouton preview
    previewBtn: {
      width: 32, height: 32, borderRadius: RADIUS.sm,
      backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    previewBtnActive: { borderColor: colors.warning, backgroundColor: colors.warningDim },

    // Effect preview
    effectPreview: {
      width: 52, height: 52,
      backgroundColor: colors.cardAlt, borderRadius: RADIUS.md,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    effectEmoji: { fontSize: 28 },

    // Font preview
    fontPreview: {
      width: 80, height: 52,
      backgroundColor: colors.cardAlt, borderRadius: RADIUS.md,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: SPACING.xs,
    },
    fontSample: {
      color: colors.accent, fontSize: 11, fontWeight: '700',
      textAlign: 'center', letterSpacing: 0.5,
    },

    // Avatar grid
    avatarGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    },
    avatarCell: {
      width: (SW - SPACING.xl * 2 - SPACING.sm * 3) / 4,
      aspectRatio: 1,
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      gap: 4, position: 'relative', overflow: 'hidden',
    },
    avatarCellActive: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentDim + '44' },
    avatarEmoji:      { fontSize: 28 },
    avatarLabel:      { color: colors.textMuted, fontSize: 9, textAlign: 'center' },
    avatarActiveDot:  {
      position: 'absolute', top: 5, right: 5,
      width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success,
    },
    avatarLockBadge: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: colors.background + 'cc',
      paddingVertical: 2, alignItems: 'center',
    },
    avatarLockText: { color: colors.warning, fontSize: 9, fontWeight: FONTS.weight.bold },
  });
}

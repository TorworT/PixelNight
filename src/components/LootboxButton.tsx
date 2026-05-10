/**
 * LootboxButton — coffre gratuit toutes les 48h
 * ─────────────────────────────────────────────────────────────────────────────
 * FLOW :
 *  1. Coffre disponible (🎁) → tap → appel RPC claim_lootbox()
 *  2. Coffre disparaît le temps de la requête (loading)
 *  3. Modal centrée : "Coffre ouvert ! 🎉" + montant + bouton "Récupérer"
 *  4. "Récupérer" → ferme modal + onClaimed() → refreshProfile()
 *  5. Coffre réapparaît en cooldown (⌛)
 *
 * DRAG :
 *  • Long press (500 ms) → mode déplacement + haptique
 *  • PanResponder capture uniquement les moves en mode drag
 *    (onStartShouldSetPanResponder=false → TouchableOpacity garde les taps)
 *  • Snap bord gauche / droit au relâcher
 *  • Position persistée dans AsyncStorage
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

// ─── Constantes ───────────────────────────────────────────────────────────────

const COOLDOWN_MS  = 24 * 60 * 60 * 1000;
const CHEST_W      = 68;
const CHEST_H      = 88;
const EDGE_MARGIN  = 6;
const STORAGE_POS  = '@lootbox_pos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStatus(lastMs: number | null) {
  if (lastMs === null) return { available: true, remainingMs: 0 };
  const rem = lastMs + COOLDOWN_MS - Date.now();
  return { available: rem <= 0, remainingMs: Math.max(0, rem) };
}

function formatRemaining(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// ─── Export utilitaire (settings) ─────────────────────────────────────────────

export async function resetLootboxPosition(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_POS);
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── LootboxRewardModal ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

interface ModalProps {
  visible: boolean;
  coins:   number;
  onClose: () => void;
}

function LootboxRewardModal({ visible, coins, onClose }: ModalProps) {
  const { colors } = useTheme();
  const ms = useMemo(() => createModalStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={ms.backdrop}>
        <View style={ms.card}>

          {/* Icône coffre ouvert */}
          <Text style={ms.chestEmoji}>🎁</Text>

          {/* Titre */}
          <Text style={ms.title}>Coffre ouvert ! 🎉</Text>

          {/* Montant */}
          <Text style={ms.amount}>+{coins} 🪙</Text>

          {/* Sous-titre */}
          <Text style={ms.subtitle}>Pièces créditées sur ton compte</Text>

          {/* Bouton Récupérer */}
          <TouchableOpacity style={ms.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={ms.btnText}>Récupérer 🎉</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── LootboxButton ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

interface Props {
  lastClaimed: string | null;
  onClaimed:   () => void;
}

export function LootboxButton({ lastClaimed, onClaimed }: Props) {
  const { colors } = useTheme();
  const bs = useMemo(() => createButtonStyles(colors), [colors]);
  const { width: SW, height: SH } = useWindowDimensions();

  // ── Cooldown ─────────────────────────────────────────────────────────────────

  const [localClaimedMs, setLocalClaimedMs] = useState<number | null>(
    lastClaimed ? new Date(lastClaimed).getTime() : null,
  );
  const [tick, setTick] = useState(0);

  // Sync depuis le profil parent (ex : après refreshProfile)
  useEffect(() => {
    const ts = lastClaimed ? new Date(lastClaimed).getTime() : null;
    if (ts !== null && (localClaimedMs === null || ts > localClaimedMs)) {
      setLocalClaimedMs(ts);
    }
  }, [lastClaimed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick toutes les minutes pour mettre à jour l'affichage du cooldown
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { available, remainingMs } = useMemo(
    () => computeStatus(localClaimedMs),
    [localClaimedMs, tick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Ouverture ─────────────────────────────────────────────────────────────────

  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [coinsWon,  setCoinsWon]  = useState(0);

  const handleOpen = useCallback(async () => {
    if (!available || loading) return;

    setLoading(true);

    const { data, error } = await supabase.rpc('claim_lootbox');

    setLoading(false);

    if (error) {
      console.warn('[Lootbox] Erreur RPC :', error.message);
      return;
    }

    const result = data as { success: boolean; coins?: number; error?: string } | null;

    if (!result?.success) {
      console.warn('[Lootbox] claim_lootbox success=false :', result?.error);
      return;
    }

    const coins = result.coins ?? 0;
    setLocalClaimedMs(Date.now());
    setCoinsWon(coins);
    setShowModal(true);
  }, [available, loading]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    onClaimed();
  }, [onClaimed]);

  // ── Position flottante (state → hitbox correcte) ──────────────────────────────

  const defaultX = SW - CHEST_W - EDGE_MARGIN;
  const defaultY = SH / 2 - CHEST_H / 2;
  const posRef   = useRef({ x: defaultX, y: defaultY });
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });

  const applyPos = useCallback((p: { x: number; y: number }) => {
    posRef.current = p;
    setPos(p);
  }, []);

  // Restauration de la position sauvegardée
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_POS).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { x: number; y: number };
        applyPos({
          x: Math.max(0, Math.min(SW - CHEST_W, saved.x)),
          y: Math.max(0, Math.min(SH - CHEST_H, saved.y)),
        });
      } catch { /* ignore */ }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag (PanResponder) ────────────────────────────────────────────────────────
  //
  // RÈGLE CRITIQUE :
  //  onStartShouldSetPanResponder = false  → TouchableOpacity conserve les taps
  //  onMoveShouldSetPanResponder  = isDraggingRef → captures les moves seulement
  //                                             après activation du mode drag

  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDX  = useRef(new Animated.Value(0)).current;
  const dragDY  = useRef(new Animated.Value(0)).current;
  const grantDX = useRef(0); // delta accumulé au moment où PanResponder prend la main
  const grantDY = useRef(0);

  const swRef = useRef(SW);
  const shRef = useRef(SH);
  useEffect(() => { swRef.current = SW; shRef.current = SH; }, [SW, SH]);

  const activateDrag = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    isDraggingRef.current = true;
    setIsDragging(true);
    dragDX.setValue(0);
    dragDY.setValue(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder:         () => isDraggingRef.current,
      onMoveShouldSetPanResponderCapture:  () => isDraggingRef.current,

      onPanResponderGrant: (_, gs) => {
        grantDX.current = gs.dx;
        grantDY.current = gs.dy;
      },

      onPanResponderMove: (_, gs) => {
        if (!isDraggingRef.current) return;
        const cw = swRef.current, ch = shRef.current, px = posRef.current;
        const relDX = gs.dx - grantDX.current;
        const relDY = gs.dy - grantDY.current;
        dragDX.setValue(Math.max(-px.x, Math.min(cw - CHEST_W - px.x, relDX)));
        dragDY.setValue(Math.max(-px.y, Math.min(ch - CHEST_H - px.y, relDY)));
      },

      onPanResponderRelease: (_, gs) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);

        const cw = swRef.current, ch = shRef.current, px = posRef.current;
        const relDX  = gs.dx - grantDX.current;
        const relDY  = gs.dy - grantDY.current;
        const finalX = Math.max(0, Math.min(cw - CHEST_W, px.x + relDX));
        const finalY = Math.max(0, Math.min(ch - CHEST_H, px.y + relDY));
        const snapX  = finalX < cw / 2 ? EDGE_MARGIN : cw - CHEST_W - EDGE_MARGIN;

        Animated.spring(dragDX, {
          toValue: snapX - px.x, tension: 230, friction: 11, useNativeDriver: true,
        }).start(() => {
          dragDX.setValue(0);
          dragDY.setValue(0);
          applyPos({ x: snapX, y: finalY });
          AsyncStorage.setItem(STORAGE_POS, JSON.stringify({ x: snapX, y: finalY })).catch(() => {});
        });
      },

      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        dragDX.setValue(0);
        dragDY.setValue(0);
      },
    })
  ).current;

  // ── Wobble idle ────────────────────────────────────────────────────────────────

  const wobble  = useRef(new Animated.Value(0)).current;
  const idleRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    idleRef.current?.stop();
    wobble.setValue(0);
    if (!available || isDragging) return;

    idleRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue:  1, duration: 700, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 700, useNativeDriver: true }),
        Animated.timing(wobble, { toValue:  0, duration: 380, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    idleRef.current.start();
    return () => { idleRef.current?.stop(); };
  }, [available, isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────────

  const wobbleDeg = wobble.interpolate({
    inputRange: [-1, 0, 1], outputRange: ['-6deg', '0deg', '6deg'],
  });

  // Le coffre disparaît pendant le chargement et tant que la modal est ouverte
  const chestVisible = !loading && !showModal;

  return (
    <>
      {/* ── Modal de récompense (portal natif) ────────────────────────────── */}
      <LootboxRewardModal
        visible={showModal}
        coins={coinsWon}
        onClose={handleClose}
      />

      {/* ── Coffre flottant ───────────────────────────────────────────────────
          Masqué pendant le chargement et l'affichage de la modal.
          Couche 1 : View positionnée par state  (hitbox correcte)
          Couche 2 : Animated.View translateX/Y  (drag, native driver)
          Couche 3 : TouchableOpacity            (tap fiable sur tous OS)
          Couche 4 : Animated.View rotate        (wobble idle)
      ──────────────────────────────────────────────────────────────────────── */}
      {chestVisible && (
        <View
          style={[bs.floatRoot, { left: pos.x, top: pos.y }]}
          {...panResponder.panHandlers}
        >
          <Animated.View
            style={{ transform: [{ translateX: dragDX }, { translateY: dragDY }] }}
          >
            {/* Anneau de drag */}
            {isDragging && <View style={bs.dragRing} pointerEvents="none" />}

            <TouchableOpacity
              onPress={handleOpen}
              onLongPress={activateDrag}
              delayLongPress={500}
              activeOpacity={available ? 0.72 : 1}
              disabled={!available}
            >
              {available ? (
                /* ── Coffre disponible ──────────────────────────────────── */
                <View style={bs.anchor}>
                  <View style={bs.glow} pointerEvents="none" />
                  <Animated.View
                    style={[bs.chestBox, { transform: [{ rotate: wobbleDeg }] }]}
                  >
                    <Text style={bs.icon}>🎁</Text>
                  </Animated.View>
                  <Text style={bs.label}>Gratuit !</Text>
                </View>
              ) : (
                /* ── Cooldown ─────────────────────────────────────────────── */
                <View style={bs.anchor}>
                  <Text style={bs.iconDim}>🎁</Text>
                  <View style={bs.badge}>
                    <Ionicons name="time-outline" size={9} color="#fff" />
                    <Text style={bs.badgeText}>{formatRemaining(remainingMs)}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── Styles ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function createButtonStyles(colors: ThemeColors) {
  return StyleSheet.create({
    floatRoot: {
      position: 'absolute',
      zIndex:   999,
    },
    anchor: {
      alignItems: 'center',
    },

    // Lueur dorée derrière le coffre disponible
    glow: {
      position:        'absolute',
      width:           82,
      height:          82,
      borderRadius:    41,
      backgroundColor: '#fbbf24',
      opacity:         0.15,
      top:             -10,
      left:            -7,
    },

    // Boîte du coffre
    chestBox: {
      width:           62,
      height:          62,
      borderRadius:    RADIUS.md,
      backgroundColor: colors.warningDim,
      borderWidth:     2,
      borderColor:     colors.warning + '99',
      alignItems:      'center',
      justifyContent:  'center',
      elevation:       10,
      shadowColor:     '#fbbf24',
      shadowOpacity:   0.5,
      shadowRadius:    10,
      shadowOffset:    { width: 0, height: 3 },
    },
    icon: { fontSize: 34 },

    label: {
      marginTop:        SPACING.xs,
      color:            colors.warning,
      fontSize:         FONTS.size.xs,
      fontWeight:       FONTS.weight.black,
      textAlign:        'center',
      textShadowColor:  'rgba(0,0,0,0.55)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },

    // Anneau visible en mode drag
    dragRing: {
      position:     'absolute',
      top: -5, left: -5, right: -5, bottom: -5,
      borderRadius: RADIUS.md + 5,
      borderWidth:  2.5,
      borderColor:  colors.warning,
    },

    // Cooldown
    iconDim: { fontSize: 32, opacity: 0.35 },
    badge: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               3,
      backgroundColor:   'rgba(0,0,0,0.65)',
      borderRadius:      RADIUS.full,
      paddingVertical:   3,
      paddingHorizontal: SPACING.sm,
      marginTop:         SPACING.xs,
    },
    badgeText: {
      color:      '#fff',
      fontSize:   FONTS.size.xs,
      fontWeight: FONTS.weight.bold,
    },
  });
}

function createModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex:            1,
      backgroundColor: 'rgba(0,0,0,0.82)',
      alignItems:      'center',
      justifyContent:  'center',
    },

    card: {
      width:             300,
      backgroundColor:   colors.card,
      borderRadius:      RADIUS.xl,
      borderWidth:       2,
      borderColor:       colors.warning,
      paddingTop:        SPACING.xl + 4,
      paddingBottom:     SPACING.xl,
      paddingHorizontal: SPACING.xl,
      alignItems:        'center',
      // Halo doré
      shadowColor:    '#fbbf24',
      shadowOpacity:  0.65,
      shadowRadius:   28,
      shadowOffset:   { width: 0, height: 0 },
      elevation:      24,
    },

    chestEmoji: {
      fontSize:         88,
      marginBottom:     SPACING.sm,
      textShadowColor:  '#fbbf24',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 20,
    },

    title: {
      color:         colors.text,
      fontSize:      FONTS.size.lg,
      fontWeight:    FONTS.weight.black,
      marginBottom:  SPACING.md,
      letterSpacing: 0.3,
    },

    // "+50 🪙"
    amount: {
      fontSize:         60,
      fontWeight:       FONTS.weight.black,
      color:            colors.warning,
      textAlign:        'center',
      marginBottom:     SPACING.sm,
      textShadowColor:  'rgba(251,191,36,0.4)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },

    subtitle: {
      color:        colors.textMuted,
      fontSize:     FONTS.size.sm,
      textAlign:    'center',
      marginBottom: SPACING.xl,
    },

    btn: {
      width:           '100%',
      backgroundColor: colors.warning,
      borderRadius:    RADIUS.lg,
      paddingVertical: SPACING.md + 2,
      alignItems:      'center',
      elevation:       4,
      shadowColor:     '#fbbf24',
      shadowOpacity:   0.5,
      shadowRadius:    8,
      shadowOffset:    { width: 0, height: 3 },
    },
    btnText: {
      color:         colors.card,
      fontSize:      FONTS.size.lg,
      fontWeight:    FONTS.weight.black,
      letterSpacing: 0.3,
    },
  });
}

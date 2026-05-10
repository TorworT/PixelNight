/**
 * ReviewModal.tsx
 * Popup sympa demandant un avis après la 3ème victoire.
 * "NOTER L'APP" → ouvre le store natif. "Plus tard" → ferme sans re-proposer.
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { markReviewPromptShown } from '../lib/reviewPrompt';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

interface Props {
  visible:   boolean;
  onDismiss: () => void;
}

export function ReviewModal({ visible, onDismiss }: Props) {
  // Card entrance
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const cardOp    = useRef(new Animated.Value(0)).current;

  // 5 stars — définis individuellement (règles des hooks)
  const s1 = useRef(new Animated.Value(0)).current;
  const s2 = useRef(new Animated.Value(0)).current;
  const s3 = useRef(new Animated.Value(0)).current;
  const s4 = useRef(new Animated.Value(0)).current;
  const s5 = useRef(new Animated.Value(0)).current;
  const starScales = [s1, s2, s3, s4, s5];

  useEffect(() => {
    if (!visible) return;

    // Reset
    cardScale.setValue(0.82);
    cardOp.setValue(0);
    starScales.forEach((s) => s.setValue(0));

    // Entrée de la card
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOp,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      // Étoiles qui apparaissent en cascade
      Animated.stagger(
        70,
        starScales.map((s) =>
          Animated.spring(s, { toValue: 1, tension: 110, friction: 6, useNativeDriver: true }),
        ),
      ).start();
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRate = async () => {
    await markReviewPromptShown();
    onDismiss();
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      }
    } catch {
      // Silencieux — ne jamais crasher pour une demande d'avis
    }
  };

  const handleLater = async () => {
    await markReviewPromptShown();
    onDismiss();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleLater}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Fond cliquable pour fermer */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleLater}
          activeOpacity={1}
        />

        <Animated.View
          style={[styles.card, { transform: [{ scale: cardScale }], opacity: cardOp }]}
        >
          {/* ── Étoiles ─────────────────────────────────────────────────── */}
          <View style={styles.starsRow}>
            {starScales.map((s, i) => (
              <Animated.View key={i} style={{ transform: [{ scale: s }] }}>
                <Ionicons name="star" size={34} color={COLORS.warning} />
              </Animated.View>
            ))}
          </View>

          {/* ── Titre ───────────────────────────────────────────────────── */}
          <Text style={styles.title}>Tu aimes PixelNight ?</Text>
          <Text style={styles.subtitle}>
            Laisse-nous un avis ⭐{'\n'}
            Ça nous aide vraiment à continuer !
          </Text>

          {/* ── Bouton principal ─────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={handleRate}
            activeOpacity={0.85}
          >
            {/* Pixel corner dots */}
            <View style={[styles.dot, { top: 0, left: 0 }]} />
            <View style={[styles.dot, { top: 0, right: 0 }]} />
            <View style={[styles.dot, { bottom: 0, left: 0 }]} />
            <View style={[styles.dot, { bottom: 0, right: 0 }]} />

            <Ionicons name="star" size={15} color={COLORS.background} />
            <Text style={styles.rateBtnText}>NOTER L'APP</Text>
          </TouchableOpacity>

          {/* ── Bouton secondaire ────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.laterBtn}
            onPress={handleLater}
            activeOpacity={0.7}
          >
            <Text style={styles.laterBtnText}>Plus tard</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: SPACING.xl,
  },

  card: {
    backgroundColor:   COLORS.card,
    borderRadius:      RADIUS.lg,
    borderWidth:       1.5,
    borderColor:       COLORS.warning + '55',
    padding:           SPACING.xl,
    width:             '100%',
    alignItems:        'center',
    gap:               SPACING.md,
    // Glow doré très subtil
    shadowColor:       COLORS.warning,
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.15,
    shadowRadius:      16,
    elevation:         12,
  },

  starsRow: {
    flexDirection: 'row',
    gap:           SPACING.sm,
    marginBottom:  SPACING.xs,
  },

  title: {
    color:       COLORS.text,
    fontSize:    FONTS.size.xl,
    fontWeight:  FONTS.weight.black,
    fontFamily:  'monospace',
    textAlign:   'center',
    letterSpacing: 1,
  },

  subtitle: {
    color:      COLORS.textSecondary,
    fontSize:   FONTS.size.sm,
    textAlign:  'center',
    lineHeight: 20,
  },

  rateBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SPACING.sm,
    width:          '100%',
    backgroundColor: COLORS.warning,
    borderRadius:    2,
    paddingVertical: SPACING.md,
    marginTop:       SPACING.sm,
    borderWidth:     2,
    borderColor:     '#fde68a',
    borderBottomColor: '#92400e',
    borderRightColor:  '#92400e',
  },

  dot: {
    position:        'absolute',
    width:           6,
    height:          6,
    backgroundColor: COLORS.background,
  },

  rateBtnText: {
    color:       COLORS.background,
    fontSize:    FONTS.size.md,
    fontWeight:  FONTS.weight.black,
    fontFamily:  'monospace',
    letterSpacing: 4,
  },

  laterBtn: {
    paddingVertical:   SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },

  laterBtnText: {
    color:     COLORS.textMuted,
    fontSize:  FONTS.size.sm,
  },
});

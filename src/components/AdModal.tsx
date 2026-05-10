import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

interface Props {
  visible: boolean;
  type: 'hint' | 'extra' | 'coins';
  onComplete: () => void;
  onDismiss: () => void;
}

const AD_SECONDS = 5;

/**
 * Simulates a rewarded ad with a 5-second countdown.
 * Replace the body with a real SDK (e.g. react-native-google-mobile-ads)
 * and call onComplete() in the EARNED_REWARD callback.
 */
export function AdModal({ visible, type, onComplete, onDismiss }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(AD_SECONDS);
  const [done, setDone] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(AD_SECONDS);
      setDone(false);
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: AD_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(timer.current!); setDone(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [visible, progress]);

  const rewardLabel =
    type === 'hint'  ? 'indice révélé !' :
    type === 'extra' ? 'tentative supplémentaire débloquée !' :
                       '+25 pièces crédités !';
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="play-circle" size={26} color={COLORS.adButton} />
            <Text style={styles.title}>Publicité récompensée</Text>
          </View>

          {/* Simulated ad area */}
          <View style={styles.adArea}>
            <Ionicons name="megaphone-outline" size={44} color={COLORS.textMuted} />
            <Text style={styles.adTag}>PUB SIMULÉE</Text>
            <Text style={styles.adNote}>
              Intégrez react-native-google-mobile-ads{'\n'}pour de vraies publicités
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: barWidth }]} />
          </View>

          {!done ? (
            <View style={styles.waitRow}>
              <Ionicons name="timer-outline" size={15} color={COLORS.textMuted} />
              <Text style={styles.waitText}>Attendez {secondsLeft}s…</Text>
            </View>
          ) : (
            <View style={styles.rewardBox}>
              <Ionicons name="gift" size={22} color={COLORS.success} />
              <Text style={styles.rewardText}>Votre {rewardLabel}</Text>
              <TouchableOpacity style={styles.claimBtn} onPress={onComplete} activeOpacity={0.85}>
                <Text style={styles.claimText}>Récupérer</Text>
                <Ionicons name="arrow-forward" size={15} color="#000" />
              </TouchableOpacity>
            </View>
          )}

          {!done && secondsLeft === AD_SECONDS && (
            <TouchableOpacity onPress={onDismiss} style={styles.cancel}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.87)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    width: '100%',
    maxWidth: 360,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { color: COLORS.text, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold },
  adArea: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  adTag: {
    color: COLORS.adButton,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.black,
    letterSpacing: 4,
  },
  adNote: { color: COLORS.textMuted, fontSize: FONTS.size.xs, textAlign: 'center', lineHeight: 18 },
  track: { height: 6, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.adButton, borderRadius: RADIUS.full },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center' },
  waitText: { color: COLORS.textMuted, fontSize: FONTS.size.sm },
  rewardBox: { alignItems: 'center', gap: SPACING.sm },
  rewardText: { color: COLORS.success, fontSize: FONTS.size.md, fontWeight: FONTS.weight.medium, textAlign: 'center' },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.success, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full, marginTop: SPACING.xs,
  },
  claimText: { color: '#000', fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold },
  cancel: { alignItems: 'center' },
  cancelText: { color: COLORS.textMuted, fontSize: FONTS.size.sm, textDecorationLine: 'underline' },
});

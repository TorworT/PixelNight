import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Linking,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import {
  areNotificationsEnabled,
  setNotificationsEnabled,
} from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { AboutScreen } from '../screens/AboutScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TermsScreen } from '../screens/TermsScreen';

const APP_VERSION = '1.0.2';
const KOFI_URL    = 'https://ko-fi.com/pixelnight'; // Remplace par ton URL Ko-fi réel

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible:   boolean;
  onDismiss: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsModal({ visible, onDismiss }: Props) {
  const { session, profile } = useAuthContext();

  const slideY  = React.useRef(new Animated.Value(400)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [togglingNotifs, setTogglingNotifs] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Charger l'état des notifs à l'ouverture
  useEffect(() => {
    if (visible) {
      areNotificationsEnabled().then(setNotifsEnabled);
    }
  }, [visible]);

  // Animation entrée / sortie
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY,  { toValue: 0,   tension: 70, friction: 10, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(400);
      opacity.setValue(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle notifications ─────────────────────────────────────────────────
  const handleToggleNotifs = useCallback(async (value: boolean) => {
    setTogglingNotifs(true);
    setNotifsEnabled(value);
    await setNotificationsEnabled(value);
    setTogglingNotifs(false);
  }, []);

  // ── Déconnexion ──────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    onDismiss();
  }, [onDismiss]);

  // ── Vider le cache des jeux ───────────────────────────────────────────────
  const handleClearCache = useCallback(async () => {
    setClearingCache(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const gameKeys = allKeys.filter((k) => k.startsWith('cached_game_'));
      if (gameKeys.length > 0) {
        await AsyncStorage.multiRemove(gameKeys);
      }
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch {
      // Non-fatal
    } finally {
      setClearingCache(false);
    }
  }, []);

  // ── Ko-fi ────────────────────────────────────────────────────────────────
  const handleKofi = useCallback(() => {
    Linking.openURL(KOFI_URL).catch(() => {});
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        {/* Fond semi-transparent cliquable pour fermer */}
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideY }], opacity },
          ]}
        >
          {/* ── Handle ────────────────────────────────────────────────── */}
          <View style={styles.handle} />

          {/* ── En-tête ───────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.title}>Paramètres</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* ── Section Compte ────────────────────────────────────────── */}
            <SectionLabel label="Compte" />

            <View style={styles.infoRow}>
              <Ionicons name="person-circle-outline" size={19} color={COLORS.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Connecté en tant que</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {profile?.pseudo ?? session?.user.email ?? '—'}
                </Text>
              </View>
            </View>

            <SettingRow
              icon="log-out-outline"
              iconColor={COLORS.accent}
              label="Déconnexion"
              onPress={handleSignOut}
              destructive
              loading={signingOut}
            />

            {/* ── Section Notifications ─────────────────────────────────── */}
            <SectionLabel label="Notifications" />

            <View style={[styles.settingRow, styles.settingRowBg]}>
              <Ionicons name="notifications-outline" size={19} color={COLORS.info} />
              <Text style={styles.settingLabel}>Rappel quotidien (7h)</Text>
              {togglingNotifs ? (
                <ActivityIndicator size="small" color={COLORS.info} />
              ) : (
                <Switch
                  value={notifsEnabled}
                  onValueChange={handleToggleNotifs}
                  trackColor={{ false: COLORS.border, true: COLORS.info + '99' }}
                  thumbColor={notifsEnabled ? COLORS.info : COLORS.textMuted}
                  ios_backgroundColor={COLORS.border}
                />
              )}
            </View>

            <Text style={styles.settingHint}>
              Une notification chaque jour à 7h pour vous rappeler de jouer.
              Annulée automatiquement si vous avez déjà joué.
            </Text>

            {/* ── Section App ───────────────────────────────────────────── */}
            <SectionLabel label="Application" />

            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={19} color={COLORS.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>PixelNight v{APP_VERSION}</Text>
              </View>
            </View>

            <SettingRow
              icon="refresh-outline"
              iconColor={COLORS.warning}
              label="Forcer la mise à jour"
              onPress={handleClearCache}
              loading={clearingCache}
              done={cacheCleared}
            />
            {cacheCleared && (
              <Text style={styles.settingHint}>
                ✓ Cache vidé — le jeu sera rechargé depuis le serveur.
              </Text>
            )}

            <SettingRow
              icon="information-circle-outline"
              iconColor={COLORS.info}
              label="À propos"
              onPress={() => setShowAbout(true)}
            />

            {/* ── Soutenir ──────────────────────────────────────────────── */}
            <SectionLabel label="Soutenir le projet" />

            <TouchableOpacity style={styles.kofiBtn} onPress={handleKofi} activeOpacity={0.82}>
              <Text style={styles.kofiEmoji}>☕</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.kofiTitle}>Soutenir PixelNight</Text>
                <Text style={styles.kofiSub}>Un café sur Ko-fi pour garder le projet vivant !</Text>
              </View>
              <Ionicons name="open-outline" size={15} color={COLORS.warning} />
            </TouchableOpacity>

            <View style={{ height: SPACING.xxl }} />
          </ScrollView>
        </Animated.View>
      </View>

      <AboutScreen
        visible={showAbout}
        onClose={() => setShowAbout(false)}
        onOpenPrivacy={() => { setShowAbout(false); setShowPrivacy(true); }}
        onOpenTerms={() => { setShowAbout(false); setShowTerms(true); }}
      />
      <PrivacyPolicyScreen visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsScreen visible={showTerms} onClose={() => setShowTerms(false)} />
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
  );
}

interface SettingRowProps {
  icon:         string;
  iconColor?:   string;
  label:        string;
  onPress:      () => void;
  destructive?: boolean;
  loading?:     boolean;
  done?:        boolean;
}

function SettingRow({ icon, iconColor, label, onPress, destructive, loading, done }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={[styles.settingRow, styles.settingRowBg]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor ?? COLORS.textSecondary} />
      ) : (
        <Ionicons name={icon as any} size={19} color={done ? COLORS.success : (iconColor ?? COLORS.textSecondary)} />
      )}
      <Text style={[styles.settingLabel, destructive && styles.settingLabelDestructive, done && styles.settingLabelDone]}>
        {label}
      </Text>
      {!loading && (
        done
          ? <Ionicons name="checkmark-circle" size={17} color={COLORS.success} />
          : <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    maxHeight: '85%',
  },

  handle: {
    width: 40, height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  title: {
    color: COLORS.text,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    fontFamily: 'monospace',
  },
  closeBtn: {
    padding: SPACING.xs,
  },

  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 1.2,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    fontFamily: 'monospace',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.cardAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  settingRowBg: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingLabel: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    flex: 1,
  },
  settingLabelDestructive: {
    color: COLORS.accent,
  },
  settingLabelDone: {
    color: COLORS.success,
  },
  settingHint: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    lineHeight: 17,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    fontStyle: 'italic',
  },

  kofiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.warningDim,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.warning + '55',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  kofiEmoji: { fontSize: 24 },
  kofiTitle: {
    color: COLORS.warning,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
  },
  kofiSub: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
});

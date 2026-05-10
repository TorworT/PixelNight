import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AboutScreen({ visible, onClose, onOpenPrivacy, onOpenTerms }: Props) {
  const handleEmail = () => {
    Linking.openURL('mailto:PixelNight04@gmail.com').catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {/* ── Header ──────────────────────────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>À propos</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo block ──────────────────────────────────────────── */}
          <View style={styles.logoSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>PN</Text>
            </View>
            <Text style={styles.appName}>PixelNight</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v1.0.2</Text>
            </View>
          </View>

          {/* ── Description ─────────────────────────────────────────── */}
          <Text style={styles.description}>
            PixelNight est un jeu de devinettes quotidien autour de la culture pop.
            Une nouvelle image chaque jour pour tester ta culture gaming !
          </Text>

          <Text style={styles.credit}>Créé avec ❤️ par l'équipe PixelNight</Text>

          {/* ── Section Légal ───────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>LÉGAL</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={onOpenPrivacy}
            activeOpacity={0.75}
          >
            <Ionicons name="shield-checkmark-outline" size={19} color={COLORS.info} />
            <Text style={styles.linkLabel}>Politique de confidentialité</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={onOpenTerms}
            activeOpacity={0.75}
          >
            <Ionicons name="document-text-outline" size={19} color={COLORS.info} />
            <Text style={styles.linkLabel}>Conditions d'utilisation</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* ── Section Contact ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>CONTACT</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={handleEmail}
            activeOpacity={0.75}
          >
            <Ionicons name="mail-outline" size={19} color={COLORS.accent} />
            <Text style={styles.linkLabel}>PixelNight04@gmail.com</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <Text style={styles.footer}>
            © 2026 PixelNight · Tous droits réservés
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: SPACING.xs,
    width: 36,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Logo section
  logoSection: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  logoBadge: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  logoText: {
    color: COLORS.accent,
    fontSize: FONTS.size.xxxl,
    fontWeight: FONTS.weight.black,
    fontFamily: 'monospace',
    lineHeight: FONTS.size.xxxl,
  },
  appName: {
    color: COLORS.text,
    fontSize: FONTS.size.xxl,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.sm,
  },
  versionBadge: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  versionText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    fontFamily: 'monospace',
    fontWeight: FONTS.weight.medium,
  },

  // Description
  description: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  credit: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },

  // Section label
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 1.2,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    fontFamily: 'monospace',
  },

  // Link rows
  linkRow: {
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
  linkLabel: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    flex: 1,
  },

  // Footer
  footer: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PrivacyPolicyScreen({ visible, onClose }: Props) {
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
            <Text style={styles.headerTitle}>Politique de Confidentialité</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lastUpdated}>Dernière mise à jour : 19 avril 2026</Text>

          {/* 1. Introduction */}
          <SectionHeader title="1. Introduction" />
          <Paragraph>
            PixelNight s'engage à protéger vos données personnelles. Cette politique explique
            quelles données nous collectons, comment nous les utilisons et vos droits.
          </Paragraph>

          {/* 2. Données collectées */}
          <SectionHeader title="2. Données collectées" />
          <Paragraph>
            Nous collectons les données suivantes :{'\n'}
            {'  '}• Adresse email{'\n'}
            {'  '}• Pseudo{'\n'}
            {'  '}• Scores et statistiques de jeu{'\n'}
            {'  '}• Pays de résidence (optionnel){'\n'}
            {'  '}• Historique des parties{'\n'}
            {'  '}• Identifiants publicitaires (via Google AdMob)
          </Paragraph>

          {/* 3. Utilisation des données */}
          <SectionHeader title="3. Utilisation des données" />
          <Paragraph>
            Vos données sont utilisées pour :{'\n'}
            {'  '}• Fonctionnement du jeu et authentification{'\n'}
            {'  '}• Affichage du classement mondial{'\n'}
            {'  '}• Statistiques et amélioration du service{'\n'}
            {'  '}• Diffusion de publicités personnalisées (Google AdMob)
          </Paragraph>

          {/* 4. Publicités (Google AdMob) */}
          <SectionHeader title="4. Publicités (Google AdMob)" />
          <Paragraph>
            Nous utilisons Google AdMob pour afficher des publicités. AdMob peut collecter
            des identifiants publicitaires (IDFA/GAID) et des données de comportement pour
            personnaliser les publicités. Vous pouvez limiter la collecte dans les paramètres
            de votre appareil.{'\n\n'}
            Pour plus d'informations : https://policies.google.com/privacy
          </Paragraph>

          {/* 5. Analytics */}
          <SectionHeader title="5. Analytics" />
          <Paragraph>
            Nous utilisons Google Analytics for Firebase pour mesurer l'utilisation de l'app.
            Ces données sont anonymisées et agrégées.
          </Paragraph>

          {/* 6. Hébergement des données */}
          <SectionHeader title="6. Hébergement des données" />
          <Paragraph>
            Vos données sont hébergées sur Supabase, dont les serveurs sont localisés en
            Europe (Union Européenne), dans le respect du RGPD.
          </Paragraph>

          {/* 7. Durée de conservation */}
          <SectionHeader title="7. Durée de conservation" />
          <Paragraph>
            Vos données sont conservées tant que votre compte est actif. Les comptes inactifs
            depuis plus de 2 ans sont automatiquement supprimés avec toutes les données
            associées.
          </Paragraph>

          {/* 8. Vos droits */}
          <SectionHeader title="8. Vos droits" />
          <Paragraph>
            Conformément au RGPD, vous disposez des droits suivants :{'\n'}
            {'  '}• Accès à vos données{'\n'}
            {'  '}• Rectification{'\n'}
            {'  '}• Suppression (droit à l'oubli){'\n'}
            {'  '}• Portabilité{'\n'}
            {'  '}• Opposition au traitement{'\n\n'}
            Pour exercer ces droits, contactez-nous à PixelNight04@gmail.com
          </Paragraph>

          {/* 9. Contact */}
          <SectionHeader title="9. Contact" />
          <Paragraph>
            Pour toute question relative à vos données personnelles :{'\n'}
            PixelNight04@gmail.com
          </Paragraph>

          {/* 10. Modifications */}
          <SectionHeader title="10. Modifications" />
          <Paragraph>
            Nous nous réservons le droit de modifier cette politique. Les modifications seront
            notifiées dans l'application.
          </Paragraph>

          <View style={{ height: SPACING.xxl }} />
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
    fontSize: FONTS.size.md,
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Last updated
  lastUpdated: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontStyle: 'italic',
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    paddingLeft: SPACING.md,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  sectionHeaderText: {
    color: COLORS.accent,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    fontFamily: 'monospace',
  },

  // Paragraph
  paragraph: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
});

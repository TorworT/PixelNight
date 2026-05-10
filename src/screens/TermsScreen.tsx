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

export function TermsScreen({ visible, onClose }: Props) {
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
            <Text style={styles.headerTitle}>Conditions d'Utilisation</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lastUpdated}>Dernière mise à jour : 19 avril 2026</Text>

          {/* 1. Acceptation des conditions */}
          <SectionHeader title="1. Acceptation des conditions" />
          <Paragraph>
            En utilisant PixelNight, vous acceptez les présentes Conditions d'Utilisation.
            Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.
          </Paragraph>

          {/* 2. Description du service */}
          <SectionHeader title="2. Description du service" />
          <Paragraph>
            PixelNight est un jeu de devinettes quotidien proposant une image pixelisée à
            identifier chaque jour. Le service est fourni gratuitement avec des publicités
            optionnelles permettant d'obtenir des récompenses.
          </Paragraph>

          {/* 3. Compte utilisateur */}
          <SectionHeader title="3. Compte utilisateur" />
          <Paragraph>
            {'  '}• Vous êtes responsable de la confidentialité de vos identifiants.{'\n'}
            {'  '}• Vous devez avoir au moins 13 ans pour créer un compte.{'\n'}
            {'  '}• Vous êtes responsable de toutes les activités effectuées depuis votre compte.{'\n'}
            {'  '}• PixelNight se réserve le droit de suspendre tout compte en cas d'abus.
          </Paragraph>

          {/* 4. Propriété intellectuelle */}
          <SectionHeader title="4. Propriété intellectuelle" />
          <Paragraph>
            L'application PixelNight, son design, son code source et ses contenus originaux
            sont la propriété exclusive de l'équipe PixelNight. Les images utilisées dans le
            jeu sont des représentations pixelisées à des fins éducatives et ludiques.
          </Paragraph>

          {/* 5. Comportements interdits */}
          <SectionHeader title="5. Comportements interdits" />
          <Paragraph>
            Il est strictement interdit de :{'\n'}
            {'  '}• Tricher ou utiliser des outils automatisés (bots, scripts){'\n'}
            {'  '}• Tenter de pirater ou compromettre la sécurité du service{'\n'}
            {'  '}• Créer de faux comptes ou usurper l'identité d'autres joueurs{'\n'}
            {'  '}• Partager les réponses quotidiennes avant la fin de la journée{'\n'}
            {'  '}• Utiliser le service à des fins commerciales sans autorisation
          </Paragraph>

          {/* 6. Limitation de responsabilité */}
          <SectionHeader title="6. Limitation de responsabilité" />
          <Paragraph>
            PixelNight est fourni "tel quel" sans garantie d'aucune sorte. Nous ne saurions
            être tenus responsables des dommages directs ou indirects résultant de
            l'utilisation du service, des interruptions de service, ou de la perte de données.
          </Paragraph>

          {/* 7. Modifications du service */}
          <SectionHeader title="7. Modifications du service" />
          <Paragraph>
            PixelNight se réserve le droit de modifier, suspendre ou interrompre le service
            à tout moment, avec ou sans préavis. Nous pouvons également modifier ces
            Conditions d'Utilisation ; les utilisateurs seront informés des changements
            importants.
          </Paragraph>

          {/* 8. Loi applicable */}
          <SectionHeader title="8. Loi applicable" />
          <Paragraph>
            Les présentes Conditions d'Utilisation sont régies par le droit français. En cas
            de litige, les tribunaux français seront compétents.
          </Paragraph>

          {/* 9. Contact */}
          <SectionHeader title="9. Contact" />
          <Paragraph>
            Pour toute question : PixelNight04@gmail.com
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

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';
import { markChangelogSeen, type ChangelogEntry } from '../lib/changelog';

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    overlay: {
      flex:            1,
      backgroundColor: 'rgba(0,0,0,0.88)',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         SPACING.xl,
    },
    card: {
      width:            '100%',
      maxWidth:         400,
      backgroundColor:  colors.card,
      borderRadius:     RADIUS.lg,
      // Bordure fine sur 3 côtés, épaisse et colorée en haut
      borderLeftWidth:   1,
      borderRightWidth:  1,
      borderBottomWidth: 1,
      borderTopWidth:    3,
      borderLeftColor:   '#a78bfa33',
      borderRightColor:  '#a78bfa33',
      borderBottomColor: '#a78bfa33',
      borderTopColor:    '#a78bfa',
    },

    // ── En-tête du contenu ───────────────────────────────────────────────────
    scrollContent: {
      padding:    SPACING.xl,
      paddingBottom: SPACING.md,
      gap:        SPACING.md,
    },
    badge: {
      flexDirection:    'row',
      alignItems:       'center',
      gap:              SPACING.xs,
      alignSelf:        'flex-start',
      backgroundColor:  '#a78bfa22',
      borderRadius:     RADIUS.full,
      borderWidth:      1,
      borderColor:      '#a78bfa',
      paddingHorizontal: SPACING.sm,
      paddingVertical:  3,
    },
    badgeText: {
      color:       '#a78bfa',
      fontSize:    FONTS.size.xs,
      fontWeight:  FONTS.weight.black,
      letterSpacing: 1,
      fontFamily:  ff ?? 'monospace',
    },
    versionTag: {
      color:        colors.textMuted,
      fontSize:     FONTS.size.xs,
      fontFamily:   ff ?? 'monospace',
      letterSpacing: 1.5,
    },
    title: {
      color:       colors.text,
      fontSize:    FONTS.size.xl,
      fontWeight:  FONTS.weight.black,
      fontFamily:  ff ?? 'monospace',
      letterSpacing: 0.5,
      lineHeight:  30,
    },
    divider: {
      height:           1,
      backgroundColor:  colors.border,
      marginVertical:   SPACING.xs,
    },

    // ── Liste des nouveautés ────────────────────────────────────────────────
    changeItem: {
      flexDirection: 'row',
      alignItems:    'flex-start',
      gap:           SPACING.sm,
    },
    changeIcon: {
      marginTop: 2,
    },
    changeText: {
      flex:       1,
      color:      colors.textSecondary,
      fontSize:   FONTS.size.sm,
      lineHeight: 21,
    },

    // ── Pied de carte ────────────────────────────────────────────────────────
    footer: {
      padding:    SPACING.xl,
      paddingTop: SPACING.md,
    },
    btn: {
      flexDirection:   'row',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             SPACING.sm,
      backgroundColor: '#a78bfa',
      borderRadius:    RADIUS.md,
      paddingVertical: SPACING.md,
    },
    btnText: {
      color:      '#ffffff',
      fontSize:   FONTS.size.md,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
    },
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entry:     ChangelogEntry;
  onDismiss: () => void;
}

// ─── ChangelogModal ───────────────────────────────────────────────────────────

export function ChangelogModal({ entry, onDismiss }: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Entrée animée
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue:         1,
        useNativeDriver: true,
        damping:         18,
        stiffness:       260,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        useNativeDriver: true,
        duration:        200,
      }),
    ]).start();
  }, [scale, opacity]);

  // Sortie animée → mark seen → callback
  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue:         0.9,
        useNativeDriver: true,
        duration:        160,
      }),
      Animated.timing(opacity, {
        toValue:         0,
        useNativeDriver: true,
        duration:        160,
      }),
    ]).start(() => {
      markChangelogSeen().catch(() => {});
      onDismiss();
    });
  }, [scale, opacity, onDismiss]);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Badge "NOUVEAUTÉS" */}
            <View style={styles.badge}>
              <Ionicons name="star" size={11} color="#a78bfa" />
              <Text style={styles.badgeText}>NOUVEAUTÉS</Text>
            </View>

            {/* Version */}
            <Text style={styles.versionTag}>VERSION {entry.version}</Text>

            {/* Titre */}
            <Text style={styles.title}>{entry.title}</Text>

            <View style={styles.divider} />

            {/* Liste des changements */}
            {entry.changes.map((change, i) => (
              <View key={i} style={styles.changeItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.success}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{change}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Bouton de fermeture */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btn}
              onPress={handleDismiss}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>C'est parti !</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

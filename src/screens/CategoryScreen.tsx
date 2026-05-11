import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthContext';
import { SupportModal } from '../components/SupportModal';
import { LootboxButton } from '../components/LootboxButton';
import type { ThemeColors } from '../constants/appearances';

const { width: W } = Dimensions.get('window');

// ─── Config des catégories ────────────────────────────────────────────────────

interface Category {
  id:        string;
  image?:    ReturnType<typeof require>; // image locale (require)
  emoji:     string;                    // fallback si pas d'image
  title:     string;
  subtitle:  string;
  color:     string;
  available: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onSelectCategory: (id: string) => void;
  onBack:           () => void;
}

// ─── Main styles factory ──────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.xl,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      width: 72,
    },
    backText: {
      color: colors.textMuted,
      fontSize: FONTS.size.sm,
      fontFamily: ff ?? 'monospace',
    },
    headerCenter: {
      alignItems: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: FONTS.size.xl,
      fontWeight: FONTS.weight.black,
      fontFamily: ff ?? 'monospace',
      letterSpacing: 2,
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      marginTop: 2,
    },

    // Cards container
    cards: {
      flex: 1,
      gap: SPACING.md,
      justifyContent: 'center',
    },

    // Card base
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      overflow: 'hidden',
      position: 'relative',
    },
    cardActive: {
      backgroundColor: colors.card,
    },
    cardInactive: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    cardDisabled: {
      opacity: 0.45,
    },
    cardGlow: {
      ...StyleSheet.absoluteFillObject,
    },

    // Icon
    iconBox: {
      width: 56, height: 56,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    catImage: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
    },
    emoji: {
      fontSize: 26,
    },

    // Text
    cardText: {
      flex: 1,
      gap: SPACING.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flexWrap: 'wrap',
    },
    cardTitle: {
      color: colors.text,
      fontSize: FONTS.size.lg,
      fontWeight: FONTS.weight.bold,
      fontFamily: ff ?? 'monospace',
    },
    cardTitleDim: {
      color: colors.textMuted,
    },
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      lineHeight: 16,
    },

    // Support FAB
    supportFab: {
      position: 'absolute',
      bottom: SPACING.xl,
      right: SPACING.xl,
      alignItems: 'center',
      gap: 4,
    },
    supportBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supportLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: FONTS.weight.bold,
      letterSpacing: 0.5,
    },

    // Coffre flottant — overlay plein écran, rendu en dernier
    lootboxFloat: {
      position: 'absolute',
      top:      0,
      left:     0,
      right:    0,
      bottom:   0,
      zIndex:   40,
    },

    // Badge
    soonBadge: {
      backgroundColor: colors.warningDim,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.warning + '66',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
    },
    soonText: {
      color: colors.warning,
      fontSize: 9,
      fontWeight: FONTS.weight.bold,
    },
  });
}

// ─── CategoryCard ─────────────────────────────────────────────────────────────

function CategoryCard({ cat, onPress }: { cat: Category; onPress: () => void }) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, tension: 300, friction: 10, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1,    tension: 300, friction: 10, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, !cat.available && styles.cardDisabled]}>
      <TouchableOpacity
        style={[
          styles.card,
          cat.available
            ? [styles.cardActive, { borderColor: cat.color }]
            : styles.cardInactive,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={!cat.available}
      >
        {/* Lueur de fond si actif */}
        {cat.available && (
          <View style={[styles.cardGlow, { backgroundColor: cat.color + '18' }]} />
        )}

        {/* Icône */}
        <View style={[
          styles.iconBox,
          { backgroundColor: cat.available ? cat.color + '22' : colors.cardAlt, borderColor: cat.available ? cat.color + '44' : colors.border },
        ]}>
          {cat.image
            ? <Image source={cat.image} style={styles.catImage} />
            : <Text style={styles.emoji}>{cat.emoji}</Text>
          }
        </View>

        {/* Texte */}
        <View style={styles.cardText}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, !cat.available && styles.cardTitleDim]}>
              {cat.title}
            </Text>
            {!cat.available && (
              <View style={styles.soonBadge}>
                <Text style={styles.soonText}>À venir</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSubtitle} numberOfLines={2}>{cat.subtitle}</Text>
        </View>

        {/* Flèche si actif */}
        {cat.available && (
          <Ionicons name="chevron-forward" size={20} color={cat.color} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── PixelGrid ────────────────────────────────────────────────────────────────

function PixelGrid() {
  const CELL = 32;
  const cols = Math.ceil(W / CELL) + 1;
  const rows = 30;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: cols }, (_, i) => (
        <View key={`v${i}`} style={[grid.line, grid.vert, { left: i * CELL }]} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View key={`h${i}`} style={[grid.line, grid.horiz, { top: i * CELL }]} />
      ))}
    </View>
  );
}

const grid = StyleSheet.create({
  line:  { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.02)' },
  vert:  { top: 0, bottom: 0, width: 1 },
  horiz: { left: 0, right: 0, height: 1 },
});

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryScreen({ onSelectCategory, onBack }: Props) {
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);
  const { profile, refreshProfile, isGuest } = useAuthContext();
  const [showSupport, setShowSupport] = useState(false);

  const CATEGORIES: Category[] = useMemo(() => [
    {
      id:       'games',
      image:    require('../../assets/images/Icones/icon-games.png'),
      emoji:    '🎮',
      title:    'Jeux Vidéos',
      subtitle: 'Retrouve le jeu à partir d\'une capture pixelisée',
      color:    colors.accent,
      available: true,
    },
    {
      id:       'cinema',
      emoji:    '🎬',
      title:    'Cinéma',
      subtitle: 'Bientôt disponible — Reconnais les films cultes',
      color:    colors.info,
      available: false,
    },
    {
      id:       'anime',
      image:    require('../../assets/images/Icones/icon-anime.png'),
      emoji:    '⭐',
      title:    'Animés',
      subtitle: 'Devine les animés par leur image pixelisée',
      color:    '#a855f7',
      available: true,
    },
    {
      id:       'dessinsanime',
      image:    require('../../assets/images/Icones/icon-dessinsanime.png'),
      emoji:    '🎨',
      title:    'Dessins Animés',
      subtitle: 'Retrouve les dessins animés et films d\'animation par leur image pixelisée',
      color:    '#f97316',
      available: true,
    },
  ], [colors]);

  // Animations d'entrée
  const headerY  = useRef(new Animated.Value(-20)).current;
  const headerOp = useRef(new Animated.Value(0)).current;

  // Chaque carte a son propre translateY + opacity
  const cardAnims = useRef(
    [0, 1, 2, 3].map(() => ({
      y:  new Animated.Value(40),
      op: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    // Header glisse d'abord
    Animated.parallel([
      Animated.timing(headerY,  { toValue: 0, duration: 350, easing: ease, useNativeDriver: true }),
      Animated.timing(headerOp, { toValue: 1, duration: 350,               useNativeDriver: true }),
    ]).start();

    // Cartes en stagger
    Animated.stagger(
      100,
      cardAnims.map(({ y, op }) =>
        Animated.parallel([
          Animated.timing(y,  { toValue: 0, duration: 420, easing: ease, useNativeDriver: true }),
          Animated.timing(op, { toValue: 1, duration: 380,               useNativeDriver: true }),
        ]),
      ),
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (cat: Category) => {
    if (!cat.available) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectCategory(cat.id);
  };

  return (
    <View style={styles.root}>
      {/* Grille de fond subtile */}
      <PixelGrid />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.header, { transform: [{ translateY: headerY }], opacity: headerOp }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Catégories</Text>
          <Text style={styles.headerSub}>Choisis ton terrain de jeu</Text>
        </View>

        {/* Placeholder pour centrage */}
        <View style={{ width: 72 }} />
      </Animated.View>

      {/* ── Cartes ──────────────────────────────────────────────────── */}
      <View style={styles.cards}>
        {CATEGORIES.map((cat, i) => (
          <Animated.View
            key={cat.id}
            style={{
              transform: [{ translateY: cardAnims[i].y }],
              opacity:   cardAnims[i].op,
              width:     '100%',
            }}
          >
            <CategoryCard cat={cat} onPress={() => handleSelect(cat)} />
          </Animated.View>
        ))}
      </View>

      {/* ── Bouton Support ──────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.supportFab}
        onPress={() => setShowSupport(true)}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.supportBtn}>
          <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
        </View>
        <Text style={styles.supportLabel}>Support</Text>
      </TouchableOpacity>

      {/* ── Modal Support ────────────────────────────────────────────── */}
      <SupportModal
        visible={showSupport}
        onClose={() => setShowSupport(false)}
      />

      {/* ── Coffre gratuit flottant ───────────────────────────────────────
          Rendu EN DERNIER pour priorité des touches sur tous les éléments.
          pointerEvents="box-none" : l'overlay laisse passer les touches
          partout sauf là où LootboxButton est rendu.
      ──────────────────────────────────────────────────────────────────── */}
      {!isGuest && (
        <View style={styles.lootboxFloat} pointerEvents="box-none">
          <LootboxButton
            lastClaimed={profile?.last_lootbox_claimed_at ?? null}
            onClaimed={() => refreshProfile().catch(() => {})}
          />
        </View>
      )}
    </View>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';
import { saveJSON } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onDone: () => void;
}

interface SlideData {
  key: string;
  emoji: string;
  title: string;
  lines: string[];
}

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDES: SlideData[] = [
  {
    key: 'slide-1',
    emoji: '',
    title: 'Bienvenue sur PixelNight !',
    lines: [
      'Une image pixelisée apparaît chaque jour',
      'Devine de quel jeu il s\'agit !',
    ],
  },
  {
    key: 'slide-2',
    emoji: '',
    title: 'Comment jouer ?',
    lines: [
      'Tu as 3 tentatives',
      'Utilise des indices si tu bloques',
      'Moins d\'indices = plus de pièces !',
    ],
  },
  {
    key: 'slide-3',
    emoji: '',
    title: 'Gagne des pièces !',
    lines: [
      'Trouve le jeu pour gagner des pièces',
      'Utilise-les dans la boutique',
      'Reviens chaque jour pour ta série !',
    ],
  },
];

const STORAGE_KEY = 'pn_onboarding_done';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Pixel grid background ────────────────────────────────────────────────────

const GRID_PITCH = 32;
const DOT_SIZE = 2;
const DOT_COLOR = '#1c1c30';

function PixelGrid() {
  const { width, height } = Dimensions.get('window');
  const cols = Math.ceil(width / GRID_PITCH) + 1;
  const rows = Math.ceil(height / GRID_PITCH) + 1;

  const dots: React.ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={[
            styles.gridDot,
            { top: r * GRID_PITCH, left: c * GRID_PITCH },
          ]}
        />,
      );
    }
  }

  return <View style={StyleSheet.absoluteFill} pointerEvents="none">{dots}</View>;
}

// ─── Animated emoji with pulse ────────────────────────────────────────────────

function PulsingEmoji({ emoji, active }: { emoji: string; active: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      scaleAnim.setValue(1);
    }

    return () => {
      loopRef.current?.stop();
    };
  }, [active, scaleAnim]);

  return (
    <Animated.Text style={[styles.emoji, { transform: [{ scale: scaleAnim }] }]}>
      {emoji}
    </Animated.Text>
  );
}

// ─── Single slide ─────────────────────────────────────────────────────────────

function Slide({ item, active: _active }: { item: SlideData; active: boolean }) {
  return (
    <View style={styles.slide}>
      <Text style={styles.slideTitle}>{item.title}</Text>

      <View style={styles.linesContainer}>
        {item.lines.map((line, index) => (
          <View key={index} style={styles.lineRow}>
            <View style={styles.lineAccent} />
            <Text style={styles.lineText}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Accent button with pixel corner dots ─────────────────────────────────────

function AccentButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.button, { transform: [{ scale: scaleAnim }] }]}>
        {/* Pixel corner dots */}
        <View style={[styles.cornerDot, styles.cornerTL]} />
        <View style={[styles.cornerDot, styles.cornerTR]} />
        <View style={[styles.cornerDot, styles.cornerBL]} />
        <View style={[styles.cornerDot, styles.cornerBR]} />

        <Text style={styles.buttonLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Dot indicators ───────────────────────────────────────────────────────────

function DotIndicators({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingScreen({ onDone }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);
  const backgroundOpacity = useRef(new Animated.Value(1)).current;

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const goToNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const handleDone = async () => {
    Animated.timing(backgroundOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      await saveJSON<boolean>(STORAGE_KEY, true);
      onDone();
    });
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <Animated.View style={[styles.container, { opacity: backgroundOpacity }]}>
      <PixelGrid />

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <Slide item={item} active={index === activeIndex} />
        )}
        style={styles.flatList}
      />

      <View style={styles.bottomArea}>
        <DotIndicators count={SLIDES.length} activeIndex={activeIndex} />

        <View style={styles.buttonWrapper}>
          <AccentButton
            label={isLast ? 'Commencer !' : 'Suivant'}
            onPress={isLast ? handleDone : goToNext}
          />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Pixel grid dot
  gridDot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: 1,
    backgroundColor: DOT_COLOR,
  },

  // FlatList fills the space above the bottom area
  flatList: {
    flex: 1,
  },

  // Each slide occupies the full screen width
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl * 2,
    paddingBottom: SPACING.xxl,
  },

  // Emoji
  emoji: {
    fontSize: 80,
    marginBottom: SPACING.xxl,
  },

  // Title
  slideTitle: {
    fontSize: FONTS.size.xxl,
    fontWeight: FONTS.weight.black,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: FONTS.size.xxl * 1.3,
  },

  // Bullet lines
  linesContainer: {
    width: '100%',
    gap: SPACING.md,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  lineAccent: {
    width: 3,
    height: FONTS.size.lg + 2,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    flexShrink: 0,
  },
  lineText: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: FONTS.size.md * 1.5,
  },

  // Bottom area (dots + button)
  bottomArea: {
    alignItems: 'center',
    paddingBottom: SPACING.xxl * 2,
    paddingTop: SPACING.lg,
    gap: SPACING.xl,
  },

  // Dot indicators
  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  dot: {
    borderRadius: RADIUS.full,
  },
  dotActive: {
    width: 20,
    height: 8,
    backgroundColor: COLORS.accent,
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.border,
  },

  // Button wrapper
  buttonWrapper: {
    width: '80%',
  },

  // Accent button
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  buttonLabel: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.black,
    color: COLORS.text,
    letterSpacing: 0.5,
  },

  // Pixel corner dots on button
  cornerDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: COLORS.background,
  },
  cornerTL: { top: 0, left: 0 },
  cornerTR: { top: 0, right: 0 },
  cornerBL: { bottom: 0, left: 0 },
  cornerBR: { bottom: 0, right: 0 },
});

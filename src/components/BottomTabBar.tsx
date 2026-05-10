import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

// 5 onglets actifs dans la zone de jeu
export type TabId = 'game' | 'infinite' | 'shop' | 'leaderboard' | 'profile';

interface TabDef {
  id:           TabId;
  label:        string;
  iconActive:   string;
  iconInactive: string;
}

const TABS: TabDef[] = [
  {
    id: 'game',
    label: 'Jeu',
    iconActive:   'game-controller',
    iconInactive: 'game-controller-outline',
  },
  {
    id: 'infinite',
    label: 'Infini',
    iconActive:   'infinite',
    iconInactive: 'infinite',
  },
  {
    id: 'shop',
    label: 'Boutique',
    iconActive:   'bag-handle',
    iconInactive: 'bag-handle-outline',
  },
  {
    id: 'leaderboard',
    label: 'Classement',
    iconActive:   'trophy',
    iconInactive: 'trophy-outline',
  },
  {
    id: 'profile',
    label: 'Profil',
    iconActive:   'person-circle',
    iconInactive: 'person-circle-outline',
  },
];

interface Props {
  activeTab:   TabId;
  onTabPress:  (id: TabId) => void;
}

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      paddingTop: SPACING.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 3,
      paddingVertical: SPACING.sm,
      position: 'relative',
    },
    activePill: {
      position: 'absolute',
      top: 0,
      width: 32,
      height: 3,
      backgroundColor: colors.accent,
      borderBottomLeftRadius:  RADIUS.full,
      borderBottomRightRadius: RADIUS.full,
    },
    label: {
      fontSize: FONTS.size.xs,
      fontWeight: FONTS.weight.medium,
      textAlign: 'center',
    },
  });
}

export function BottomTabBar({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
      <View style={styles.separator} />
      <View style={styles.row}>
        {TABS.map((tab) => {
          const isActive   = activeTab === tab.id;
          const iconColor  = isActive ? colors.accent : colors.textSecondary;
          const labelColor = isActive ? colors.accent : colors.textSecondary;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabPress(tab.id)}
              activeOpacity={0.7}
            >
              {/* Pill indicatrice */}
              {isActive && <View style={styles.activePill} />}

              <Ionicons
                name={(isActive ? tab.iconActive : tab.iconInactive) as any}
                size={22}
                color={iconColor}
              />
              <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * CountryPicker — Modal de sélection de pays avec barre de recherche.
 * Utilisé dans AuthScreen (inscription) et ProfileScreen (modifier).
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES, Country, flagEmoji } from '../constants/countries';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.82)',
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.background,
      marginTop: 60,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      overflow: 'hidden',
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      gap: SPACING.md,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.lg,
      fontWeight: FONTS.weight.bold,
    },
    closeBtn: {
      padding: SPACING.xs,
    },

    // Search
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: SPACING.md,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      height: 44,
      gap: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '55',
      gap: SPACING.md,
    },
    rowSelected: {
      backgroundColor: colors.accentDim,
    },
    flag: {
      fontSize: 22,
      width: 32,
      textAlign: 'center',
    },
    name: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
    },
    nameSelected: {
      color: colors.accent,
      fontWeight: FONTS.weight.bold,
    },
    code: {
      color: colors.textMuted,
      fontSize: FONTS.size.xs,
      fontFamily: 'monospace',
    },

    // Empty
    empty: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      gap: SPACING.sm,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: FONTS.size.sm,
    },
  });
}

// ─── CountryRow ───────────────────────────────────────────────────────────────

function CountryRow({
  country,
  selected,
  onPress,
  styles,
}: {
  country: Country;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.flag}>{flagEmoji(country.code)}</Text>
      <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
        {country.name}
      </Text>
      <Text style={styles.code}>{country.code}</Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
      )}
    </TouchableOpacity>
  );
}

// ─── CountryPicker ────────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  selected: string;           // ISO code courant
  onSelect: (code: string) => void;
  onClose:  () => void;
}

export function CountryPicker({ visible, selected, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  const handleSelect = useCallback(
    (code: string) => {
      onSelect(code);
      onClose();
      setQuery('');
    },
    [onSelect, onClose],
  );

  const handleClose = useCallback(() => {
    onClose();
    setQuery('');
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="globe-outline" size={20} color={colors.accent} />
            <Text style={styles.title}>Choisir un pays</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Barre de recherche */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un pays…"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Liste */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <CountryRow
                country={item}
                selected={item.code === selected}
                onPress={() => handleSelect(item.code)}
                styles={styles}
              />
            )}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            getItemLayout={(_, index) => ({
              length: 48,
              offset: 48 * index,
              index,
            })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={32} color={colors.border} />
                <Text style={styles.emptyText}>Aucun pays trouvé</Text>
              </View>
            }
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

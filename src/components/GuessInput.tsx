import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/appearances';

interface Props {
  onSubmit: (guess: string) => void;
  attemptsLeft: number;
  /** Nombre total de chances pour la partie — détermine le nombre de ronds affichés. */
  maxAttempts?: number;
  /** Catégorie active — sert à choisir l'icône dans les suggestions. */
  category?: string;
  /** Titres de la catégorie active chargés depuis game_aliases (GameScreen les fournit). */
  extraTitles?: string[];
  /** Titres à exclure de l'autocomplete (power-up "Éliminer ×3"). */
  excludedTitles?: string[];
  /** Placeholder du champ de saisie — adapté à la catégorie courante. */
  placeholder?: string;
}

/** Références stables pour les tableaux vides (évite les recomputations inutiles de useMemo). */
const EMPTY_TITLES: string[] = [];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '');
}

function createStyles(colors: ThemeColors, ff: string | undefined) {
  return StyleSheet.create({
    wrapper: { width: '100%' },

    dropdown: {
      backgroundColor: colors.cardAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      marginBottom: SPACING.xs,
      overflow: 'hidden',
    },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    suggestionBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    suggestionText: { color: colors.text, fontSize: FONTS.size.md, flex: 1 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.size.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      fontWeight: FONTS.weight.medium,
    },
    btn: {
      backgroundColor: colors.accent,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { backgroundColor: colors.accentDim },

    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.xs,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotActive: { backgroundColor: colors.accent },
    dotUsed: { backgroundColor: colors.border },
    dotsLabel: { color: colors.textMuted, fontSize: FONTS.size.xs, marginLeft: SPACING.xs },
  });
}

export function GuessInput({ onSubmit, attemptsLeft, maxAttempts = 5, category, extraTitles = EMPTY_TITLES, excludedTitles = EMPTY_TITLES, placeholder = 'Entrez un nom de jeu…' }: Props) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { colors, fontFamily } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFamily), [colors, fontFamily]);

  // Titres de la catégorie active (fournis par GameScreen depuis game_aliases),
  // après exclusion des titres éliminés par power-up.
  const allTitles = React.useMemo(() => {
    const excluded = new Set(excludedTitles.map(normalize));
    return extraTitles.filter((t) => !excluded.has(normalize(t)));
  }, [extraTitles, excludedTitles]);

  // Référence stable vers allTitles pour handleChange (évite de recréer le callback à chaque frappe)
  const allTitlesRef = useRef(allTitles);
  allTitlesRef.current = allTitles;

  const handleChange = useCallback((text: string) => {
    setValue(text);
    if (text.length < 2) { setSuggestions([]); return; }
    const q = normalize(text);
    const titles   = allTitlesRef.current;
    const starts   = titles.filter((t) =>  normalize(t).startsWith(q));
    const contains = titles.filter((t) => !normalize(t).startsWith(q) && normalize(t).includes(q));
    setSuggestions([...starts, ...contains].slice(0, 8));
  }, []); // ← dépendances vides : jamais recréé, lit toujours la dernière version via ref

  const pick = useCallback((title: string) => {
    setValue(title);
    setSuggestions([]);
    Keyboard.dismiss();
  }, []);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    setSuggestions([]);
    Keyboard.dismiss();
  }, [value, onSubmit]);

  return (
    <View style={styles.wrapper}>
      {/* ── Autocomplete dropdown ─────────────────────────────────────────────
          Rendered as View+map (NOT FlatList) to avoid the
          "VirtualizedLists nested in ScrollViews" warning.
          Max 8 suggestions → no virtualization needed.           */}
      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="always"
            scrollEnabled={suggestions.length > 5}
            style={{ maxHeight: 220 }}
          >
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.suggestion,
                  index < suggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => pick(item)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    category === 'anime' || category === 'dessinsanime'
                      ? 'tv-outline'
                      : category === 'cinema'
                        ? 'film-outline'
                        : 'game-controller-outline'
                  }
                  size={13}
                  color={colors.textMuted}
                />
                <Text style={styles.suggestionText} numberOfLines={1}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Input row ─────────────────────────────────────────────────────── */}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={submit}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.btn, !value.trim() && styles.btnDisabled]}
          onPress={submit}
          disabled={!value.trim()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Attempts dots ─────────────────────────────────────────────────── */}
      <View style={styles.dotsRow}>
        {Array.from({ length: maxAttempts }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i < attemptsLeft ? styles.dotActive : styles.dotUsed]}
          />
        ))}
        <Text style={styles.dotsLabel}>
          {attemptsLeft === 1 ? '1 tentative restante' : `${attemptsLeft} tentatives restantes`}
        </Text>
      </View>
    </View>
  );
}

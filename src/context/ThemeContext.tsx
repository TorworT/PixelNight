/**
 * ThemeContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fournit le thème visuel actif à toute l'application.
 *
 * Fonctionnalités :
 *  • Charge les préférences et items possédés depuis AsyncStorage au démarrage
 *  • Expose `colors` (couleurs du thème actif) à tous les composants
 *  • Gère un mode prévisualisation de 10 s (`startPreview`)
 *  • Persiste les modifications via `applyPrefs` (AsyncStorage)
 *  • `markOwned` enregistre un item acheté
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import {
  ThemeId, ButtonStyleId, VictoryEffectId, AvatarId, FontId,
  ThemeColors, AppearanceCategory,
  THEMES, AVATARS, FONTS_LIST, FREE_ITEMS,
} from '../constants/appearances';

// Police par fontId
const FONT_FAMILY: Record<FontId, string | undefined> = {
  mono:  'monospace',
  serif: 'serif',
  sans:  undefined,   // police système (sans-serif par défaut)
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppearancePrefs {
  themeId:         ThemeId;
  buttonStyleId:   ButtonStyleId;
  victoryEffectId: VictoryEffectId;
  avatarId:        AvatarId;
  fontId:          FontId;
}

export interface AppearanceOwned {
  themes:         ThemeId[];
  buttonStyles:   ButtonStyleId[];
  victoryEffects: VictoryEffectId[];
  avatars:        AvatarId[];
  fonts:          FontId[];
}

interface ThemeContextValue {
  /** Couleurs du thème actif (preview ou permanent). */
  colors:          ThemeColors;
  /** fontFamily à utiliser dans les styles dynamiques (undefined = police système). */
  fontFamily:      string | undefined;
  /** Préférences persistées. */
  prefs:           AppearancePrefs;
  /** Items possédés. */
  owned:           AppearanceOwned;
  /** ID du thème en prévisualisation (null si aucun). */
  previewThemeId:  ThemeId | null;
  /** Lance une prévisualisation de 10 s d'un thème. */
  startPreview:    (id: ThemeId) => void;
  /** Annule la prévisualisation. */
  cancelPreview:   () => void;
  /** Applique une ou plusieurs préférences et les persiste. */
  applyPrefs:      (partial: Partial<AppearancePrefs>) => Promise<void>;
  /** Enregistre un item comme possédé (après achat). */
  markOwned:       (category: AppearanceCategory, id: string) => Promise<void>;
  /** Vérifie si un item est possédé. */
  isOwned:         (category: AppearanceCategory, id: string) => boolean;
  /** Emoji de l'avatar sélectionné. */
  avatarEmoji:     string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PREFS_KEY = 'pn_appearance_prefs_v1';
const OWNED_KEY = 'pn_appearance_owned_v1';

const DEFAULT_PREFS: AppearancePrefs = {
  themeId:         'dark',
  buttonStyleId:   'classic',
  victoryEffectId: 'confetti',
  avatarId:        'gamepad',
  fontId:          'mono',
};

const DEFAULT_OWNED: AppearanceOwned = {
  themes:         [...FREE_ITEMS.themes],
  buttonStyles:   [...FREE_ITEMS.buttons],
  victoryEffects: [...FREE_ITEMS.victory],
  avatars:        [...FREE_ITEMS.avatars],
  fonts:          [...FREE_ITEMS.fonts],
};

// ─── Context ──────────────────────────────────────────────────────────────────

const defaultTheme = THEMES.find((t) => t.id === 'dark')!;

const ThemeContext = createContext<ThemeContextValue>({
  colors:         defaultTheme.colors,
  fontFamily:     'monospace',
  prefs:          DEFAULT_PREFS,
  owned:          DEFAULT_OWNED,
  previewThemeId: null,
  startPreview:   () => {},
  cancelPreview:  () => {},
  applyPrefs:     async () => {},
  markOwned:      async () => {},
  isOwned:        () => false,
  avatarEmoji:    '🎮',
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs,          setPrefs]          = useState<AppearancePrefs>(DEFAULT_PREFS);
  const [owned,          setOwned]          = useState<AppearanceOwned>(DEFAULT_OWNED);
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Chargement depuis AsyncStorage ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [savedPrefs, savedOwned] = await Promise.all([
        loadJSON<AppearancePrefs>(PREFS_KEY),
        loadJSON<AppearanceOwned>(OWNED_KEY),
      ]);
      if (!mountedRef.current) return;
      if (savedPrefs) setPrefs({ ...DEFAULT_PREFS, ...savedPrefs });
      if (savedOwned) {
        // Toujours garantir les items gratuits même si le cache est corrompu
        setOwned({
          themes:         [...new Set([...FREE_ITEMS.themes,   ...(savedOwned.themes         ?? [])])],
          buttonStyles:   [...new Set([...FREE_ITEMS.buttons,  ...(savedOwned.buttonStyles   ?? [])])],
          victoryEffects: [...new Set([...FREE_ITEMS.victory,  ...(savedOwned.victoryEffects ?? [])])],
          avatars:        [...new Set([...FREE_ITEMS.avatars,  ...(savedOwned.avatars         ?? [])])],
          fonts:          [...new Set([...FREE_ITEMS.fonts,    ...(savedOwned.fonts           ?? [])])],
        });
      }
    }
    load();
  }, []);

  // ── Couleurs actives ───────────────────────────────────────────────────────
  const activeThemeId = previewThemeId ?? prefs.themeId;
  const activeTheme   = THEMES.find((t) => t.id === activeThemeId) ?? defaultTheme;
  const colors        = activeTheme.colors;

  // ── Prévisualisation 10 s ──────────────────────────────────────────────────
  const startPreview = useCallback((id: ThemeId) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewThemeId(id);
    previewTimer.current = setTimeout(() => {
      if (mountedRef.current) setPreviewThemeId(null);
    }, 10_000);
  }, []);

  const cancelPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewThemeId(null);
  }, []);

  // ── Appliquer les préférences ──────────────────────────────────────────────
  const applyPrefs = useCallback(async (partial: Partial<AppearancePrefs>) => {
    const merged = { ...prefs, ...partial };
    if (mountedRef.current) setPrefs(merged);
    await saveJSON(PREFS_KEY, merged);
  }, [prefs]);

  // ── Marquer un item comme possédé ─────────────────────────────────────────
  const markOwned = useCallback(async (category: AppearanceCategory, id: string) => {
    const next = { ...owned };
    switch (category) {
      case 'theme':   next.themes         = [...new Set([...next.themes,         id as ThemeId])];         break;
      case 'button':  next.buttonStyles   = [...new Set([...next.buttonStyles,   id as ButtonStyleId])];   break;
      case 'victory': next.victoryEffects = [...new Set([...next.victoryEffects, id as VictoryEffectId])]; break;
      case 'avatar':  next.avatars        = [...new Set([...next.avatars,         id as AvatarId])];        break;
      case 'font':    next.fonts          = [...new Set([...next.fonts,           id as FontId])];          break;
    }
    if (mountedRef.current) setOwned(next);
    await saveJSON(OWNED_KEY, next);
  }, [owned]);

  // ── isOwned ────────────────────────────────────────────────────────────────
  const isOwned = useCallback((category: AppearanceCategory, id: string): boolean => {
    switch (category) {
      case 'theme':   return owned.themes.includes(id as ThemeId);
      case 'button':  return owned.buttonStyles.includes(id as ButtonStyleId);
      case 'victory': return owned.victoryEffects.includes(id as VictoryEffectId);
      case 'avatar':  return owned.avatars.includes(id as AvatarId);
      case 'font':    return owned.fonts.includes(id as FontId);
      default:        return false;
    }
  }, [owned]);

  const avatarEmoji = AVATARS.find((a) => a.id === prefs.avatarId)?.emoji ?? '🎮';
  const fontFamily  = FONT_FAMILY[prefs.fontId];

  return (
    <ThemeContext.Provider value={{
      colors, fontFamily, prefs, owned, previewThemeId,
      startPreview, cancelPreview, applyPrefs, markOwned, isOwned, avatarEmoji,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Accède à tout le contexte d'apparence. */
export function useTheme() {
  return useContext(ThemeContext);
}

/** Accède uniquement aux couleurs du thème actif (raccourci courant). */
export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

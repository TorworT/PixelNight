/**
 * appearances.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Catalogue complet des items cosmétiques :
 *  • Thèmes (6)        — couleurs globales de l'app
 *  • Styles boutons (5)— forme / rendu des boutons principaux
 *  • Effets victoire (4)— animation affichée quand on gagne
 *  • Avatars (8)       — emoji affiché dans le profil et le classement
 *  • Polices (3)       — famille de police des textes titres
 */

// ─── IDs ─────────────────────────────────────────────────────────────────────

export type ThemeId         = 'dark' | 'neon' | 'gameboy' | 'pastel' | 'inferno' | 'arctic';
export type ButtonStyleId   = 'classic' | 'retro' | 'pixel' | 'minimal' | 'neonbtn';
export type VictoryEffectId = 'confetti' | 'fireworks' | 'pixelrain' | 'golden';
export type AvatarId        = 'gamepad' | 'joystick' | 'alien' | 'robot' | 'skull' | 'fox' | 'dragon' | 'crown';
export type FontId          = 'mono' | 'serif' | 'sans';

export type AppearanceCategory = 'theme' | 'button' | 'victory' | 'avatar' | 'font';

// ─── Theme colors ─────────────────────────────────────────────────────────────

export interface ThemeColors {
  background:    string;
  card:          string;
  cardAlt:       string;
  border:        string;
  accent:        string;
  accentDim:     string;
  success:       string;
  successDim:    string;
  warning:       string;
  warningDim:    string;
  info:          string;
  infoDim:       string;
  text:          string;
  textSecondary: string;
  textMuted:     string;
  adButton:      string;
}

// ─── Definitions ──────────────────────────────────────────────────────────────

export interface AppTheme {
  id:     ThemeId;
  label:  string;
  emoji:  string;
  cost:   number;
  colors: ThemeColors;
}

export interface ButtonStyleDef {
  id:    ButtonStyleId;
  label: string;
  emoji: string;
  cost:  number;
  desc:  string;
}

export interface VictoryEffectDef {
  id:    VictoryEffectId;
  label: string;
  emoji: string;
  cost:  number;
  desc:  string;
}

export interface AvatarDef {
  id:    AvatarId;
  emoji: string;
  label: string;
  cost:  number;
}

export interface FontDef {
  id:     FontId;
  label:  string;
  emoji:  string;
  cost:   number;
  sample: string;
  family: string;
}

// ─── Thèmes ───────────────────────────────────────────────────────────────────

export const THEMES: AppTheme[] = [
  {
    id: 'dark', label: 'Sombre', emoji: '🌑', cost: 0,
    colors: {
      background: '#0f0f1a', card: '#1a1a2e', cardAlt: '#16213e',
      border: '#2a2a4e', accent: '#e94560', accentDim: '#7a1e2e',
      success: '#4ade80', successDim: '#1a5c32',
      warning: '#fbbf24', warningDim: '#5c430e',
      info: '#60a5fa', infoDim: '#1a3a6e',
      text: '#ffffff', textSecondary: '#a0a0cc', textMuted: '#5a5a7e',
      adButton: '#7c3aed',
    },
  },
  {
    id: 'neon', label: 'Néon', emoji: '💜', cost: 150,
    colors: {
      background: '#0d0221', card: '#1a0535', cardAlt: '#140428',
      border: '#3d0a7a', accent: '#bf00ff', accentDim: '#5a006e',
      success: '#00ff88', successDim: '#004433',
      warning: '#ffdd00', warningDim: '#4a3e00',
      info: '#00ffff', infoDim: '#003d3d',
      text: '#f0d0ff', textSecondary: '#cc88ff', textMuted: '#7a3a9e',
      adButton: '#7c3aed',
    },
  },
  {
    id: 'gameboy', label: 'Game Boy', emoji: '🟢', cost: 150,
    colors: {
      background: '#0f380f', card: '#306230', cardAlt: '#205020',
      border: '#4a7a4a', accent: '#8bac0f', accentDim: '#4a5a06',
      success: '#9bbc0f', successDim: '#4a5a06',
      warning: '#8bac0f', warningDim: '#4a5a06',
      info: '#9bbc0f', infoDim: '#4a5a06',
      text: '#9bbc0f', textSecondary: '#8bac0f', textMuted: '#4a6a4a',
      adButton: '#8bac0f',
    },
  },
  {
    id: 'pastel', label: 'Pastel', emoji: '🌸', cost: 150,
    colors: {
      background: '#1a1a2e', card: '#2d1b3d', cardAlt: '#231530',
      border: '#4a2a6a', accent: '#ff9de2', accentDim: '#7a3a6e',
      success: '#98f5b0', successDim: '#2d5a3d',
      warning: '#ffd6a0', warningDim: '#5a3a10',
      info: '#b8c0ff', infoDim: '#2a2a6e',
      text: '#ffe4f0', textSecondary: '#c8a0d8', textMuted: '#7a5a8a',
      adButton: '#c084fc',
    },
  },
  {
    id: 'inferno', label: 'Inferno', emoji: '🔥', cost: 200,
    colors: {
      background: '#1a0a00', card: '#2e1500', cardAlt: '#230f00',
      border: '#5a2a00', accent: '#ff6b00', accentDim: '#7a3000',
      success: '#ffd700', successDim: '#5a4a00',
      warning: '#ffd700', warningDim: '#5a4a00',
      info: '#ffaa44', infoDim: '#5a3000',
      text: '#ffd700', textSecondary: '#ffaa66', textMuted: '#8a5a22',
      adButton: '#cc4400',
    },
  },
  {
    id: 'arctic', label: 'Arctique', emoji: '❄️', cost: 200,
    colors: {
      background: '#0a1628', card: '#0f2040', cardAlt: '#0c1a33',
      border: '#1e3a5f', accent: '#00d4ff', accentDim: '#003d5a',
      success: '#66ffcc', successDim: '#003d2a',
      warning: '#ffe066', warningDim: '#4a3a00',
      info: '#88ccff', infoDim: '#1a2a4e',
      text: '#ffffff', textSecondary: '#88ccff', textMuted: '#3a5a7e',
      adButton: '#0077cc',
    },
  },
];

// ─── Styles de boutons ────────────────────────────────────────────────────────

export const BUTTON_STYLES: ButtonStyleDef[] = [
  { id: 'classic', label: 'Classique',      emoji: '⬛', cost: 0,   desc: 'Style pixel-art avec coins percés.' },
  { id: 'retro',   label: 'Aquarelle',      emoji: '🎨', cost: 100, desc: 'Coins arrondis, bordure douce, légère opacité.' },
  { id: 'pixel',   label: 'Pixel Art',      emoji: '🟥', cost: 100, desc: 'Entièrement carré, bordure épaisse, style 8-bit.' },
  { id: 'minimal', label: 'Glassmorphism',  emoji: '🪟', cost: 120, desc: 'Fond semi-transparent, style verre dépoli.' },
  { id: 'neonbtn', label: 'Néon',           emoji: '💡', cost: 150, desc: 'Lueur néon colorée, bordure lumineuse.' },
];

// ─── Effets de victoire ───────────────────────────────────────────────────────

export const VICTORY_EFFECTS: VictoryEffectDef[] = [
  { id: 'confetti',  label: 'Confettis',       emoji: '🎊', cost: 0,   desc: 'Pluie de confettis colorés.' },
  { id: 'fireworks', label: 'Feux d\'artifice', emoji: '🎆', cost: 100, desc: 'Explosion de feux d\'artifice.' },
  { id: 'pixelrain', label: 'Pixel Rain',       emoji: '🟩', cost: 120, desc: 'Pluie de pixels tombants.' },
  { id: 'golden',    label: 'Golden',           emoji: '✨', cost: 150, desc: 'Éclat doré légendaire.' },
];

// ─── Avatars ──────────────────────────────────────────────────────────────────

export const AVATARS: AvatarDef[] = [
  { id: 'gamepad',  emoji: '🎮', label: 'Manette',  cost: 0   },
  { id: 'joystick', emoji: '🕹️', label: 'Joystick', cost: 80  },
  { id: 'alien',    emoji: '👾', label: 'Alien',     cost: 80  },
  { id: 'robot',    emoji: '🤖', label: 'Robot',     cost: 80  },
  { id: 'skull',    emoji: '💀', label: 'Skull',     cost: 100 },
  { id: 'fox',      emoji: '🦊', label: 'Renard',    cost: 100 },
  { id: 'dragon',   emoji: '🐉', label: 'Dragon',    cost: 150 },
  { id: 'crown',    emoji: '👑', label: 'Couronne',  cost: 200 },
];

// ─── Polices ──────────────────────────────────────────────────────────────────

export const FONTS_LIST: FontDef[] = [
  { id: 'mono',  label: 'Monospace', emoji: '⌨️', cost: 0,   sample: 'PIXELNIGHT', family: 'monospace'  },
  { id: 'serif', label: 'Serif',     emoji: '📜', cost: 100, sample: 'PixelNight',  family: 'serif'      },
  { id: 'sans',  label: 'Sans',      emoji: '🔠', cost: 80,  sample: 'PixelNight',  family: 'sans-serif' },
];

// ─── Items gratuits (inclus par défaut) ───────────────────────────────────────

export const FREE_ITEMS = {
  themes:  ['dark']      as ThemeId[],
  buttons: ['classic']   as ButtonStyleId[],
  victory: ['confetti']  as VictoryEffectId[],
  avatars: ['gamepad']   as AvatarId[],
  fonts:   ['mono']      as FontId[],
};

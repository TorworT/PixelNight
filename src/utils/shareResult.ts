import { Share } from 'react-native';
import { GameStatus, Attempt } from '../hooks/useGameState';
import { getDisplayDate } from './dateUtils';

// ─── Play Store ───────────────────────────────────────────────────────────────

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.valentinchave.pixelnight';

// ─── Grid builder ─────────────────────────────────────────────────────────────

/**
 * Converts the attempts array into an emoji grid à la Wordle.
 *   ⬛ = mauvaise réponse
 *   🟩 = bonne réponse (toujours le dernier carré si gagné)
 *
 * Exemple : 3 tentatives, gagné à la 2e → "⬛🟩"
 */
function buildGrid(attempts: Attempt[]): string {
  if (attempts.length === 0) return '⬛';
  return attempts.map((a) => (a.isCorrect ? '🟩' : '⬛')).join('');
}

// ─── Text builder ─────────────────────────────────────────────────────────────

export interface ShareParams {
  status: GameStatus;
  attempts: Attempt[];
  hintsRevealed: number;
  hasWatchedAdForExtra: boolean;
  /** Série actuelle du joueur (profile.serie_actuelle), 0 si inconnu. */
  serie: number;
  /** URL Supabase de l'image du jeu — incluse dans le partage pour un aperçu visuel. */
  imageUrl?: string;
}

function buildShareText(p: ShareParams): string {
  const won          = p.status === 'won';
  const maxAttempts  = p.hasWatchedAdForExtra ? 4 : 3;
  const usedAttempts = p.attempts.length;
  const grid         = buildGrid(p.attempts);

  // Date capitalisée en français, ex: "Mercredi 15 avril 2026"
  const rawDate   = getDisplayDate();
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  const lines: string[] = [];

  // ── En-tête ────────────────────────────────────────────────────────────────
  lines.push(`🎮 PixelNight — ${dateLabel}`);
  lines.push('');

  // ── Résultat ───────────────────────────────────────────────────────────────
  if (won) {
    if (p.hasWatchedAdForExtra && usedAttempts === maxAttempts) {
      lines.push('✅ Trouvé avec la chance bonus ! 😅');
    } else if (usedAttempts === 1) {
      lines.push('✅ Trouvé du PREMIER COUP ! 🤯');
    } else {
      lines.push(`✅ Trouvé en ${usedAttempts}/${maxAttempts} essais !`);
    }
  } else {
    lines.push(`❌ Pas trouvé aujourd'hui... (${usedAttempts}/${maxAttempts})`);
  }

  // ── Grille emoji ───────────────────────────────────────────────────────────
  lines.push('');
  lines.push(grid);

  // ── Indices utilisés ───────────────────────────────────────────────────────
  if (p.hintsRevealed > 0) {
    const s = p.hintsRevealed > 1 ? 's' : '';
    lines.push(`💡 ${p.hintsRevealed} indice${s} utilisé${s}`);
  }

  // ── Série (uniquement si > 1 et victoire) ─────────────────────────────────
  if (won && p.serie > 1) {
    lines.push('');
    lines.push(`🔥 Série actuelle : ${p.serie} jours d'affilée !`);
  }

  // ── Call-to-action ─────────────────────────────────────────────────────────
  lines.push('');
  if (won) {
    if (usedAttempts === 1) {
      lines.push('📱 Trop fort ? Prouve-le sur PixelNight !');
    } else {
      lines.push('📱 Défie-moi sur PixelNight !');
    }
  } else {
    lines.push('📱 Tu aurais trouvé ? Joue sur PixelNight !');
  }

  // ── Image du jeu (aperçu) ──────────────────────────────────────────────────
  if (p.imageUrl) {
    lines.push('');
    lines.push(p.imageUrl);
  }

  // ── Lien Play Store ────────────────────────────────────────────────────────
  lines.push('');
  lines.push(`🎮 ${PLAY_STORE_URL}`);

  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ouvre le menu de partage natif Android avec le résultat formaté.
 * Ne lance pas d'exception — l'annulation utilisateur est silencieuse.
 */
export async function shareResult(params: ShareParams): Promise<void> {
  const message = buildShareText(params);

  try {
    await Share.share({ message });
  } catch {
    // Partage annulé ou non supporté — on ignore silencieusement
  }
}

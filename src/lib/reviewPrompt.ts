/**
 * reviewPrompt.ts
 * Logique de demande d'avis App Store / Play Store.
 *
 * - Compte le nombre de victoires en AsyncStorage.
 * - Après REVIEW_THRESHOLD victoires (3), indique que la popup doit s'afficher.
 * - Une fois la popup affichée, ne jamais la re-proposer.
 */

import { loadJSON, saveJSON } from '../utils/storage';

const WINS_COUNT_KEY   = 'pn_wins_count';
const REVIEW_ASKED_KEY = 'pn_review_asked';
const REVIEW_THRESHOLD = 3;

/**
 * À appeler après chaque victoire.
 * Retourne true si la popup de demande d'avis doit être affichée ce soir.
 */
export async function trackWinAndCheckReview(): Promise<boolean> {
  try {
    const asked = await loadJSON<boolean>(REVIEW_ASKED_KEY);
    if (asked) return false;

    const count    = (await loadJSON<number>(WINS_COUNT_KEY)) ?? 0;
    const newCount = count + 1;
    await saveJSON(WINS_COUNT_KEY, newCount);

    return newCount >= REVIEW_THRESHOLD;
  } catch {
    return false;
  }
}

/**
 * À appeler dès que l'utilisateur a vu la popup (quel que soit le bouton cliqué).
 * Empêche toute réapparition future.
 */
export async function markReviewPromptShown(): Promise<void> {
  try {
    await saveJSON(REVIEW_ASKED_KEY, true);
  } catch {
    // Silencieux
  }
}

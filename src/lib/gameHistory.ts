import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameHistoryEntry {
  date:         string;  // 'YYYY-MM-DD'
  won:          boolean;
  attempts:     number;
  score:        number;
  coins_earned: number;
}

export interface WinDistributionItem {
  label:    string;
  attempts: number | null; // null = perdu
  count:    number;
}

export interface CalendarDay {
  date:   string;   // 'YYYY-MM-DD'
  label:  string;   // 'Lun', 'Mar', etc.
  played: boolean;
  won:    boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Enregistre le résultat de la partie dans game_history (UPSERT).
 * À appeler en même temps que submitGameResult (indépendants, non-bloquants).
 */
export async function recordGameHistory(
  won:          boolean,
  attempts:     number,
  score:        number,
  coinsEarned:  number,
): Promise<void> {
  const { error } = await supabase.rpc('record_game_history', {
    p_won:      won,
    p_attempts: attempts,
    p_score:    score,
    p_coins:    coinsEarned,
  });
  if (error && __DEV__) console.warn('[gameHistory] record:', error.message);
}

/**
 * Récupère l'historique de parties pour le joueur connecté.
 * Si `days` est fourni, filtre sur les N derniers jours.
 * Sans argument, retourne TOUTES les parties (aucune limite de date).
 */
export async function getRecentHistory(days?: number): Promise<GameHistoryEntry[]> {
  let query = supabase
    .from('game_history')
    .select('date, won, attempts, score, coins_earned')
    .order('date', { ascending: false });

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    query = query.gte('date', since.toISOString().slice(0, 10));
  }

  const { data, error } = await query;

  if (error) {
    if (__DEV__) console.warn('[gameHistory] getRecent:', error.message);
    return [];
  }
  return (data ?? []) as unknown as GameHistoryEntry[];
}

// ─── Calculs locaux ───────────────────────────────────────────────────────────

/**
 * Répartition des résultats pour le graphique en barres.
 */
export function computeWinDistribution(history: GameHistoryEntry[]): WinDistributionItem[] {
  const won1 = history.filter((h) => h.won && h.attempts === 1).length;
  const won2 = history.filter((h) => h.won && h.attempts === 2).length;
  const won3 = history.filter((h) => h.won && h.attempts >= 3).length;
  const lost = history.filter((h) => !h.won).length;
  return [
    { label: '1 essai',  attempts: 1,    count: won1 },
    { label: '2 essais', attempts: 2,    count: won2 },
    { label: '3 essais', attempts: 3,    count: won3 },
    { label: 'Perdu',    attempts: null, count: lost },
  ];
}

/** Total des pièces gagnées sur toute la période chargée. */
export function computeTotalCoinsEarned(history: GameHistoryEntry[]): number {
  return history.reduce((sum, h) => sum + (h.coins_earned ?? 0), 0);
}

/**
 * Génère le tableau des 7 derniers jours (du plus ancien au plus récent)
 * en croisant avec l'historique.
 */
export function computeCalendarWeek(history: GameHistoryEntry[]): CalendarDay[] {
  const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const historyMap = new Map(history.map((h) => [h.date, h]));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i)); // 6 jours en arrière → aujourd'hui
    const dateStr = d.toISOString().slice(0, 10);
    const entry   = historyMap.get(dateStr);
    return {
      date:   dateStr,
      label:  DAY_LABELS[d.getDay()],
      played: !!entry,
      won:    entry?.won ?? false,
    };
  });
}

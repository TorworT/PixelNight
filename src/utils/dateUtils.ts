/**
 * Heure à laquelle le jeu du jour change (7h heure locale).
 * Avant 7h → on joue encore au jeu d'hier.
 * À partir de 7h → nouveau jeu du jour.
 */
const GAME_RESET_HOUR = 7;

/**
 * Returns the "game date" as YYYY-MM-DD using 7h as the daily pivot.
 * Before 07:00 → yesterday's date (still the same game).
 * From 07:00   → today's date (new game).
 */
export function getDateString(date: Date = new Date()): string {
  const effective = new Date(date);
  if (effective.getHours() < GAME_RESET_HOUR) {
    effective.setDate(effective.getDate() - 1);
  }
  const y = effective.getFullYear();
  const m = String(effective.getMonth() + 1).padStart(2, '0');
  const d = String(effective.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Number of "game days" elapsed since 2024-01-01 20:00 local time.
 * Used to pick the daily game deterministically when Supabase is unavailable.
 */
export function getDayIndex(date: Date = new Date()): number {
  const effective = new Date(date);
  if (effective.getHours() < GAME_RESET_HOUR) {
    effective.setDate(effective.getDate() - 1);
  }
  // Epoch anchor: 2024-01-01 at game reset hour (local time)
  const epoch = new Date(2024, 0, 1, GAME_RESET_HOUR, 0, 0, 0);
  return Math.floor((effective.getTime() - epoch.getTime()) / 86_400_000);
}

/** Human-readable date label, e.g. "lundi 14 avril 2026". */
export function getDisplayDate(date: Date = new Date()): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Milliseconds until the next game reset (7h local time).
 * Used by the Countdown component.
 */
export function msUntilReset(): number {
  const now    = new Date();
  const target = new Date(now);
  // If we've already passed 7h today, target is tomorrow at 7h
  if (now.getHours() >= GAME_RESET_HOUR) {
    target.setDate(target.getDate() + 1);
  }
  target.setHours(GAME_RESET_HOUR, 0, 0, 0);
  return Math.max(0, target.getTime() - now.getTime());
}

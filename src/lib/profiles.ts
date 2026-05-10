import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  pseudo: string;
  avatar_url: string;
  country_code: string; // ISO 3166-1 alpha-2 (ex. 'FR')
  score_total: number;
  serie_actuelle: number;
  meilleure_serie: number;
  parties_jouees: number;
  parties_gagnees: number;
  coins: number;
  // Inventaire power-ups (quantités en stock)
  hint_letter: number;
  hint_zone:   number;
  extra_life:  number;
  skip:        number;
  /** Titre actif affiché sous le pseudo (ref vers titles.id, null si aucun). */
  active_title: string | null;
  /** Tier d'abonnement courant — mis à jour via sync_subscription_tier(). */
  subscription_tier: 'free' | 'basic' | 'pro' | 'legend';
  /** Code de parrainage unique du joueur (8 chars alphanum, auto-généré). */
  referral_code: string | null;
  /** UUID du parrain si le joueur a été parrainé, null sinon. */
  referred_by: string | null;
  /** Timestamp du dernier coffre gratuit réclamé (null = jamais ouvert). */
  last_lootbox_claimed_at: string | null;
  /** Timestamp de la dernière réclamation de pièces quotidiennes (null = jamais). */
  daily_coins_claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Types d'items de l'inventaire (correspondent aux colonnes Supabase). */
export type InventoryItemType = 'hint_letter' | 'hint_zone' | 'extra_life' | 'skip';

// ─── Score rules ──────────────────────────────────────────────────────────────

/** Points awarded based on how many attempts were needed. */
export function calculateScore(attemptsUsed: number): number {
  if (attemptsUsed <= 1) return 100;
  if (attemptsUsed === 2) return 75;
  if (attemptsUsed === 3) return 50;
  return 25;
}

/** Pièces gagnées après une victoire. currentSerie = série AVANT cette victoire. */
export function calculateCoins(
  attemptsUsed: number,
  currentSerie: number,
  won: boolean,
): number {
  if (!won) return 0;
  const newSerie = currentSerie + 1;
  const base  = attemptsUsed <= 1 ? 100 : attemptsUsed === 2 ? 75 : attemptsUsed === 3 ? 50 : 25;
  const bonus = newSerie % 30 === 0 ? 500 : newSerie % 7 === 0 ? 200 : newSerie % 5 === 0 ? 25 : 0;
  return base + bonus;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const PROFILE_COLUMNS = [
  'id', 'pseudo', 'avatar_url', 'country_code',
  'score_total', 'serie_actuelle', 'meilleure_serie',
  'parties_jouees', 'parties_gagnees',
  'coins', 'hint_letter', 'hint_zone', 'extra_life', 'skip',
  'active_title', 'subscription_tier',
  'referral_code', 'referred_by',
  'last_lootbox_claimed_at', 'daily_coins_claimed_at',
  'created_at', 'updated_at',
].join(', ');

export async function getProfile(userId: string): Promise<Profile | null> {
  console.log('[profiles] getProfile() → userId:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) {
    // Log détaillé pour débugger : code + message + hint
    console.error(
      '[profiles] getProfile ERROR',
      '\n  code   :', error.code,
      '\n  message:', error.message,
      '\n  hint   :', (error as any).hint ?? '—',
      '\n  details:', (error as any).details ?? '—',
    );
    // PGRST116 = "no rows returned" → profil pas encore créé (normal au 1er lancement)
    if (error.code === 'PGRST116') return null;
    // Pour toute autre erreur Supabase, on lance pour que l'appelant puisse afficher
    // un message d'erreur clair (timeout, RLS, colonne manquante, etc.)
    throw new Error(`[getProfile] ${error.code}: ${error.message}`);
  }
  const p = data as unknown as Profile;
  // Garantit des valeurs numériques même si les colonnes viennent d'être ajoutées
  p.coins        = typeof p.coins        === 'number' ? p.coins        : 0;
  p.hint_letter  = typeof p.hint_letter  === 'number' ? p.hint_letter  : 0;
  p.hint_zone    = typeof p.hint_zone    === 'number' ? p.hint_zone    : 0;
  p.extra_life   = typeof p.extra_life   === 'number' ? p.extra_life   : 0;
  p.skip         = typeof p.skip         === 'number' ? p.skip         : 0;
  p.country_code      = typeof p.country_code      === 'string' ? p.country_code      : 'FR';
  p.active_title      = typeof p.active_title      === 'string' ? p.active_title      : null;
  p.subscription_tier = (['free', 'basic', 'pro', 'legend'] as const).includes(p.subscription_tier as any)
    ? p.subscription_tier
    : 'free';
  p.referral_code             = typeof p.referral_code             === 'string' ? p.referral_code             : null;
  p.referred_by               = typeof p.referred_by               === 'string' ? p.referred_by               : null;
  p.last_lootbox_claimed_at   = typeof p.last_lootbox_claimed_at   === 'string' ? p.last_lootbox_claimed_at   : null;
  p.daily_coins_claimed_at    = typeof p.daily_coins_claimed_at    === 'string' ? p.daily_coins_claimed_at    : null;
  console.log('[profiles] getProfile OK — pseudo:', p.pseudo, 'score:', p.score_total);
  return p;
}

export async function submitGameResult(
  score: number,
  won: boolean,
  newSerie: number,
): Promise<void> {
  const { error } = await supabase.rpc('submit_game_result', {
    p_score:     score,
    p_won:       won,
    p_new_serie: newSerie,
  });
  if (error && __DEV__) console.warn('[profiles] submitGameResult:', error.message);
}

// ─── Coins ────────────────────────────────────────────────────────────────────

export async function addCoins(amount: number): Promise<void> {
  const { error } = await supabase.rpc('add_coins', { p_amount: amount });
  if (error) {
    if (__DEV__) console.warn('[profiles] addCoins:', error.message);
    throw new Error(error.message ?? 'add_coins_failed');
  }
}

export async function spendCoins(amount: number): Promise<void> {
  const { error } = await supabase.rpc('spend_coins', { p_amount: amount });
  if (error) {
    if (__DEV__) console.warn('[profiles] spendCoins:', error.message);
    throw new Error(error.message ?? 'spend_coins_failed');
  }
}

// ─── Inventaire ───────────────────────────────────────────────────────────────

/**
 * Achète un item : déduit `cost` pièces ET incrémente le stock en une
 * transaction atomique côté serveur.
 * Lève 'insufficient_coins' si le solde est insuffisant.
 */
export async function buyItem(type: InventoryItemType, cost: number): Promise<void> {
  const { error } = await supabase.rpc('buy_item', {
    p_type: type,
    p_cost: cost,
  });
  if (error) {
    if (__DEV__) console.warn('[profiles] buyItem:', error.message);
    throw new Error(error.message ?? 'buy_item_failed');
  }
}

/**
 * Consomme 1 exemplaire d'un item de l'inventaire.
 * Lève 'item_not_available' si le stock est à 0.
 */
export async function useItem(type: InventoryItemType): Promise<void> {
  const { error } = await supabase.rpc('use_item', { p_type: type });
  if (error) {
    if (__DEV__) console.warn('[profiles] useItem:', error.message);
    throw new Error(error.message ?? 'use_item_failed');
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<Profile[]> {
  console.log('[profiles] getLeaderboard() → querying profiles table…');
  const { data, error } = await supabase
    .from('profiles')
    .select('id, pseudo, country_code, score_total, meilleure_serie, parties_jouees, parties_gagnees, active_title, subscription_tier')
    .order('score_total', { ascending: false })
    .limit(50);
  if (error) {
    console.error(
      '[profiles] getLeaderboard ERROR',
      '\n  code   :', error.code,
      '\n  message:', error.message,
      '\n  hint   :', (error as any).hint ?? '—',
      '\n  details:', (error as any).details ?? '—',
    );
    // Lancer l'erreur pour que LeaderboardScreen puisse afficher un message précis
    throw new Error(`[getLeaderboard] ${error.code}: ${error.message}`);
  }
  const rows = (data ?? []) as unknown as Profile[];
  console.log('[profiles] getLeaderboard OK —', rows.length, 'joueurs');
  return rows;
}

/** Top N joueurs — utilisé par le widget condensé de l'écran d'accueil. */
export async function getTopPlayers(limit: number = 5): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, pseudo, country_code, score_total, meilleure_serie')
    .order('score_total', { ascending: false })
    .limit(limit);
  if (error) {
    if (__DEV__) console.warn('[profiles] getTopPlayers:', error.message);
    return [];
  }
  return (data ?? []) as unknown as Profile[];
}

// ─── Mise à jour du profil ────────────────────────────────────────────────────

/** Met à jour le code pays du joueur connecté. */
export async function updateCountryCode(countryCode: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const { error } = await supabase
    .from('profiles')
    .update({ country_code: countryCode })
    .eq('id', user.id);
  if (error) {
    if (__DEV__) console.warn('[profiles] updateCountryCode:', error.message);
    throw new Error(error.message ?? 'update_country_failed');
  }
}

import { supabase } from './supabase';
import type { Profile } from './profiles';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Type de titre :
 * - streak_win   : débloqué automatiquement selon meilleure_serie
 * - streak_loss  : débloqué automatiquement selon le nombre de défaites cumulées
 * - achievement  : débloqué automatiquement selon les parties_gagnees
 * - shop         : acheté avec des pièces dans la boutique
 */
export type TitleType = 'streak_win' | 'streak_loss' | 'achievement' | 'shop';

export interface Title {
  id: string;
  label: string;
  description: string;
  type: TitleType;
  /** Coût en pièces (0 si non achetable). */
  cost: number;
  /** Seuil de déclenchement pour les titres automatiques (0 si achetable). */
  condition_value: number;
  /** Couleur d'affichage (hex). */
  color: string;
}

export interface PlayerTitle {
  user_id: string;
  title_id: string;
  unlocked_at: string;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Récupère tous les titres disponibles dans le jeu (table `titles`).
 * Trié par type puis par condition_value pour un affichage cohérent.
 */
export async function getTitles(): Promise<Title[]> {
  const { data, error } = await supabase
    .from('titles')
    .select('id, label, description, type, cost, condition_value, color')
    .order('type', { ascending: true })
    .order('condition_value', { ascending: true });

  if (error) {
    if (__DEV__) console.warn('[titles] getTitles:', error.message);
    throw new Error(`[getTitles] ${error.code}: ${error.message}`);
  }
  return (data ?? []) as unknown as Title[];
}

/**
 * Récupère les titres débloqués d'un joueur (table `player_titles`).
 * Retourne un tableau vide si aucun titre ou si le joueur est introuvable.
 */
export async function getMyTitles(userId: string): Promise<PlayerTitle[]> {
  const { data, error } = await supabase
    .from('player_titles')
    .select('user_id, title_id, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  if (error) {
    if (__DEV__) console.warn('[titles] getMyTitles:', error.message);
    return [];
  }
  return (data ?? []) as unknown as PlayerTitle[];
}

/**
 * Débloque un titre pour le joueur connecté (INSERT dans `player_titles`).
 * Utilise upsert pour éviter les doublons si déjà débloqué.
 * Lève une erreur si non authentifié.
 */
export async function unlockTitle(titleId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  const { error } = await supabase
    .from('player_titles')
    .upsert(
      { user_id: user.id, title_id: titleId, unlocked_at: new Date().toISOString() },
      { onConflict: 'user_id, title_id', ignoreDuplicates: true },
    );

  if (error) {
    if (__DEV__) console.warn('[titles] unlockTitle:', error.message);
    throw new Error(error.message ?? 'unlock_title_failed');
  }
}

/**
 * Achète un titre en pièces :
 * 1. Déduit `cost` pièces via le RPC `spend_coins` (côté serveur, vérifie le solde).
 * 2. Débloque le titre en base via `unlockTitle`.
 * Lève 'insufficient_coins' si le solde est insuffisant.
 */
export async function buyTitle(titleId: string, cost: number): Promise<void> {
  // Étape 1 : déduire les pièces (atomique côté serveur)
  const { error: spendError } = await supabase.rpc('spend_coins', { p_amount: cost });
  if (spendError) {
    if (__DEV__) console.warn('[titles] buyTitle spend_coins:', spendError.message);
    throw new Error(spendError.message ?? 'insufficient_coins');
  }

  // Étape 2 : déverrouiller le titre en base
  try {
    await unlockTitle(titleId);
  } catch (unlockErr) {
    // En cas d'échec du déverrouillage, on tente de rembourser les pièces
    supabase.rpc('add_coins', { p_amount: cost }).catch(() => {});
    throw unlockErr;
  }
}

/**
 * Définit le titre actif du joueur (colonne `active_title` de `profiles`).
 * Passe `null` pour retirer le titre actif.
 */
export async function setActiveTitle(titleId: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ active_title: titleId })
    .eq('id', user.id);

  if (error) {
    if (__DEV__) console.warn('[titles] setActiveTitle:', error.message);
    throw new Error(error.message ?? 'set_active_title_failed');
  }
}

// ─── Auto-unlock ──────────────────────────────────────────────────────────────

/**
 * Vérifie et débloque automatiquement les titres éligibles selon le profil.
 *
 * Règles de déclenchement :
 * - streak_win   : profile.meilleure_serie >= title.condition_value
 * - streak_loss  : (parties_jouees - parties_gagnees) >= title.condition_value
 * - achievement  : profile.parties_gagnees >= title.condition_value
 *
 * Les titres `shop` sont ignorés (jamais auto-débloqués).
 * Les titres déjà débloqués sont ignorés silencieusement.
 *
 * @returns Liste des IDs de titres nouvellement débloqués lors de cet appel.
 */
export async function checkAndUnlockTitles(profile: Profile): Promise<string[]> {
  const totalLosses = Math.max(0, profile.parties_jouees - profile.parties_gagnees);

  let allTitles: Title[];
  let myTitles: PlayerTitle[];

  try {
    [allTitles, myTitles] = await Promise.all([
      getTitles(),
      getMyTitles(profile.id),
    ]);
  } catch (err) {
    if (__DEV__) console.warn('[titles] checkAndUnlockTitles fetch error:', err);
    return [];
  }

  const alreadyUnlocked = new Set(myTitles.map((pt) => pt.title_id));

  // Filtre les titres automatiques non encore débloqués
  const candidates = allTitles.filter(
    (t) => t.type !== 'shop' && !alreadyUnlocked.has(t.id),
  );

  const newlyUnlocked: string[] = [];

  for (const title of candidates) {
    let eligible = false;

    switch (title.type) {
      case 'streak_win':
        eligible = profile.meilleure_serie >= title.condition_value;
        break;
      case 'streak_loss':
        eligible = totalLosses >= title.condition_value;
        break;
      case 'achievement':
        eligible = profile.parties_gagnees >= title.condition_value;
        break;
    }

    if (!eligible) continue;

    try {
      await unlockTitle(title.id);
      newlyUnlocked.push(title.id);
      if (__DEV__) console.log('[titles] Auto-unlocked:', title.label);
    } catch (err) {
      // Ne pas bloquer les autres titres si l'un échoue
      if (__DEV__) console.warn('[titles] Failed to unlock', title.id, err);
    }
  }

  return newlyUnlocked;
}

/**
 * guestProfile.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Profil local pour le mode invité : stats, pièces et inventaire sauvegardés
 * dans AsyncStorage. Aucun compte Supabase requis.
 *
 * Lors d'une inscription, le contenu est automatiquement transféré vers
 * le nouveau compte (géré dans AuthContext).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadJSON, saveJSON } from '../utils/storage';
import type { InventoryItemType } from './profiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuestProfile {
  // Statistiques
  coins:           number;
  score_total:     number;
  parties_jouees:  number;
  parties_gagnees: number;
  serie_actuelle:  number;
  meilleure_serie: number;
  // Inventaire power-ups (mêmes clés que Profile Supabase)
  hint_letter: number;
  hint_zone:   number;
  extra_life:  number;
  skip:        number;
  // Méta
  lastPlayedDate: string | null; // YYYY-MM-DD — idempotence quotidienne
}

// ─── Clés AsyncStorage ────────────────────────────────────────────────────────

const GUEST_PROFILE_KEY = 'pn_guest_profile_v1';
const GUEST_MODE_KEY    = 'pn_guest_mode';

// ─── Valeur par défaut ────────────────────────────────────────────────────────

export const DEFAULT_GUEST: GuestProfile = {
  coins: 0, score_total: 0, parties_jouees: 0, parties_gagnees: 0,
  serie_actuelle: 0, meilleure_serie: 0,
  hint_letter: 0, hint_zone: 0, extra_life: 0, skip: 0,
  lastPlayedDate: null,
};

// ─── Flag mode invité ─────────────────────────────────────────────────────────

export async function isGuestModeActive(): Promise<boolean> {
  return (await loadJSON<boolean>(GUEST_MODE_KEY)) === true;
}

export async function setGuestModeActive(active: boolean): Promise<void> {
  if (active) {
    await saveJSON(GUEST_MODE_KEY, true);
  } else {
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
  }
}

// ─── CRUD profil ──────────────────────────────────────────────────────────────

export async function getGuestProfile(): Promise<GuestProfile> {
  return (await loadJSON<GuestProfile>(GUEST_PROFILE_KEY)) ?? { ...DEFAULT_GUEST };
}

export async function saveGuestProfile(p: GuestProfile): Promise<void> {
  await saveJSON(GUEST_PROFILE_KEY, p);
}

/** Supprime le profil ET le flag de mode. Appelé après transfert vers un compte. */
export async function clearGuestProfile(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_PROFILE_KEY);
  await AsyncStorage.removeItem(GUEST_MODE_KEY);
}

// ─── Mutations de partie ──────────────────────────────────────────────────────

/**
 * Enregistre une victoire.
 * Idempotente : ignore si lastPlayedDate = aujourd'hui.
 */
export async function updateGuestOnWin(params: {
  score:   number;
  coins:   number;
  newSerie: number;
}): Promise<GuestProfile> {
  const today = new Date().toISOString().split('T')[0];
  const p     = await getGuestProfile();
  if (p.lastPlayedDate === today) return p;

  const updated: GuestProfile = {
    ...p,
    coins:           p.coins + params.coins,
    score_total:     p.score_total + params.score,
    parties_jouees:  p.parties_jouees + 1,
    parties_gagnees: p.parties_gagnees + 1,
    serie_actuelle:  params.newSerie,
    meilleure_serie: Math.max(p.meilleure_serie, params.newSerie),
    lastPlayedDate:  today,
  };
  await saveGuestProfile(updated);
  return updated;
}

/**
 * Enregistre une défaite.
 * Idempotente : ignore si lastPlayedDate = aujourd'hui.
 */
export async function updateGuestOnLoss(): Promise<GuestProfile> {
  const today = new Date().toISOString().split('T')[0];
  const p     = await getGuestProfile();
  if (p.lastPlayedDate === today) return p;

  const updated: GuestProfile = {
    ...p,
    parties_jouees: p.parties_jouees + 1,
    serie_actuelle: 0,
    lastPlayedDate: today,
  };
  await saveGuestProfile(updated);
  return updated;
}

/** Ajoute des pièces (récompense pub). */
export async function addGuestCoins(amount: number): Promise<GuestProfile> {
  const p       = await getGuestProfile();
  const updated = { ...p, coins: p.coins + amount };
  await saveGuestProfile(updated);
  return updated;
}

/**
 * Achète un item : déduit les pièces et incrémente le stock local.
 * Lève 'insufficient_coins' si le solde est insuffisant.
 */
export async function buyGuestItem(type: InventoryItemType, cost: number): Promise<GuestProfile> {
  const p = await getGuestProfile();
  if (p.coins < cost) throw new Error('insufficient_coins');
  const updated: GuestProfile = { ...p, coins: p.coins - cost, [type]: (p[type] ?? 0) + 1 };
  await saveGuestProfile(updated);
  return updated;
}

/**
 * Consomme 1 exemplaire d'un item de l'inventaire.
 * Lève 'item_not_available' si le stock est à 0.
 */
export async function useGuestItem(type: InventoryItemType): Promise<GuestProfile> {
  const p       = await getGuestProfile();
  const current = (p[type] ?? 0) as number;
  if (current <= 0) throw new Error('item_not_available');
  const updated = { ...p, [type]: current - 1 };
  await saveGuestProfile(updated);
  return updated;
}

// ─── Résumé pour la bannière de conversion ────────────────────────────────────

export async function getGuestTransferSummary(): Promise<{
  coins:   number;
  serie:   number;
  hasData: boolean;
}> {
  const p = await getGuestProfile();
  return {
    coins:   p.coins,
    serie:   p.serie_actuelle,
    hasData: p.parties_jouees > 0 || p.coins > 0,
  };
}

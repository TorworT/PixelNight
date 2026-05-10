import { Share } from 'react-native';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReferralError =
  | 'invalid_code'
  | 'already_referred'
  | 'own_code'
  | 'not_authenticated'
  | string;

export type ReferralResult =
  | { success: true }
  | { success: false; error: ReferralError };

// ─── Validation locale du code ────────────────────────────────────────────────

/** Normalise un code saisi : majuscules, trim. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Vérifie qu'un code existe dans la table profiles.
 * Utilisé avant l'inscription pour donner un retour immédiat à l'utilisateur.
 * Retourne l'id du parrain si le code est valide, null sinon.
 */
export async function checkReferralCode(code: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', normalizeCode(code))
    .single();
  return data?.id ?? null;
}

// ─── Génération du code pour les comptes existants ───────────────────────────

/**
 * Appelle la RPC `ensure_referral_code` qui :
 *   - retourne le code existant si déjà défini
 *   - le génère (MD5 de l'UUID) et le persiste sinon
 * Idempotente et thread-safe côté serveur.
 * Retourne null uniquement si l'utilisateur n'est pas authentifié ou si erreur réseau.
 */
export async function ensureReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_referral_code');
  if (error) {
    if (__DEV__) console.warn('[referral] ensureReferralCode:', error.message);
    return null;
  }
  return (data as string) ?? null;
}

// ─── Application post-inscription ────────────────────────────────────────────

/**
 * Appelle la RPC `apply_referral` pour appliquer un code APRÈS l'inscription.
 * Crédite 50 pièces au filleul ET au parrain.
 */
export async function applyReferral(code: string): Promise<ReferralResult> {
  if (!code.trim()) return { success: false, error: 'invalid_code' };

  const { data, error } = await supabase.rpc('apply_referral', {
    p_code: normalizeCode(code),
  });

  if (error) {
    if (__DEV__) console.warn('[referral] applyReferral RPC error:', error.message);
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return { success: false, error: result.error ?? 'unknown' };
  }

  return { success: true };
}

// ─── Message d'erreur lisible ─────────────────────────────────────────────────

export function referralErrorMessage(error: ReferralError): string {
  switch (error) {
    case 'invalid_code':      return 'Code invalide — vérifie les caractères.';
    case 'already_referred':  return 'Tu as déjà utilisé un code de parrainage.';
    case 'own_code':          return 'Tu ne peux pas utiliser ton propre code.';
    case 'not_authenticated': return 'Connecte-toi pour utiliser un code.';
    default:                  return 'Erreur inattendue — réessaie plus tard.';
  }
}

// ─── Partage du code ──────────────────────────────────────────────────────────

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.valentinchave.pixelnight';

/**
 * Ouvre le menu de partage natif avec un message invitant l'ami à s'inscrire.
 */
export async function shareReferralCode(code: string): Promise<void> {
  const message = [
    '🎮 Rejoins-moi sur PixelNight !',
    '',
    'Devine des jeux pixelisés chaque jour et grimpe dans le classement mondial 🏆',
    '',
    '🎁 Utilise mon code à l\'inscription pour recevoir 50 pièces offertes :',
    `      ${code}`,
    '',
    `📲 ${PLAY_STORE_URL}`,
  ].join('\n');

  try {
    await Share.share({ message });
  } catch {
    // Annulé silencieusement
  }
}

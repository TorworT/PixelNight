import { supabase } from './supabase';
import { loadJSON, saveJSON } from '../utils/storage';

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Version courante de l'application.
 * Doit rester synchronisée avec app.json > expo.version.
 */
export const APP_VERSION = '1.0.2';

/** Clé AsyncStorage pour la dernière version dont le changelog a été affiché. */
const STORAGE_KEY = 'pn_changelog_seen_version';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChangelogEntry {
  id:         number;
  version:    string;
  title:      string;
  changes:    string[];
  created_at: string;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Vérifie si le changelog de la version courante doit être affiché.
 *
 * Logique :
 *  1. Lit la dernière version "vue" en AsyncStorage.
 *  2. Si elle correspond à APP_VERSION → rien à montrer, retourne null.
 *  3. Sinon, tente de récupérer l'entrée depuis Supabase.
 *  4. Retourne l'entrée si elle existe, null sinon.
 *
 * Ne lève jamais d'erreur — échoue silencieusement.
 */
export async function checkChangelog(): Promise<ChangelogEntry | null> {
  try {
    const seenVersion = await loadJSON<string>(STORAGE_KEY);
    if (seenVersion === APP_VERSION) return null;

    const { data, error } = await supabase
      .from('changelogs')
      .select('id, version, title, changes, created_at')
      .eq('version', APP_VERSION)
      .maybeSingle();

    if (error || !data) return null;
    return data as ChangelogEntry;
  } catch {
    return null;
  }
}

/**
 * Marque la version courante comme "vue" dans AsyncStorage.
 * À appeler lorsque l'utilisateur ferme la modale de changelog.
 */
export async function markChangelogSeen(): Promise<void> {
  await saveJSON(STORAGE_KEY, APP_VERSION);
}

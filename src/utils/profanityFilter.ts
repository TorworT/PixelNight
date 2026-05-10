/**
 * Liste de mots interdits (français + anglais courants).
 * Normalisation appliquée à la vérification : minuscules, sans accents,
 * les caractères non-alphanumériques sont ignorés.
 */
const BANNED_WORDS: string[] = [
  // ── Français ────────────────────────────────────────────────────────────────
  'merde', 'merdeuse', 'merdeux',
  'putain', 'pute', 'putasse',
  'salope', 'salopiaud', 'salopiaud',
  'connard', 'connarde', 'connasse',
  'bite', 'bites',
  'couille', 'couilles',
  'chatte',
  'encule', 'enculer', 'enculeur', 'enculé',
  'niquer', 'nique', 'niquez',
  'baiser', 'baise',
  'foutre',
  'branleur', 'branleuse', 'branlette',
  'fdp',
  'ntm',
  'tpd',
  'pd', 'pede', 'pédale',
  'lopette',
  'enfoiré', 'enfoiree',
  'batard', 'batarde',
  'salaud', 'salaude',
  'ordure',
  'tapette',
  'fiotte',
  'tantouze',
  'clochard',
  'bouffon',
  'raclure',
  'fils de pute',
  'va te faire',
  // ── Anglais ─────────────────────────────────────────────────────────────────
  'fuck', 'fucker', 'fucked', 'fucking', 'fuckboy', 'fuckface',
  'motherfucker', 'motherfuck',
  'shit', 'shithead', 'bullshit',
  'bitch', 'bitches',
  'asshole', 'ashole',
  'bastard',
  'cunt',
  'dick', 'dickhead',
  'cock', 'cocksucker',
  'pussy',
  'nigger', 'nigga',
  'faggot', 'fag',
  'retard',
  'whore',
  'slut',
  'kys',
  'rape',
  'pedo', 'pedophile',
  'nazi',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise une chaîne : minuscules, sans accents, sans ponctuation. */
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // supprime les accents
    .replace(/[^a-z0-9]/g, ' ')        // ponctuation/espaces → espace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Même normalisation mais sans espace (pour détecter les mots collés). */
function compact(s: string): string {
  return normalizeStr(s).replace(/\s/g, '');
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Retourne `true` si `pseudo` contient un mot interdit.
 *
 * Deux niveaux de détection :
 * - Correspondance de mot entier (délimitée par des espaces / début-fin) — pour
 *   les mots courts qui pourraient créer des faux positifs en sous-chaîne.
 * - Correspondance sous-chaîne compacte (mots collés) — activée uniquement pour
 *   les termes de 4 caractères ou plus afin d'éviter les faux positifs.
 */
export function containsProfanity(pseudo: string): boolean {
  const normalized = normalizeStr(pseudo);
  const compacted  = compact(pseudo);

  for (const banned of BANNED_WORDS) {
    const nb = normalizeStr(banned);
    const nc = nb.replace(/\s/g, '');

    // 1. Mot exact (délimité par début, fin ou espace)
    const wordRegex = new RegExp(`(^| )${nc}( |$)`);
    if (wordRegex.test(normalized)) return true;

    // 2. Sous-chaîne compacte — uniquement pour les termes ≥ 4 caractères
    //    pour éviter que "pd" ou "con" ne bloquent des pseudos innocents.
    if (nc.length >= 4 && compacted.includes(nc)) return true;
  }

  return false;
}

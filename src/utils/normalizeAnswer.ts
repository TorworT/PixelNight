/**
 * Normalisation des réponses pour la comparaison insensible à la casse,
 * aux accents, aux espaces et aux chiffres romains/arabes.
 *
 * Pipeline :
 *   1. toLowerCase()               — insensible à la casse
 *   2. normalize('NFD') + [̀-ͯ]  — supprime les accents (é→e, ù→u, ñ→n…)
 *   3. arabicToRoman()             — convertit les chiffres arabes en romains
 *                                    ("2" → "ii") pour que "fairy tail 2" = "fairy tail ii"
 *   4. [^a-z]                      — supprime espaces, tirets, apostrophes, etc.
 *
 * La conversion arabic→roman est appliquée sur LES DEUX côtés (réponse du
 * joueur ET titre de référence), donc la comparaison reste symétrique.
 */

// ─── Conversion chiffres arabes → romains ─────────────────────────────────────

const ROMAN_VALS = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1] as const;
const ROMAN_SYMS = ['m','cm','d','cd','c','xc','l','xl','x','ix','v','iv','i'] as const;

function arabicToRoman(n: number): string {
  if (n <= 0 || n > 3999) return String(n); // hors plage → garde le chiffre tel quel
  let result = '';
  let remaining = n;
  for (let i = 0; i < ROMAN_VALS.length; i++) {
    while (remaining >= ROMAN_VALS[i]) {
      result    += ROMAN_SYMS[i];
      remaining -= ROMAN_VALS[i];
    }
  }
  return result;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Normalise une chaîne pour la comparaison de réponses de jeu.
 *
 * Exemples :
 *   normalizeAnswer("Fairy Tail")        === normalizeAnswer("fairy tail")        // true
 *   normalizeAnswer("Pokémon")           === normalizeAnswer("pokemon")            // true
 *   normalizeAnswer("Dragon Ball Z")     === normalizeAnswer("dragon ball z")      // true
 *   normalizeAnswer("Final Fantasy VII") === normalizeAnswer("Final Fantasy 7")    // true
 *   normalizeAnswer("Naruto II")         === normalizeAnswer("Naruto 2")           // true
 *   normalizeAnswer("One Piece")         === normalizeAnswer("One Piece")          // true
 */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // supprime les diacritiques combinants
    .replace(/(\d+)/g, (_, n) =>      // chiffres arabes → romains (1→i, 2→ii, 7→vii…)
      arabicToRoman(parseInt(n, 10)),
    )
    .replace(/[^a-z]/g, '');          // supprime tout sauf les lettres a-z
}

/**
 * Vérifie si une réponse du joueur correspond au titre ou à l'un de ses alias.
 *
 * @param guess   - Ce que le joueur a tapé
 * @param title   - Titre principal du jeu/animé
 * @param aliases - Alias alternatifs acceptés (optionnel)
 */
export function isAnswerCorrect(
  guess:   string,
  title:   string,
  aliases: string[] = [],
): boolean {
  const nGuess = normalizeAnswer(guess);
  if (nGuess === normalizeAnswer(title)) return true;
  return aliases.some((alias) => nGuess === normalizeAnswer(alias));
}

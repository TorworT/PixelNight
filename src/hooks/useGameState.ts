import { useState, useEffect, useCallback } from 'react';
import { Game, GAMES } from '../constants/games';
import { getDateString, getDayIndex } from '../utils/dateUtils';
import { loadJSON, saveJSON } from '../utils/storage';
import { fetchDailyGame, GameSource } from '../lib/dailyGame';
import { isAnswerCorrect } from '../utils/normalizeAnswer';

export interface Attempt {
  text: string;
  isCorrect: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost' | 'skipped';

/** Types de power-ups activables en cours de partie. */
export type PowerupType = 'firstLetter' | 'revealZone' | 'extraLife' | 'skip';

/** Flags locaux : quels effets sont actifs pour la partie en cours. */
export interface Powerups {
  firstLetter: boolean; // Première lettre révélée
  revealZone:  boolean; // Zone centrale non-floutée
  extraLife:   boolean; // Vie supplémentaire déjà consommée
}

export interface PersistedState {
  attempts:             Attempt[];
  maxAttempts:          number;
  hintsRevealed:        number;
  status:               GameStatus;
  hasWatchedAdForExtra: boolean;
  defeatAccepted:       boolean;   // true quand l'utilisateur clique "Accepter la défaite"
  scoreSubmitted:       boolean;
  powerups:             Powerups;
}

const MAX_ATTEMPTS = 5;
const MAX_HINTS    = 3;


const BLUR_MAX = 28;
// Progression fixe sur 5 essais (% de BLUR_MAX) :
//   essai 1 → 85% (24)  essai 2 → 75% (21)  essai 3 → 60% (17)
//   essai 4 → 50% (14)  essai 5 → 43% (12)
// Défaite → 43% (12)   Victoire → 0
const BLUR_STEPS          = [28, 24, 21, 17, 14, 12, 6, 3] as const; // index = nb essais utilisés (0‥7)
const BLUR_DEFEAT_PARTIAL = 12;

function computeBlurRadius(
  attemptsUsed:        number,
  maxAttempts:         number,
  status:              GameStatus,
  hasWatchedAdForExtra: boolean,
  defeatAccepted:      boolean,
): number {
  if (status === 'playing') {
    return BLUR_STEPS[Math.min(attemptsUsed, BLUR_STEPS.length - 1)];
  }
  if (status === 'lost') {
    // L'image ne se révèle QUE quand le joueur accepte explicitement la défaite.
    return defeatAccepted ? 0 : BLUR_DEFEAT_PARTIAL;
  }
  return 0;
}

const INITIAL_POWERUPS: Powerups = {
  firstLetter: false,
  revealZone:  false,
  extraLife:   false,
};

const INITIAL_STATE: PersistedState = {
  attempts:             [],
  maxAttempts:          MAX_ATTEMPTS,
  hintsRevealed:        0,
  status:               'playing',
  hasWatchedAdForExtra: false,
  defeatAccepted:       false,
  scoreSubmitted:       false,
  powerups:             INITIAL_POWERUPS,
};

export function useGameState(category = 'games', initialMaxAttempts: number = MAX_ATTEMPTS) {
  const [game, setGame]             = useState<Game | null>(null);
  const [state, setState]           = useState<PersistedState>(INITIAL_STATE);
  const [isLoading, setIsLoading]   = useState(true);
  const [gameSource, setGameSource] = useState<GameSource | null>(null);

  // v2 : force le rechargement depuis Supabase (invalide le cache v1 potentiellement
  // corrompu avec un fallback jeux vidéo pour les catégories anime/dessinsanime)
  const storageKey = category === 'games'
    ? `pixelnight_v2_${getDateString()}`
    : `pixelnight_v2_${category}_${getDateString()}`;

  useEffect(() => {
    let cancelled = false;

    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        const fallback = GAMES[Math.abs(getDayIndex()) % GAMES.length];
        setGame(fallback);
        setGameSource('local_fallback');
        setIsLoading(false);
      }
    }, 6000);

    async function load() {
      const [result, saved] = await Promise.all([
        fetchDailyGame(category),
        loadJSON<PersistedState>(storageKey),
      ]);
      clearTimeout(safetyTimer);
      if (cancelled) return;
      setGame(result.game);
      setGameSource(result.source);
      if (saved) {
        // maxAttempts : prend le max entre la valeur sauvée (peut être > base si extraLife
        // ou pub utilisés en cours de partie) et initialMaxAttempts (tier de l'abonné).
        const effectiveMax = Math.max(saved.maxAttempts ?? MAX_ATTEMPTS, initialMaxAttempts);
        setState({
          ...INITIAL_STATE,
          ...saved,
          maxAttempts: effectiveMax,
          powerups: saved.powerups ?? INITIAL_POWERUPS,
        });
      } else {
        setState({ ...INITIAL_STATE, maxAttempts: initialMaxAttempts });
      }
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [storageKey]);

  const persist = useCallback((next: PersistedState) => {
    setState(next);
    saveJSON(storageKey, next);
  }, [storageKey]);

  const submitGuess = useCallback((guess: string) => {
    if (!game || state.status !== 'playing') return;
    if (state.attempts.length >= state.maxAttempts) return;

    // ✅ Vérifie le titre principal ET les aliases (insensible casse/accents/chiffres romains)
    const isCorrect = isAnswerCorrect(guess, game.title, game.aliases ?? []);

    const newAttempts: Attempt[] = [...state.attempts, { text: guess, isCorrect }];

    let newStatus: GameStatus = 'playing';
    if (isCorrect) newStatus = 'won';
    else if (newAttempts.length >= state.maxAttempts) newStatus = 'lost';

    // Après la 4ème tentative (post-pub), la défaite est automatiquement acceptée
    // → image et titre révélés immédiatement sans clic supplémentaire.
    const newDefeatAccepted =
      state.defeatAccepted ||
      (newStatus === 'lost' && state.hasWatchedAdForExtra);

    persist({ ...state, attempts: newAttempts, status: newStatus, defeatAccepted: newDefeatAccepted });
  }, [game, state, persist]);

  const markScoreSubmitted = useCallback(() => {
    persist({ ...state, scoreSubmitted: true });
  }, [state, persist]);

  const watchAdForHint = useCallback(() => {
    if (state.hintsRevealed >= MAX_HINTS) return;
    persist({ ...state, hintsRevealed: state.hintsRevealed + 1 });
  }, [state, persist]);

  const watchAdForExtraChance = useCallback(() => {
    if (state.status !== 'lost' || state.hasWatchedAdForExtra) return;
    persist({
      ...state,
      status:               'playing',
      maxAttempts:          state.maxAttempts + 1,
      hasWatchedAdForExtra: true,
      defeatAccepted:       false,
    });
  }, [state, persist]);

  const acceptDefeat = useCallback(() => {
    // Ne plus bloquer si hasWatchedAdForExtra=true :
    // le joueur doit pouvoir accepter la défaite après sa 4ème chance aussi.
    if (state.status !== 'lost' || state.defeatAccepted) return;
    persist({ ...state, defeatAccepted: true });
  }, [state, persist]);

  const activatePowerup = useCallback((type: PowerupType) => {
    switch (type) {
      case 'firstLetter':
        persist({ ...state, powerups: { ...state.powerups, firstLetter: true } });
        break;
      case 'revealZone':
        persist({ ...state, powerups: { ...state.powerups, revealZone: true } });
        break;
      case 'extraLife':
        if (state.status === 'lost' && !state.powerups.extraLife) {
          persist({
            ...state,
            status:      'playing',
            maxAttempts: state.maxAttempts + 1,
            powerups:    { ...state.powerups, extraLife: true },
          });
        }
        break;
      case 'skip':
        if (state.status === 'playing') {
          persist({ ...state, status: 'skipped' });
        }
        break;
    }
  }, [state, persist]);

  return {
    game,
    state,
    isLoading,
    gameSource,
    category,
    blurRadius: computeBlurRadius(
      state.attempts.length,
      state.maxAttempts,
      state.status,
      state.hasWatchedAdForExtra,
      state.defeatAccepted,
    ),
    attemptsLeft: Math.max(0, state.maxAttempts - state.attempts.length),
    canGetHint:   state.hintsRevealed < MAX_HINTS && state.status === 'playing',
    canGetExtra:  state.status === 'lost' && !state.hasWatchedAdForExtra && !state.defeatAccepted,
    submitGuess,
    markScoreSubmitted,
    watchAdForHint,
    watchAdForExtraChance,
    acceptDefeat,
    activatePowerup,
  };
}
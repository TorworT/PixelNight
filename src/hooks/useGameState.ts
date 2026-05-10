import { useState, useEffect, useCallback } from 'react';
import { Game, GAMES } from '../constants/games';
import { getDateString, getDayIndex } from '../utils/dateUtils';
import { loadJSON, saveJSON } from '../utils/storage';
import { fetchDailyGame, GameSource } from '../lib/dailyGame';

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

const MAX_ATTEMPTS = 3;
const MAX_HINTS    = 3;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const BLUR_MAX = 28;
const BLUR_MIN = 4;
const BLUR_DEFEAT_PARTIAL = 14;

function computeBlurRadius(
  attemptsUsed:        number,
  maxAttempts:         number,
  status:              GameStatus,
  hasWatchedAdForExtra: boolean,
  defeatAccepted:      boolean,
): number {
  if (status === 'playing') {
    const step = (BLUR_MAX - BLUR_MIN) / Math.max(maxAttempts, 1);
    return Math.max(BLUR_MIN, Math.round(BLUR_MAX - attemptsUsed * step));
  }
  if (status === 'lost') {
    // L'image ne se révèle QUE quand le joueur accepte explicitement la défaite.
    // hasWatchedAdForExtra n'affecte PAS le flou — sinon l'image révèle dès
    // que le joueur perd le 4ème essai après avoir regardé la pub.
    return defeatAccepted ? 2 : BLUR_DEFEAT_PARTIAL;
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

export function useGameState(category = 'games') {
  const [game, setGame]             = useState<Game | null>(null);
  const [state, setState]           = useState<PersistedState>(INITIAL_STATE);
  const [isLoading, setIsLoading]   = useState(true);
  const [gameSource, setGameSource] = useState<GameSource | null>(null);

  // 'games' keeps the original key format for backward compatibility
  const storageKey = category === 'games'
    ? `pixelnight_${getDateString()}`
    : `pixelnight_${category}_${getDateString()}`;

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
        setState({
          ...INITIAL_STATE,
          ...saved,
          powerups: saved.powerups ?? INITIAL_POWERUPS,
        });
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

    // ✅ Vérifie le titre principal ET les aliases
    const isCorrect =
      normalize(guess) === normalize(game.title) ||
      (game.aliases ?? []).some((alias) => normalize(guess) === normalize(alias));

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
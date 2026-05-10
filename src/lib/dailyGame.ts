import { supabase, DailyGameRow, resolveImageUrl } from './supabase';
import { Game, GAMES } from '../constants/games';
import { getDateString, getDayIndex } from '../utils/dateUtils';
import { loadJSON, saveJSON } from '../utils/storage';

export type GameSource = 'supabase' | 'local_fallback' | 'cache';

export interface DailyGameResult {
  game: Game;
  source: GameSource;
}

function rowToGame(row: DailyGameRow, folder = 'games'): Game {
  return {
    id: row.id,
    title: row.game_name,
    imageUrl: resolveImageUrl(row.image_url, folder),
    hints: [row.hint1, row.hint2, row.hint3],
    year: 0,
    genre: row.category,
    developer: '',
    aliases: row.aliases ?? [],
  };
}

function cacheKey(dateStr?: string, category = 'games'): string {
  const d = dateStr ?? getDateString();
  // 'games' keeps the original key format for backward compatibility
  return category === 'games' ? `cached_game_${d}` : `cached_game_${category}_${d}`;
}

async function readCache(category = 'games'): Promise<Game | null> {
  return loadJSON<Game>(cacheKey(undefined, category));
}

async function writeCache(game: Game, category = 'games'): Promise<void> {
  await saveJSON(cacheKey(undefined, category), game);
}

function networkTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('network_timeout')), ms),
  );
}

/**
 * Vérifie qu'une URL d'image est accessible via une requête HEAD.
 * Timeout 4 s. Retourne false sur 404, timeout ou toute erreur réseau.
 * Les URL non-HTTP (ex. assets locaux) sont considérées valides d'emblée.
 */
async function checkImageUrl(url: string): Promise<boolean> {
  if (!url.startsWith('http')) return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.ok; // true pour 2xx, false pour 404 / 5xx etc.
  } catch {
    return false; // timeout (AbortError) ou erreur réseau
  }
}

async function fetchAndCacheForDate(dateStr: string, category = 'games'): Promise<void> {
  const { data } = await Promise.race([
    supabase.from('daily_games').select('*').eq('date', dateStr).eq('category', category).single(),
    networkTimeout(6000),
  ]);

  if (data) {
    const game = rowToGame(data as DailyGameRow, category);
    await saveJSON(cacheKey(dateStr, category), game);
  }
}

export async function prefetchUpcomingGames(days = 7, category = 'games'): Promise<void> {
  const today = new Date();
  const fetches: Promise<void>[] = [];

  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    fetches.push(
      loadJSON<Game>(cacheKey(dateStr, category)).then((cached) => {
        if (cached) return;
        return fetchAndCacheForDate(dateStr, category);
      }).catch(() => {}),
    );
  }

  await Promise.allSettled(fetches);
}

export async function fetchDailyGame(category = 'games'): Promise<DailyGameResult> {
  const cached = await readCache(category);
  if (cached) {
    return { game: cached, source: 'cache' };
  }

  try {
    const today = getDateString();

    const { data, error } = await Promise.race([
      supabase.from('daily_games').select('*').eq('date', today).eq('category', category).single(),
      networkTimeout(5000),
    ]);

    if (error) throw error;
    if (!data) throw new Error('No daily_games row for today');

    const game = rowToGame(data as DailyGameRow, category);

    // Vérifie que l'image est accessible avant de mettre en cache et de servir.
    // En cas de 404 ou timeout → fallback local (pas de cache pour forcer un
    // nouveau fetch Supabase au prochain lancement).
    if (!(await checkImageUrl(game.imageUrl))) {
      const fallback = GAMES[Math.abs(getDayIndex()) % GAMES.length];
      return { game: fallback, source: 'local_fallback' };
    }

    await writeCache(game, category);
    return { game, source: 'supabase' };

  } catch {
    const game = GAMES[Math.abs(getDayIndex()) % GAMES.length];
    return { game, source: 'local_fallback' };
  }
}

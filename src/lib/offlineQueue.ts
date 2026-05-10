/**
 * offlineQueue.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * File d'attente persistante pour les résultats de parties joués hors ligne.
 *
 * Stratégie d'idempotence :
 *   L'RPC Supabase `sync_offline_result` utilise INSERT … ON CONFLICT DO NOTHING
 *   sur game_history, et ne met à jour le profil QUE si la ligne est nouvelle.
 *   → Pas de double-comptage même si le réseau revient entre deux appels.
 */

import { loadJSON, saveJSON } from '../utils/storage';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingGameResult {
  type:     'game_result';
  date:     string;   // YYYY-MM-DD
  won:      boolean;
  attempts: number;
  score:    number;
  coins:    number;
  newSerie: number;
  queuedAt: number;  // timestamp ms
}

type QueueItem = PendingGameResult;

const QUEUE_KEY = 'pn_offline_queue_v1';

// ─── Helpers internes ─────────────────────────────────────────────────────────

async function readQueue(): Promise<QueueItem[]> {
  return (await loadJSON<QueueItem[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(q: QueueItem[]): Promise<void> {
  await saveJSON(QUEUE_KEY, q);
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Ajoute un résultat de partie en attente de synchronisation.
 * Idempotente : ne duplique pas si la même date est déjà dans la file.
 */
export async function enqueueGameResult(params: {
  won:      boolean;
  attempts: number;
  score:    number;
  coins:    number;
  newSerie: number;
}): Promise<void> {
  const queue   = await readQueue();
  const dateStr = new Date().toISOString().split('T')[0];

  // Un seul résultat par jour dans la file
  if (queue.some((i) => i.type === 'game_result' && i.date === dateStr)) return;

  queue.push({ type: 'game_result', date: dateStr, ...params, queuedAt: Date.now() });
  await writeQueue(queue);
}

/** Nombre d'opérations en attente. */
export async function getOfflineQueueSize(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Traite toutes les opérations en attente via l'RPC `sync_offline_result`.
 * Retourne le nombre de parties effectivement synchronisées avec succès.
 */
export async function processOfflineQueue(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueueItem[] = [];
  let processed = 0;

  for (const item of queue) {
    if (item.type !== 'game_result') {
      remaining.push(item);
      continue;
    }

    try {
      const { error } = await supabase.rpc('sync_offline_result', {
        p_date:      item.date,
        p_won:       item.won,
        p_attempts:  item.attempts,
        p_score:     item.score,
        p_coins:     item.coins,
        p_new_serie: item.newSerie,
      });

      if (error) {
        remaining.push(item); // réessai à la prochaine connexion
      } else {
        processed++;
      }
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return processed;
}

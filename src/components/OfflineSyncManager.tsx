/**
 * OfflineSyncManager.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composant invisible. Surveille la connexion réseau via NetInfo et,
 * dès le retour en ligne, synchronise la file d'attente hors ligne.
 *
 * Doit être monté à l'intérieur de <AuthProvider> pour avoir accès
 * à la session et à refreshProfile().
 */

import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuthContext } from '../context/AuthContext';
import { processOfflineQueue, getOfflineQueueSize } from '../lib/offlineQueue';

export function OfflineSyncManager() {
  const { session, refreshProfile } = useAuthContext();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!session) return;

    const unsub = NetInfo.addEventListener(async (state) => {
      const online = state.isConnected !== false;

      if (!online) {
        wasOffline.current = true;
        return;
      }

      // Reconnexion détectée après une période hors ligne
      if (wasOffline.current) {
        wasOffline.current = false;

        const pending = await getOfflineQueueSize().catch(() => 0);
        if (pending === 0) return;

        const synced = await processOfflineQueue().catch(() => 0);
        if (synced > 0) {
          // Rafraîchit le profil pour refléter les parties synchronisées
          // (score, coins, serie mis à jour côté Supabase)
          refreshProfile().catch(() => {});
        }
      }
    });

    return unsub;
  }, [session, refreshProfile]);

  // Composant purement logique — aucun rendu visuel
  return null;
}

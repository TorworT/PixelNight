/**
 * useNetworkStatus.ts
 * Retourne true quand l'appareil a accès à internet, false sinon.
 *
 * Utilise @react-native-community/netinfo pour des notifications push
 * instantanées — aucun polling, pas d'intervalle.
 */

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Lecture initiale de l'état réseau
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected !== false));

    // Abonnement temps réel — NetInfo.addEventListener retourne la fonction
    // de désabonnement directement (compatible avec useEffect cleanup)
    return NetInfo.addEventListener((s) => setIsConnected(s.isConnected !== false));
  }, []);

  return isConnected;
}

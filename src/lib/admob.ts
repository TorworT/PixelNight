/**
 * admob.ts — Wrapper autour de react-native-google-mobile-ads.
 *
 * En Expo Go (store client) le SDK natif n'est pas disponible :
 * IS_EXPO_GO vaut true → les appelants tombent en mode simulé (AdModal).
 * En build EAS (standalone/bare), les vraies pubs AdMob sont utilisées.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';

// ─── Environnement ─────────────────────────────────────────────────────────────

/** true quand l'app tourne dans Expo Go (pas de modules natifs tiers). */
export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── IDs publicitaires ─────────────────────────────────────────────────────────

/**
 * En mode développement (__DEV__) on utilise l'ID de test Google pour ne pas
 * invalider le compte AdMob avec des clics de test.
 * En production chaque placement a son propre Ad Unit ID.
 */
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'; // Google test rewarded

const AD_UNIT = {
  /** Pub boutique : récompense +25 pièces. */
  coins: __DEV__ ? TEST_REWARDED_ID : 'ca-app-pub-5431544837646381/7251937110',
  /** Pub indice   : récompense 1 hint révélé. */
  hint:  __DEV__ ? TEST_REWARDED_ID : 'ca-app-pub-5431544837646381/5496002319',
} as const;

// ─── Fonction interne partagée ────────────────────────────────────────────────

/**
 * Charge et affiche une pub récompensée pour l'Ad Unit ID donné.
 *
 * @returns
 *   - `true`  → EARNED_REWARD reçu (pub vue jusqu'à la fin)
 *   - `false` → pub fermée trop tôt, erreur de chargement ou module absent
 *
 * En Expo Go renvoie toujours `false` ; l'appelant affiche AdModal.
 */
async function _showRewarded(adUnitId: string): Promise<boolean> {
  if (IS_EXPO_GO) return false;

  try {
    // Require dynamique : évite un crash à l'import si le natif est absent.
    const {
      RewardedAd,
      RewardedAdEventType,
      AdEventType,
    } = require('react-native-google-mobile-ads');

    const ad = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return new Promise<boolean>((resolve) => {
      let earned = false;

      // Pub chargée → affichage immédiat.
      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => { cleanup(); resolve(false); });
      });

      // L'utilisateur a regardé jusqu'à la fin.
      const unsubEarned = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => { earned = true; },
      );

      // Pub fermée (qu'elle ait été regardée ou non).
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup();
        resolve(earned);
      });

      // Erreur réseau ou de chargement.
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (err: Error) => {
        console.warn(`[AdMob] Erreur (${adUnitId}) :`, err?.message ?? err);
        cleanup();
        resolve(false);
      });

      function cleanup() {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
      }

      ad.load();
    });
  } catch (e) {
    console.warn('[AdMob] Module non disponible :', e);
    return false;
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Affiche la pub récompensée du placement **Boutique** (+25 pièces).
 * Ad Unit : ca-app-pub-5431544837646381/7251937110
 *
 * @returns `true` si la récompense a été gagnée, `false` sinon.
 */
export function showRewardedAdCoins(): Promise<boolean> {
  return _showRewarded(AD_UNIT.coins);
}

/**
 * Affiche la pub récompensée du placement **Indice** (hint révélé).
 * Ad Unit : ca-app-pub-5431544837646381/5496002319
 *
 * @returns `true` si la récompense a été gagnée, `false` sinon.
 */
export function showRewardedAdHint(): Promise<boolean> {
  return _showRewarded(AD_UNIT.hint);
}

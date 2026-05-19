import { useState, useEffect, useCallback, useRef } from 'react';
import Purchases, {
  type PurchasesOfferings,
  type CustomerInfo,
} from 'react-native-purchases';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  getSubscriptionTier,
  purchaseSubscription,
  purchaseCoinPack,
  restorePurchases,
  type SubscriptionTier,
} from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';

// ─── Helper local ─────────────────────────────────────────────────────────────

/**
 * Dérive le tier depuis un objet CustomerInfo déjà en mémoire,
 * sans déclencher d'appel réseau supplémentaire.
 * Les identifiants d'entitlements ('basic', 'pro', 'legend') doivent
 * correspondre exactement à ceux configurés dans le dashboard RevenueCat.
 */
function tierFromInfo(info: CustomerInfo): SubscriptionTier {
  const active = info.entitlements.active;
  if (active['legend']) return 'legend';
  if (active['pro'])    return 'pro';
  if (active['basic'])  return 'basic';
  return 'free';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsePurchasesResult {
  /** Offres RevenueCat disponibles (null pendant le chargement). */
  offerings:        PurchasesOfferings | null;
  /** Tier d'abonnement actif, synchronisé en temps réel. */
  subscriptionTier: SubscriptionTier;
  /** true pendant le chargement initial ou un rafraîchissement. */
  loading:          boolean;
  /** Message d'erreur de chargement, null si ok. */
  error:            string | null;
  /**
   * Lance l'achat d'un abonnement et rafraîchit le tier immédiatement.
   * @returns true si confirmé, false si annulé par l'utilisateur.
   */
  purchaseSub:  (tier: Exclude<SubscriptionTier, 'free'>) => Promise<boolean>;
  /**
   * Lance l'achat d'un pack de pièces + crédite Supabase automatiquement.
   * @returns true si confirmé, false si annulé par l'utilisateur.
   */
  purchasePack: (packId: string, coins: number) => Promise<boolean>;
  /**
   * Restaure les achats passés (après réinstallation / changement d'appareil).
   * @returns le tier restauré, 'free' si aucun abonnement actif.
   */
  restore:  () => Promise<SubscriptionTier>;
  /** Recharge les offres RevenueCat et le tier actif. */
  refresh:  () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePurchases(): UsePurchasesResult {
  const [offerings,        setOfferings]        = useState<PurchasesOfferings | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);

  // refreshProfile met à jour le profile dans AuthContext (subscription_tier inclus)
  const { refreshProfile, session } = useAuthContext();

  // Évite les setState après unmount (ex. : navigation rapide)
  const isMounted = useRef(true);

  // ── Chargement offres + tier ──────────────────────────────────────────────

  const load = useCallback(async () => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [off, tier] = await Promise.all([
        Purchases.getOfferings(),
        getSubscriptionTier(), // appelle getCustomerInfo() + sync Supabase
      ]);
      if (!isMounted.current) return;
      setOfferings(off);
      setSubscriptionTier(tier);
    } catch (err: any) {
      if (__DEV__) console.warn('[usePurchases] load error:', err);
      if (!isMounted.current) return;
      setError(err?.message ?? 'Erreur de chargement RevenueCat');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  // ── Listeners (montage uniquement) ────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;

    // Chargement initial
    load();

    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      return () => { isMounted.current = false; };
    }

    // 1. Écoute les changements CustomerInfo en temps réel via RevenueCat SDK.
    //    Déclenché après chaque achat, restauration, expiration ou webhook RC.
    //    API v10 : addCustomerInfoUpdateListener() retourne void — conserver la
    //    référence de la fonction pour pouvoir la passer à removeCustomerInfoUpdateListener().
    const onCustomerInfoUpdate = (info: CustomerInfo) => {
      if (!isMounted.current) return;
      const tier = tierFromInfo(info);
      const activeKeys = Object.keys(info?.entitlements?.active ?? {});
      if (__DEV__) {
        console.log('[usePurchases] customerInfoUpdate → tier:', tier,
          '| entitlements actifs:', activeKeys);
      }
      setSubscriptionTier(tier);
      // Sync vers Supabase puis rafraîchit le profil dans AuthContext
      // pour que l'UI (InfiniteScreen, badges…) reflète immédiatement le nouveau tier.
      const userId = session?.user?.id;
      if (userId) {
        supabase.rpc('sync_subscription_tier', { p_user_id: userId, p_tier: tier })
          .then(() => refreshProfile())
          .catch(() => {});
      }
    };

    // addCustomerInfoUpdateListener retourne void en v10 — NE PAS appeler .remove() sur le résultat
    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);

    // 2. Rafraîchit le tier quand l'app revient au premier plan.
    //    Couvre le retour depuis le Play Store, une résiliation externe, etc.
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active' || !isMounted.current) return;
      if (__DEV__) console.log('[usePurchases] AppState → active : refresh customerInfo');
      Purchases.getCustomerInfo()
        .then((info) => {
          if (!isMounted.current) return;
          const tier = tierFromInfo(info);
          setSubscriptionTier(tier);
          const userId = session?.user?.id;
          if (userId) {
            supabase.rpc('sync_subscription_tier', { p_user_id: userId, p_tier: tier })
              .then(() => refreshProfile())
              .catch(() => {});
          }
        })
        .catch(() => {});
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      isMounted.current = false;
      // v10 : cleanup via removeCustomerInfoUpdateListener(callback) — pas de .remove()
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
      appStateSub.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Achat abonnement ──────────────────────────────────────────────────────

  const purchaseSub = useCallback(
    async (tier: Exclude<SubscriptionTier, 'free'>): Promise<boolean> => {
      const ok = await purchaseSubscription(tier);
      if (ok) {
        // Lit le CustomerInfo directement depuis le SDK RevenueCat (données fraîches,
        // pas de cache expiré) pour mettre à jour le tier immédiatement après l'achat.
        try {
          const info = await Purchases.getCustomerInfo();
          if (isMounted.current) {
            const newTier = tierFromInfo(info);
            setSubscriptionTier(newTier);
            // Sync Supabase puis rafraîchit AuthContext → débloque l'UI immédiatement
            const userId = session?.user?.id;
            if (userId) {
              supabase.rpc('sync_subscription_tier', { p_user_id: userId, p_tier: newTier })
                .then(() => refreshProfile())
                .catch(() => {});
            }
          }
        } catch {
          // Fallback : getSubscriptionTier() (fait la sync Supabase en interne)
          const newTier = await getSubscriptionTier();
          if (isMounted.current) {
            setSubscriptionTier(newTier);
            refreshProfile().catch(() => {});
          }
        }
      }
      return ok;
    },
    [],
  );

  // ── Achat pack de pièces ──────────────────────────────────────────────────

  const purchasePack = useCallback(
    (packId: string, coins: number): Promise<boolean> =>
      purchaseCoinPack(packId, coins),
    [],
  );

  // ── Restauration ──────────────────────────────────────────────────────────

  const restore = useCallback(async (): Promise<SubscriptionTier> => {
    const tier = await restorePurchases();
    if (isMounted.current) setSubscriptionTier(tier);
    return tier;
  }, []);

  // ── Résultat ──────────────────────────────────────────────────────────────

  return {
    offerings,
    subscriptionTier,
    loading,
    error,
    purchaseSub,
    purchasePack,
    restore,
    refresh: load,
  };
}

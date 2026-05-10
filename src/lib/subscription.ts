import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getDateString } from '../utils/dateUtils';

// ─── Config ───────────────────────────────────────────────────────────────────

const REVENUECAT_GOOGLE_KEY = 'goog_qbMrGYPrFGoQqFlpxzqtyjXMMpy';

/** Identifiants produits tels que configurés dans le Google Play Console. */
const PRODUCT_IDS = {
  basic:  'pixelnight_basic',
  pro:    'pixelnight_pro',
  legend: 'pixelnight_legend',
} as const;

/** Identifiants d'entitlements tels que configurés dans le dashboard RevenueCat. */
const ENTITLEMENTS = {
  basic:  'basic',
  pro:    'pro',
  legend: 'legend',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'legend';

// ─── Helpers internes ────────────────────────────────────────────────────────

/** Lit le tier actif depuis un objet CustomerInfo. */
function tierFromCustomerInfo(info: CustomerInfo): SubscriptionTier {
  const active = info.entitlements.active;
  if (active[ENTITLEMENTS.legend]) return 'legend';
  if (active[ENTITLEMENTS.pro])    return 'pro';
  if (active[ENTITLEMENTS.basic])  return 'basic';
  return 'free';
}

/** Retourne true si l'erreur correspond à une annulation volontaire. */
function isUserCancellation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  return (
    e['code'] === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    e['userCancelled'] === true
  );
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Initialise le SDK RevenueCat.
 * À appeler une seule fois au démarrage de l'app (avant tout autre appel).
 * Ne fait rien sur les plateformes non supportées (web).
 */
export async function initRevenueCat(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  await Purchases.setLogLevel(LOG_LEVEL.ERROR);

  Purchases.configure({
    apiKey: REVENUECAT_GOOGLE_KEY,
  });
}

/**
 * Retourne le tier d'abonnement actif de l'utilisateur.
 * Priorité : legend > pro > basic > free.
 * Retourne 'free' en cas d'erreur ou d'absence d'abonnement.
 *
 * Synchronise silencieusement profiles.subscription_tier côté Supabase afin
 * que le badge apparaisse dans le classement pour tous les joueurs.
 */
export async function getSubscriptionTier(): Promise<SubscriptionTier> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'free';
  try {
    const info = await Purchases.getCustomerInfo();
    const tier = tierFromCustomerInfo(info);
    // Sync non-bloquante — échoue silencieusement si hors ligne ou non authentifié
    supabase.rpc('sync_subscription_tier', { p_tier: tier }).catch(() => {});
    return tier;
  } catch {
    return 'free';
  }
}

/**
 * Lance l'achat d'un abonnement.
 * Cherche le package correspondant au tier dans l'offre courante RevenueCat.
 *
 * @returns true si l'achat est confirmé, false si annulé par l'utilisateur.
 * @throws en cas d'erreur non liée à une annulation.
 */
export async function purchaseSubscription(
  tier: Exclude<SubscriptionTier, 'free'>,
): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;

  const offerings = await Purchases.getOfferings();
  if (!offerings.current) {
    throw new Error('Aucune offre disponible dans RevenueCat.');
  }

  const pkg: PurchasesPackage | undefined =
    offerings.current.availablePackages.find(
      (p) => p.product.identifier === PRODUCT_IDS[tier],
    );

  if (!pkg) {
    throw new Error(`Package introuvable pour le tier "${tier}" (id: ${PRODUCT_IDS[tier]}).`);
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[ENTITLEMENTS[tier]];
  } catch (err) {
    if (isUserCancellation(err)) return false;
    throw err;
  }
}

/**
 * Restaure les achats passés (utile après réinstallation ou changement d'appareil).
 * @returns le tier restauré, 'free' si aucun abonnement actif trouvé.
 */
export async function restorePurchases(): Promise<SubscriptionTier> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'free';
  try {
    const info = await Purchases.restorePurchases();
    return tierFromCustomerInfo(info);
  } catch {
    return 'free';
  }
}

/**
 * Retourne true si l'utilisateur possède au moins un abonnement actif (basic, pro ou legend).
 */
export async function isSubscribed(): Promise<boolean> {
  const tier = await getSubscriptionTier();
  return tier !== 'free';
}

// ─── Pièces quotidiennes ──────────────────────────────────────────────────────

/** Pièces créditées chaque jour selon le tier d'abonnement. */
const DAILY_COINS: Record<SubscriptionTier, number> = {
  free:   0,
  basic:  0,
  pro:    20,
  legend: 50,
} as const;

export interface ClaimDailyCoinsResult {
  /** Pièces créditées ce lancement (0 si déjà réclamé aujourd'hui ou tier free/basic). */
  coinsAwarded:   number;
  /** true si le claim avait déjà été effectué pour ce jour de jeu. */
  alreadyClaimed: boolean;
  /** Tier détecté au moment de l'appel. */
  tier:           SubscriptionTier;
}

/**
 * Réclame les pièces quotidiennes selon le tier d'abonnement.
 *
 * | Tier   | Pièces/jour |
 * |--------|-------------|
 * | free   | 0           |
 * | basic  | 0           |
 * | pro    | 20          |
 * | legend | 50          |
 *
 * La vérification et le crédit sont **atomiques** côté serveur via la RPC
 * `claim_daily_coins` (voir supabase/daily_coins_migration.sql).
 * La date de référence est celle de l'app (pivot 7h) pour rester cohérent
 * avec le reset du jeu du jour.
 *
 * Ne lève jamais d'erreur — retourne `coinsAwarded: 0` silencieusement.
 */
export async function claimDailyCoins(): Promise<ClaimDailyCoinsResult> {
  // Plateformes non supportées (web / simulateur web)
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { coinsAwarded: 0, alreadyClaimed: false, tier: 'free' };
  }

  // 1. Vérifier le tier
  const tier = await getSubscriptionTier();
  const amount = DAILY_COINS[tier];

  if (amount === 0) {
    return { coinsAwarded: 0, alreadyClaimed: false, tier };
  }

  // 2. Appel RPC atomique — vérifie + crédite + horodate en une seule transaction
  try {
    const { data, error } = await supabase.rpc('claim_daily_coins', {
      p_amount:    amount,
      p_game_date: getDateString(), // 'YYYY-MM-DD' avec pivot 7h local
    });

    if (error) {
      if (__DEV__) console.warn('[subscription] claimDailyCoins RPC error:', error.message);
      return { coinsAwarded: 0, alreadyClaimed: false, tier };
    }

    const result = data as { coins_awarded: number; already_claimed: boolean } | null;
    return {
      coinsAwarded:   result?.coins_awarded   ?? 0,
      alreadyClaimed: result?.already_claimed ?? false,
      tier,
    };
  } catch (err) {
    if (__DEV__) console.warn('[subscription] claimDailyCoins threw:', err);
    return { coinsAwarded: 0, alreadyClaimed: false, tier };
  }
}

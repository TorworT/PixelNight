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

/**
 * Identifiants des PACKAGES RevenueCat (pas les product IDs Google Play).
 * À retrouver dans : Dashboard RevenueCat → Offerings → default → packages.
 *   basic  → package "$rc_monthly"  (package mensuel standard RC)
 *   pro    → package "pro_monthly"
 *   legend → package "legend_monthly"
 */
const PACKAGE_IDS = {
  basic:  '$rc_monthly',
  pro:    'pro_monthly',
  legend: 'legend_monthly',
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
 * À appeler UNE SEULE FOIS, au démarrage, AVANT tout autre appel RC.
 * Ne fait rien sur les plateformes non supportées (web).
 *
 * Notes v10 :
 * - Toutes les méthodes sont STATIQUES sur `Purchases` — pas de getSharedInstance().
 * - configure() doit être appelé EN PREMIER (avant setLogLevel et toute autre méthode).
 * - configure() est synchrone, setLogLevel() est async (Promise<void>).
 */
export async function initRevenueCat(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  // 1. configure() en PREMIER — initialise le SDK natif (synchrone)
  Purchases.configure({
    apiKey: REVENUECAT_GOOGLE_KEY,
  });

  // 2. setLogLevel() APRÈS configure() — async, retourne Promise<void>
  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);

  if (__DEV__) {
    const configured = await Purchases.isConfigured();
    console.log('[subscription] initRevenueCat → isConfigured:', configured);
  }

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      if (userId) {
        supabase.rpc('sync_subscription_tier', { p_user_id: userId, p_tier: tier }).catch(() => {});
      }
    }).catch(() => {});
    return tier;
  } catch {
    return 'free';
  }
}

/**
 * Lance l'achat d'un abonnement.
 * Utilise l'offering "default" (offerings.current) et recherche le package
 * par son identifiant RevenueCat (pkg.identifier), pas par le product ID.
 *
 * @returns true si l'achat est confirmé, false si annulé par l'utilisateur.
 * @throws en cas d'erreur non liée à une annulation.
 */
export async function purchaseSubscription(
  tier: Exclude<SubscriptionTier, 'free'>,
): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;

  // offerings.current === offering "default" dans le dashboard RevenueCat
  const offerings = await Purchases.getOfferings();

  if (__DEV__) {
    console.log('[subscription] offerings.current:', offerings.current?.identifier ?? 'null');
    console.log('[subscription] availablePackages:', offerings.current?.availablePackages.map((p) => ({
      id: p.identifier, productId: p.product.identifier,
    })) ?? []);
  }

  if (!offerings.current) {
    throw new Error('Aucune offre disponible dans RevenueCat (offering "default" manquante).');
  }

  // Recherche par l'identifiant du PACKAGE RC (pkg.identifier),
  // et non par l'identifiant du produit Google Play (pkg.product.identifier).
  const packageId = PACKAGE_IDS[tier];
  const pkg: PurchasesPackage | undefined =
    offerings.current.availablePackages.find((p) => p.identifier === packageId);

  if (__DEV__) {
    console.log(`[subscription] package "${packageId}" →`, pkg ? `trouvé (${pkg.product.identifier})` : 'INTROUVABLE');
  }

  if (!pkg) {
    throw new Error(
      `Package RC introuvable pour le tier "${tier}" (package id: "${packageId}"). ` +
      `Packages disponibles : ${offerings.current.availablePackages.map((p) => p.identifier).join(', ')}`,
    );
  }

  // Vérifie que le SDK est configuré avant d'acheter
  const configured = await Purchases.isConfigured();
  if (!configured) {
    throw new Error(
      '[RevenueCat] SDK non initialisé — configure() n\'a pas été appelé ou a échoué. ' +
      'Vérifier que initRevenueCat() est appelé au démarrage de l\'app.',
    );
  }

  if (__DEV__) {
    console.log(`[subscription] purchasePackage() → tier="${tier}", pkg="${pkg.identifier}", ` +
      `product="${pkg.product.identifier}", presentedOfferingContext:`, pkg.presentedOfferingContext);
  }

  try {
    // API v10 — méthode STATIQUE sur Purchases (pas de getSharedInstance()).
    // Syntaxe standard avec destructuration — évite tout accès à des propriétés undefined.
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    const isBasic  = customerInfo.entitlements.active['basic']  !== undefined;
    const isPro    = customerInfo.entitlements.active['pro']    !== undefined;
    const isLegend = customerInfo.entitlements.active['legend'] !== undefined;

    if (__DEV__) {
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      console.log('[subscription] purchasePackage résultat:', {
        activeEntitlements,
        entitlementCible: ENTITLEMENTS[tier],
        isBasic, isPro, isLegend,
      });
    }

    // Sync bloquante vers Supabase immédiatement après l'achat.
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id;
    const { error: syncError } = userId
      ? await supabase.rpc('sync_subscription_tier', { p_user_id: userId, p_tier: tier })
      : { error: new Error('sync_subscription_tier — utilisateur non authentifié') };
    if (syncError) {
      if (__DEV__) console.warn('[subscription] purchaseSubscription — sync_subscription_tier error:', syncError.message);
    } else {
      if (__DEV__) console.log('[subscription] purchaseSubscription — sync_subscription_tier OK, tier:', tier);
    }

    // Retourne true dès que Google Play a confirmé — refreshProfile() est appelé
    // par le caller (usePurchases / SubscriptionScreen) pour mettre à jour l'UI.
    return true;

  } catch (err: any) {
    if (__DEV__) {
      console.warn('[subscription] purchasePackage erreur:', {
        code:                   err?.code,
        message:                err?.message,
        userInfo:               err?.userInfo,
        underlyingErrorMessage: err?.underlyingErrorMessage,
        userCancelled:          err?.userCancelled,
      });
    }
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

// ─── Packs de pièces ─────────────────────────────────────────────────────────

/** Identifiants des packs de pièces configurés dans Google Play Console / RevenueCat. */
export const COIN_PACK_IDS = {
  coins_500:  'coins_500',
  coins_1200: 'coins_1200',
  coins_3000: 'coins_3000',
} as const;

export type CoinPackId = keyof typeof COIN_PACK_IDS;

/**
 * Lance l'achat d'un pack de pièces via RevenueCat,
 * puis crédite automatiquement les pièces dans Supabase si l'achat est confirmé.
 *
 * @param packId      - identifiant produit Google Play / App Store
 * @param coinsAmount - nombre de pièces à créditer après achat confirmé
 * @returns true si l'achat est confirmé, false si annulé par l'utilisateur.
 * @throws en cas d'erreur non liée à une annulation.
 */
export async function purchaseCoinPack(
  packId:      string,
  coinsAmount: number,
): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;

  try {
    // Cherche le package dans TOUTES les offerings disponibles (pas seulement current).
    // Les consommables (coins_500, coins_1200, coins_3000) peuvent être dans une
    // offering dédiée ou dans l'offering "default" — on parcourt offerings.all.
    const offerings = await Purchases.getOfferings();

    if (__DEV__) {
      console.log('[subscription] purchaseCoinPack — offerings disponibles:',
        Object.keys(offerings.all));
      const allPkgs = Object.values(offerings.all).flatMap((o) => o.availablePackages);
      console.log('[subscription] purchaseCoinPack — tous les packages:',
        allPkgs.map((p) => ({ pkg: p.identifier, product: p.product.identifier })));
    }

    const allPackages = Object.values(offerings.all)
      .flatMap((o) => o.availablePackages);

    // Recherche par product.identifier (Google Play product ID) car les consommables
    // n'ont pas forcément un package identifier normalisé comme les abonnements.
    const pkg = allPackages.find((p) => p.product.identifier === packId);

    if (__DEV__) {
      console.log(`[subscription] purchaseCoinPack — package "${packId}" →`,
        pkg ? `trouvé (pkg: ${pkg.identifier})` : 'INTROUVABLE');
    }

    if (!pkg) {
      throw new Error(
        `Package introuvable pour "${packId}". ` +
        `Produits disponibles : ${allPackages.map((p) => p.product.identifier).join(', ')}`,
      );
    }

    await Purchases.purchasePackage(pkg);

    // Crédite les pièces côté Supabase de manière atomique via RPC
    const { error } = await supabase.rpc('add_coins', { p_amount: coinsAmount });
    if (error && __DEV__) {
      console.warn('[subscription] purchaseCoinPack — add_coins error:', error.message);
    }

    return true;
  } catch (err) {
    if (isUserCancellation(err)) return false;
    throw err;
  }
}

// ─── Pièces quotidiennes ──────────────────────────────────────────────────────

/** Pièces créditées chaque jour selon le tier d'abonnement. */
const DAILY_COINS: Record<SubscriptionTier, number> = {
  free:   0,
  basic:  0,
  pro:    20,
  legend: 100,
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

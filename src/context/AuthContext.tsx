import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { Session } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { Profile, getProfile } from '../lib/profiles';
import { loadJSON, saveJSON, removeJSON } from '../utils/storage';
import { initNotifications, ensureDailyScheduled } from '../lib/notifications';
import { prefetchUpcomingGames } from '../lib/dailyGame';
import {
  GuestProfile,
  getGuestProfile,
  clearGuestProfile,
  isGuestModeActive,
  setGuestModeActive,
} from '../lib/guestProfile';
import { getSubscriptionTier } from '../lib/subscription';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Timeout global du démarrage. Au-delà, l'app affiche toujours quelque chose. */
const STARTUP_TIMEOUT_MS = 5000;


const profileCacheKey = (userId: string) => `pn_profile_cache_${userId}`;

// ─── Shape ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session:             Session | null;
  profile:             Profile | null;
  authLoading:         boolean;
  refreshProfile:      () => Promise<void>;
  // Mode invité
  isGuest:             boolean;
  guestProfile:        GuestProfile | null;
  continueAsGuest:     () => Promise<void>;
  exitGuest:           () => Promise<void>;
  refreshGuestProfile: () => Promise<void>;
  // Déconnexion unifiée (compte + invité)
  signOut:             () => Promise<void>;
  // Démarrage hors ligne
  offlineStart:   boolean;
  retryStartup:   () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  session:             null,
  profile:             null,
  authLoading:         true,
  refreshProfile:      async () => {},
  isGuest:             false,
  guestProfile:        null,
  continueAsGuest:     async () => {},
  exitGuest:           async () => {},
  refreshGuestProfile: async () => {},
  signOut:             async () => {},
  offlineStart:        false,
  retryStartup:        async () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Charge le profil depuis AsyncStorage (aucune requête réseau). */
async function loadCachedProfile(userId: string): Promise<Profile | null> {
  return loadJSON<Profile>(profileCacheKey(userId));
}

/** Persiste le profil localement pour le prochain démarrage hors ligne. */
async function cacheProfile(profile: Profile): Promise<void> {
  await saveJSON(profileCacheKey(profile.id), profile);
}

/**
 * Efface toutes les données de session locales liées à un utilisateur.
 * Appelé quand une corruption ou une session invalide est détectée,
 * avant de forcer une déconnexion propre.
 */
async function clearAllSessionData(userId: string): Promise<void> {
  await removeJSON(profileCacheKey(userId));
  await setGuestModeActive(false);
}

/**
 * Détecte un profil corrompu ou incomplet venant du cache AsyncStorage.
 * Un cache corrompu peut survenir après une migration de schéma, un crash
 * en cours d'écriture ou une désynchronisation Supabase ↔ cache local.
 *
 * Critères :
 *   - pas d'id ou de pseudo → objet incomplet
 *   - subscription_tier null/undefined → colonne ajoutée après mise en cache
 *   - coins null/undefined → idem
 */
function isProfileCorrupted(p: unknown): boolean {
  if (!p || typeof p !== 'object') return true;
  const profile = p as Partial<Profile>;
  // Seuls id et pseudo manquants indiquent une vraie corruption.
  // subscription_tier peut valoir 'free' et coins peut valoir 0 — ce sont
  // des valeurs légitimes, pas des signes de cache incompatible.
  if (!profile.id || typeof profile.id !== 'string') return true;
  if (!profile.pseudo || typeof profile.pseudo !== 'string') return true;
  return false;
}

/**
 * Retourne true si l'erreur Supabase indique une session expirée ou invalide.
 * Déclenche une déconnexion propre plutôt que de laisser un état vide.
 */
function isAuthError(err: unknown): boolean {
  const msg = ((err as any)?.message ?? '').toLowerCase();
  const code = (err as any)?.code ?? '';
  return (
    msg.includes('jwt expired') ||
    msg.includes('invalid_token') ||
    msg.includes('not authenticated') ||
    msg.includes('refresh_token_not_found') ||
    code === 'PGRST301' || // JWT expired côté PostgREST
    code === '401'
  );
}

/**
 * Si un profil invité local existe, transfère ses données vers le compte
 * Supabase connecté, puis efface le profil local.
 * Ne tente rien si l'appareil est hors ligne.
 */
async function maybeTransferGuestData(userId: string): Promise<void> {
  const gp = await getGuestProfile();
  if (gp.parties_jouees === 0 && gp.coins === 0) return;

  const net = await NetInfo.fetch();
  if (net.isConnected === false) return; // reporter au prochain lancement

  const current = await getProfile(userId);
  if (!current) return;

  const { error } = await supabase
    .from('profiles')
    .update({
      coins:           current.coins + gp.coins,
      score_total:     current.score_total + gp.score_total,
      parties_jouees:  current.parties_jouees + gp.parties_jouees,
      parties_gagnees: current.parties_gagnees + gp.parties_gagnees,
      serie_actuelle:  Math.max(current.serie_actuelle, gp.serie_actuelle),
      meilleure_serie: Math.max(current.meilleure_serie, gp.meilleure_serie),
      updated_at:      new Date().toISOString(),
    })
    .eq('id', userId);

  if (!error) await clearGuestProfile();
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session,      setSession]      = useState<Session | null>(null);
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [isGuest,      setIsGuest]      = useState(false);
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [offlineStart, setOfflineStart] = useState(false);

  // Évite les setState après démontage
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  /**
   * Passe à true dès que runStartup() se termine (succès, erreur ou timeout).
   * Permet à onAuthStateChange d'ignorer les événements qui arrivent pendant
   * le démarrage et évite la double exécution de fetchProfile().
   */
  const startupDoneRef = useRef(false);

  // ── fetchProfile avec mise en cache ─────────────────────────────────────────
  /**
   * Charge le profil depuis Supabase + RC, met en cache, et met à jour le state.
   * Retourne le profil chargé ou null en cas d'échec total.
   *
   * Stratégie de robustesse :
   *   1. Si Supabase répond → merge avec le tier RC → setProfile → mise en cache → retourne profil.
   *   2. Si Supabase retourne null (PGRST116) → fallback cache.
   *   3. Si le cache est corrompu → on l'efface + on retente (1 fois) via Supabase.
   *   4. Si l'erreur indique une session expirée/invalide → signOut propre → retourne null.
   *   5. Si toute tentative échoue → retourne null (appelant décidera de l'action).
   */
  const fetchProfile = useCallback(async (userId: string, _retry = false): Promise<Profile | null> => {
    try {
      console.log('[fetchProfile] START userId:', userId);

      // Lecture Supabase + tier RevenueCat en parallèle.
      // RC est la source de vérité pour le tier : si RC retourne un tier actif,
      // il écrase la valeur Supabase (qui peut être en retard après un achat).
      const [p, rcTier] = await Promise.all([
        getProfile(userId),
        getSubscriptionTier(),
      ]);

      console.log('[fetchProfile] getProfile result:', p?.pseudo, 'coins:', p?.coins, 'tier:', p?.subscription_tier);
      console.log('[fetchProfile] rcTier:', rcTier);

      if (p && mountedRef.current) {
        // RC gagne si non-free ; sinon on garde la valeur Supabase
        const mergedTier = rcTier !== 'free' ? rcTier : p.subscription_tier;
        console.log('[fetchProfile] mergedTier:', mergedTier);
        const merged = { ...p, subscription_tier: mergedTier };
        console.log('[fetchProfile] setProfile appelé avec coins:', merged?.coins);
        setProfile(merged);
        await cacheProfile(merged).catch(() => {});
        return merged;
      } else if (!p && mountedRef.current) {
        // PGRST116 : profil pas encore créé — tentative depuis le cache
        const cached = await loadCachedProfile(userId);
        if (isProfileCorrupted(cached)) {
          // Cache corrompu sans profil distant → on efface et on attend la création
          await removeJSON(profileCacheKey(userId));
          console.warn('[AuthContext] fetchProfile — cache corrompu effacé (profil absent de Supabase)');
          return null;
        } else if (cached && mountedRef.current) {
          setProfile(cached);
          return cached;
        }
        return null;
      }
      return null;
    } catch (err) {
      // ── Session expirée / token invalide → déconnexion propre ────────────
      if (isAuthError(err)) {
        console.error('[AuthContext] fetchProfile — session invalide, déconnexion propre:', err);
        await clearAllSessionData(userId);
        await supabase.auth.signOut();
        if (mountedRef.current) { setSession(null); setProfile(null); }
        return null;
      }

      console.error('[AuthContext] fetchProfile threw:', err);

      if (!_retry) {
        // Première erreur : on efface le cache potentiellement corrompu et on retente
        console.warn('[AuthContext] fetchProfile — effacement cache + retry');
        await removeJSON(profileCacheKey(userId));
        return fetchProfile(userId, true);
      }

      // Deuxième échec : fallback cache (même potentiellement périmé vaut mieux que vide)
      const cached = await loadCachedProfile(userId);
      if (cached && !isProfileCorrupted(cached) && mountedRef.current) {
        console.log('[AuthContext] fetchProfile — fallback cache (retry échoué)');
        setProfile(cached);
        return cached;
      }
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const refreshGuestProfile = useCallback(async () => {
    const gp = await getGuestProfile();
    if (mountedRef.current) setGuestProfile(gp);
  }, []);

  const continueAsGuest = useCallback(async () => {
    await setGuestModeActive(true);
    const gp = await getGuestProfile();
    if (mountedRef.current) {
      setGuestProfile(gp);
      setIsGuest(true);
      setOfflineStart(false);
    }
  }, []);

  const exitGuest = useCallback(async () => {
    await setGuestModeActive(false);
    if (mountedRef.current) {
      setIsGuest(false);
      setGuestProfile(null);
    }
  }, []);

  /**
   * Déconnexion unifiée — fonctionne pour un compte Supabase ET pour le mode
   * invité. Remet à zéro toutes les données d'authentification locales.
   * `onAuthStateChange` s'occupera de passer `session` à null pour les comptes
   * Supabase ; on force également `isGuest` à false ici pour couvrir les deux cas.
   */
  const signOut = useCallback(async () => {
    // Toujours effacer le mode invité persisté
    await setGuestModeActive(false);
    // Déconnecter Supabase (no-op si pas de session active)
    await supabase.auth.signOut();
    // Réinitialiser l'état local immédiatement (sans attendre onAuthStateChange)
    if (mountedRef.current) {
      setSession(null);
      setProfile(null);
      setIsGuest(false);
      setGuestProfile(null);
    }
  }, []);

  // ── Logique de démarrage ────────────────────────────────────────────────────

  /**
   * Séquence de démarrage principale.
   * ⚠️ Toujours appelée via `Promise.race` avec STARTUP_TIMEOUT_MS pour
   *    garantir que setAuthLoading(false) est appelé dans tous les cas.
   */
  const runStartup = useCallback(async (): Promise<void> => {
    try {
      // getSession() lit AsyncStorage puis tente un refresh réseau si le token est expiré.
      const { data: { session: s }, error: sessionError } = await supabase.auth.getSession();

      // Session explicitement invalide (refresh token expiré, révoqué, etc.)
      if (sessionError) {
        console.error('[AuthContext] runStartup — getSession error:', sessionError.message);
        await supabase.auth.signOut();
        if (mountedRef.current) { setSession(null); setAuthLoading(false); }
        return;
      }

      if (!mountedRef.current) return;
      setSession(s);

      if (s?.user.id) {
        const net = await NetInfo.fetch();
        const online = net.isConnected !== false;

        if (online) {
          // getSession() gère déjà le refresh du token automatiquement quand
          // nécessaire — un appel supplémentaire à refreshSession() créait des
          // conflits et déconnectait les utilisateurs après chaque redémarrage.

          // En ligne : profil frais depuis Supabase (fetchProfile gère les erreurs et retries)
          await maybeTransferGuestData(s.user.id);
          const loadedProfile = await fetchProfile(s.user.id);

          // ── Déconnexion uniquement si fetchProfile ET getProfile échouent tous les deux ──
          // fetchProfile fait déjà 1 retry interne avant de retourner null.
          // On ne déconnecte que si le profil est vraiment introuvable (compte supprimé).
          if (!loadedProfile || isProfileCorrupted(loadedProfile)) {
            console.warn('[AuthContext] runStartup — profil null après fetch+retry, déconnexion');
            await clearAllSessionData(s.user.id);
            await supabase.auth.signOut();
            if (mountedRef.current) { setSession(null); setProfile(null); setAuthLoading(false); }
            return;
          }

          initNotifications().catch(() => {});
          prefetchUpcomingGames().catch(() => {});
        } else {
          // Hors ligne : profil depuis le cache local
          const cached = await loadCachedProfile(s.user.id);

          if (isProfileCorrupted(cached)) {
            // Cache corrompu et pas de réseau → on l'efface, l'utilisateur verra un état vide
            // mais au prochain lancement en ligne, fetchProfile repartira proprement.
            console.warn('[AuthContext] runStartup — cache corrompu hors ligne, effacement');
            await removeJSON(profileCacheKey(s.user.id));
          } else if (cached && mountedRef.current) {
            setProfile(cached);
          }
        }
      } else {
        // Pas de session — mode invité ou premier lancement
        const net = await NetInfo.fetch();
        const guestActive = await isGuestModeActive();

        if (guestActive) {
          const gp = await getGuestProfile();
          if (mountedRef.current) { setGuestProfile(gp); setIsGuest(true); }
        } else if (net.isConnected === false) {
          if (mountedRef.current) setOfflineStart(true);
        }
      }
    } finally {
      // Marque le startup comme terminé dans TOUS les cas (succès, erreur, return anticipé).
      // onAuthStateChange attend ce signal avant de traiter les événements suivants.
      startupDoneRef.current = true;
    }
  }, [fetchProfile]);

  // ── Retry (bouton "Réessayer" de NoConnectionScreen) ───────────────────────
  const retryStartup = useCallback(async (): Promise<void> => {
    if (mountedRef.current) {
      setAuthLoading(true);
      setOfflineStart(false);
    }

    await Promise.race([
      runStartup().catch(() => { if (mountedRef.current) setOfflineStart(true); }),
      new Promise<void>((resolve) => setTimeout(resolve, STARTUP_TIMEOUT_MS)),
    ]).finally(() => {
      if (mountedRef.current) setAuthLoading(false);
    });
  }, [runStartup]);

  // ── Démarrage initial ───────────────────────────────────────────────────────
  useEffect(() => {
    // Race : séquence de démarrage vs timeout de 5 s
    // Dans tous les cas, setAuthLoading(false) est appelé en ≤ 5 s.
    const startupPromise = runStartup()
      .catch(() => { if (mountedRef.current) setOfflineStart(true); });
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, STARTUP_TIMEOUT_MS),
    );
    Promise.race([startupPromise, timeoutPromise]).finally(() => {
      if (mountedRef.current) setAuthLoading(false);
    });

    // Réagit aux événements login / logout (après le démarrage)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        // INITIAL_SESSION est toujours géré par runStartup() — l'ignorer ici
        // évite le double fetchProfile() et le setAuthLoading(false) prématuré.
        if (_event === 'INITIAL_SESSION') return;

        // Pendant le démarrage, les événements concurrents (ex: TOKEN_REFRESHED)
        // sont ignorés — runStartup() est la source de vérité pour cette phase.
        if (!startupDoneRef.current) return;

        if (!mountedRef.current) return;
        setSession(s);
        if (s?.user.id) {
          await maybeTransferGuestData(s.user.id);
          await fetchProfile(s.user.id);
          if (mountedRef.current) {
            setIsGuest(false);
            setGuestProfile(null);
            setOfflineStart(false);
          }
          initNotifications().catch(() => {});
          prefetchUpcomingGames().catch(() => {});
        } else {
          if (mountedRef.current) setProfile(null);
        }
        if (mountedRef.current) setAuthLoading(false);
      },
    );

    // Vérifie la notification quotidienne à chaque retour en premier plan
    const AppState = require('react-native').AppState;
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') ensureDailyScheduled().catch(() => {});
    });

    return () => {
      subscription.unsubscribe();
      sub.remove();
    };
  }, [fetchProfile, runStartup]);

  return (
    <AuthContext.Provider value={{
      session, profile, authLoading, refreshProfile,
      isGuest, guestProfile, continueAsGuest, exitGuest, refreshGuestProfile, signOut,
      offlineStart, retryStartup,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext() {
  return useContext(AuthContext);
}

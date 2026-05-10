import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { Session } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { Profile, getProfile } from '../lib/profiles';
import { loadJSON, saveJSON } from '../utils/storage';
import { initNotifications, ensureDailyScheduled } from '../lib/notifications';
import { prefetchUpcomingGames } from '../lib/dailyGame';
import {
  GuestProfile,
  getGuestProfile,
  clearGuestProfile,
  isGuestModeActive,
  setGuestModeActive,
} from '../lib/guestProfile';

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

  // ── fetchProfile avec mise en cache ─────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const p = await getProfile(userId);
      if (p && mountedRef.current) {
        setProfile(p);
        cacheProfile(p).catch(() => {});
      } else if (!p && mountedRef.current) {
        // Profil null = PGRST116 (pas de ligne) — charger depuis le cache
        const cached = await loadCachedProfile(userId);
        if (cached && mountedRef.current) setProfile(cached);
      }
    } catch (err) {
      // Erreur Supabase (RLS, colonne manquante, réseau…) → fallback cache
      console.error('[AuthContext] fetchProfile threw:', err);
      const cached = await loadCachedProfile(userId);
      if (cached && mountedRef.current) {
        console.log('[AuthContext] fetchProfile using cached profile for', userId);
        setProfile(cached);
      }
      // Ne pas propager : l'app continue avec le cache ou sans profil
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
    // supabase.auth.getSession() lit d'abord depuis AsyncStorage et peut
    // faire une requête réseau pour rafraîchir un token expiré → peut bloquer.
    const { data: { session: s } } = await supabase.auth.getSession();

    if (!mountedRef.current) return;
    setSession(s);

    if (s?.user.id) {
      // Vérifier la connectivité AVANT tout appel Supabase
      const net = await NetInfo.fetch();
      const online = net.isConnected !== false;

      if (online) {
        // Transfert éventuel de données invité + chargement du profil frais
        await maybeTransferGuestData(s.user.id);
        await fetchProfile(s.user.id);
        initNotifications().catch(() => {});
        prefetchUpcomingGames().catch(() => {});
      } else {
        // Hors ligne : profil depuis le cache local (jamais de réseau)
        const cached = await loadCachedProfile(s.user.id);
        if (cached && mountedRef.current) setProfile(cached);
      }
    } else {
      // Pas de session — mode invité ou écran hors ligne
      const net = await NetInfo.fetch();
      const guestActive = await isGuestModeActive();

      if (guestActive) {
        const gp = await getGuestProfile();
        if (mountedRef.current) { setGuestProfile(gp); setIsGuest(true); }
      } else if (net.isConnected === false) {
        // Hors ligne sans compte ni mode invité → écran "pas de connexion"
        if (mountedRef.current) setOfflineStart(true);
      }
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
    Promise.race([
      runStartup().catch(() => { if (mountedRef.current) setOfflineStart(true); }),
      new Promise<void>((resolve) => setTimeout(resolve, STARTUP_TIMEOUT_MS)),
    ]).finally(() => {
      if (mountedRef.current) setAuthLoading(false);
    });

    // Réagit aux événements login / logout (après le démarrage)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
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

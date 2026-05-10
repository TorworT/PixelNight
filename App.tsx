import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View, Animated, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';

import { AuthProvider, useAuthContext } from './src/context/AuthContext';
import { ThemeProvider, useThemeColors } from './src/context/ThemeContext';
import { GameStateProvider }             from './src/context/GameStateContext';
import { ComingSoonScreen }              from './src/screens/ComingSoonScreen';
import { MainMenuScreen }                from './src/screens/MainMenuScreen';
import { CategoryScreen }                from './src/screens/CategoryScreen';
import { GameScreen }                    from './src/screens/GameScreen';
import { AuthScreen }                    from './src/screens/AuthScreen';
import { LeaderboardScreen }             from './src/screens/LeaderboardScreen';
import { ShopScreen }                    from './src/screens/ShopScreen';
import { ProfileScreen }                 from './src/screens/ProfileScreen';
import { InfiniteScreen }                from './src/screens/InfiniteScreen';
import { BottomTabBar, TabId }           from './src/components/BottomTabBar';
import { OfflineBanner }                 from './src/components/OfflineBanner';
import { OfflineSyncManager }            from './src/components/OfflineSyncManager';
import { NoConnectionScreen }            from './src/screens/NoConnectionScreen';
import { OnboardingScreen }              from './src/components/OnboardingScreen';
import { COLORS }                        from './src/constants/theme';
import { loadJSON }                      from './src/utils/storage';
import { initRevenueCat, claimDailyCoins } from './src/lib/subscription';
import { checkChangelog, type ChangelogEntry } from './src/lib/changelog';
import { ChangelogModal }                from './src/components/ChangelogModal';

// ─── Expo Updates — background check ─────────────────────────────────────────
// app.json sets checkAutomatically: "ON_LOAD" : Expo applique déjà les updates
// disponibles avant que le JS ne démarre (cold launch). Cette fonction ajoute
// une vérification en milieu de session pour les joueurs qui restent longtemps
// dans l'app. L'update est téléchargée silencieusement et s'appliquera au
// prochain lancement — sans jamais interrompre la partie en cours.

async function checkForUpdateSilently(onUpdateReady?: () => void): Promise<void> {
  // Skip en dev et dans Expo Go (Updates API indisponible).
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      // ⚠️ PAS de reloadAsync() — l'update s'applique au prochain cold launch.
      onUpdateReady?.();
    }
  } catch {
    // Erreurs réseau / serveur indisponible → ignorées silencieusement.
  }
}

// ─── Toast "Mise à jour téléchargée" ─────────────────────────────────────────

function UpdateToast({ onDismiss }: { onDismiss: () => void }) {
  const slideY  = useRef(new Animated.Value(-72)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide-in
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0,   useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1,   useNativeDriver: true, duration: 220 }),
    ]).start();

    // Auto-dismiss après 5 s
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -72, useNativeDriver: true, duration: 260 }),
      Animated.timing(opacity, { toValue: 0,   useNativeDriver: true, duration: 200 }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={[updateToastStyles.container, { transform: [{ translateY: slideY }], opacity }]}>
      <Ionicons name="cloud-download-outline" size={16} color={COLORS.accent} />
      <View style={updateToastStyles.textBlock}>
        <Text style={updateToastStyles.title}>Mise à jour téléchargée ✓</Text>
        <Text style={updateToastStyles.sub}>Sera appliquée au prochain lancement</Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={14} color={COLORS.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const updateToastStyles = StyleSheet.create({
  container: {
    position:        'absolute',
    top:             12,
    left:            16,
    right:           16,
    zIndex:          999,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.accent + '55',
    borderRadius:    6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor:     '#000',
    shadowOpacity:   0.4,
    shadowRadius:    8,
    elevation:       8,
  },
  textBlock: { flex: 1 },
  title:     { color: COLORS.text,      fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  sub:       { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
});

// ─── Toast "Pièces quotidiennes" ──────────────────────────────────────────────

function DailyCoinsToast({ coins, onDismiss }: { coins: number; onDismiss: () => void }) {
  const slideY  = useRef(new Animated.Value(-72)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 220 }),
    ]).start();

    const timer = setTimeout(() => dismiss(), 4000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -72, useNativeDriver: true, duration: 260 }),
      Animated.timing(opacity, { toValue: 0,   useNativeDriver: true, duration: 200 }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={[dailyCoinsToastStyles.container, { transform: [{ translateY: slideY }], opacity }]}>
      <Text style={dailyCoinsToastStyles.emoji}>🪙</Text>
      <View style={dailyCoinsToastStyles.textBlock}>
        <Text style={dailyCoinsToastStyles.title}>+{coins} pièces — Bonus journalier !</Text>
        <Text style={dailyCoinsToastStyles.sub}>Reviens demain pour en gagner d'autres</Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={14} color={COLORS.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const dailyCoinsToastStyles = StyleSheet.create({
  container: {
    position:          'absolute',
    top:               12,
    left:              16,
    right:             16,
    zIndex:            998,   // juste sous l'UpdateToast (999)
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    backgroundColor:   COLORS.card,
    borderWidth:       1,
    borderColor:       COLORS.warning + '66',
    borderRadius:      6,
    paddingVertical:   10,
    paddingHorizontal: 14,
    shadowColor:       '#000',
    shadowOpacity:     0.4,
    shadowRadius:      8,
    elevation:         8,
  },
  emoji:     { fontSize: 18 },
  textBlock: { flex: 1 },
  title:     { color: COLORS.warning,   fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  sub:       { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
});

// ─── Routes de l'application ──────────────────────────────────────────────────

type AppRoute = 'home' | 'categories' | 'game' | 'coming_soon';

const ANIME_LAUNCH_DATE         = new Date(2026, 5, 1); // 1er juin 2026
const DESSINS_ANIME_LAUNCH_DATE = new Date(2026, 5, 1); // 1er juin 2026

interface ComingSoonInfo {
  label:      string;
  icon:       string;
  launchDate: string;
}

// ─── Inner app (a accès au contexte Auth) ─────────────────────────────────────

function InnerApp() {
  const { session, authLoading, isGuest, offlineStart, refreshProfile } = useAuthContext();
  const themeColors = useThemeColors();

  const [onboardingDone,    setOnboardingDone]    = useState<boolean | null>(null);
  const [route,             setRoute]             = useState<AppRoute>('home');
  const [activeTab,         setActiveTab]         = useState<TabId>('game');
  const [updateReady,       setUpdateReady]       = useState(false);
  const [selectedCategory,  setSelectedCategory]  = useState<string>('games');
  const [dailyCoins,        setDailyCoins]        = useState<number | null>(null);
  const [pendingChangelog,  setPendingChangelog]  = useState<ChangelogEntry | null>(null);
  const [comingSoonInfo,    setComingSoonInfo]     = useState<ComingSoonInfo>({
    label: 'Animé', icon: 'star', launchDate: '01/06/2026',
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Load onboarding flag + kick off update check + init RevenueCat ─────
  useEffect(() => {
    loadJSON<boolean>('pn_onboarding_done').then((value) => {
      setOnboardingDone(value === true);
    });
    // Vérifie silencieusement les updates en arrière-plan.
    // Le callback déclenche le toast si une update a été téléchargée.
    checkForUpdateSilently(() => setUpdateReady(true));
    // Initialise RevenueCat dès le démarrage (non-bloquant, erreurs ignorées).
    initRevenueCat().catch(() => {});
    // Vérifie si le changelog de cette version a déjà été affiché.
    checkChangelog().then((entry) => { if (entry) setPendingChangelog(entry); }).catch(() => {});
  }, []);

  // ── Pièces quotidiennes (Pro / Legend) ────────────────────────────────────
  // Déclenché une fois par session (session?.user?.id stable entre re-renders).
  // Ignoré pour les invités et les comptes free/basic (claimDailyCoins retourne 0).
  useEffect(() => {
    if (!session || isGuest) return;
    claimDailyCoins()
      .then(({ coinsAwarded }) => {
        if (coinsAwarded > 0) {
          setDailyCoins(coinsAwarded);
          refreshProfile().catch(() => {});
        }
      })
      .catch(() => {});
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spinner while checking onboarding or restoring session ───────────────
  if (onboardingDone === null || authLoading) {
    return (
      <View style={[styles.splash, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator color={themeColors.accent} size="large" />
      </View>
    );
  }

  // ── Show onboarding before any auth check ─────────────────────────────────
  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={() => setOnboardingDone(true)}
      />
    );
  }

  // ── Pas de session et pas en mode invité → écran de connexion ─────────────
  if (!session && !isGuest) {
    if (offlineStart) return <NoConnectionScreen />;
    return <AuthScreen />;
  }

  // ── Transition fondu entre routes ─────────────────────────────────────────
  const transition = (next: AppRoute, tab: TabId = 'game') => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setRoute(next);
      setActiveTab(tab);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  };

  const goHome        = () => transition('home');
  const goCategories  = () => transition('categories');
  const goGame        = (cat = 'games') => { setSelectedCategory(cat); transition('game', 'game'); };
  const goComingSoon  = (info: ComingSoonInfo) => { setComingSoonInfo(info); transition('coming_soon'); };

  const handleTabPress = (id: TabId) => {
    if (id !== activeTab) setActiveTab(id);
  };

  // ── Rendu selon la route ──────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.fill, { opacity: fadeAnim, backgroundColor: themeColors.background }]}>

      {/* ── ACCUEIL ─────────────────────────────────────────────────────── */}
      {route === 'home' && (
        <MainMenuScreen onPlay={goCategories} />
      )}

      {/* ── SÉLECTION CATÉGORIE ─────────────────────────────────────────── */}
      {route === 'categories' && (
        <CategoryScreen
          onSelectCategory={(id) => {
            if (id === 'games') {
              goGame('games');
            } else if (id === 'anime') {
              if (new Date() < ANIME_LAUNCH_DATE) {
                goComingSoon({ label: 'Animé', icon: 'star', launchDate: '01/06/2026' });
              } else {
                goGame('anime');
              }
            } else if (id === 'dessinsanime') {
              if (new Date() < DESSINS_ANIME_LAUNCH_DATE) {
                goComingSoon({ label: 'Dessin Animé', icon: 'tv-outline', launchDate: '01/06/2026' });
              } else {
                goGame('dessinsanime');
              }
            }
          }}
          onBack={goHome}
        />
      )}

      {/* ── À VENIR ──────────────────────────────────────────────────────── */}
      {route === 'coming_soon' && (
        <ComingSoonScreen
          label={comingSoonInfo.label}
          icon={comingSoonInfo.icon}
          launchDate={comingSoonInfo.launchDate}
          onBack={goCategories}
        />
      )}

      {/* ── ZONE DE JEU (4 onglets) ──────────────────────────────────────── */}
      {route === 'game' && (
        <GameStateProvider category={selectedCategory}>
          <View style={styles.fill}>

            {/* Jeu */}
            {activeTab === 'game' && (
              <GameScreen onBack={goCategories} />
            )}

            {/* Mode Infini */}
            {activeTab === 'infinite' && (
              <InfiniteScreen />
            )}

            {/* Boutique */}
            {activeTab === 'shop' && (
              <ShopScreen />
            )}

            {/* Classement */}
            {activeTab === 'leaderboard' && (
              <LeaderboardScreen />
            )}

            {/* Profil */}
            {activeTab === 'profile' && (
              <ProfileScreen />
            )}

          </View>
          <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />
        </GameStateProvider>
      )}

      {/* ── Toast "Mise à jour téléchargée" ────────────────────────────── */}
      {updateReady && (
        <UpdateToast onDismiss={() => setUpdateReady(false)} />
      )}

      {/* ── Toast "Pièces quotidiennes" ─────────────────────────────────── */}
      {dailyCoins !== null && (
        <DailyCoinsToast coins={dailyCoins} onDismiss={() => setDailyCoins(null)} />
      )}

      {/* ── Modale changelog (affichée une seule fois par version) ──────── */}
      {pendingChangelog !== null && onboardingDone === true && (session != null || isGuest) && (
        <ChangelogModal
          entry={pendingChangelog}
          onDismiss={() => setPendingChangelog(null)}
        />
      )}

    </Animated.View>
  );
}

// ─── ThemedRoot (lit ThemeContext pour le fond dynamique) ─────────────────────

function ThemedRoot() {
  const themeColors = useThemeColors();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: themeColors.background }]} edges={['top']}>
      <StatusBar style="light" backgroundColor={themeColors.background} />
      <AuthProvider>
        <OfflineSyncManager />
        <InnerApp />
      </AuthProvider>
      {/* Bandeau hors-ligne — positionné en absolu, s'affiche par-dessus tout */}
      <OfflineBanner />
    </SafeAreaView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fill: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

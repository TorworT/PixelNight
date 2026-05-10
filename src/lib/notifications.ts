import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { loadJSON, saveJSON } from '../utils/storage';

// ─── Détection Expo Go ────────────────────────────────────────────────────────

const IS_EXPO_GO = Constants.appOwnership === 'expo';

// ─── Require conditionnel ─────────────────────────────────────────────────────

type NotificationsModule = typeof import('expo-notifications');

const Notifications: NotificationsModule | null = (() => {
  if (IS_EXPO_GO) return null;
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
})();

// ─── Handler global ───────────────────────────────────────────────────────────

if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert:  true,
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   false,
      }),
    });
  } catch {
    // Silencieux
  }
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAILY_NOTIF_ID     = 'pixelnight_daily';
const STREAK_NOTIF_ID    = 'pixelnight_streak';
const NOTIFS_ENABLED_KEY = 'pn_notifs_enabled';

const DAILY_HOUR    = 7; // ✅ changé de 20h à 7h
const DAILY_MINUTE  = 0;
const STREAK_HOUR   = 9;
const STREAK_MINUTE = 0;

const DAILY_MESSAGES = [
  "☀️ Bonne journée ! L'image du jour t'attend !",
  "🎮 Un nouveau défi pixel t'attend ce matin !",
  "☕ Avec ton café, un petit pixel ? 👀",
  "🔥 Ta série continue ? Viens jouer !",
  "🪙 Tes pièces t'attendent... Sauras-tu trouver le jeu ?",
];

const STREAK_MESSAGES: Record<number, string> = {
  3:  "🔥 Série de 3 jours ! Continue comme ça !",
  7:  "🔥 Série de 7 jours ! Tu es en feu !",
  30: "🏆 Série de 30 jours ! Tu es une légende PixelNight !",
};

// ─── Helpers internes ─────────────────────────────────────────────────────────

function randomDailyBody(): string {
  return DAILY_MESSAGES[Math.floor(Math.random() * DAILY_MESSAGES.length)];
}

function tomorrowAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function isEnabled(): Promise<boolean> {
  const saved = await loadJSON<boolean>(NOTIFS_ENABLED_KEY);
  return saved !== false;
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function initNotifications(): Promise<void> {
  if (!Notifications) return;
  if (!Device.isDevice) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await supabase.rpc('save_push_token', { p_token: token });
    } catch {
      // Normal en développement local
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'PixelNight',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    await ensureDailyScheduled();

  } catch {
    // Silencieux
  }
}

export async function ensureDailyScheduled(): Promise<void> {
  if (!Notifications) return;

  try {
    const enabled = await isEnabled();
    if (!enabled) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const exists = scheduled.some((n) => n.identifier === DAILY_NOTIF_ID);
    if (!exists) await scheduleDailyAt7h();
  } catch {
    // Silencieux
  }
}

export async function scheduleDailyAt7h(): Promise<void> {
  if (!Notifications) return;

  try {
    const enabled = await isEnabled();
    if (!enabled) return;

    await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_NOTIF_ID,
      content: {
        title: "🎮 PixelNight - Le jeu du jour t'attend !",
        body:  randomDailyBody(),
        sound: true,
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour:   DAILY_HOUR,
        minute: DAILY_MINUTE,
      },
    });
  } catch {
    // Silencieux
  }
}

export async function skipTodayNotification(): Promise<void> {
  if (!Notifications) return;

  try {
    const now = new Date();
    if (now.getHours() >= DAILY_HOUR) return; // Déjà après 7h

    await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {});

    const enabled = await isEnabled();
    if (!enabled) return;

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_NOTIF_ID,
      content: {
        title: "🎮 PixelNight - Le jeu du jour t'attend !",
        body:  randomDailyBody(),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: tomorrowAt(DAILY_HOUR, DAILY_MINUTE),
      },
    });
  } catch {
    // Silencieux
  }
}

export async function scheduleStreakNotification(serie: number): Promise<void> {
  if (!Notifications) return;

  try {
    const message = STREAK_MESSAGES[serie];
    if (!message) return;

    const enabled = await isEnabled();
    if (!enabled) return;

    await Notifications.cancelScheduledNotificationAsync(STREAK_NOTIF_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_NOTIF_ID,
      content: {
        title: '🎮 PixelNight',
        body:  message,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: tomorrowAt(STREAK_HOUR, STREAK_MINUTE),
      },
    });
  } catch {
    // Silencieux
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await saveJSON(NOTIFS_ENABLED_KEY, enabled);

  if (!Notifications) return;

  try {
    if (!enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } else {
      await scheduleDailyAt7h();
    }
  } catch {
    // Silencieux
  }
}

export async function areNotificationsEnabled(): Promise<boolean> {
  return isEnabled();
}
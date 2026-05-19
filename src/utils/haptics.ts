/**
 * Wrapper autour d'expo-haptics qui respecte la préférence utilisateur
 * "Désactiver la vibration" stockée dans AsyncStorage.
 *
 * Usage : importer ce module à la place d'expo-haptics.
 *   import * as Haptics from '../utils/haptics';
 *
 * Les enums (ImpactFeedbackStyle, NotificationFeedbackType) sont
 * ré-exportés pour que le code existant n'ait pas à changer.
 */

import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ré-export des enums pour la compatibilité descendante
export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

export const HAPTICS_PREF_KEY = 'pn_haptics_disabled';

/** Cache en mémoire — évite des lectures AsyncStorage à chaque vibration. */
let _disabled = false;

/**
 * Charge la préférence depuis AsyncStorage.
 * À appeler une seule fois au démarrage de l'app.
 */
export async function loadHapticsPreference(): Promise<void> {
  try {
    const val = await AsyncStorage.getItem(HAPTICS_PREF_KEY);
    _disabled = val === 'true';
  } catch {
    _disabled = false;
  }
}

/**
 * Active ou désactive les vibrations.
 * Met à jour le cache mémoire ET AsyncStorage immédiatement.
 */
export async function setHapticsDisabled(disabled: boolean): Promise<void> {
  _disabled = disabled;
  try {
    await AsyncStorage.setItem(HAPTICS_PREF_KEY, disabled ? 'true' : 'false');
  } catch {}
}

/** Retourne l'état courant (cache mémoire). */
export function getHapticsDisabled(): boolean {
  return _disabled;
}

/** Équivalent de Haptics.impactAsync() — respecte la préférence. */
export function impactAsync(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): void {
  if (_disabled) return;
  Haptics.impactAsync(style).catch(() => {});
}

/** Équivalent de Haptics.notificationAsync() — respecte la préférence. */
export function notificationAsync(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
): void {
  if (_disabled) return;
  Haptics.notificationAsync(type).catch(() => {});
}

/** Équivalent de Haptics.selectionAsync() — respecte la préférence. */
export function selectionAsync(): void {
  if (_disabled) return;
  Haptics.selectionAsync().catch(() => {});
}

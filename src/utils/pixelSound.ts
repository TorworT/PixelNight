/**
 * pixelSound.ts — Sons pixel art via expo-av.
 *
 * Pour activer les sons, ajoutez ces fichiers dans assets/sounds/ :
 *   - victory.mp3  (son de victoire court, style chiptune 8-bit)
 *   - defeat.mp3   (son de défaite court, style chiptune 8-bit)
 *
 * Sources gratuites : freesound.org, opengameart.org (licence CC0)
 *
 * Si les fichiers sont absents, les fonctions échouent silencieusement.
 */

import { Audio } from 'expo-av';

let victorySound: Audio.Sound | null = null;
let defeatSound:  Audio.Sound | null = null;

async function loadAndPlay(getter: () => Audio.Sound | null, setter: (s: Audio.Sound) => void, req: number): Promise<void> {
  try {
    let sound = getter();
    if (!sound) {
      sound = new Audio.Sound();
      await sound.loadAsync(req);
      setter(sound);
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Fichier absent ou erreur audio — silencieux
  }
}

/** Son de victoire pixel art (chiptune joyeux). */
export async function playVictorySound(): Promise<void> {
  // Décommente quand le fichier assets/sounds/victory.mp3 est présent :
  // await loadAndPlay(() => victorySound, (s) => { victorySound = s; }, require('../../assets/sounds/victory.mp3'));
}

/** Son de défaite pixel art (chiptune triste). */
export async function playDefeatSound(): Promise<void> {
  // Décommente quand le fichier assets/sounds/defeat.mp3 est présent :
  // await loadAndPlay(() => defeatSound, (s) => { defeatSound = s; }, require('../../assets/sounds/defeat.mp3'));
}

/** Libère les ressources audio (à appeler dans un cleanup). */
export async function unloadSounds(): Promise<void> {
  try { await victorySound?.unloadAsync(); victorySound = null; } catch {}
  try { await defeatSound?.unloadAsync();  defeatSound  = null; } catch {}
}

import { useState, useEffect } from 'react';
import { loadJSON, saveJSON } from '../utils/storage';
import { getDateString } from '../utils/dateUtils';

interface StreakData {
  streak: number;
  bestStreak: number;
  lastPlayedDate: string; // YYYY-MM-DD
}

const STORAGE_KEY = 'pixelnight_streak';

/**
 * Tracks consecutive daily play streaks.
 * Updates on first access each day (opening the main menu counts as "playing").
 */
export function useStreak() {
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function compute() {
      const today = getDateString();
      const yesterday = getDateString(new Date(Date.now() - 86_400_000));
      const data = await loadJSON<StreakData>(STORAGE_KEY);

      if (!data) {
        // First ever launch
        const initial: StreakData = { streak: 1, bestStreak: 1, lastPlayedDate: today };
        await saveJSON(STORAGE_KEY, initial);
        setStreak(1);
        setBestStreak(1);
      } else if (data.lastPlayedDate === today) {
        // Already updated today — just read
        setStreak(data.streak);
        setBestStreak(data.bestStreak);
      } else if (data.lastPlayedDate === yesterday) {
        // Consecutive day — increment
        const newStreak = data.streak + 1;
        const newBest = Math.max(newStreak, data.bestStreak);
        await saveJSON(STORAGE_KEY, { streak: newStreak, bestStreak: newBest, lastPlayedDate: today });
        setStreak(newStreak);
        setBestStreak(newBest);
      } else {
        // Gap — reset streak
        const newBest = Math.max(1, data.bestStreak);
        await saveJSON(STORAGE_KEY, { streak: 1, bestStreak: newBest, lastPlayedDate: today });
        setStreak(1);
        setBestStreak(newBest);
      }

      setIsLoaded(true);
    }

    compute();
  }, []);

  return { streak, bestStreak, isLoaded };
}

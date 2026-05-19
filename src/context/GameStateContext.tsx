import React, { createContext, useContext } from 'react';
import { useGameState } from '../hooks/useGameState';

/**
 * GameStateContext — shared instance of useGameState().
 *
 * Wrap <GameStateProvider> around the tab navigator so both GameScreen
 * and ShopScreen operate on the same game state (same AsyncStorage key,
 * same powerup flags, no double-fetch).
 */
type GameStateContextValue = ReturnType<typeof useGameState>;

const GameStateContext = createContext<GameStateContextValue | null>(null);

interface ProviderProps {
  children:            React.ReactNode;
  category?:           string;
  initialMaxAttempts?: number;
}

export function GameStateProvider({ children, category = 'games', initialMaxAttempts }: ProviderProps) {
  const value = useGameState(category, initialMaxAttempts);
  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameStateContext(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error('useGameStateContext must be used inside <GameStateProvider>');
  }
  return ctx;
}

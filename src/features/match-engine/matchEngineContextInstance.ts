/**
 * Context-Instanz getrennt vom Provider (React-Refresh-Kompatibilitaet, gleiches
 * Muster wie `features/auth/context/authContextInstance.ts`).
 */
import { createContext } from 'react';
import type { LocalMatchStore, ClockSync, OutboxSender, MatchEngine } from '../../core/match/client';

export interface MatchEngineContextValue {
  engine: MatchEngine;
  sender: OutboxSender;
  store: LocalMatchStore;
  clock: ClockSync;
}

export const MatchEngineContext = createContext<MatchEngineContextValue | null>(null);

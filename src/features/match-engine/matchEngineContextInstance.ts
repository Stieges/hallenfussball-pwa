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
  /** m3 (Nachtrag C3a-2a): das AKTUELLE Konto. Der Provider gibt bei jedem Kontowechsel ein NEUES
   * Kontext-Objekt aus (`accountId` geaendert), damit Hooks, die `context` in einer
   * Abhaengigkeitsliste fuehren (z. B. `useEngineMatches`), ihren Kopien-Cache zuverlaessig neu
   * aufbauen -- vorher blieb `bundle` (Engine/Sender/Store/Uhr) referenzstabil ueber jeden
   * Kontowechsel hinweg, ein Hook-Effekt mit `[..., context]` als Abhaengigkeit lief deshalb nach
   * einem Kontowechsel NICHT erneut, bis sich zufaellig eine ANDERE Abhaengigkeit (z. B. `tournament`)
   * aenderte. */
  accountId: string;
}

export const MatchEngineContext = createContext<MatchEngineContextValue | null>(null);

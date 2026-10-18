/**
 * Hilfen des Cockpit-Testgerüsts mit echter Engine (Aufgabe 2.4): Konstanten, Store-gestützter Sender und `anpfiff`.
 * Getrennt von `engineHarness.tsx`, damit diese Datei nur Funktionen und Typen und jene nur die Komponente exportiert.
 */
import 'fake-indexeddb/auto';
import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { looseVs } from '../../../test/matchSlotFixtures';
import type { LocalMatchStore } from '../../../core/match/client';
import { emptyOutboxStatus, type OutboxStatus } from '../../../core/match/client/outboxTypes';

export const HARNESS_MATCH_ID = 'match-harness-1';
export const HARNESS_TOURNAMENT_ID = 'tour-harness';

export const harnessTournament = {
  id: HARNESS_TOURNAMENT_ID,
  matches: [{ id: HARNESS_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 1 }],
  teams: [{ id: 'teama', name: 'FC Alpha' }, { id: 'teamb', name: 'SV Beta' }],
  groupPhaseGameDuration: 20,
} as unknown as Tournament;

/** Was `MatchEngineContext.sender` im Gerüst können muss (Teilmenge des `OutboxSender`). */
export interface HarnessSender {
  kick: (matchId?: string) => Promise<void>;
  getStatus: () => OutboxStatus;
  subscribe: (listener: (status: OutboxStatus) => void) => () => void;
  dismissRejected: (matchId: string, ids: string[]) => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
}
export type SenderFabrik = (store: LocalMatchStore, accountId: string, tournamentId: string) => HarnessSender;

/** Zählt bei jedem `kick()` die wartenden Einträge des Spiels aus dem Store (kein gesetzter Zähler). */
export function storeSender(store: LocalMatchStore, accountId: string, tournamentId: string): HarnessSender {
  const listeners = new Set<(status: OutboxStatus) => void>();
  let status = emptyOutboxStatus();
  return {
    kick: vi.fn(async (matchId?: string) => {
      const copy = matchId ? await store.load(accountId, matchId) : null;
      const n = copy?.pending.length ?? 0;
      status = { ...emptyOutboxStatus(), pendingByTournament: { [tournamentId]: n }, pendingByMatch: matchId ? { [matchId]: n } : {} };
      listeners.forEach((l) => { l(status); });
    }),
    getStatus: () => status,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    dismissRejected: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  };
}

/** Der Tipp auf „Anpfiff“ (Daumenleiste/Knopf der Spielfläche). */
export async function anpfiff(user: UserEvent): Promise<void> {
  await user.click(await screen.findByTestId('match-start-button'));
}

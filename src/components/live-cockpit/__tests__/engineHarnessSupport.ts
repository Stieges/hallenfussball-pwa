/**
 * Hilfen des Cockpit-Testgerüsts mit echter Engine (Aufgabe 2.4): Konstanten, Store-gestützter Sender und `anpfiff`.
 * Getrennt von `engineHarness.tsx`, damit diese Datei nur Funktionen und Typen und jene nur die Komponente exportiert.
 */
import 'fake-indexeddb/auto';
import { act, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import type { UserEvent } from '@testing-library/user-event';
import { expect, vi } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { looseVs } from '../../../test/matchSlotFixtures';
import { ClockSync, LocalMatchStore, MatchCommands, MatchEngine } from '../../../core/match/client';
import { serverRules, type EngineEvent, type EventDetails, type MatchContext } from '../../../core/match';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../features/match-engine/matchEngineContextInstance';
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

let konten = 0;
let aktuellerKontext: MatchEngineContextValue | null = null;

/** Die Spiel-Zuordnung, mit der das Gerüst `MatchCommands` aufruft. */
export const HARNESS_CTX: MatchContext = { matchId: HARNESS_MATCH_ID, teamAId: 'teama', teamBId: 'teamb' };

/** Baut Engine, Store und Spiel auf; der Kontext ist danach über `harnessContext()` erreichbar. */
export async function baueKontext(senderFabrik: SenderFabrik, gastKonto: boolean): Promise<MatchEngineContextValue> {
  const accountId = gastKonto ? 'guest' : `acc-harness-${(konten += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(Date.now()), () => Date.now(), { get: () => null, set: () => undefined });
  const sender = senderFabrik(store, accountId, HARNESS_TOURNAMENT_ID);
  const engine = new MatchEngine({ store, clock, sender, fetchConfirmed: () => Promise.resolve({ events: [], newWatermark: 0 }), now: () => Date.now() });
  await engine.start(accountId);
  await engine.ensureMatch(HARNESS_MATCH_ID, HARNESS_CTX, harnessTournament.id);
  const kontext = { engine, store, clock, sender, accountId } as unknown as MatchEngineContextValue;
  aktuellerKontext = kontext;
  return kontext;
}

/** Der zuletzt aufgebaute Kontext (eine Testdatei = ein Gerüst). */
export function harnessContext(): MatchEngineContextValue {
  if (!aktuellerKontext) { throw new Error('Gerüst nicht aufgebaut'); }
  return aktuellerKontext;
}

/** Provider für Hooks, die den Engine-Kontext lesen (`renderHook({ wrapper })`). */
export function engineWrapper(value: MatchEngineContextValue): (props: { children: ReactNode }) => ReactElement {
  return function EngineWrapper({ children }) {
    return createElement(MatchEngineContext.Provider, { value }, children);
  };
}

/** Engine mit angepfiffenem Spiel (1 × 20 Minuten) ohne React: für Hooks, die nur `MatchEngineContext` brauchen. */
export async function laufendesEngineSpiel(): Promise<{ value: MatchEngineContextValue; commands: MatchCommands; ctx: MatchContext }> {
  const value = await baueKontext(storeSender, false);
  const commands = new MatchCommands({ engine: value.engine, store: value.store, sender: value.sender, accountId: value.accountId });
  const rules = serverRules({ durationMinutes: null, phase: null, groupPhaseDuration: 20, finalRoundDuration: null, config: { gamePeriods: 1, halftimeBreak: 0 }, finalsConfig: null });
  await commands.start(HARNESS_MATCH_ID, HARNESS_CTX, 'leitung', rules);
  return { value, commands, ctx: HARNESS_CTX };
}

/** Alle Einträge im Log des Spiels, auch zurückgenommene und ihre RETRACT/AMEND-Einträge. */
export function eintraegeImLog(): EngineEvent[] {
  return harnessContext().engine.view(HARNESS_MATCH_ID)?.log ?? [];
}

/** Einträge im Log ohne die zurückgenommenen (und ohne RETRACT/AMEND selbst). */
export function wirksameImLog(): EngineEvent[] {
  const log = eintraegeImLog();
  const zurueck = new Set(log.filter((e) => e.type === 'RETRACT').map((e) => e.targetId));
  return log.filter((e) => e.type !== 'RETRACT' && e.type !== 'AMEND' && !zurueck.has(e.id));
}

/** Die wirksamen Tore (GOAL) des Spiels. */
export function toreImLog(): EngineEvent[] {
  return wirksameImLog().filter((e) => e.type === 'GOAL');
}

/** Wartet auf das erste wirksame Tor im Log und liefert es. */
export async function torImLog(): Promise<EngineEvent> {
  await waitFor(() => { expect(toreImLog().length).toBeGreaterThan(0); });
  return toreImLog()[0];
}

/** Angaben (Rückennummer …) zu einem Eintrag aus dem Engine-Zustand. */
export function detailsVon(id: string): EventDetails {
  const details = harnessContext().engine.view(HARNESS_MATCH_ID)?.result.state.details;
  return details && Object.hasOwn(details, id) ? details[id] : {};
}

/** Was im Ausgang (nicht bestätigt) liegt, in der Reihenfolge des Speicherns. */
export async function ausgang(): Promise<EngineEvent[]> {
  const kontext = harnessContext();
  const kopie = await kontext.store.load(kontext.accountId, HARNESS_MATCH_ID);
  return kopie?.pending ?? [];
}

/** Ein anderes Gerät sendet ein Tor für `teamId` (zweite `MatchCommands`-Instanz auf derselben Engine). */
export async function fremdesGeraetSendetTor(teamId: string): Promise<void> {
  const kontext = harnessContext();
  const fremd = new MatchCommands({ engine: kontext.engine, store: kontext.store, sender: kontext.sender, accountId: kontext.accountId });
  await act(async () => { await fremd.goal(HARNESS_MATCH_ID, HARNESS_CTX, 'leitung', teamId, false); });
}

/** Wartet die Sperre des Nummern-Bausteins ab (echte Zeitgeber, 300 ms; nur `Date` ist gefälscht). */
export async function warteSperre(): Promise<void> {
  await act(async () => { await new Promise((fertig) => { setTimeout(fertig, 310); }); });
}

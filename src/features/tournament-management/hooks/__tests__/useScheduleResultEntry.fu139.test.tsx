/**
 * @FU-139: Warnung in der Rückfrage „Spiel beenden und Ergebnis eintragen“, wenn der Eintrag von den im Cockpit gebuchten Toren
 * abweicht. Gleicher echter Weg wie useScheduleResultEntry.spielBeenden.test.tsx (echte Engine, Server-RPC gemockt, echte DE-Texte).
 * Werte aus dem Gherkin: Spiel 9 läuft mit 1:0 (Tor von Nummer 7, SV Süd), die Turnierleitung trägt 3:1 ein.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const role = vi.hoisted(() => ({ actor: 'leitung' }));
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => role.actor }));
const authors = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../../core/repositories/eventAuthorNamesRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../core/repositories/eventAuthorNamesRpc')>()),
  readEventAuthorNames: authors.read,
}));
// @FU-115: Stand der Feldsteuerung am Server (field_control_state), je Test gesetzt; Standard: niemand sonst steuert.
const holder = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../../core/repositories/fieldControlStateRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../core/repositories/fieldControlStateRpc')>()),
  readForeignFieldHolder: holder.read,
}));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import type { EngineEventWithSeq } from '../../../../core/match/client';
import { effectiveScoreFor, type EngineEvent, type MatchRules } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import {
  FC_NORD, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine,
} from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

await initRealDeI18n();

/** Tom pfeift auf seinem Gerät an; `vorMs` = wie lange das her ist (Uhr läuft seitdem). */
const anpfiff = (vorMs: number, rules: MatchRules = RULES): EngineEvent =>
  ({ id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - vorMs, section: 1, clockMs: 0, teamId: null, payload: { rules } });
const tor = (id: string, teamId: string, vorMs: number): EngineEvent =>
  ({ id, type: 'GOAL', actor: 'helper', at: NOW - vorMs, section: 1, clockMs: 1000, teamId, payload: {} });
const seq = (event: EngineEvent, n: number): EngineEventWithSeq => ({ ...event, seq: n });
/**
 * Der Server bestätigt, was gesendet wurde: der nächste Abgleich liefert die gesendeten Einträge (Seq ab 100). Nur Aufrufe,
 * die der Server beantwortet hat -- mit `auchVerloren` auch solche, deren Antwort verloren ging (N3: gespeichert, aber Netzfehler).
 */
function echoSent(h: ScheduleEngine, auchVerloren = false): void {
  let delivered = 0;
  let seqNo = 100;
  h.fetchConfirmed.mockImplementation(async (_matchId: string, watermark: number) => {
    const all = h.api.mock.calls
      .filter((_call, i) => auchVerloren || h.api.mock.settledResults[i]?.type === 'fulfilled')
      .flatMap(([, events]) => events);
    const fresh = all.slice(delivered);
    delivered = all.length;
    return { events: fresh.map((e): EngineEventWithSeq => ({ ...e, actor: 'leitung', seq: (seqNo += 1) })), newWatermark: fresh.length > 0 ? seqNo : watermark };
  });
}
const confirmed = (h: ScheduleEngine, events: EngineEvent[], from = 1) =>
  h.fetchConfirmed.mockResolvedValueOnce({ events: events.map((e, i) => seq(e, from + i)), newWatermark: from + events.length - 1 });

function render(h: ScheduleEngine) {
  const showWarning = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>
  );
  const tournament = scheduleTournament({ [SPIEL_9]: { field: 2 } });
  const hook = renderHook(() => useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false }), { wrapper });
  /** Startet die Eingabe (ohne auf sie zu warten); Rückfragen beantwortet der Test selbst. */
  const enter = (matchId: string, a: number, b: number): Promise<boolean> => {
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => { done = hook.result.current.enterScore(matchId, a, b); });
    return done;
  };
  const answer = async (value: string | null) => {
    await act(async () => { hook.result.current.answerPrompt(value); await settle(); });
  };
  return { hook, enter, answer, showWarning };
}

const sent = (h: ScheduleEngine) => h.api.mock.calls.map(([, events]) => events);
const state = (h: ScheduleEngine, matchId: string) => h.engine.view(matchId)?.result.state;
const scoreOf = (h: ScheduleEngine, matchId: string, a: string, b: string) => {
  const s = state(h, matchId);
  return s ? `${effectiveScoreFor(s, a)}:${effectiveScoreFor(s, b)}` : '';
};
const outboxEmpty = async (h: ScheduleEngine, matchId: string) => ((await h.store.load(h.value.accountId, matchId))?.pending ?? []).length === 0;


const tor7 = (id: string, teamId: string, vorMs: number): EngineEvent => ({ ...tor(id, teamId, vorMs), payload: { number: 7 } });
const types = (h: ScheduleEngine) => sent(h).map((events) => events.map((e) => e.type));

describe('@FU-139 Warnung bei abweichendem Ergebnis (Spielplan, Spiel beenden)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    authors.read.mockReset();
    authors.read.mockResolvedValue(new Map());
    holder.read.mockReset();
    holder.read.mockResolvedValue(null);
    role.actor = 'leitung';
    h = await makeScheduleEngine();
    echoSent(h);
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-139 Spiel 9 läuft mit 1:0, Eintrag 3:1 → die Rückfrage trägt den gebuchten Stand „1:0“; „Beenden“ speichert 3:1 als RESULT_ENTRY, das Tor bleibt im Protokoll', async () => {
    confirmed(h, [anpfiff(480_000), tor7('t1', SV_SUED, 300_000)]);
    const { hook, enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(hook.result.current.prompt).toEqual({ kind: 'end', matchNumber: 9, score: '3:1', rest: '2:00', controlledBy: null, bookedScore: '1:0' });
    expect(h.api).not.toHaveBeenCalled();
    await answer('yes');
    expect(await done).toBe(true);
    await settle();

    expect(showWarning).not.toHaveBeenCalled();
    expect(types(h)).toEqual([['RESULT_ENTRY']]);
    expect(sent(h)[0][0].payload).toMatchObject({ scores: { [SV_SUED]: 3, [FC_NORD]: 1 } });
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('3:1');
    expect(state(h, SPIEL_9)?.status).toBe('finished');
    expect(Object.keys(state(h, SPIEL_9)?.accepted ?? {})).toContain('t1'); // das gebuchte Tor bleibt stehen
    expect(state(h, SPIEL_9)?.goals.map((g) => g.id)).toEqual(['t1']);
    expect(state(h, SPIEL_9)?.retracted).toEqual([]);
  });

  it('@FU-139 „Abbrechen“ speichert nichts, Spiel 9 läuft unverändert weiter (1:0)', async () => {
    confirmed(h, [anpfiff(480_000), tor7('t1', SV_SUED, 300_000)]);
    const { enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer(null);
    expect(await done).toBe(false);

    expect(h.api).not.toHaveBeenCalled();
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
    expect(state(h, SPIEL_9)?.status).toBe('running');
    expect(state(h, SPIEL_9)?.clock.running).toBe(true);
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('1:0');
  });

  it('@FU-139 Gegenbeispiel: Eintrag 1:0 (Stand aus dem Cockpit) → keine Warnung in der Rückfrage', async () => {
    confirmed(h, [anpfiff(480_000), tor7('t1', SV_SUED, 300_000)]);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 1, 0);
    await act(async () => { await settle(); });

    expect(hook.result.current.prompt).toEqual({ kind: 'end', matchNumber: 9, score: '1:0', rest: '2:00', controlledBy: null });
    await answer(null);
    await done;
  });

  it('@FU-139 Gegenbeispiel: keine Tore gebucht → keine Warnung bei 3:1', async () => {
    confirmed(h, [anpfiff(480_000)]);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(hook.result.current.prompt).toEqual({ kind: 'end', matchNumber: 9, score: '3:1', rest: '2:00', controlledBy: null });
    await answer(null);
    await done;
  });

  it('@FU-139 abgelaufene Spielzeit (@FU-114, „Ja“/„Nein“): dieselbe Rückfrage trägt die Warnung, „Ja“ beendet mit dem Eintrag, das Tor bleibt', async () => {
    confirmed(h, [anpfiff(1_300_000), tor7('t1', SV_SUED, 1_200_000),
      { ...anpfiff(0), id: 'h1', type: 'SECTION_END', at: NOW - 700_000, clockMs: 600_000, payload: {} },
      { ...anpfiff(0), id: 'h2', type: 'SECTION_START', at: NOW - 640_000, clockMs: 600_000, section: 1, payload: {} }]);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(hook.result.current.prompt).toMatchObject({ kind: 'end', score: '3:1', rest: null, bookedScore: '1:0' });
    await answer('yes');
    expect(await done).toBe(true);
    await settle();
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('3:1');
    expect(state(h, SPIEL_9)?.goals.map((g) => g.id)).toEqual(['t1']);
  });

  it('@FU-139 ein zurückgenommenes Tor zählt nicht: nach Rücknahme keine Warnung', async () => {
    confirmed(h, [anpfiff(480_000), tor7('t1', SV_SUED, 300_000),
      { ...anpfiff(0), id: 'r1', type: 'RETRACT', at: NOW - 200_000, clockMs: 2000, teamId: null, targetId: 't1', payload: {} }]);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('0:0');
    expect(hook.result.current.prompt).toEqual({ kind: 'end', matchNumber: 9, score: '3:1', rest: '2:00', controlledBy: null });
    await answer(null);
    await done;
  });
});

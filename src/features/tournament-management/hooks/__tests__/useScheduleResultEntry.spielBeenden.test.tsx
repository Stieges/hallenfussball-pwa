/**
 * Spiel beenden und Ergebnis eintragen im Spielplan (20261110_009, Variante A). Echter Weg wie
 * useScheduleResultEntry.test.tsx: echter `LocalMatchStore` + `MatchEngine` + `OutboxSender` (Server-RPC gemockt), echte
 * DE-Texte. Werte aus dem Gherkin (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`): @FU-112, @FU-113, @FU-114,
 * @FU-115, @FU-116, @FU-117, @FU-118, @FU-081 (präzisiert), @FU-094; Gegenbeispiele @FU-080 (geplant) und @FU-069 (beendet).
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
import { type EngineEventWithSeq } from '../../../../core/match/client';
import { effectiveScoreFor, type EngineEvent, type MatchRules } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import {
  FC_NORD, GAST, HALBFINALE_1, HEIM, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine,
} from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

await initRealDeI18n();

const KO_SHOOTOUT: MatchRules = { ...RULES, knockout: true, tiebreak: 'shootout', sections: 1 };
/** Tom pfeift auf seinem Gerät an; `vorMs` = wie lange das her ist (Uhr läuft seitdem). */
const anpfiff = (vorMs: number, rules: MatchRules = RULES): EngineEvent =>
  ({ id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - vorMs, section: 1, clockMs: 0, teamId: null, payload: { rules } });
const tor = (id: string, teamId: string, vorMs: number): EngineEvent =>
  ({ id, type: 'GOAL', actor: 'helper', at: NOW - vorMs, section: 1, clockMs: 1000, teamId, payload: {} });
const seq = (event: EngineEvent, n: number): EngineEventWithSeq => ({ ...event, seq: n });
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
const lastWarning = (showWarning: ReturnType<typeof vi.fn>): string => String(showWarning.mock.calls.at(-1)?.[0] ?? '');
const outboxEmpty = async (h: ScheduleEngine, matchId: string) => ((await h.store.load(h.value.accountId, matchId))?.pending ?? []).length === 0;

describe('Spiel beenden und Ergebnis eintragen (Spielplan)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    authors.read.mockReset();
    authors.read.mockResolvedValue(new Map());
    holder.read.mockReset();
    holder.read.mockResolvedValue(null);
    role.actor = 'leitung';
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-112 Rückfrage „Spiel 9 läuft noch – Uhr zeigt 2:00 Restzeit. Jetzt mit 3:1 beenden?“, nach „Ja“ ein Eintrag, beendet mit 3:1, Uhr steht', async () => {
    confirmed(h, [anpfiff(480_000)]); // 8:00 gespielt, 2:00 Rest in der ersten Halbzeit
    const { hook, enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(hook.result.current.prompt).toEqual({ kind: 'end', matchNumber: 9, score: '3:1', rest: '2:00', controlledBy: null });
    expect(h.api).not.toHaveBeenCalled();
    await answer('yes');
    expect(await done).toBe(true);
    await settle();

    expect(showWarning).not.toHaveBeenCalled();
    expect(sent(h).map((events) => events.map((e) => e.type))).toEqual([['RESULT_ENTRY']]); // Abpfiff und Ergebnis in EINEM Eintrag
    expect(sent(h)[0][0].payload).toEqual({ scores: { [SV_SUED]: 3, [FC_NORD]: 1 }, basedOn: null });
    expect(state(h, SPIEL_9)?.status).toBe('finished');
    expect(state(h, SPIEL_9)?.clock.running).toBe(false);
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('3:1');
  });

  it('@FU-112 Gegenbeispiel: nach „Nein“ läuft Spiel 9 unverändert weiter, nichts gespeichert', async () => {
    confirmed(h, [anpfiff(480_000)]);
    const { enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer(null);
    expect(await done).toBe(false);

    expect(h.api).not.toHaveBeenCalled();
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
    expect(state(h, SPIEL_9)?.status).toBe('running');
    expect(state(h, SPIEL_9)?.clock.running).toBe(true);
  });

  it('@FU-114 Spielzeit abgelaufen: Rückfrage „Spielzeit abgelaufen – jetzt mit 2:2 beenden?“, nach „Ja“ beendet mit 2:2', async () => {
    confirmed(h, [anpfiff(1_300_000), { ...anpfiff(0), id: 'h1', type: 'SECTION_END', at: NOW - 700_000, clockMs: 600_000, payload: {} },
      { ...anpfiff(0), id: 'h2', type: 'SECTION_START', at: NOW - 640_000, clockMs: 600_000, section: 1, payload: {} }]);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 2, 2);
    await act(async () => { await settle(); });

    expect(state(h, SPIEL_9)?.section).toBe(2);
    expect(hook.result.current.prompt).toMatchObject({ kind: 'end', score: '2:2', rest: null });
    await answer('yes');
    expect(await done).toBe(true);
    await settle();
    expect(state(h, SPIEL_9)?.status).toBe('finished');
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('2:2');
  });

  it('@FU-115 @FU-081 Toms Gerät steuert Feld 2: Hinweis „Feld 2 wird gerade von Tom gesteuert“ in der Rückfrage, danach ohne Übernahme beendet', async () => {
    confirmed(h, [anpfiff(480_000)]);
    holder.read.mockResolvedValue({ field: 2, holder: 'Tom' });
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(holder.read.mock.calls.map((call) => call[2])).toEqual([2]); // Feld von Spiel 9
    expect(hook.result.current.prompt).toMatchObject({ kind: 'end', controlledBy: { field: 2, holder: 'Tom' } });
    await answer('yes');
    expect(await done).toBe(true);
    await settle();
    expect(sent(h).map((events) => events.map((e) => e.type))).toEqual([['RESULT_ENTRY']]); // kein Übernehmen, kein Anpfiff
  });

  it('@FU-113 Helfer: kein „Spiel beenden“, Hinweis wie bisher, nichts gespeichert, Spiel läuft weiter', async () => {
    role.actor = 'helper';
    confirmed(h, [anpfiff(480_000)]);
    const { hook, enter, showWarning } = render(h);
    expect(await enter(SPIEL_9, 3, 1)).toBe(false);

    expect(hook.result.current.prompt).toBeNull();
    expect(lastWarning(showWarning)).toBe('Spiel läuft – Ergebnis erst nach dem Abpfiff');
    expect(holder.read).not.toHaveBeenCalled();
    expect(h.api).not.toHaveBeenCalled();
    expect(state(h, SPIEL_9)?.status).toBe('running');
  });

  it('@FU-116 Toms Tor kam schon an: der Eintrag trägt das Tor als Stand (basedOn)', async () => {
    confirmed(h, [anpfiff(480_000), tor('t1', SV_SUED, 300_000)]);
    const { enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(true);
    await settle();
    expect(sent(h)[0][0].payload).toEqual({ scores: { [SV_SUED]: 3, [FC_NORD]: 1 }, basedOn: 't1' });
  });

  it('@FU-116 Toms Tor zum 1:0 kommt an, während Olli die Rückfrage offen hat → nichts gespeichert, „inzwischen geändert (jetzt 1:0)“, läuft weiter', async () => {
    confirmed(h, [anpfiff(480_000)]);
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    confirmed(h, [tor('t1', SV_SUED, 10_000)], 2);
    await answer('yes');
    expect(await done).toBe(false);

    expect(lastWarning(showWarning)).toBe('Spiel 9 wurde inzwischen geändert (jetzt 1:0)');
    expect(h.api).not.toHaveBeenCalled();
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
    expect(state(h, SPIEL_9)?.status).toBe('running');
  });

  it('@FU-117 ohne Netz: „Geht nur mit Netz“, keine Rückfrage, nichts vorgemerkt, Spiel läuft weiter', async () => {
    confirmed(h, [anpfiff(480_000)]);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { hook, enter, showWarning } = render(h);
    expect(await enter(SPIEL_9, 3, 1)).toBe(false);

    expect(hook.result.current.prompt).toBeNull();
    expect(lastWarning(showWarning)).toBe('Geht nur mit Netz');
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
    expect(state(h, SPIEL_9)?.status).toBe('running');
  });

  it('@FU-118 laufendes Strafstoßschießen: „Strafstoßschießen läuft – im Cockpit zu Ende bringen“, nichts gespeichert', async () => {
    confirmed(h, [anpfiff(700_000, KO_SHOOTOUT), { ...anpfiff(0), id: 'ende', type: 'MATCH_END', at: NOW - 60_000, clockMs: 600_000, payload: {} }]);
    const { hook, enter, showWarning } = render(h);
    expect(await enter(HALBFINALE_1, 1, 1)).toBe(false);

    expect(state(h, HALBFINALE_1)?.status).toBe('shootout');
    expect(hook.result.current.prompt).toBeNull();
    expect(lastWarning(showWarning)).toBe('Strafstoßschießen läuft – im Cockpit zu Ende bringen');
    expect(h.api).not.toHaveBeenCalled();
  });

  it('@FU-094 K.-o.-Unentschieden: nach „Ja“ die Strafstoß-Abfrage, mit 4:3 ein Eintrag mit Strafstoß', async () => {
    confirmed(h, [anpfiff(300_000, KO_SHOOTOUT)]);
    const { hook, enter, answer } = render(h);
    const done = enter(HALBFINALE_1, 2, 2);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt).toMatchObject({ kind: 'end', matchNumber: 11, score: '2:2' });
    await answer('yes');
    expect(hook.result.current.prompt).toMatchObject({ kind: 'shootout', score: '2:2' });
    await answer('4:3');
    expect(await done).toBe(true);
    await settle();

    expect(sent(h)[0][0].payload).toEqual({ scores: { [HEIM]: 2, [GAST]: 2 }, shootout: { [HEIM]: 4, [GAST]: 3 }, basedOn: null });
    expect(state(h, HALBFINALE_1)?.status).toBe('finished');
  });

  it('@FU-094 Gegenbeispiel: ohne Strafstoßergebnis bleibt das Halbfinale laufend, nichts gespeichert', async () => {
    confirmed(h, [anpfiff(300_000, KO_SHOOTOUT)]);
    const { enter, answer } = render(h);
    const done = enter(HALBFINALE_1, 2, 2);
    await act(async () => { await settle(); });
    await answer('yes');
    await answer(null);
    expect(await done).toBe(false);
    expect(h.api).not.toHaveBeenCalled();
    expect(state(h, HALBFINALE_1)?.status).toBe('running');
  });

  it('@FU-080 Gegenbeispiel: geplantes Spiel 9 ohne Rückfrage wie bisher (RESULT_ENTRY ohne basedOn), auch ohne Netz vorgemerkt', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { hook, enter } = render(h);
    expect(await enter(SPIEL_9, 3, 1)).toBe(true);
    expect(hook.result.current.prompt).toBeNull();
    const pending = (await h.store.load(h.value.accountId, SPIEL_9))?.pending ?? [];
    expect(pending.map((e) => e.type)).toEqual(['RESULT_ENTRY']);
    expect(pending[0].payload).toEqual({ scores: { [SV_SUED]: 3, [FC_NORD]: 1 } });
  });

  it('@FU-069 Gegenbeispiel: beendetes Spiel 9 → Korrektur mit Grund wie bisher, kein „Spiel beenden“', async () => {
    confirmed(h, [{ id: 'e1', type: 'RESULT_ENTRY', actor: 'leitung', at: NOW - 60_000, section: null, clockMs: null, teamId: null, payload: { scores: { [SV_SUED]: 2, [FC_NORD]: 1 } } }]);
    // Olli kennt den Stand 2:1 schon (Korrektur vom bekannten Stand, @FU-082).
    await h.engine.ensureMatch(SPIEL_9, { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD }, 'T');
    await h.engine.catchUp(SPIEL_9);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 2, 2);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt).toMatchObject({ kind: 'reason', matchNumber: 9, before: '2:1', after: '2:2' });
    await answer(null);
    expect(await done).toBe(false);
  });
});

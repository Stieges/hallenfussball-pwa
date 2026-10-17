/**
 * A-08f3e2 – Schnelleingabe im Spielplan über Server-Einträge (Plan A-08f3 v4 § 3, Brief A-08f3e2e3).
 * Echter Weg: echter `LocalMatchStore` + `MatchEngine` + `OutboxSender` (Server-RPC gemockt), echte DE-Texte.
 * Werte aus den Gherkin-Szenarien (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * @FU-080, @FU-081, @FU-082, @FU-093, @FU-094 (Teil), @FU-069; Grundpflicht @EK-004 (`2026-10-02_ergebnisse-korrigieren.md:317`).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { MatchCommands, rowToEngineEvent, type EngineEventWithSeq } from '../../../../core/match/client';
import { effectiveScoreFor, type EngineEvent } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import {
  FC_NORD, HALBFINALE_1, NOW, SPIEL_7, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine,
} from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

await initRealDeI18n();

const resultEntry = (id: string, scores: Record<string, number>): EngineEvent =>
  ({ id, type: 'RESULT_ENTRY', actor: 'leitung', at: NOW - 60_000, section: null, clockMs: null, teamId: null, payload: { scores } });
const correction = (id: string, scores: Record<string, number>, basedOn: string): EngineEvent =>
  ({ id, type: 'CORRECTION', actor: 'leitung', at: NOW - 30_000, section: null, clockMs: null, teamId: null, payload: { scores, reason: 'input_error', basedOn } });
// Tom pfeift Spiel 9 an einem anderen Gerät an (Regeln wie vom Server gesetzt).
const anpfiff: EngineEvent = { id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - 120_000, section: 1, clockMs: 0, teamId: null, payload: { rules: RULES } };
const seq = (event: EngineEvent, n: number): EngineEventWithSeq => ({ ...event, seq: n });

function render(h: ScheduleEngine, options: { lockFinishedResults?: boolean; matches?: Parameters<typeof scheduleTournament>[0] } = {}) {
  const onMatchesUpdate = vi.fn();
  const showWarning = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>
  );
  const hook = renderHook(
    () => useScheduleResultEntry({ tournament: scheduleTournament(options.matches), onMatchesUpdate, showWarning, lockFinishedResults: options.lockFinishedResults ?? false }),
    { wrapper },
  );
  /** Startet die Eingabe; Rückfragen beantwortet der Test selbst. */
  const enter = (matchId: string, a: number, b: number) => {
    let done: Promise<void> = Promise.resolve();
    act(() => { done = hook.result.current.enterScore(matchId, a, b); });
    return done;
  };
  const answer = async (value: string | null) => {
    await act(async () => { hook.result.current.answerPrompt(value); await settle(); });
  };
  return { hook, enter, answer, onMatchesUpdate, showWarning };
}

const sentTypes = (h: ScheduleEngine): string[][] => h.api.mock.calls.map(([, events]) => events.map((event) => event.type));
const outbox = async (h: ScheduleEngine, matchId: string) => h.store.load(h.value.accountId, matchId);
const status = (h: ScheduleEngine, matchId: string) => h.engine.view(matchId)?.result.state.status;
const scoreOf = (h: ScheduleEngine, matchId: string, teamA: string, teamB: string) => {
  const state = h.engine.view(matchId)?.result.state;
  return state ? `${effectiveScoreFor(state, teamA)}:${effectiveScoreFor(state, teamB)}` : '';
};
const lastWarning = (showWarning: ReturnType<typeof vi.fn>): string => String(showWarning.mock.calls.at(-1)?.[0] ?? '');

describe('A-08f3e2 Schnelleingabe über Server-Einträge', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-080 Spiel 9 geplant, Olli trägt 3:1 ein → RESULT_ENTRY, beendet mit 3:1', async () => {
    const { enter, showWarning } = render(h);
    await enter(SPIEL_9, 3, 1);
    await settle();

    expect(showWarning).not.toHaveBeenCalled();
    expect(sentTypes(h)).toEqual([['RESULT_ENTRY']]);
    expect(h.api.mock.calls[0][1][0].payload).toEqual({ scores: { [SV_SUED]: 3, [FC_NORD]: 1 } });
    expect(status(h, SPIEL_9)).toBe('finished');
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('3:1');
  });

  it('@FU-081 Gegenbeispiel: Spiel 9 läuft am Server (fremdes Gerät) → „Spiel läuft“, Ausgang leer', async () => {
    h.fetchConfirmed.mockResolvedValueOnce({
      events: [seq(anpfiff, 1)],
      newWatermark: 1,
    });
    const { enter, showWarning } = render(h);
    await enter(SPIEL_9, 3, 1);
    await settle();

    expect(lastWarning(showWarning)).toBe('Spiel läuft – Ergebnis erst nach dem Abpfiff');
    expect((await outbox(h, SPIEL_9))?.pending).toEqual([]);
    expect(h.api).not.toHaveBeenCalled();
  });

  // Rest von @FU-081 (Gerätename, „Spielleitung übernehmen“) gehört zu A-34/B-49 (Brief A-08f3e2e3 § 1).
  it.fails('@FU-081 Rest (A-34/B-49): Ablehnung nennt „Feld 2 wird von Tom gesteuert“', async () => {
    h.fetchConfirmed.mockResolvedValueOnce({
      events: [seq(anpfiff, 1)],
      newWatermark: 1,
    });
    const { enter, showWarning } = render(h);
    await enter(SPIEL_9, 3, 1);
    expect(lastWarning(showWarning)).toBe('Spiel läuft – Feld 2 wird von Tom gesteuert');
  });

  it('N-4: lokal geplant, Engine nach catchUp beendet → correct (mit Grund), nicht enterResult', async () => {
    const enterSpy = vi.spyOn(MatchCommands.prototype, 'enterResult');
    const correctSpy = vi.spyOn(MatchCommands.prototype, 'correct');
    h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(resultEntry('e1', { [SV_SUED]: 2, [FC_NORD]: 1 }), 1)], newWatermark: 1 });
    const { hook, enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });

    expect(hook.result.current.prompt).toMatchObject({ kind: 'reason', matchNumber: 9, before: '2:1', after: '3:1' });
    await answer('input_error');
    await done;

    expect(enterSpy).not.toHaveBeenCalled();
    expect(correctSpy).toHaveBeenCalledTimes(1);
    // Die Turnierleitung kannte das 2:1 nicht -- STALE_BASE statt stillem Überschreiben.
    expect(lastWarning(showWarning)).toBe('Spiel 9 wurde inzwischen geändert (jetzt 2:1)');
  });

  describe('@FU-082 Zwei Korrekturen vom selben Stand', () => {
    async function mariaSieht21() {
      // Spiel 7 endete 2:1; Marias Gerät hat diesen Stand geladen.
      h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(resultEntry('e1', { [FC_NORD]: 2, [SV_SUED]: 1 }), 1)], newWatermark: 1 });
      await h.engine.ensureMatch(SPIEL_7, { matchId: SPIEL_7, teamAId: FC_NORD, teamBId: SV_SUED }, 'T');
      await h.engine.catchUp(SPIEL_7);
    }

    it('@FU-082 Olli korrigiert auf 2:2, danach Maria auf 3:1 → abgelehnt mit aktuellem Stand 2:2', async () => {
      await mariaSieht21();
      h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(correction('e2', { [FC_NORD]: 2, [SV_SUED]: 2 }, 'e1'), 2)], newWatermark: 2 });
      const { enter, answer, showWarning } = render(h);
      const done = enter(SPIEL_7, 3, 1);
      await act(async () => { await settle(); });
      await answer('input_error');
      await done;

      expect(lastWarning(showWarning)).toBe('Spiel 7 wurde inzwischen geändert (jetzt 2:2)');
      expect((await outbox(h, SPIEL_7))?.pending).toEqual([]);
      expect(scoreOf(h, SPIEL_7, FC_NORD, SV_SUED)).toBe('2:2');
    });

    // Befund C-EREIGNIS-OHNE-URHEBER: `match_events` speichert keinen Urheber, `rowToEngineEvent` kennt keinen Namen.
    it.fails('@FU-082 Text nennt den Namen: „Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)“', async () => {
      await mariaSieht21();
      const row = { id: 'e2', type: 'CORRECTION', client_time: null, recorded_at: new Date(NOW).toISOString(), section: null, clock_ms: null, team_id: null, target_event_id: null, payload: { scores: { [FC_NORD]: 2, [SV_SUED]: 2 }, reason: 'input_error', basedOn: 'e1' }, seq: 2, event_format: 1, review_state: null };
      h.fetchConfirmed.mockResolvedValueOnce({ events: [rowToEngineEvent(row)], newWatermark: 2 });
      const { enter, answer, showWarning } = render(h);
      const done = enter(SPIEL_7, 3, 1);
      await act(async () => { await settle(); });
      await answer('input_error');
      await done;
      expect(lastWarning(showWarning)).toBe('Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)');
    });

    it('@FU-082 Gegenbeispiel: Olli korrigiert vom aktuellen Stand 2:1 auf 2:2 → CORRECTION angenommen', async () => {
      await mariaSieht21();
      const { enter, answer, showWarning } = render(h);
      const done = enter(SPIEL_7, 2, 2);
      await act(async () => { await settle(); });
      await answer('referee_decision');
      await done;
      await settle();

      expect(showWarning).not.toHaveBeenCalled();
      expect(sentTypes(h)).toEqual([['CORRECTION']]);
      expect(h.api.mock.calls[0][1][0].payload).toMatchObject({ reason: 'referee_decision', basedOn: 'e1' });
      expect(scoreOf(h, SPIEL_7, FC_NORD, SV_SUED)).toBe('2:2');
    });
  });

  describe('@FU-093 Ein abgesetztes Spiel bekommt nach Rückfrage ein Ergebnis', () => {
    async function spiel9Abgesetzt(): Promise<void> {
      await h.engine.ensureMatch(SPIEL_9, { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD }, 'T');
      const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
      await commands.skip(SPIEL_9, { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD }, 'leitung');
      await settle();
      h.api.mockClear();
    }

    it('@FU-093 Rückfrage, nach „Ja“ beendet mit 3:1 (ein Stapel UNSKIP + RESULT_ENTRY)', async () => {
      await spiel9Abgesetzt();
      const { hook, enter, answer } = render(h);
      const done = enter(SPIEL_9, 3, 1);
      await act(async () => { await settle(); });
      expect(hook.result.current.prompt).toEqual({ kind: 'unskip', matchNumber: 9 });

      await answer('yes');
      await done;
      await settle();
      expect(sentTypes(h)).toEqual([['UNSKIP', 'RESULT_ENTRY']]);
      expect(status(h, SPIEL_9)).toBe('finished');
      expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('3:1');
    });

    it('@FU-093 Gegenbeispiel: nach „Nein“ bleibt Spiel 9 abgesetzt und ohne Ergebnis', async () => {
      await spiel9Abgesetzt();
      const { enter, answer } = render(h);
      const done = enter(SPIEL_9, 3, 1);
      await act(async () => { await settle(); });
      await answer(null);
      await done;

      expect(h.api).not.toHaveBeenCalled();
      expect((await outbox(h, SPIEL_9))?.pending).toEqual([]);
      expect(status(h, SPIEL_9)).toBe('skipped');
    });

    it('@FU-093 H1 (B-07a): Server nimmt UNSKIP an, lehnt RESULT_ENTRY ab → Spiel geplant ohne Ergebnis, Eintrag in der Ablehnungsliste', async () => {
      await spiel9Abgesetzt();
      h.api.mockImplementationOnce(async (_matchId, events) => ({
        results: [{ id: events[0].id, status: 'accepted' }, { id: events[1].id, status: 'rejected', code: 'INVALID_TRANSITION' }],
        state: null,
        serverTime: 1,
      }));
      const { enter, answer } = render(h);
      const done = enter(SPIEL_9, 3, 1);
      await act(async () => { await settle(); });
      await answer('yes');
      await done;
      await settle();

      const copy = await outbox(h, SPIEL_9);
      expect(copy?.rejected.map((entry) => [entry.event.type, entry.code])).toEqual([['RESULT_ENTRY', 'INVALID_TRANSITION']]);
      expect(status(h, SPIEL_9)).toBe('scheduled');
    });
  });

  describe('@FU-094 K.-o.-Unentschieden im Direkteintrag', () => {
    it('@FU-094 ohne Strafstoßergebnis speichert die App das Unentschieden nicht (Halbfinale 1, 2:2)', async () => {
      const { enter, showWarning } = render(h);
      await enter(HALBFINALE_1, 2, 2);
      await settle();

      expect(lastWarning(showWarning)).toBe(
        'Unentschieden im K.-o.-Spiel – das Ergebnis mit Strafstoßschießen bitte im Cockpit eintragen. Nichts gespeichert.',
      );
      expect(await outbox(h, HALBFINALE_1)).toBeNull();
      expect(h.api).not.toHaveBeenCalled();
    });

    it('@FU-094 Gegenbeispiel: Gruppenspiel 7 mit 2:2 wird ohne Abfrage gespeichert', async () => {
      const { enter, showWarning } = render(h);
      await enter(SPIEL_7, 2, 2);
      await settle();

      expect(showWarning).not.toHaveBeenCalled();
      expect(sentTypes(h)).toEqual([['RESULT_ENTRY']]);
      expect(scoreOf(h, SPIEL_7, FC_NORD, SV_SUED)).toBe('2:2');
    });

    // Befund C-DIREKTEINTRAG-OHNE-STRAFSTOSS: `RESULT_ENTRY` kennt kein Strafstoßergebnis -> Paket A-25a (F2, 28.10.).
    it.fails('@FU-094 die App fragt zusätzlich nach dem Ergebnis des Strafstoßschießens (4:3 → Sieger Heimteam)', async () => {
      const { hook, enter } = render(h);
      void enter(HALBFINALE_1, 2, 2);
      await act(async () => { await settle(); });
      expect(hook.result.current.prompt?.kind).toBe('shootout');
    });
  });

  describe('Beendetes Spiel: Korrektur mit Grund (@FU-069, @EK-004)', () => {
    async function spiel7Beendet21() {
      h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(resultEntry('e1', { [FC_NORD]: 2, [SV_SUED]: 1 }), 1)], newWatermark: 1 });
      await h.engine.ensureMatch(SPIEL_7, { matchId: SPIEL_7, teamAId: FC_NORD, teamBId: SV_SUED }, 'T');
      await h.engine.catchUp(SPIEL_7);
    }

    it('@FU-069 beendetes Spiel 7: kein RESULT_ENTRY am Cockpit vorbei, nur CORRECTION mit Grund', async () => {
      await spiel7Beendet21();
      const enterSpy = vi.spyOn(MatchCommands.prototype, 'enterResult');
      const { enter, answer } = render(h);
      const done = enter(SPIEL_7, 2, 2);
      await act(async () => { await settle(); });
      await answer('input_error');
      await done;
      await settle();

      expect(enterSpy).not.toHaveBeenCalled();
      expect(sentTypes(h)).toEqual([['CORRECTION']]);
    });

    it('@EK-004 Abbruch der Grund-Auswahl → nichts gespeichert, Spiel 7 steht weiter mit 2:1', async () => {
      await spiel7Beendet21();
      const { enter, answer } = render(h);
      const done = enter(SPIEL_7, 2, 2);
      await act(async () => { await settle(); });
      await answer(null);
      await done;

      expect(h.api).not.toHaveBeenCalled();
      expect((await outbox(h, SPIEL_7))?.pending).toEqual([]);
      expect(scoreOf(h, SPIEL_7, FC_NORD, SV_SUED)).toBe('2:1');
    });

    it('Einstellung „beendete Ergebnisse sperren“: Hinweis, keine Rückfrage, nichts gespeichert', async () => {
      await spiel7Beendet21();
      const { hook, enter, showWarning } = render(h, { lockFinishedResults: true });
      await enter(SPIEL_7, 2, 2);

      expect(hook.result.current.prompt).toBeNull();
      expect(lastWarning(showWarning)).toContain('bereits beendet');
      expect(h.api).not.toHaveBeenCalled();
    });
  });

  it('Spiel ohne zwei feststehende Teams → Hinweis, keine Engine-Kopie', async () => {
    const ensure = vi.spyOn(h.engine, 'ensureMatch');
    const { enter, showWarning } = render(h, { matches: { [SPIEL_9]: { slotB: { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 1 } } } } });
    await enter(SPIEL_9, 3, 1);

    expect(lastWarning(showWarning)).toBe('Ergebnis erst, wenn beide Teams feststehen');
    expect(ensure).not.toHaveBeenCalled();
  });
});

describe('A-08f3e2 Gast', () => {
  it('Gast: Eintrag sofort lokal bestätigt, kein Server-Aufruf', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const h = await makeScheduleEngine('guest');
    const { enter } = render(h);
    await enter(SPIEL_9, 3, 1);
    await settle();

    const copy = await h.store.load('guest', SPIEL_9);
    expect(copy?.confirmed.map((event) => event.type)).toEqual(['RESULT_ENTRY']);
    expect(copy?.pending).toEqual([]);
    expect(h.api).not.toHaveBeenCalled();
    expect(scoreOf(h, SPIEL_9, SV_SUED, FC_NORD)).toBe('3:1');
    vi.unstubAllGlobals();
  });
});

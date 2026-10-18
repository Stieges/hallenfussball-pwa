/**
 * A-08f3e2 – Schnelleingabe im Spielplan über Server-Einträge (Plan A-08f3 v4 § 3, Brief A-08f3e2e3).
 * Echter Weg: echter `LocalMatchStore` + `MatchEngine` + `OutboxSender` (Server-RPC gemockt), echte DE-Texte.
 * Werte aus den Gherkin-Szenarien (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * @FU-080, @FU-081, @FU-082, @FU-093, @FU-094 (A-25a: Strafstoß-Abfrage), @FU-069; Grundpflicht @EK-004 (`2026-10-02_ergebnisse-korrigieren.md:317`).
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
// UR: Antwort der Lesefunktion match_event_author_names (Server), je Test gesetzt; Standard: keine Namen.
const authors = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../../core/repositories/eventAuthorNamesRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../core/repositories/eventAuthorNamesRpc')>()),
  readEventAuthorNames: authors.read,
}));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { MatchCommands, rowToEngineEvent, type EngineEventWithSeq } from '../../../../core/match/client';
import { effectiveScoreFor, type EngineEvent } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import {
  FC_NORD, GAST, HALBFINALE_1, HEIM, NOW, SPIEL_7, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine,
} from '../../../../test/scheduleEngineHarness';
import { cacheColumns } from '../../../../core/match/client/cacheColumns';
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
  const showWarning = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>
  );
  const hook = renderHook(
    () => useScheduleResultEntry({ tournament: scheduleTournament(options.matches), showWarning, lockFinishedResults: options.lockFinishedResults ?? false }),
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
  return { hook, enter, answer, showWarning };
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
    authors.read.mockReset();
    authors.read.mockResolvedValue(new Map());
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

  // Fixrunde 1 (M-1): Die Turnierleitung kannte das 2:1 nicht -- statt einer Grund-Rückfrage, die sicher scheitert,
  // sofort der aktuelle Stand (@FU-082: „Spiel … wurde inzwischen … geändert (jetzt …)“), nie stilles Überschreiben.
  it('N-4: lokal geplant, Engine nach catchUp beendet 2:1 → kein enterResult, keine Rückfrage, sofort „inzwischen geändert (jetzt 2:1)“', async () => {
    const enterSpy = vi.spyOn(MatchCommands.prototype, 'enterResult');
    h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(resultEntry('e1', { [SV_SUED]: 2, [FC_NORD]: 1 }), 1)], newWatermark: 1 });
    const { hook, enter, showWarning } = render(h);
    await enter(SPIEL_9, 3, 1);

    expect(hook.result.current.prompt).toBeNull();
    expect(enterSpy).not.toHaveBeenCalled();
    expect(lastWarning(showWarning)).toBe('Spiel 9 wurde inzwischen geändert (jetzt 2:1)');
    expect((await outbox(h, SPIEL_9))?.pending).toEqual([]);
    expect(h.api).not.toHaveBeenCalled();
  });

  describe('@HE-042 Helfer dürfen den Spielbetrieb, sonst nichts (Direkteintrag/Korrektur nur Turnierleitung)', () => {
    afterEach(() => { role.actor = 'leitung'; });

    it('@HE-042 Helfer trägt im Spielplan 3:1 für das geplante Spiel 9 ein → „nur Turnierleitung“, nichts gespeichert', async () => {
      role.actor = 'helper';
      const { enter, showWarning } = render(h);
      await enter(SPIEL_9, 3, 1);

      expect(lastWarning(showWarning)).toBe('nur Turnierleitung');
      expect((await outbox(h, SPIEL_9))?.pending).toEqual([]);
      expect(h.api).not.toHaveBeenCalled();
    });

    it('@HE-042 Helfer will das beendete Spiel 7 korrigieren → „Korrektur nur durch die Turnierleitung“, keine Grund-Rückfrage', async () => {
      role.actor = 'helper';
      h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(resultEntry('e1', { [FC_NORD]: 2, [SV_SUED]: 1 }), 1)], newWatermark: 1 });
      const { hook, enter, showWarning } = render(h);
      await enter(SPIEL_7, 2, 2);

      expect(hook.result.current.prompt).toBeNull();
      expect(lastWarning(showWarning)).toBe('Korrektur nur durch die Turnierleitung');
      expect(h.api).not.toHaveBeenCalled();
    });
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
      const { hook, enter, showWarning } = render(h);
      await enter(SPIEL_7, 3, 1);

      expect(hook.result.current.prompt).toBeNull();
      expect(lastWarning(showWarning)).toBe('Spiel 7 wurde inzwischen geändert (jetzt 2:2)');
      expect((await outbox(h, SPIEL_7))?.pending).toEqual([]);
      expect(scoreOf(h, SPIEL_7, FC_NORD, SV_SUED)).toBe('2:2');
    });

    // UR (C-EREIGNIS-OHNE-URHEBER): der Urheber steht am Server (match_event_authors), der Name kommt über die
    // Lesefunktion match_event_author_names -- hier ihre Antwort: Eintrag e2 stammt von Olli.
    it('@FU-082 Text nennt den Namen: „Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)“', async () => {
      authors.read.mockResolvedValue(new Map([['e2', { name: 'Olli', role: 'owner' }]]));
      await mariaSieht21();
      const row = { id: 'e2', type: 'CORRECTION', client_time: null, recorded_at: new Date(NOW).toISOString(), section: null, clock_ms: null, team_id: null, target_event_id: null, payload: { scores: { [FC_NORD]: 2, [SV_SUED]: 2 }, reason: 'input_error', basedOn: 'e1' }, seq: 2, event_format: 1, review_state: null };
      h.fetchConfirmed.mockResolvedValueOnce({ events: [rowToEngineEvent(row)], newWatermark: 2 });
      const { enter, showWarning } = render(h);
      await enter(SPIEL_7, 3, 1);
      expect(lastWarning(showWarning)).toBe('Spiel 7 wurde inzwischen von Olli geändert (jetzt 2:2)');
      expect(authors.read.mock.calls.map((call) => call[1])).toContain(SPIEL_7);
    });

    it('@FU-082 Gegenbeispiel: Lesefunktion scheitert → „Spiel 7 wurde inzwischen geändert (jetzt 2:2)“, keine Fehlermeldung', async () => {
      authors.read.mockRejectedValue(new Error('Zeitlimit'));
      await mariaSieht21();
      h.fetchConfirmed.mockResolvedValueOnce({ events: [seq(correction('e2', { [FC_NORD]: 2, [SV_SUED]: 2 }, 'e1'), 2)], newWatermark: 2 });
      const { enter, showWarning } = render(h);
      await enter(SPIEL_7, 3, 1);
      expect(showWarning).toHaveBeenCalledTimes(1);
      expect(lastWarning(showWarning)).toBe('Spiel 7 wurde inzwischen geändert (jetzt 2:2)');
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
      const batch = vi.spyOn(h.store, 'addPendingBatch');
      const { hook, enter, answer } = render(h);
      const done = enter(SPIEL_9, 3, 1);
      await act(async () => { await settle(); });
      expect(hook.result.current.prompt).toEqual({ kind: 'unskip', matchNumber: 9 });

      await answer('yes');
      await done;
      await settle();
      expect(sentTypes(h)).toEqual([['UNSKIP', 'RESULT_ENTRY']]);
      // R12: ein Stapel in EINER Speicher-Transaktion -- ein abgelehntes UNSKIP nimmt den Eintrag mit.
      expect(batch).toHaveBeenCalledTimes(1);
      expect(batch.mock.calls[0][2].map((event) => event.type)).toEqual(['UNSKIP', 'RESULT_ENTRY']);
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

  describe('@FU-094 K.-o.-Unentschieden im Direkteintrag (A-25a)', () => {
    /** Olli trägt 2:2 für das Halbfinale 1 ein (Turnierregel K.-o.: Strafstoßschießen) und wartet auf die Abfrage. */
    async function halbfinale22() {
      const view = render(h);
      const done = view.enter(HALBFINALE_1, 2, 2);
      await act(async () => { await settle(); });
      return { ...view, done };
    }

    it('@FU-094 fragt zusätzlich nach dem Ergebnis des Strafstoßschießens (Halbfinale 1, 2:2)', async () => {
      const { hook, answer, done } = await halbfinale22();
      expect(hook.result.current.prompt).toEqual({
        kind: 'shootout', matchNumber: 11, score: '2:2', homeName: 'Heimteam', awayName: 'Auswärtsteam',
      });
      expect(h.api).not.toHaveBeenCalled();
      await answer(null);
      await done;
    });

    it('@FU-094 ohne Angabe des Strafstoßergebnisses speichert die App das Unentschieden nicht', async () => {
      const { answer, done, showWarning } = await halbfinale22();
      await answer(null);
      await done;
      await settle();

      expect((await outbox(h, HALBFINALE_1))?.pending ?? []).toEqual([]);
      expect(h.api).not.toHaveBeenCalled();
      expect(status(h, HALBFINALE_1)).toBe('scheduled');
      expect(showWarning).not.toHaveBeenCalled();
    });

    it('@FU-094 nach „4:3 für das Heimteam“ ist das Halbfinale beendet mit 2:2 und Sieger Heimteam', async () => {
      const { answer, done } = await halbfinale22();
      await answer('4:3');
      await done;
      await settle();

      expect(sentTypes(h)).toEqual([['RESULT_ENTRY']]);
      expect(h.api.mock.calls[0][1][0].payload).toEqual({ scores: { [HEIM]: 2, [GAST]: 2 }, shootout: { [HEIM]: 4, [GAST]: 3 } });
      expect(status(h, HALBFINALE_1)).toBe('finished');
      const state = h.engine.view(HALBFINALE_1)?.result.state;
      expect(state && cacheColumns(state, { matchId: HALBFINALE_1, teamAId: HEIM, teamBId: GAST })).toMatchObject({
        score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty',
      });
    });

    it('@FU-094 Fehlerfall: der Server lehnt den Eintrag ab → Eintrag in der Ablehnungsliste, Halbfinale bleibt geplant', async () => {
      h.api.mockImplementationOnce(async (_matchId, events) => ({
        results: [{ id: events[0].id, status: 'rejected', code: 'INVALID_PAYLOAD', detail: { reason: 'SHOOTOUT_REQUIRED' } }],
        state: null,
        serverTime: 1,
      }));
      const { hook, answer, done } = await halbfinale22();
      // Vorbedingung (Review A-25a K1): die Abfrage erschien, und gesendet wurde der Eintrag MIT Strafstoßergebnis.
      expect(hook.result.current.prompt?.kind).toBe('shootout');
      await answer('4:3');
      await done;
      await settle();
      expect(h.api).toHaveBeenCalledTimes(1);
      expect(h.api.mock.calls[0][1][0].payload).toEqual({ scores: { [HEIM]: 2, [GAST]: 2 }, shootout: { [HEIM]: 4, [GAST]: 3 } });

      const copy = await outbox(h, HALBFINALE_1);
      expect(copy?.rejected.map((entry) => [entry.event.type, entry.code])).toEqual([['RESULT_ENTRY', 'INVALID_PAYLOAD']]);
      expect(status(h, HALBFINALE_1)).toBe('scheduled');
    });

    it('@FU-094 Gegenbeispiel: Gruppenspiel 7 mit 2:2 wird ohne Abfrage gespeichert', async () => {
      const { hook, enter, showWarning } = render(h);
      await enter(SPIEL_7, 2, 2);
      await settle();

      expect(hook.result.current.prompt).toBeNull();
      expect(showWarning).not.toHaveBeenCalled();
      expect(sentTypes(h)).toEqual([['RESULT_ENTRY']]);
      expect(h.api.mock.calls[0][1][0].payload).toEqual({ scores: { [FC_NORD]: 2, [SV_SUED]: 2 } });
      expect(scoreOf(h, SPIEL_7, FC_NORD, SV_SUED)).toBe('2:2');
    });

    it('@FU-094 Gegenbeispiel: Halbfinale 1 mit 3:2 wird ohne Abfrage gespeichert', async () => {
      const { hook, enter } = render(h);
      await enter(HALBFINALE_1, 3, 2);
      await settle();

      expect(hook.result.current.prompt).toBeNull();
      expect(sentTypes(h)).toEqual([['RESULT_ENTRY']]);
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

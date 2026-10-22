/**
 * Spiel beenden und Ergebnis eintragen im Spielplan (20261110_009, Variante A). Echter Weg wie
 * useScheduleResultEntry.test.tsx: echter `LocalMatchStore` + `MatchEngine` + `OutboxSender` (Server-RPC gemockt), echte
 * DE-Texte. Werte aus dem Gherkin (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`): @FU-112, @FU-113, @FU-114,
 * @FU-115, @FU-116, @FU-117, @FU-118, @FU-081 (präzisiert), @FU-094; Gegenbeispiele @FU-080 (geplant) und @FU-069 (beendet).
 * Review H2: der Notweg sendet SOFORT (am Ausgang vorbei); der Server bestätigt, der Abgleich (`fetchConfirmed`) liefert den
 * Eintrag zurück (`echoSent`). Scheitert das Senden: „Nicht gesendet – bitte erneut versuchen“, nichts vorgemerkt. H3: Gast lokal.
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
import { MatchCommands, type EngineEventWithSeq } from '../../../../core/match/client';
import { effectiveScoreFor, type EngineEvent, type MatchRules } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import {
  FC_NORD, GAST, HALBFINALE_1, HEIM, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine,
} from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';
import { networkError } from '../../../../core/match/client/__tests__/outboxHarness';

await initRealDeI18n();

const KO_SHOOTOUT: MatchRules = { ...RULES, knockout: true, tiebreak: 'shootout', sections: 1 };
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
    echoSent(h);
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

  it('Review H2: Senden scheitert (Netz) → „Nicht gesendet – bitte erneut versuchen“, nichts vorgemerkt, Spiel läuft weiter', async () => {
    confirmed(h, [anpfiff(480_000)]);
    h.api.mockRejectedValueOnce(networkError());
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(false);

    expect(lastWarning(showWarning)).toBe('Nicht gesendet – bitte erneut versuchen');
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
    expect(state(h, SPIEL_9)?.status).toBe('running');
  });

  it('Review H2: Server lehnt ab (Tor kam am Server vorher an, STALE_BASE) → „inzwischen geändert (jetzt 1:0)“, nichts vorgemerkt', async () => {
    confirmed(h, [anpfiff(480_000)]);
    h.api.mockResolvedValueOnce({ results: [{ id: null, status: 'rejected', code: 'STALE_BASE', detail: { currentScores: { [SV_SUED]: 1, [FC_NORD]: 0 }, lastScoreEventId: 't1' } }], state: null, serverTime: NOW });
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(false);

    expect(lastWarning(showWarning)).toBe('Spiel 9 wurde inzwischen geändert (jetzt 1:0)');
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
  });

  it('Review H3: Gast (nur lokal) ohne Netz → Rückfrage trotzdem, nach „Ja“ lokal beendet, kein Server-Aufruf', async () => {
    h.engine.stop();
    h = await makeScheduleEngine('guest');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: 'guest' });
    const ctx = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };
    await h.engine.ensureMatch(SPIEL_9, ctx, 'T');
    await commands.start(SPIEL_9, ctx, 'leitung', RULES);
    const { hook, enter, answer } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt).toMatchObject({ kind: 'end', score: '3:1' });
    await answer('yes');
    expect(await done).toBe(true);
    expect(h.api).not.toHaveBeenCalled();
    expect(state(h, SPIEL_9)?.status).toBe('finished');
  });

  // @FU-116 Z. 2: Toms Tor, das nach Ollis Eintrag ankommt, gehört in die Klärungsliste der Turnierleitung. Heute lehnt der
  // Server mit MATCH_FINISHED ab, und der Eintrag steht nur in Toms eigener Ablehnungsliste (nur „Verwerfen“).
  it.fails('@FU-116 Z. 2 Toms verspätetes Tor steht in der Klärungsliste der Turnierleitung (C-KLAERUNGSLISTE-OHNE-PAKET)', async () => {
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    const ctx = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };
    await h.engine.ensureMatch(SPIEL_9, ctx, 'T');
    await commands.start(SPIEL_9, ctx, 'helper', RULES);
    await settle();
    h.api.mockResolvedValueOnce({ results: [{ id: null, status: 'rejected', code: 'MATCH_FINISHED' }], state: null, serverTime: NOW });
    const goalId = await commands.goal(SPIEL_9, ctx, 'helper', SV_SUED, false);
    await settle();
    const copy = await h.store.load(h.value.accountId, SPIEL_9);
    expect(copy?.review.map((e) => e.id)).toContain(goalId);
  });

  // --- Nachblick N2: wartende Einträge im Ausgang zuerst senden ------------------------------------------------------
  async function wartendImAusgang(art: 'tor' | 'karte'): Promise<string | null> {
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    const ctx = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };
    await h.engine.ensureMatch(SPIEL_9, ctx, 'T');
    await h.engine.catchUp(SPIEL_9);
    h.api.mockRejectedValueOnce(networkError()); // das Tor bzw. die Karte bleibt ohne Netz im Ausgang
    const id = art === 'tor'
      ? await commands.goal(SPIEL_9, ctx, 'leitung', SV_SUED, false)
      : await commands.card(SPIEL_9, ctx, 'leitung', FC_NORD, 'YELLOW_CARD');
    await settle();
    expect(await outboxEmpty(h, SPIEL_9)).toBe(false);
    return id;
  }

  it('N2 wartendes Tor: zuerst gesendet, dann das Ende auf dem Stand mit dem Tor (basedOn = Tor)', async () => {
    confirmed(h, [anpfiff(480_000)]);
    const torId = await wartendImAusgang('tor');
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(true);
    await settle();

    expect(showWarning).not.toHaveBeenCalled();
    const gesendet = sent(h).filter((_c, i) => h.api.mock.settledResults[i]?.type === 'fulfilled').map((events) => events.map((e) => e.type));
    expect(gesendet).toEqual([['GOAL'], ['RESULT_ENTRY']]); // das Tor vor dem Ende
    expect(sent(h).at(-1)?.[0].payload).toMatchObject({ basedOn: torId });
  });

  it('N2 wartende Karte, Senden scheitert weiter → „Erst ausstehende Einträge senden – bitte gleich noch einmal“, kein Ende gesendet', async () => {
    confirmed(h, [anpfiff(480_000)]);
    await wartendImAusgang('karte');
    h.api.mockRejectedValue(networkError()); // auch beim Nachsenden kein Netz
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(false);

    expect(lastWarning(showWarning)).toBe('Erst ausstehende Einträge senden – bitte gleich noch einmal');
    expect(sent(h).flat().map((e) => e.type)).not.toContain('RESULT_ENTRY');
    expect(state(h, SPIEL_9)?.status).toBe('running');
  });

  // --- Nachblick N3 ------------------------------------------------------------------------------------------------
  it('N3 Netzfehler, aber der Server hat schon gespeichert → Abgleich, das Ende gilt, keine Fehlermeldung', async () => {
    confirmed(h, [anpfiff(480_000)]);
    echoSent(h, true);
    h.api.mockRejectedValueOnce(networkError());
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(true);
    expect(showWarning).not.toHaveBeenCalled();
    expect(state(h, SPIEL_9)?.status).toBe('finished');
  });

  it('N3 veraltete App (CLIENT_OUTDATED) → Update-Hinweis „App aktualisieren“, nichts gesendet', async () => {
    confirmed(h, [anpfiff(480_000)]);
    h.api.mockResolvedValueOnce({ error: 'CLIENT_OUTDATED', minClientFormat: 9, serverTime: NOW });
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(false);
    expect(lastWarning(showWarning)).toBe('App aktualisieren');
    expect(await outboxEmpty(h, SPIEL_9)).toBe(true);
  });

  it('N3 angenommen, der Abgleich danach scheitert → keine Fehlermeldung, das Ende gilt', async () => {
    confirmed(h, [anpfiff(480_000)]);
    h.fetchConfirmed.mockImplementation(async (_matchId: string, watermark: number) => {
      if (h.api.mock.calls.length > 0) { throw new Error('Netz weg'); }
      return { events: [], newWatermark: watermark };
    });
    const { enter, answer, showWarning } = render(h);
    const done = enter(SPIEL_9, 3, 1);
    await act(async () => { await settle(); });
    await answer('yes');
    expect(await done).toBe(true);
    expect(showWarning).not.toHaveBeenCalled();
    expect(sent(h).map((events) => events.map((e) => e.type))).toEqual([['RESULT_ENTRY']]);
  });
});

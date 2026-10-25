/**
 * R3-2a, Ausgang der Spiel-Einträge nach dem Turnierabschluss (Migration 20261113_003, R-EA-5: `append_match_events` →
 * `closed_intake` bewahrt neue Einträge in `late_entries` auf und antwortet `review` mit Code AFTER_FINISH).
 *
 * Szenarien:
 * - @FU-018: Tom hat ohne Netz ein Tor eingetragen, Olli hat danach abgeschlossen; hat Toms Gerät wieder Netz, zählt das Tor
 *   nicht, der Eintrag wird aufbewahrt, Toms Gerät zeigt „an die Turnierleitung übergeben“.
 * - @LZ-039: ein Eintrag ohne Netz, der erst nach dem Abschluss ankommt, ändert den Endstand nicht (vor oder nach dem Abschluss
 *   eingetragen – die Antwort ist dieselbe).
 * - @LZ-030: Marias Korrektur kommt kurz nach dem Abschluss an → nicht übernommen.
 * Grenzfall (Plan K6, „nie wiederholen“): wirft der Server im Wettlauf mit dem Abschluss 55000 TOURNAMENT_FINISHED, bleibt der
 * Eintrag im Ausgang (nicht MATCH_GONE, nichts verworfen) und der nächste Versuch bekommt AFTER_FINISH – danach kein Versuch mehr.
 * Gegenbeispiel: 55000 „Spiel nicht mehr beschreibbar“ (Turnier gelöscht) bleibt MATCH_GONE.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { idsIn, makeHarness, rejectedIn, resultOf, rpcError, success, type Harness } from './outboxHarness';

const TURNIER = 'live-cup';

async function seed(h: Harness, matchId: string, ids: string[]): Promise<void> {
  await h.store.create('acc', matchId, ctx, TURNIER);
  for (const [index, id] of ids.entries()) {
    await h.store.addPending('acc', matchId, ev({ id, type: 'GOAL', at: index + 1, teamId: 'teamA' }));
  }
}

const afterFinish = (events: readonly { id: string }[]) => success(events.map((event) => resultOf(event.id, 'review', 'AFTER_FINISH')));
const finishedRace = () => rpcError('55000', 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (matches, Turnier live-cup).');

describe('R3-2a Ausgang nach dem Abschluss (@FU-018, @LZ-039, @LZ-030)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    { uhrzeit: '17:55', bedeutung: 'vor dem Abschluss eingetragen' },
    { uhrzeit: '18:10', bedeutung: 'nach dem Abschluss eingetragen' },
  ])('@FU-018 @LZ-039 Toms Tor ($bedeutung, $uhrzeit) kommt um 18:20 an: verlässt den Ausgang, „an die Turnierleitung übergeben“, kein neuer Versuch', async () => {
    const h = makeHarness();
    await seed(h, 'finale', ['tor-tom']);
    h.api.mockImplementation(async (_matchId, events) => afterFinish(events));

    await h.sender.start('acc');
    await h.tick(600000);

    expect(await idsIn(h, 'acc', 'finale', 'pending')).toEqual([]);
    expect(await idsIn(h, 'acc', 'finale', 'acked')).toEqual([]); // zählt nicht im Ergebnis
    expect(await idsIn(h, 'acc', 'finale', 'review')).toEqual(['tor-tom']); // aufbewahrt, nicht verworfen
    const status = h.sender.getStatus();
    expect(status.afterFinishByMatch).toEqual({ finale: 1 });
    expect(status.pendingByTournament[TURNIER]).toBe(0);
    expect(h.api).toHaveBeenCalledTimes(1);
  });

  it('@LZ-030 Marias Korrektur kurz nach dem Abschluss: nicht übernommen, als übergeben gezählt', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'hf1', ctx, TURNIER);
    await h.store.addPending('acc', 'hf1', ev({ id: 'korrektur-maria', type: 'CORRECTION', at: 1, payload: { scores: { teamA: 2, teamB: 3 } } }));
    h.api.mockImplementation(async (_matchId, events) => afterFinish(events));

    await h.sender.start('acc');

    expect(await idsIn(h, 'acc', 'hf1', 'acked')).toEqual([]);
    expect(h.sender.getStatus().afterFinishByMatch).toEqual({ hf1: 1 });
  });

  it('Grenzfall: 55000 TOURNAMENT_FINISHED im Wettlauf – Eintrag bleibt im Ausgang, der nächste Versuch wird aufbewahrt, danach Ruhe', async () => {
    const h = makeHarness();
    await seed(h, 'finale', ['tor-tom']);
    h.api.mockRejectedValueOnce(finishedRace());
    h.api.mockImplementation(async (_matchId, events) => afterFinish(events));

    await h.sender.start('acc');

    expect(await idsIn(h, 'acc', 'finale', 'pending')).toEqual(['tor-tom']);
    expect(await rejectedIn(h, 'acc', 'finale')).toEqual([]);

    await h.tick(60000);

    expect(await idsIn(h, 'acc', 'finale', 'pending')).toEqual([]);
    expect(await idsIn(h, 'acc', 'finale', 'review')).toEqual(['tor-tom']);
    expect(await rejectedIn(h, 'acc', 'finale')).toEqual([]);
    const calls = h.api.mock.calls.length;
    expect(calls).toBe(2);
    await h.tick(600000);
    expect(h.api.mock.calls.length).toBe(calls);
  });

  it('keine Schleife: meldet der Server 55000 TOURNAMENT_FINISHED zweimal in Folge, ist es endgültig „nicht übernommen – Turnier ist abgeschlossen“', async () => {
    const h = makeHarness();
    await seed(h, 'finale', ['tor-tom', 'tor-clara']);
    h.api.mockRejectedValue(finishedRace());

    await h.sender.start('acc');
    await h.tick(600000);

    expect(h.api).toHaveBeenCalledTimes(2);
    expect(await idsIn(h, 'acc', 'finale', 'pending')).toEqual([]);
    expect(await rejectedIn(h, 'acc', 'finale')).toEqual([['tor-tom', 'TOURNAMENT_FINISHED'], ['tor-clara', 'TOURNAMENT_FINISHED']]);
  });

  it('Gegenbeispiel: 55000 „Spiel nicht mehr beschreibbar“ bleibt MATCH_GONE (nichts aufbewahrt, keine Übergabe)', async () => {
    const h = makeHarness();
    await seed(h, 'mG', ['tor-tom']);
    h.api.mockRejectedValue(rpcError('55000', 'append_match_events: Spiel mG nicht mehr beschreibbar'));

    await h.sender.start('acc');

    expect(await rejectedIn(h, 'acc', 'mG')).toEqual([['tor-tom', 'MATCH_GONE']]);
    expect(h.sender.getStatus().afterFinishByMatch).toEqual({});
  });

  it('Gegenbeispiel: ein anderer Klärungsgrund (AFTER_END) zählt nicht als „Turnier abgeschlossen“', async () => {
    const h = makeHarness();
    await seed(h, 'm7', ['tor-tom']);
    h.api.mockImplementation(async (_matchId, events) => success(events.map((event) => resultOf(event.id, 'review', 'AFTER_END'))));

    await h.sender.start('acc');

    expect(await idsIn(h, 'acc', 'm7', 'review')).toEqual(['tor-tom']);
    expect(h.sender.getStatus().afterFinishByMatch).toEqual({});
    expect(h.sender.getStatus().reviewByMatch).toEqual({ m7: 1 });
  });
});

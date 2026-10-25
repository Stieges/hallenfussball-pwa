/**
 * R3-2b (Review #392 M2): Nach dem Wiederöffnen des Turniers (heute Notweg @LZ-091) verschwindet auf Toms Gerät der Hinweis
 * „Turnier ist abgeschlossen – N Einträge an die Turnierleitung übergeben“. Die Einträge liegen bei der Turnierleitung
 * („nach dem Abschluss eingetroffen“); @FU-018 letzte Zeile: „wer den Eintrag übernehmen will, öffnet das Turnier wieder“ –
 * das Gerät führt sie nicht weiter.
 * Gegenbeispiele: andere Klärungseinträge (AFTER_END) und Einträge eines anderen Turniers bleiben.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { idsIn, makeHarness, resultOf, success, type Harness } from './outboxHarness';

async function seed(h: Harness, matchId: string, tournamentId: string, id: string): Promise<void> {
  await h.store.create('acc', matchId, ctx, tournamentId);
  await h.store.addPending('acc', matchId, ev({ id, type: 'GOAL', at: 1, teamId: 'teamA' }));
}

describe('R3-2b @FU-018 nach dem Wiederöffnen: „an die Turnierleitung übergeben“ aufräumen', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('Toms übergebene Einträge im Live-Cup werden abgeschlossen, der Hinweis zählt 0; AFTER_END und ein anderes Turnier bleiben', async () => {
    const h = makeHarness();
    await seed(h, 'finale', 'live-cup', 'tor-tom');
    await seed(h, 'hf1', 'live-cup', 'tor-clara');
    await seed(h, 'm7', 'live-cup', 'karte-tom');
    await seed(h, 'anders', 'winter-cup', 'tor-anders');
    h.api.mockImplementation(async (matchId, events) =>
      success(events.map((event) => resultOf(event.id, 'review', matchId === 'm7' ? 'AFTER_END' : 'AFTER_FINISH'))));
    await h.sender.start('acc');
    expect(h.sender.getStatus().afterFinishByTournament).toEqual({ 'live-cup': 2, 'winter-cup': 1 });

    await h.sender.closeAfterFinish('live-cup');

    const status = h.sender.getStatus();
    expect(status.afterFinishByMatch).toEqual({ anders: 1 });
    expect(status.afterFinishByTournament).toEqual({ 'winter-cup': 1 });
    expect(await idsIn(h, 'acc', 'finale', 'review')).toEqual([]);
    expect(await idsIn(h, 'acc', 'hf1', 'review')).toEqual([]);
    expect(await idsIn(h, 'acc', 'm7', 'review')).toEqual(['karte-tom']);
    expect(await idsIn(h, 'acc', 'anders', 'review')).toEqual(['tor-anders']);
  });
});

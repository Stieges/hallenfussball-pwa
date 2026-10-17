/**
 * A-30a Schritt 2 (@SL-137, @SL-138, @W3-028): die getragenen Farben fahren im Anpfiff-Ereignis mit
 * (`MATCH_START.payload.kit`, Ruling R-A30-1). Ein zweiter Schreibweg existiert nicht: die Farbe kommt mit
 * genau diesem Ereignis beim Server an, auch wenn es ohne Netz angepfiffen und später gesendet wird.
 * Die lokale Kopie leitet die Farbe aus dem eigenen MATCH_START ab (TS-Gegenstück zum Server-Trigger).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '../../';
import { ClockSync } from '../ClockSync';
import { MatchEngine } from '../MatchEngine';
import { MatchCommands } from '../MatchCommands';
import { applyEngineOverlay, engineOverlayFields } from '../applyEngineOverlay';
import { kitFromEvents } from '../matchKitFromEvents';
import { DEFAULT_BIB_COLOR, defaultKit, kitWithBib, wornColors } from '../../../models/kit';
import { teamSlot } from '../../../models/matchSlot';
import type { Match, Team } from '../../../../types/tournament';
import { B07_CTX, B07_RULES, KICKOFF_AT, kickoff, makeHarness } from './commandHarness';
import { makeHarness as makeOutboxHarness, networkError, CLOCK_START } from './outboxHarness';

const ID = B07_CTX.matchId;
const ROT = '#C62828';
const WEISS = '#FFFFFF';
const SV_SUED = '11111111-1111-4111-8111-000000000001';
const FC_NORD = '11111111-1111-4111-8111-000000000002';
const TSV_OST = '11111111-1111-4111-8111-000000000003';

function team(id: string, name: string, primary: string): Team {
  return { id, name, colors: { primary } };
}

function spiel(id: string, home: string, away: string): Match {
  return { id, round: 1, field: 1, slotA: teamSlot(home), slotB: teamSlot(away) };
}

describe('A-30a startMatch(…, kit): Anpfiff trägt die getragenen Farben', () => {
  it('@SL-137 Anpfiff mit „Leibchen“ für FC Nord → Ereignis im Ausgang enthält payload.kit, die lokale Ansicht zeigt Gelb nur in Spiel 12', async () => {
    const teams = [team(SV_SUED, 'SV Süd', ROT), team(FC_NORD, 'FC Nord', ROT)];
    const spiel12 = spiel(ID, SV_SUED, FC_NORD);
    const kit = kitWithBib(spiel12, teams, {}, 'b');
    const h = makeHarness([], KICKOFF_AT);

    const id = await h.commands.start(ID, B07_CTX, 'leitung', B07_RULES, kit);

    expect(h.stored).toHaveLength(1);
    expect(id).toBe(h.stored[0].id);
    expect(h.stored[0].type).toBe('MATCH_START');
    expect(h.stored[0].payload).toEqual({ rules: B07_RULES, kit: { a: ROT, b: DEFAULT_BIB_COLOR, bibSide: 'b' } });
    expect(h.kick).toHaveBeenCalledWith(ID);

    // Lokale Ansicht: die Turnierkopie bekommt die getragene Farbe aus dem eigenen MATCH_START.
    expect(kitFromEvents(h.log)).toEqual({ a: ROT, b: DEFAULT_BIB_COLOR, bibSide: 'b' });
    const spiel13 = spiel('spiel-13', FC_NORD, TSV_OST);
    const tournament = { matches: [{ ...spiel12, matchStatus: 'running' as const }, spiel13] };
    const overlaid = applyEngineOverlay(tournament, new Map([[ID, { ...overlayOf(h.log), matchStatus: 'running' as const }]]));
    const allTeams = [...teams, team(TSV_OST, 'TSV Ost', WEISS)];
    expect(wornColors(overlaid.matches[0], allTeams)).toEqual({ a: ROT, b: DEFAULT_BIB_COLOR });
    // Im nächsten Spiel trägt FC Nord wieder Rot.
    expect(wornColors(overlaid.matches[1], allTeams)).toEqual({ a: ROT, b: WEISS });
  });

  it('@SL-138 ohne Farbkonflikt: Anpfiff ohne weiteren Schritt, kit geht ohne Leibchen mit', async () => {
    const teams = [team(SV_SUED, 'SV Süd', ROT), team(TSV_OST, 'TSV Ost', WEISS)];
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.start(ID, B07_CTX, 'leitung', B07_RULES, defaultKit(spiel(ID, SV_SUED, TSV_OST), teams, {}));
    expect(h.stored[0].payload).toEqual({ rules: B07_RULES, kit: { a: ROT, b: WEISS } });
  });

  it('@W3-028 auch ohne eingetragene Farben geht kit beim Anpfiff mit (leeres Objekt hält „keine Farbe“ fest)', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.start(ID, B07_CTX, 'leitung', B07_RULES, defaultKit(spiel(ID, SV_SUED, TSV_OST), [], {}));
    expect(h.stored[0].payload).toEqual({ rules: B07_RULES, kit: {} });
  });

  it('@SL-137 Farben werden vor dem Senden auf #RRGGBB normalisiert (der Server nimmt nur diese Form)', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.start(ID, B07_CTX, 'leitung', B07_RULES, { a: '#fc0', b: '#c62828', bibSide: 'a' });
    expect(h.stored[0].payload.kit).toEqual({ a: '#FFCC00', b: ROT, bibSide: 'a' });
  });

  it.each([
    { fall: 'Farbe kein Hex', kit: { a: 'gelb' } },
    { fall: 'Leibchen-Seite unbekannt', kit: { a: ROT, bibSide: 'c' } },
    { fall: 'unbekannter Schlüssel', kit: { a: ROT, farbe: ROT } },
  ])('@SL-137 Fehlerpolitik: $fall → Anpfiff gestoppt (INVALID_KIT), nichts gespeichert, nichts gesendet', async ({ kit }) => {
    const h = makeHarness([], KICKOFF_AT);
    // Absichtlich ungültige Eingabe (z. B. aus einer fehlerhaften Ansicht) – Laufzeitprüfung vor dem Senden.
    const ungueltig = kit as unknown as Parameters<typeof h.commands.start>[4];
    await expect(h.commands.start(ID, B07_CTX, 'leitung', B07_RULES, ungueltig)).rejects.toMatchObject({
      name: 'MatchCommandRejectedError',
      code: ERROR_CODES.INVALID_PAYLOAD,
      detail: { reason: 'INVALID_KIT' },
    });
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });

  it('@SL-138 Gegenbeispiel: Anpfiff ohne kit funktioniert unverändert (payload nur rules)', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.start(ID, B07_CTX, 'leitung', B07_RULES);
    expect(h.stored[0].payload).toEqual({ rules: B07_RULES });
    expect(kitFromEvents(h.log)).toBeUndefined();
  });
});

describe('A-30a kitFromEvents: TS-Gegenstück zum Trigger matches_kit_from_match_start', () => {
  it('@W3-028 nur MATCH_START trägt die Farbe; der jüngste MATCH_START mit kit-Objekt zählt', () => {
    const first = { ...kickoff(), payload: { rules: B07_RULES, kit: { a: ROT, b: WEISS } } };
    const second = { ...kickoff(), payload: { rules: B07_RULES, kit: { a: WEISS, b: ROT } } };
    expect(kitFromEvents([first])).toEqual({ a: ROT, b: WEISS });
    expect(kitFromEvents([first, second])).toEqual({ a: WEISS, b: ROT });
  });

  it('@W3-028 Gegenbeispiel: andere Ereignistypen (GOAL, PAUSE) ändern die Farben nicht', () => {
    const start = { ...kickoff(), payload: { rules: B07_RULES, kit: { a: ROT, b: WEISS } } };
    const goal = { ...kickoff(), type: 'GOAL' as const, teamId: B07_CTX.teamAId, payload: { kit: { a: WEISS } } };
    const pause = { ...kickoff(), type: 'PAUSE' as const, payload: { kit: { a: WEISS } } };
    expect(kitFromEvents([start, goal, pause])).toEqual({ a: ROT, b: WEISS });
  });

  it('@SL-137 wie der Server: ungültige Werte werden zu „keine Farbe“, nie Abbruch; kein Objekt → keine Änderung', () => {
    const invalid = { ...kickoff(), payload: { rules: B07_RULES, kit: { a: 'rot', b: '#c62828', bibSide: 'x' } } };
    expect(kitFromEvents([invalid])).toEqual({ b: ROT });
    const start = { ...kickoff(), payload: { rules: B07_RULES, kit: { a: ROT } } };
    const notObject = { ...kickoff(), payload: { rules: B07_RULES, kit: 'gelb' } };
    expect(kitFromEvents([start, notObject])).toEqual({ a: ROT });
  });
});

describe('A-30a Offline-Reihenfolge: die Farbe kommt mit genau diesem Ereignis an', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('@SL-137 Anpfiff ohne Netz, später gesendet → MATCH_START mit kit im selben Ereignis, kein zweiter Schreibweg', async () => {
    const o = makeOutboxHarness();
    const storage = { get: () => null, set: () => undefined };
    const engine = new MatchEngine({
      store: o.store,
      clock: new ClockSync(() => Promise.resolve(CLOCK_START), () => CLOCK_START, storage),
      sender: { start: vi.fn(async () => undefined), stop: vi.fn() },
      fetchConfirmed: vi.fn(),
      now: () => CLOCK_START,
    });
    await engine.start('acc');
    await engine.ensureMatch(ID, B07_CTX);
    // Ohne Netz: der Befehl speichert nur in den Ausgang (kick sendet nichts).
    const commands = new MatchCommands({ engine, store: o.store, sender: { kick: vi.fn(async () => undefined) }, accountId: 'acc' });
    const kit = { a: DEFAULT_BIB_COLOR, b: ROT, bibSide: 'a' as const };
    const startId = await commands.start(ID, B07_CTX, 'leitung', B07_RULES, kit);
    expect(o.api).not.toHaveBeenCalled();

    // Netz kommt später: erster Versuch scheitert, der zweite geht durch.
    o.api.mockImplementationOnce(async () => {
      throw networkError();
    });
    await o.sender.start('acc');
    await o.tick(1000);

    expect(o.api).toHaveBeenCalledTimes(2);
    for (const [matchId, events] of o.api.mock.calls) {
      expect(matchId).toBe(ID);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ id: startId, type: 'MATCH_START', payload: { rules: B07_RULES, kit } });
    }
    // Lokale Ansicht vor und nach dem Senden gleich: Farbe aus dem eigenen MATCH_START.
    const view = engine.view(ID);
    expect(view && engineOverlayFields(view, B07_CTX).kit).toEqual(kit);
  });
});

function overlayOf(log: Parameters<typeof kitFromEvents>[0]) {
  return { scoreA: 0, scoreB: 0, overtimeScoreA: undefined, overtimeScoreB: undefined, penaltyScoreA: undefined,
    penaltyScoreB: undefined, decidedBy: undefined, kit: kitFromEvents(log) };
}

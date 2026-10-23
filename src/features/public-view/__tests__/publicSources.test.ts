/**
 * Adapter der Zuschauer-Seite (B-15): (a) der heutige Weg mit Version aus dem Inhalt, (b) die Server-Funktion
 * `public_tournament` nach dem B-14-Vertrag, getestet mit einem Stub (@ZM-021, @ZM-026, @ZM-109).
 */
import { describe, it, expect, vi } from 'vitest';
import { buildLiveViewTournament } from '../../../screens/__tests__/liveViewFixture';
import type { Tournament } from '../../../types/tournament';
import { createLegacyPublicSource } from '../legacyPublicSource';
import { createRpcPublicSource, type PublicRpcCall } from '../rpcPublicSource';
import { defaultPublicTournamentSource } from '../defaultPublicSource';
import { contentVersionOf } from '../publicVersion';
import { applyPublicDelta } from '../publicDelta';
import { parsePublicReply } from '../publicTournamentWire';
import { ObservedServerClock } from '../serverClock';
import { deltaOneGoalReply, fullReply, STUB_SERVER_NOW, STUB_VERSION, unchangedReply } from './payloadFixtures';

const CODE = 'ABC123';
const withClock = { clock: { nowMs: (): number => Date.now() } };

const lookupOf = (...results: Array<Tournament | null | Error>) => {
  const getByShareCode = vi.fn();
  for (const result of results) {
    if (result instanceof Error) {
      getByShareCode.mockRejectedValueOnce(result);
    } else {
      getByShareCode.mockResolvedValueOnce(result);
    }
  }
  return { getByShareCode };
};

describe('Adapter (a) – heutiger Weg', () => {
  it('@ZM-021 erste Antwort ist voll, mit Version aus dem Inhalt', async () => {
    const t = buildLiveViewTournament();
    const source = createLegacyPublicSource(lookupOf(t), withClock);
    const result = await source.fetch(CODE, null);
    expect(result).toEqual({ kind: 'full', version: contentVersionOf(t), tournament: t });
  });

  it('@ZM-021 gleicher Inhalt → „nichts geändert“, es wird nicht neu gerechnet', async () => {
    const t = buildLiveViewTournament();
    const source = createLegacyPublicSource(lookupOf(t, structuredClone(t)), withClock);
    const first = await source.fetch(CODE, null);
    const second = await source.fetch(CODE, first.kind === 'full' ? first.version : null);
    expect(second).toEqual({ kind: 'unchanged', version: contentVersionOf(t) });
  });

  it('@ZM-021 Gegenbeispiel: ein Tor ändert die Version, die Antwort ist wieder voll', async () => {
    const t = buildLiveViewTournament();
    const after = { ...t, matches: t.matches.map((m) => (m.matchNumber === 7 ? { ...m, scoreA: 2 } : m)) };
    expect(contentVersionOf(after)).not.toBe(contentVersionOf(t));
    const source = createLegacyPublicSource(lookupOf(after), withClock);
    const result = await source.fetch(CODE, contentVersionOf(t));
    expect(result.kind).toBe('full');
  });

  it('@ZM-036 null aus der Abfrage (sie hat nachgefragt) heißt „nicht gefunden“, auch mit gehaltenem Stand', async () => {
    const source = createLegacyPublicSource(lookupOf(null, null), withClock);
    expect(await source.fetch(CODE, null)).toEqual({ kind: 'not-found' });
    expect(await source.fetch(CODE, '1')).toEqual({ kind: 'not-found' });
  });

  it('@ZM-109 eine werfende Abfrage ist „nicht erreichbar“, nie „nicht gefunden“', async () => {
    const source = createLegacyPublicSource(lookupOf(new Error('Zeitüberschreitung')), withClock);
    expect(await source.fetch(CODE, null)).toEqual({ kind: 'unreachable' });
  });

  it('Adapter (a) hat keinen festen Takt (BP-2: Voll-Abfrage im 10-s-Takt sprengt das Egress-Budget), Adapter (b) 10 Sekunden', () => {
    expect(createLegacyPublicSource(lookupOf(), withClock).pollIntervalMs).toBeNull();
    expect(createRpcPublicSource({ call: vi.fn() }).pollIntervalMs).toBe(10_000);
  });
});

describe('Adapter (b) – Server-Funktion nach dem Vertrag (Stub)', () => {
  const stub = (...replies: Array<Record<string, unknown> | Error>): PublicRpcCall & ReturnType<typeof vi.fn> => {
    const call = vi.fn();
    for (const reply of replies) {
      if (reply instanceof Error) {
        call.mockRejectedValueOnce(reply);
      } else {
        call.mockResolvedValueOnce({ data: reply, error: null });
      }
    }
    return call as PublicRpcCall & ReturnType<typeof vi.fn>;
  };

  it('@ZM-021 Voll-Antwort: Turnier, Teams, Spiele (15) und Ereignisse mit Teamnamen', async () => {
    const source = createRpcPublicSource({ call: stub(fullReply()) });
    const result = await source.fetch(CODE, null);
    expect(result.kind).toBe('full');
    if (result.kind !== 'full') {
      return;
    }
    expect(result.version).toBe(String(STUB_VERSION));
    expect(result.tournament.teams).toHaveLength(6);
    expect(result.tournament.matches).toHaveLength(15);
    const running = result.tournament.matches.find((m) => m.matchNumber === 9);
    expect(running?.matchStatus).toBe('running');
    expect(running?.liveState).toBeDefined();
    const goals = result.tournament.matches.flatMap((m) => m.events ?? []).filter((e) => e.type === 'GOAL');
    expect(goals.length).toBeGreaterThan(10);
    expect(goals.every((e) => typeof e.payload.teamName === 'string')).toBe(true);
  });

  it('@ZM-021 sendet since_version als ganze Zahl; ohne Stand oder mit Stand eines anderen Adapters null', async () => {
    const call = stub(unchangedReply(), unchangedReply(), unchangedReply());
    const source = createRpcPublicSource({ call });
    await source.fetch(CODE, String(STUB_VERSION));
    await source.fetch(CODE, null);
    await source.fetch(CODE, '3fa9c0b1-12345');
    expect(call.mock.calls.map(([args]) => (args as { since_version: number | null }).since_version)).toEqual([STUB_VERSION, null, null]);
    expect(call.mock.calls[0][0]).toMatchObject({ share_code: CODE });
  });

  it('@ZM-021 „keine Änderung“ trägt nur die Version', async () => {
    const source = createRpcPublicSource({ call: stub(unchangedReply()) });
    expect(await source.fetch(CODE, String(STUB_VERSION))).toEqual({ kind: 'unchanged', version: String(STUB_VERSION) });
  });

  it('@ZM-021 Delta „1 Tor“: das Spiel mit neuem Stand und Ereignissen, eingearbeitet in den gehaltenen Stand', async () => {
    const source = createRpcPublicSource({ call: stub(fullReply(), deltaOneGoalReply()) });
    const full = await source.fetch(CODE, null);
    const delta = await source.fetch(CODE, String(STUB_VERSION));
    expect(delta.kind).toBe('delta');
    if (full.kind !== 'full' || delta.kind !== 'delta') {
      return;
    }
    expect(delta.baseVersion).toBe(String(STUB_VERSION));
    expect(delta.delta.matches).toHaveLength(1);
    const merged = applyPublicDelta(full.tournament, delta.delta);
    const before = full.tournament.matches.find((m) => m.matchNumber === 9);
    const after = merged.matches.find((m) => m.matchNumber === 9);
    expect(before?.scoreA).toBe(1);
    expect(after?.scoreA).toBe(2);
    expect(merged.matches).toHaveLength(15);
    expect(merged.matches.map((m) => m.matchNumber)).toEqual(full.tournament.matches.map((m) => m.matchNumber));
    // alle anderen Spiele unverändert
    expect(merged.matches.filter((m) => m.matchNumber !== 9)).toEqual(full.tournament.matches.filter((m) => m.matchNumber !== 9));
  });

  it('@ZM-021 Delta kann Spiele entfernen', () => {
    const parsed = parsePublicReply({ ...deltaOneGoalReply(), removed_match_ids: ['gibt-es-nicht'], matches: [] });
    expect(parsed.result).toMatchObject({ kind: 'delta', delta: { matches: [], removedMatchIds: ['gibt-es-nicht'] } });
  });

  it('@ZM-109 Gegenbeispiel: ein Ereignistyp außerhalb der öffentlichen Positivliste (B-14-Vertrag) ist „nicht erreichbar“', async () => {
    const reply = fullReply();
    const matches = reply.matches as Array<Record<string, unknown>>;
    const bad = { ...reply, matches: [{ ...matches[0], events: [{ id: 'e1', type: 'MATCH_STARTED', team_id: null, section: 1, clock_ms: 0 }] }, ...matches.slice(1)] };
    expect(await createRpcPublicSource({ call: stub(bad) }).fetch(CODE, null)).toEqual({ kind: 'unreachable' });
  });

  it('@ZM-109 Gegenbeispiel: nur „not_found“ heißt nicht gefunden; Fehler, Zeitüberschreitung und Unsinn sind „nicht erreichbar“', async () => {
    expect(await createRpcPublicSource({ call: stub({ state: 'not_found' }) }).fetch(CODE, null)).toEqual({ kind: 'not-found' });
    const failing: PublicRpcCall = () => Promise.resolve({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } });
    expect(await createRpcPublicSource({ call: failing }).fetch(CODE, null)).toEqual({ kind: 'unreachable' });
    expect(await createRpcPublicSource({ call: stub(new Error('Failed to fetch')) }).fetch(CODE, null)).toEqual({ kind: 'unreachable' });
    expect(await createRpcPublicSource({ call: stub({ html: '<html>Anmeldeseite des Hallen-WLAN</html>' }) }).fetch(CODE, null)).toEqual({ kind: 'unreachable' });
    expect(await createRpcPublicSource({ call: stub({ state: 'full', version: 'abc' }) }).fetch(CODE, null)).toEqual({ kind: 'unreachable' });
  });

  it('@ZM-026 Handy-Uhr falsch: die Serverzeit der Antwort gleicht die Uhr ab, die Uhr des Handys geht 40 Sekunden vor', async () => {
    const handyUhr = STUB_SERVER_NOW + 40_000;
    const clock = new ObservedServerClock(() => handyUhr);
    const source = createRpcPublicSource({ call: stub(unchangedReply()), clock, deviceNow: () => handyUhr });
    expect(source.nowMs()).toBe(handyUhr);
    await source.fetch(CODE, String(STUB_VERSION));
    expect(Math.abs(source.nowMs() - STUB_SERVER_NOW)).toBeLessThanOrEqual(1000);
  });

  it('@ZM-026 Gegenbeispiel: ohne Antwort mit Serverzeit bleibt die Geräteuhr', async () => {
    const handyUhr = STUB_SERVER_NOW + 40_000;
    const clock = new ObservedServerClock(() => handyUhr);
    const source = createRpcPublicSource({ call: stub({ state: 'not_found' }), clock, deviceNow: () => handyUhr });
    await source.fetch(CODE, null);
    expect(source.nowMs()).toBe(handyUhr);
  });
});

describe('Standardweg der Zuschauer-Seite', () => {
  it('@ZM-068 liest ohne Schalter über die Server-Funktion (B-14 ist live, anon liest die Tabellen nicht mehr)', () => {
    expect(defaultPublicTournamentSource.kind).toBe('rpc');
  });
});

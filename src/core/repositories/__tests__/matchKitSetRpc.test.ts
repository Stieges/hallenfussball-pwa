/**
 * Client für `match_kit_set` (Leibchen 2b, Punkt 3): die Antwort des Servers wird in Ergebnisarten übersetzt, nie ein Wurf.
 * Szenarien: @SL-202/@SL-213 (nur das steuernde Gerät), @SL-227 (freies Feld), @SL-229 (Abweisung), @SL-150 (nur Turnierleitung im laufenden Spiel),
 * @SL-216 (offline wartend). Server-Antworten laut `supabase/migrations/20261124_002_leibchen_schritt2.sql` (Kopfkommentar, Antwortformen).
 */
import { describe, expect, it, vi } from 'vitest';
import { loadMatchKickoffStates, sendMatchKitSet, type MatchKitSetArgs } from '../matchKitSetRpc';

const ARGS: MatchKitSetArgs = {
  matchId: '00000000-0000-4000-8000-0000000000b1',
  decision: 'bib',
  bibSide: 'a',
  bibColor: '#FFCC00',
  teams: { a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000a2' },
  deviceId: '00000000-0000-4000-8000-0000000000d1',
  controlEpoch: 3,
};

function client(response: { data?: unknown; error?: unknown } | Error) {
  const rpc = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve({ data: response.data ?? null, error: response.error ?? null })));
  return { rpc, client: { rpc } as never };
}

describe('sendMatchKitSet: Aufruf', () => {
  it('@SL-201 „Bestätigen“ schickt decision bib, bibSide, bibColor und die Teams der Seiten, dazu Gerät und Epoche', async () => {
    const c = client({ data: { status: 'saved', phase: 'before', decision: 'bib', kit: { bibSide: 'a', bibColor: '#FFCC00' } } });
    await sendMatchKitSet(c.client, ARGS);
    expect(c.rpc).toHaveBeenCalledWith('match_kit_set', {
      p_match_id: ARGS.matchId,
      p_decision: 'bib',
      p_kit: { bibSide: 'a', bibColor: '#FFCC00', teamA: ARGS.teams?.a, teamB: ARGS.teams?.b },
      p_device_id: ARGS.deviceId,
      p_control_epoch: 3,
    });
  });

  it('@SL-149 „Keine Leibchen“ schickt decision none und nur die Teams (kein bibSide, keine Farbe)', async () => {
    const c = client({ data: { status: 'saved', phase: 'before', decision: 'none', kit: null } });
    await sendMatchKitSet(c.client, { ...ARGS, decision: 'none', bibSide: undefined, bibColor: undefined });
    expect(c.rpc).toHaveBeenCalledWith('match_kit_set', expect.objectContaining({ p_decision: 'none', p_kit: { teamA: ARGS.teams?.a, teamB: ARGS.teams?.b } }));
  });

  it('@SL-150 ohne Teams (Nachtrag) und ohne Epoche: kein teamA/teamB, Epoche weggelassen', async () => {
    const c = client({ data: { status: 'saved', phase: 'live', decision: 'bib', kit: { bibSide: 'b', bibColor: '#FF9800' } } });
    await sendMatchKitSet(c.client, { ...ARGS, bibSide: 'b', bibColor: '#ff9800', teams: undefined, controlEpoch: null });
    const aufruf = c.rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(aufruf[1].p_kit).toEqual({ bibSide: 'b', bibColor: '#FF9800' });
    expect('p_control_epoch' in aufruf[1]).toBe(false);
  });

  it('@SL-201 Gegenbeispiel: ohne Supabase-Client geht nichts raus, die Wahl wartet (offline)', async () => {
    expect(await sendMatchKitSet(null, ARGS)).toEqual({ kind: 'offline' });
  });
});

describe('sendMatchKitSet: Antworten', () => {
  it('@SL-201 gespeichert vor dem Anpfiff', async () => {
    const c = client({ data: { status: 'saved', phase: 'before', decision: 'bib', kit: { bibSide: 'a', bibColor: '#FFCC00' } } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'saved', phase: 'before', decision: 'bib' });
  });

  it('@SL-150 gespeichert im laufenden Spiel (Nachtrag)', async () => {
    const c = client({ data: { status: 'saved', phase: 'live', decision: 'none', kit: null } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'saved', phase: 'live', decision: 'none' });
  });

  it.each([
    { code: 'NOT_CONTROLLER', detail: { reason: 'OTHER_DEVICE' }, grund: 'OTHER_DEVICE', fall: '@SL-202 anderes Gerät hält das Feld' },
    { code: 'NOT_CONTROLLER', detail: { reason: 'STALE_EPOCH' }, grund: 'STALE_EPOCH', fall: '@SL-229 Feld inzwischen übernommen' },
    { code: 'LEAD_ONLY', detail: undefined, grund: undefined, fall: '@SL-150 im laufenden Spiel nur Turnierleitung' },
    { code: 'NOT_NEXT_MATCH', detail: undefined, grund: undefined, fall: '@SL-236 Helfer, nicht das nächste Spiel' },
    { code: 'MATCH_FINISHED', detail: undefined, grund: undefined, fall: '@SL-150 beendet ist gesperrt' },
    { code: 'MATCH_SKIPPED', detail: undefined, grund: undefined, fall: '@SL-232 ausgefallen' },
    { code: 'TEAMS_CHANGED', detail: undefined, grund: undefined, fall: '@SL-229 anderes Team auf der Seite' },
  ])('$fall: Abweisung $code wird als rejected mit Code geliefert', async ({ code, detail, grund }) => {
    const c = client({ data: { status: 'rejected', code, ...(detail === undefined ? {} : { detail }) } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'rejected', code, ...(grund === undefined ? {} : { reason: grund }) });
  });

  it('@SL-227 Mama Petra / kein Recht: 42501 ist „nicht erlaubt“, keine Wiederholung', async () => {
    const c = client({ error: { code: '42501', message: 'match_kit_set: keine Berechtigung' } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'forbidden' });
  });

  it('@SL-212 „Teams noch offen“ (22023) ist ein Fehler der Anfrage, keine Wiederholung', async () => {
    const c = client({ error: { code: '22023', message: 'match_kit_set: Spiel hat noch keine zwei Teams' } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'invalid' });
  });

  it('@FU-018 abgeschlossenes Turnier (55000 TOURNAMENT_FINISHED): nicht wiederholen', async () => {
    const c = client({ error: { code: '55000', message: 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen' } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'tournamentFinished' });
  });

  it('@SL-216 ohne Netz (Fetch-Fehler) wartet die Wahl: offline', async () => {
    const c = client({ error: { message: 'TypeError: Failed to fetch' } });
    expect(await sendMatchKitSet(c.client, ARGS)).toEqual({ kind: 'offline' });
    expect(await sendMatchKitSet(client(new TypeError('Load failed')).client, ARGS)).toEqual({ kind: 'offline' });
  });

  it('Gegenbeispiel: eine unbekannte Antwortform ist ein Fehler, kein „gespeichert“', async () => {
    const c = client({ data: { status: 'saved' } });
    expect((await sendMatchKitSet(c.client, ARGS)).kind).toBe('error');
    expect((await sendMatchKitSet(client({ data: { status: 'rejected', code: 'ALIEN' } }).client, ARGS)).kind).toBe('error');
  });
});

describe('loadMatchKickoffStates: frischer Stand „angepfiffen?“ (@SL-229 Zeile 1)', () => {
  const lesen = (antwort: { data?: unknown; error?: unknown } | Error) => {
    const inFn = vi.fn(() => (antwort instanceof Error ? Promise.reject(antwort) : Promise.resolve({ data: antwort.data ?? null, error: antwort.error ?? null })));
    return { inFn, client: { from: () => ({ select: () => ({ in: inFn }) }) } as never };
  };

  it('running und paused gelten als angepfiffen, scheduled nicht', async () => {
    const c = lesen({ data: [{ id: 'a', match_status: 'running' }, { id: 'b', match_status: 'paused' }, { id: 'c', match_status: 'scheduled' }] });
    const m = await loadMatchKickoffStates(c.client, ['a', 'b', 'c']);
    expect([m?.get('a')?.kickedOff, m?.get('b')?.kickedOff, m?.get('c')?.kickedOff]).toEqual([true, true, false]);
  });

  it('Gegenbeispiel: Fehler, Wurf und fehlender Client geben null (nie ein Wurf)', async () => {
    expect(await loadMatchKickoffStates(lesen({ error: { message: 'x' } }).client, ['a'])).toBeNull();
    expect(await loadMatchKickoffStates(lesen(new Error('netz')).client, ['a'])).toBeNull();
    expect(await loadMatchKickoffStates(null, ['a'])).toBeNull();
  });
});

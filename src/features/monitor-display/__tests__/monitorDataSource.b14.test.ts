/**
 * B-14 (E-A2, E-A3): Der Monitor liest die Cloud nur über `display_tournament` (Positivliste, nur der eigene Monitor, auch
 * ohne Online-Teilen) und fragt mit gemerktem Stand nur nach Änderungen. Kein Monitor wird leer, wenn die Cloud stört.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicReply } from '../../../core/repositories/publicPayload';
import { RepositoryError } from '../../../core/errors';
import type { Match, Tournament } from '../../../types/tournament';

const { getForDisplay, localGet } = vi.hoisted(() => ({ getForDisplay: vi.fn(), localGet: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getForDisplay }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

import { createMonitorSource } from '../monitorDataSource';

const spiel = (id: string, matchNumber: number, scoreA?: number): Match => ({ id, matchNumber, scoreA, round: 1, field: 1 } as unknown as Match);
const turnier: Tournament = {
  id: 'tour-1', title: 'Hallencup Nord', monitors: [{ id: 'mon-1', name: 'Hallenmonitor Feld 1' }],
  matches: [spiel('s7', 7, 1), spiel('s8', 8, 0)],
} as unknown as Tournament;

const voll = (version: number): PublicReply => ({ kind: 'full', version, serverNowMs: 0, tournament: turnier });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('createMonitorSource über display_tournament (B-14)', () => {
  it('erster Abruf ohne Stand: volle Antwort, Version gemerkt, nur der eigene Monitor', async () => {
    getForDisplay.mockResolvedValueOnce(voll(100));
    const delta = await createMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(getForDisplay).toHaveBeenCalledWith('tour-1', 'mon-1', null);
    expect(delta).toMatchObject({ kind: 'snapshot', version: '100', origin: 'cloud', lookupFailed: false, monitor: { id: 'mon-1' } });
  });

  it('mit Stand: fragt nur nach Änderungen und meldet „unverändert“', async () => {
    const source = createMonitorSource('tour-1', 'mon-1');
    getForDisplay.mockResolvedValueOnce(voll(100)).mockResolvedValueOnce({ kind: 'unchanged', version: 100, serverNowMs: 0 });
    await source.fetch(null);
    const delta = await source.fetch('100');
    expect(getForDisplay).toHaveBeenLastCalledWith('tour-1', 'mon-1', 100);
    expect(delta).toEqual({ kind: 'unchanged' });
  });

  it('Delta (1 Tor in Spiel 8): ersetzt nur Spiel 8, Spiel 7 bleibt', async () => {
    const source = createMonitorSource('tour-1', 'mon-1');
    getForDisplay.mockResolvedValueOnce(voll(100)).mockResolvedValueOnce({
      kind: 'delta', version: 200, baseVersion: 100, serverNowMs: 0, matches: [spiel('s8', 8, 1)], removedMatchIds: [],
    });
    await source.fetch(null);
    const delta = await source.fetch('100');
    expect(delta.kind).toBe('snapshot');
    if (delta.kind !== 'snapshot') { return; }
    expect(delta.version).toBe('200');
    expect(delta.tournament.matches.map((m) => [m.id, m.scoreA])).toEqual([['s7', 1], ['s8', 1]]);
  });

  it('@ZP-003 @ZP-005 Delta mit original_start: Spiel 8 trägt ohne Neuladen die ursprüngliche Uhrzeit, ein späteres Delta ohne sie nimmt sie wieder weg', async () => {
    const source = createMonitorSource('tour-1', 'mon-1');
    const verschoben = { ...spiel('s8', 8, 0), scheduledTime: new Date(2026, 10, 28, 15, 25), originalStart: new Date(2026, 10, 28, 15, 15) } as Match;
    const zurueck = { ...spiel('s8', 8, 0), scheduledTime: new Date(2026, 10, 28, 15, 15) } as Match;
    getForDisplay.mockResolvedValueOnce(voll(100))
      .mockResolvedValueOnce({ kind: 'delta', version: 200, baseVersion: 100, serverNowMs: 0, matches: [verschoben], removedMatchIds: [] })
      .mockResolvedValueOnce({ kind: 'delta', version: 300, baseVersion: 200, serverNowMs: 0, matches: [zurueck], removedMatchIds: [] });
    await source.fetch(null);
    const mit = await source.fetch('100');
    if (mit.kind !== 'snapshot') { throw new Error(mit.kind); }
    expect(mit.tournament.matches.find((m) => m.id === 's8')?.originalStart?.getMinutes()).toBe(15);
    const ohne = await source.fetch('200');
    if (ohne.kind !== 'snapshot') { throw new Error(ohne.kind); }
    expect(ohne.tournament.matches.find((m) => m.id === 's8')?.originalStart).toBeUndefined();
    expect(ohne.tournament.matches.find((m) => m.id === 's7')).toBeDefined();
  });

  it('Gegenbeispiel: Version eines anderen Wegs (kein Stand gemerkt) → volle Antwort statt Delta', async () => {
    getForDisplay.mockResolvedValueOnce(voll(300));
    await createMonitorSource('tour-1', 'mon-1').fetch('abc');
    expect(getForDisplay).toHaveBeenCalledWith('tour-1', 'mon-1', null);
  });

  it('@ZM-109 Störung am Server: lokaler Rückfall mit lookupFailed (nie „nicht gefunden“), Bild bleibt', async () => {
    getForDisplay.mockRejectedValueOnce(new RepositoryError('display_tournament', 'Failed to fetch'));
    localGet.mockResolvedValueOnce(null);
    const delta = await createMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toEqual({ kind: 'missing', lookupFailed: true });
  });

  it('not_found (Monitor gehört nicht zum Turnier oder Turnier gelöscht) → lokale Kopie, sonst „fehlt“', async () => {
    getForDisplay.mockResolvedValueOnce({ kind: 'not-found' });
    localGet.mockResolvedValueOnce(null);
    const delta = await createMonitorSource('tour-1', 'mon-x').fetch(null);
    expect(delta).toEqual({ kind: 'missing', lookupFailed: false });
  });
});

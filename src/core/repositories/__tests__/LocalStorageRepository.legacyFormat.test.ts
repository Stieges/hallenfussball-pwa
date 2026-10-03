/**
 * A-05 (@FU-007, +A-07): Altformat-Turnier im lokalen Speicher wird abgelehnt, beiseitegelegt und
 * gemeldet – nicht still verworfen, kein TypeError. Gueltige Turniere (auch mit Uebergangsfeld teamA)
 * bleiben in der Liste.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

const data = new Map<string, unknown>();
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(data.get(key) ?? null),
      set: (key: string, value: unknown) => {
        data.set(key, structuredClone(value));
        return Promise.resolve();
      },
    } as unknown as IStorageAdapter),
}));

const captureFeatureError = vi.fn();
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => captureFeatureError(...args),
}));

import { LocalStorageRepository } from '../LocalStorageRepository';

const TEAM_A = '11111111-1111-4111-8111-111111111111';
const TEAM_B = '22222222-2222-4222-8222-222222222222';

const baseTournament = {
  id: 'ok',
  title: 'Gueltig',
  status: 'draft',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
  teams: [],
  sport: 'football',
  sportId: 'football',
  tournamentType: 'classic',
  mode: 'classic',
};

const legacy = {
  ...baseTournament,
  id: 'alt',
  title: 'Altformat',
  matches: [{ id: 'm1', teamA: 'FC Nord', teamB: 'FC Sued' }],
};

const valid = {
  ...baseTournament,
  matches: [
    {
      id: 'm1',
      round: 1,
      field: 1,
      teamA: TEAM_A,
      teamB: TEAM_B,
      slotA: { kind: 'team', teamId: TEAM_A },
      slotB: { kind: 'team', teamId: TEAM_B },
    },
  ],
};

describe('LocalStorageRepository – Altformat (@FU-007)', () => {
  beforeEach(() => {
    data.clear();
    vi.clearAllMocks();
  });

  it('@FU-007 Turnier mit einem Spiel ohne slotA/slotB landet unter tournaments_legacy_v1 mit Hinweis', async () => {
    data.set('tournaments', [legacy]);

    const repo = new LocalStorageRepository();
    await expect(repo.get('alt')).resolves.toBeNull();

    expect(data.get('tournaments_legacy_v1')).toEqual([legacy]);
    expect(data.get('tournaments')).toEqual([]);
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
    expect(String(captureFeatureError.mock.calls[0][0])).toContain('alt');
  });

  it('@FU-007 Altformat wirft keinen TypeError beim Laden und verwirft keine Daten still', async () => {
    data.set('tournaments', [legacy, valid]);
    const repo = new LocalStorageRepository();
    await expect(repo.listForCurrentUser()).resolves.toHaveLength(1);
    expect(data.get('tournaments_legacy_v1')).toHaveLength(1);
  });

  it('@FU-007 Gegenbeispiel: gueltiges Turnier MIT Uebergangsfeld teamA bleibt in der Liste', async () => {
    data.set('tournaments', [valid]);

    const repo = new LocalStorageRepository();
    const list = await repo.listForCurrentUser();

    expect(list.map((t) => t.id)).toEqual(['ok']);
    expect(data.has('tournaments_legacy_v1')).toBe(false);
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Entwurf ohne Spiele bleibt in der Liste', async () => {
    data.set('tournaments', [{ ...baseTournament, matches: [] }]);
    const list = await new LocalStorageRepository().listForCurrentUser();
    expect(list).toHaveLength(1);
    expect(data.has('tournaments_legacy_v1')).toBe(false);
  });
});

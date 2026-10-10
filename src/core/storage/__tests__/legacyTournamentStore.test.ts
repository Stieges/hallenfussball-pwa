/**
 * A-05: Altformat-Turniere werden beiseitegelegt, nicht verworfen (@FU-007).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../IStorageAdapter';

const data = new Map<string, unknown>();
vi.mock('../StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(data.get(key) ?? null),
      set: (key: string, value: unknown) => {
        data.set(key, value);
        return Promise.resolve();
      },
    } as unknown as IStorageAdapter),
}));

import { quarantineLegacyTournaments, countLegacyTournaments } from '../legacyTournamentStore';
import { LEGACY_TOURNAMENTS_KEY } from '../legacyTournamentStore';

describe('legacyTournamentStore (@FU-007)', () => {
  beforeEach(() => data.clear());

  it('@FU-007 legt Altformat-Turniere unter tournaments_legacy_v1 ab', async () => {
    await quarantineLegacyTournaments([{ id: 'a' }, { id: 'b' }]);
    expect(LEGACY_TOURNAMENTS_KEY).toBe('tournaments_legacy_v1');
    expect(data.get('tournaments_legacy_v1')).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(await countLegacyTournaments()).toBe(2);
  });

  it('@FU-007 zweites Beiseitelegen desselben Turniers dupliziert nicht (Gegenbeispiel), ersetzt nur den Eintrag', async () => {
    await quarantineLegacyTournaments([{ id: 'a', v: 1 }]);
    await quarantineLegacyTournaments([{ id: 'a', v: 2 }, { id: 'c' }]);
    expect(data.get('tournaments_legacy_v1')).toEqual([{ id: 'a', v: 2 }, { id: 'c' }]);
  });

  it('Gegenbeispiel: leere Liste schreibt nichts', async () => {
    await quarantineLegacyTournaments([]);
    expect(data.has('tournaments_legacy_v1')).toBe(false);
    expect(await countLegacyTournaments()).toBe(0);
  });

  it('Gegenbeispiel: kaputter Speicherinhalt (kein Array) zaehlt als 0', async () => {
    data.set('tournaments_legacy_v1', 'kaputt');
    expect(await countLegacyTournaments()).toBe(0);
  });
});

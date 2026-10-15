/**
 * A-08f3a (Plan `task-A-08f3-plan.md` v3, Paket a, Gegenbeispiel (iv)): Schreibkette im lokalen Speicher.
 * Feldweg aus der Cloud (`applyServerMatchFields`) und eigenes `updateMatches` überschreiben sich nicht.
 * Anforderungen: @FU-087, @FU-023 (technische Absicherung, Plan § 6 „Paketpunkte ohne Szenario“).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament, Match } from '../../models/types';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => {
        stores.raw.set(key, structuredClone(value));
        return Promise.resolve();
      },
    }),
}));

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { LocalStorageRepository } from '../LocalStorageRepository';
import { createMockMatch, createMockTournament } from '../../../test/factories';

const UPDATED_AT = '2026-10-15T08:00:00.000Z';
const KICKOFF_OLD = '1970-01-01T14:30:00.000Z';
const KICKOFF_NEW = '1970-01-01T14:40:00.000Z';

function localV7(): Tournament {
  const matches = ['m1', 'm2'].map((id) => createMockMatch({ id, matchStatus: 'scheduled' }));
  return createMockTournament({ id: 'T', ownerId: 'olli', version: 7, updatedAt: UPDATED_AT, matches });
}

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}

function storedMatch(id: string): Match {
  const found = stored().matches.find((m) => m.id === id);
  if (!found) { throw new Error(`Spiel ${id} fehlt`); }
  return found;
}

describe('A-08f3a Schreibkette: alle Schreibmethoden des lokalen Speichers laufen nacheinander', () => {
  beforeEach(() => {
    stores.raw.clear();
    stores.raw.set('tournaments', [localV7()]);
  });

  it('Gegenbeispiel (iv): applyServerMatchFields und updateMatches gleichzeitig → beide gespeichert', async () => {
    const local = new LocalStorageRepository();

    await Promise.all([
      local.applyServerMatchFields('T', new Map([['m1', { scoreA: 1, scoreB: 0, matchStatus: 'running' }]])),
      local.updateMatches('T', [{ id: 'm2', scheduledTime: new Date(KICKOFF_NEW) }]),
    ]);

    expect(storedMatch('m1')).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    expect(new Date(storedMatch('m2').scheduledTime ?? KICKOFF_OLD).toISOString()).toBe(KICKOFF_NEW);
    expect(stored().version).toBe(8);
  });

  it('applyServerMatchFields ändert weder Version noch updatedAt noch Konto-Marker', async () => {
    const local = new LocalStorageRepository();

    await local.applyServerMatchFields('T', new Map([['m1', { scoreA: 3, scoreB: 1, matchStatus: 'finished' }]]));

    expect(stored()).toMatchObject({ version: 7, updatedAt: UPDATED_AT, ownerId: 'olli' });
    expect(storedMatch('m1')).toMatchObject({ scoreA: 3, scoreB: 1, matchStatus: 'finished' });
  });
});

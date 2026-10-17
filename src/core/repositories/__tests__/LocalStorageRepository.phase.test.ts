/**
 * A-25a (Ruling Controller, Befund C-PHASE-LOKAL-VERLOREN): Die Phase eines Spiels (`'semifinal'`, `'final'`, …)
 * übersteht Speichern → lokal Laden. Ohne sie gilt ein lokal geladenes K.-o.-Spiel als Gruppenspiel
 * (`serverRulesFor(…).knockout = false`), und die Schnelleingabe fragt kein Strafstoßergebnis ab (@FU-094).
 * Der Rundlauf läuft über den gültigen Schema-Zweig (`TournamentSchema.safeParse` erfolgreich), nicht über den
 * Rückfall „Rohdaten bei Validierungsfehler“.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

const storageGet = vi.fn<(key: string) => Promise<unknown>>();
const storageSet = vi.fn<(key: string, value: unknown) => Promise<void>>();

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => storageGet(key),
      set: (key: string, value: unknown) => storageSet(key, value),
    } as unknown as IStorageAdapter),
}));

const captureFeatureError = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import { LocalStorageRepository } from '../LocalStorageRepository';
import { TournamentSchema } from '../../models/schemas/TournamentSchema';
import { createMockMatch, createMockTournament } from '../../../test/factories';

async function speichernUndLaden(matches: ReturnType<typeof createMockMatch>[]) {
  storageGet.mockResolvedValue([]);
  const repo = new LocalStorageRepository();
  await repo.save(createMockTournament({ id: 't-phase', sportId: 'football-indoor', matches }));
  const persisted = storageSet.mock.calls.at(-1)?.[1];
  expect(Array.isArray(persisted) && TournamentSchema.safeParse(persisted[0]).success).toBe(true);
  storageGet.mockResolvedValue(persisted);
  return repo.get('t-phase');
}

describe('LocalStorageRepository — Phase der Spiele übersteht lokales Laden (C-PHASE-LOKAL-VERLOREN)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@FU-094 Halbfinale 1 (phase „semifinal“) und Finale (phase „final“) behalten nach dem Neuladen ihre Phase', async () => {
    const reloaded = await speichernUndLaden([
      createMockMatch({ id: 'hf1', phase: 'semifinal', isFinal: true }),
      createMockMatch({ id: 'finale', phase: 'final', isFinal: true }),
    ]);
    expect(reloaded?.matches.map((m) => m.phase)).toEqual(['semifinal', 'final']);
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein Spiel ohne phase bleibt gültig und hat nach dem Neuladen keine Phase', async () => {
    const ohne = createMockMatch({ id: 'g1', group: 'A' });
    delete ohne.phase;
    const reloaded = await speichernUndLaden([ohne]);
    expect(reloaded?.matches[0].phase).toBeUndefined();
    expect(captureFeatureError).not.toHaveBeenCalled();
  });
});

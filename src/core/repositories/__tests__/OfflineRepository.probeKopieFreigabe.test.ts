/**
 * @W5-024 „Eine Kopie hat einen eigenen Freigabe-Code“: Die Kopie startet ohne Code (nicht der des Originals); beim Freigeben
 * über den vorhandenen Weg (`make_tournament_public`, hier gemockte RPC) entsteht ein neuer Code, der nicht der des Originals ist.
 * Deutung: Der Code entsteht erst bei der Freigabe der Kopie, serverseitig.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import type { SupabaseRepository } from '../SupabaseRepository';
import type { Tournament } from '../../models/types';
import { buildCopiedTournament } from '../../models/tournamentCopy';
import { hallencupOstGespielt, OST_CODE } from '../../models/__fixtures__/hallencupOstGespielt';

let created: Array<{ dispose(): void }> = [];
afterEach(() => { created.forEach(q => q.dispose()); created = []; });

describe('@W5-024 Kopie freigeben ergibt einen neuen, eigenen Code', () => {
  it('die Kopie hat vor der Freigabe keinen Code; nach make_tournament_public einen neuen, nicht den des Originals', async () => {
    const kopie = buildCopiedTournament(hallencupOstGespielt(), {
      newId: crypto.randomUUID(), title: 'Hallencup Ost (Probe)', now: '2026-11-20T10:00:00.000Z', makeId: () => crypto.randomUUID(),
    });
    expect(kopie.shareCode).toBeUndefined();
    expect(kopie.isPublic).toBe(false);

    const rpc = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>()
      .mockResolvedValue({ shareCode: 'PRB7Q2', createdAt: '2026-11-20T10:05:00.000Z' });
    const cached: Tournament[] = [];
    const localRepo = {
      get: vi.fn(() => Promise.resolve(kopie)),
      cacheCloudCopy: vi.fn((t: Tournament) => { cached.push(t); return Promise.resolve(); }),
    } as unknown as LocalStorageRepository;
    const repo = new OfflineRepository(localRepo, { makeTournamentPublic: rpc } as unknown as SupabaseRepository);
    created.push(repo.mutationQueue);

    const result = await repo.makeTournamentPublic(kopie.id);

    expect(rpc).toHaveBeenCalledWith(kopie.id);
    expect(result?.shareCode).toBe('PRB7Q2');
    expect(result?.shareCode).not.toBe(OST_CODE);
    expect(cached[0]).toMatchObject({ id: kopie.id, isPublic: true, shareCode: 'PRB7Q2' });
  });
});

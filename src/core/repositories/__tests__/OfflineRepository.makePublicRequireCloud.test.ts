/**
 * C-FESTLEGEN-TEILT-NICHT (@W1-020): `makeTournamentPublic(id, { requireCloud: true })` wartet, bis das Turnier in der
 * Cloud ist, nimmt den Server-Code und weicht bei Fehlern NICHT auf einen lokalen Code aus.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import type { SupabaseRepository } from '../SupabaseRepository';

const cloudMakePublic = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>();
const localMakePublic = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>();
const cacheCloudCopy = vi.fn(() => Promise.resolve());
let created: Array<{ dispose(): void }> = [];

function createRepository() {
  const localRepo = {
    makeTournamentPublic: localMakePublic,
    get: vi.fn(() => Promise.resolve({ id: 't1', isPublic: true, shareCode: 'LOCAL1' })),
    cacheCloudCopy,
  } as unknown as LocalStorageRepository;
  const supabaseRepo = { makeTournamentPublic: cloudMakePublic } as unknown as SupabaseRepository;
  const repo = new OfflineRepository(localRepo, supabaseRepo);
  created.push(repo.mutationQueue);
  return repo;
}

describe('OfflineRepository.makeTournamentPublic requireCloud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    created = [];
  });
  afterEach(() => { created.forEach((q) => q.dispose()); vi.useRealTimers(); });

  it('Server-Code wird zurueckgegeben und in die lokale Kopie uebernommen', async () => {
    cloudMakePublic.mockResolvedValue({ shareCode: 'SERVR2', createdAt: '2026-10-24T10:00:00.000Z' });

    const result = await createRepository().makeTournamentPublic('t1', { requireCloud: true });

    expect(result?.shareCode).toBe('SERVR2');
    expect(cacheCloudCopy).toHaveBeenCalledWith(expect.objectContaining({ shareCode: 'SERVR2', isPublic: true }));
    expect(localMakePublic).not.toHaveBeenCalled();
  });

  it('Netzfehler: wirft, kein lokaler Rueckfall, nichts eingereiht', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const repo = createRepository();

    await expect(repo.makeTournamentPublic('t1', { requireCloud: true })).rejects.toThrow('Failed to fetch');

    expect(localMakePublic).not.toHaveBeenCalled();
    expect(repo.mutationQueue.hasPending('t1')).toBe(false);
    expect(cloudMakePublic).toHaveBeenCalledTimes(1);
  });

  it('wartet auf die wartende Speicherung, bevor der Aufruf an den Server geht', async () => {
    cloudMakePublic.mockResolvedValue({ shareCode: 'SERVR2', createdAt: '2026-10-24T10:00:00.000Z' });
    const repo = createRepository();
    let pending = true;
    vi.spyOn(repo.mutationQueue, 'hasPending').mockImplementation(() => pending);
    vi.spyOn(repo.mutationQueue, 'hasFailed').mockReturnValue(false);
    let notify: () => void = () => undefined;
    vi.spyOn(repo.mutationQueue, 'subscribe').mockImplementation((listener) => {
      notify = () => listener({ pendingCount: 0, failedCount: 0 });
      return () => undefined;
    });

    const promise = repo.makeTournamentPublic('t1', { requireCloud: true });
    await Promise.resolve();
    expect(cloudMakePublic).not.toHaveBeenCalled();

    pending = false;
    notify();
    await expect(promise).resolves.toMatchObject({ shareCode: 'SERVR2' });
    expect(cloudMakePublic).toHaveBeenCalledTimes(1);
  });

  it('gescheiterte Speicherung: wirft, der Server wird nicht gefragt', async () => {
    const repo = createRepository();
    vi.spyOn(repo.mutationQueue, 'hasFailed').mockReturnValue(true);

    await expect(repo.makeTournamentPublic('t1', { requireCloud: true })).rejects.toThrow();

    expect(cloudMakePublic).not.toHaveBeenCalled();
  });

  it('Speicherung kommt nie an (Zeitablauf): wirft', async () => {
    vi.useFakeTimers();
    const repo = createRepository();
    vi.spyOn(repo.mutationQueue, 'hasPending').mockReturnValue(true);
    vi.spyOn(repo.mutationQueue, 'hasFailed').mockReturnValue(false);

    const promise = repo.makeTournamentPublic('t1', { requireCloud: true });
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(25_000);
    await assertion;

    expect(cloudMakePublic).not.toHaveBeenCalled();
  });

  it('ohne requireCloud bleibt der lokale Rueckfall (Teilen unter Sichtbarkeit unveraendert)', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    localMakePublic.mockResolvedValue({ shareCode: 'LOCAL1', createdAt: '2026-10-24T10:00:00.000Z' });

    const result = await createRepository().makeTournamentPublic('t1');

    expect(result?.shareCode).toBe('LOCAL1');
  });
});

/**
 * @W5-027 angemeldet: Archiviert Olli die Probe-Kopie, steht die Änderung zuerst nur lokal (Warteschlange).
 * Die Startseite lädt danach die Cloud-Liste neu; dort liegt noch der alte Stand. Die neuere lokale Fassung muss gewinnen,
 * sonst bliebe die archivierte Kopie auf der Startseite stehen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import type { SupabaseRepository } from '../SupabaseRepository';
import type { Tournament } from '../../models/types';
import { ownerOnlyList } from '../../../test/fakeCloudRepository';

let created: Array<{ dispose(): void }> = [];

function tournament(id: string, updatedAt: string, extra: Partial<Tournament> = {}): Tournament {
  return { id, title: id, updatedAt, matches: [], teams: [], ...extra } as unknown as Tournament;
}

function repo(cloudList: Tournament[], localList: Tournament[], pendingIds: string[] = localList.map(t => t.id)) {
  const localRepo = { listForCurrentUser: vi.fn(() => Promise.resolve(localList)) } as unknown as LocalStorageRepository;
  const supabaseRepo = { listForCurrentUser: vi.fn(() => Promise.resolve(cloudList)), listWithMemberships: vi.fn(ownerOnlyList(() => Promise.resolve(cloudList))) } as unknown as SupabaseRepository;
  const r = new OfflineRepository(localRepo, supabaseRepo);
  vi.spyOn(r.mutationQueue, 'hasPending').mockImplementation((id: string) => pendingIds.includes(id));
  created.push(r.mutationQueue);
  return r;
}

describe('@W5-027 OfflineRepository.listForCurrentUser: neuere lokale Fassung gewinnt', () => {
  afterEach(() => { created.forEach(q => q.dispose()); created = []; });

  it('die lokal archivierte Kopie (neueres updatedAt, Änderung wartet in der Warteschlange) ersetzt die alte Cloud-Zeile', async () => {
    const cloudStand = tournament('kopie', '2026-11-20T10:00:00.000Z');
    const lokal = tournament('kopie', '2026-11-20T10:05:00.000Z', { manuallyCompleted: true });
    const list = await repo([cloudStand], [lokal]).listForCurrentUser();
    expect(list).toHaveLength(1);
    expect(list[0].manuallyCompleted).toBe(true);
  });

  it('Gegenbeispiel: ist die Cloud-Zeile neuer oder gleich alt, gilt die Cloud-Fassung', async () => {
    const cloudStand = tournament('a', '2026-11-20T10:05:00.000Z', { title: 'Cloud' });
    const gleich = tournament('b', '2026-11-20T10:00:00.000Z', { title: 'Cloud-b' });
    const list = await repo(
      [cloudStand, gleich],
      [tournament('a', '2026-11-20T10:00:00.000Z', { title: 'Lokal' }), tournament('b', '2026-11-20T10:00:00.000Z', { title: 'Lokal-b' })],
    ).listForCurrentUser();
    expect(list.map(t => t.title)).toEqual(['Cloud', 'Cloud-b']);
  });

  it('nur lokal vorhandene Turniere bleiben dabei', async () => {
    const list = await repo([tournament('c', '2026-11-20T10:00:00.000Z')], [tournament('nur-lokal', '2026-11-20T10:00:00.000Z')]).listForCurrentUser();
    expect(list.map(t => t.id)).toEqual(['c', 'nur-lokal']);
  });

  it('Gegenbeispiel: nichts in der Warteschlange, die Cloud-Fassung gilt, auch wenn die lokale ein neueres updatedAt hat (Geräteuhr)', async () => {
    const cloudStand = tournament('kopie', '2026-11-20T10:00:00.000Z', { title: 'Cloud' });
    const lokal = tournament('kopie', '2026-11-20T11:00:00.000Z', { title: 'Lokal', manuallyCompleted: true });
    const list = await repo([cloudStand], [lokal], []).listForCurrentUser();
    expect(list[0].title).toBe('Cloud');
    expect(list[0].manuallyCompleted).toBeUndefined();
  });

  it('Dead-Letter: die Änderung wurde abgelehnt und steht nicht mehr als offen in der Warteschlange, die Cloud-Fassung gilt', async () => {
    const cloudStand = tournament('kopie', '2026-11-20T10:00:00.000Z', { title: 'Cloud' });
    const lokal = tournament('kopie', '2026-11-20T10:05:00.000Z', { title: 'Lokal (abgelehnt)' });
    const r = repo([cloudStand], [lokal], []);
    expect(r.mutationQueue.hasPending('kopie')).toBe(false);
    expect((await r.listForCurrentUser())[0].title).toBe('Cloud');
  });
});

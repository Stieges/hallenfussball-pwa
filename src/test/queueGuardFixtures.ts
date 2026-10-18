/**
 * Testgerüst A-08f3c2 (nur Testumgebung): Live-Cup und Hilfen für die Tests zu Regel Q
 * (`OfflineRepository.queueGuard*.test.ts`). Speicher-Attrappen bleiben im jeweiligen Test (`vi.mock` wird gehoben).
 */
import type { Tournament, Match } from '../core/models/types';
import { createMockMatch, createMockTournament } from './factories';
import { teamSlot } from '../core/models/matchSlot';
import { testUuid } from './testIds';

export const FC_NORD = testUuid(81);
const UPDATED_AT = '2026-10-15T08:00:00.000Z';

export interface QueueStores { raw: Map<string, unknown>; queue: Map<string, string> }

/** Live-Cup: Gruppe-A-Spiel und Halbfinale 1 (Heimseite noch offen). */
export function liveCup(version: number, extra: { title?: string; teamName?: string; hfHeim?: string; plus?: Match[]; updatedAt?: string } = {}): Tournament {
  const base = createMockTournament({ id: 'T', ownerId: 'olli', version, updatedAt: extra.updatedAt ?? UPDATED_AT, title: extra.title ?? 'Live-Cup' });
  const name = extra.teamName;
  const teams = name ? base.teams.map((t, i) => (i === 0 ? { ...t, name } : t)) : base.teams;
  const hf = createMockMatch({ id: 'hf-1', matchStatus: 'scheduled', ...(extra.hfHeim ? { slotA: teamSlot(extra.hfHeim) } : {}) });
  return { ...base, teams, matches: [createMockMatch({ id: 'spiel-4', matchStatus: 'scheduled' }), hf, ...(extra.plus ?? [])] };
}

export const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1]]);

export function stored(stores: QueueStores): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}

export const heimseite = (t: Tournament): string | undefined => {
  const slot = t.matches.find((m) => m.id === 'hf-1')?.slotA;
  return slot?.kind === 'team' ? slot.teamId : undefined;
};

/** Dead-Letter-Eintrag des Kontos (wie nach MAX_RETRIES), vor dem Anlegen des Repositorys. */
export function deadLetter(stores: QueueStores, type: string, payload: unknown): void {
  stores.queue.set('mutation_queue_failed_v1:olli', JSON.stringify([
    { id: 'dl-1', type, payload, timestamp: 1, retryCount: 5, failedAt: 2, lastError: 'Optimistic lock failed' },
  ]));
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

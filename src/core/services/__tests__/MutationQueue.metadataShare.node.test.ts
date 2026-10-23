/**
 * BP-1 – Befund C-METADATEN-ZUSAMMENFASSEN-VERDRAENGT-TEILEN, Szenarien @BM-072 und @BM-073 (Record turnier-bekannt-machen).
 *
 * @BM-072: Maria (Co-Admin) wählt ohne Netz „online teilen“ (die App zeigt den Freigabe-Code) und ändert danach den
 * Turniernamen auf „Hallencup Nord 2026“. Hat das Tablet wieder Netz, öffnet der Zuschauer-Link mit diesem Code den
 * „Hallencup Nord 2026“, und es warten keine Einträge mehr.
 * @BM-073: Teilen, Teilen zurücknehmen und Namen ändern ohne Netz – am Ende heißt das Turnier „Hallencup Nord 2026“ und der
 * Zuschauer-Link zeigt „nicht gefunden oder nicht öffentlich“ (Reihenfolge bleibt).
 *
 * Die Einträge entstehen wie in `OfflineRepository` (Rückfall „online teilen“ mit `onlyIfUnshared`, Zurücknehmen und
 * Turnierangaben als `UPDATE_TOURNAMENT_METADATA`); gesendet wird über den echten `executeMetadataMutation` gegen eine
 * Attrappe der Cloud-Zeile.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../models/types';

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    setItemPersisted: vi.fn((key: string, value: string) => { mockStorage.set(key, value); return true; }),
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
    getIsAvailable: vi.fn(() => true),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

import { MutationQueue } from '../MutationQueue';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';

interface CloudRow { title: string; isPublic: boolean; shareCode: string | null }

/** Cloud-Zeile des „Hallencup Nord“ mit den beiden Schreibwegen der Turnierangaben. */
function makeCloud() {
  const row: CloudRow = { title: 'Hallencup Nord', isPublic: false, shareCode: null };
  const repo = {
    shareIfUnshared: vi.fn(async (_id: string, share: { shareCode: string }) => {
      if (row.shareCode !== null) {
        return { applied: false, cloud: { isPublic: row.isPublic, shareCode: row.shareCode, shareCodeCreatedAt: undefined } };
      }
      row.isPublic = true;
      row.shareCode = share.shareCode;
      return { applied: true };
    }),
    updateTournamentMetadata: vi.fn(async (_id: string, metadata: Partial<Tournament>) => {
      if (metadata.title !== undefined) { row.title = metadata.title; }
      if (metadata.isPublic !== undefined) { row.isPublic = metadata.isPublic; }
      if (metadata.shareCode !== undefined) { row.shareCode = metadata.shareCode; }
    }),
  };
  /** Was der Zuschauer-Link mit `code` zeigt. */
  const zuschauerLink = (code: string): string => (row.isPublic && row.shareCode === code ? row.title : 'nicht gefunden oder nicht öffentlich');
  return { row, repo, zuschauerLink };
}

const localRepo = { get: vi.fn(async () => null), cacheCloudCopy: vi.fn(async () => undefined) } as unknown as LocalStorageRepository;
const CODE = 'NORD26';

let mq: MutationQueue | undefined;

beforeEach(() => {
  mockStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
});

afterEach(() => {
  mq?.dispose();
  vi.useRealTimers();
});

/** Einträge wie `OfflineRepository` sie ohne Netz einreiht. */
const teilen = { tournamentId: 'nord', metadata: { isPublic: true, shareCode: CODE, shareCodeCreatedAt: '2026-11-01T10:00:00Z' }, onlyIfUnshared: true };
const zuruecknehmen = { tournamentId: 'nord', metadata: { isPublic: false, shareCode: null } };
const namen = (title: string) => ({ tournamentId: 'nord', metadata: { title } });

async function wiederNetz(queue: MutationQueue): Promise<void> {
  (globalThis.navigator as { onLine: boolean }).onLine = true;
  await queue.process();
}

describe('BP-1 C-METADATEN-ZUSAMMENFASSEN-VERDRAENGT-TEILEN: wartender Teilen-Eintrag geht nicht verloren', () => {
  it('@BM-072 online teilen, danach Namen ändern, beides ohne Netz: Zuschauer-Link mit dem Code zeigt „Hallencup Nord 2026“', async () => {
    const cloud = makeCloud();
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', teilen);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', namen('Hallencup Nord 2026'));

    await wiederNetz(mq);

    expect(cloud.zuschauerLink(CODE)).toBe('Hallencup Nord 2026');
    expect(mq.getPendingCount()).toBe(0);
    expect(mq.getFailedCount()).toBe(0);
  });

  it('@BM-072 @BM-070 hat Olli inzwischen geteilt, bleibt sein Code (Aushang gilt weiter), und Marias Name kommt trotzdem an', async () => {
    const cloud = makeCloud();
    cloud.row.isPublic = true;
    cloud.row.shareCode = 'OLLI01'; // Olli hat geteilt, während Marias Tablet kein Netz hatte
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', teilen);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', namen('Hallencup Nord 2026'));

    await wiederNetz(mq);

    expect(cloud.zuschauerLink('OLLI01')).toBe('Hallencup Nord 2026');
    expect(cloud.row.shareCode).toBe('OLLI01');
    expect(mq.getPendingCount()).toBe(0);
  });

  it('@BM-073 teilen, zurücknehmen, Namen ändern ohne Netz: Name kommt an, Link „nicht gefunden oder nicht öffentlich“', async () => {
    const cloud = makeCloud();
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', teilen);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', zuruecknehmen);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', namen('Hallencup Nord 2026'));

    await wiederNetz(mq);

    expect(cloud.row.title).toBe('Hallencup Nord 2026');
    expect(cloud.zuschauerLink(CODE)).toBe('nicht gefunden oder nicht öffentlich');
    expect(mq.getPendingCount()).toBe(0);
  });

  it('@BM-073 Reihenfolge bleibt auch, wenn der Name zuerst geändert wird (Name, teilen, zurücknehmen): nicht öffentlich', async () => {
    const cloud = makeCloud();
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', namen('Hallencup Nord 2026'));
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', teilen);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', zuruecknehmen);

    await wiederNetz(mq);

    expect(cloud.row.title).toBe('Hallencup Nord 2026');
    expect(cloud.zuschauerLink(CODE)).toBe('nicht gefunden oder nicht öffentlich');
  });
});

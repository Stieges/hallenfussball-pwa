/**
 * @ME-043 Monitore übernehmen kann nur, wer beide Turniere verwaltet (Nachtest NT1, B-22, Fixrunde PR #284).
 *
 * Gegeben Olli verwaltet den „Hallencup Nord“ und den „Hallencup Süd“, nicht aber den „Kreispokal“
 * Wenn Olli im „Hallencup Süd“ „Monitore übernehmen“ wählt
 * Dann bietet die App den „Hallencup Nord“ an, aber nicht den „Kreispokal“
 *
 * Echter Listenweg: OfflineRepository.listForCurrentUser (Konto olli) → useTournaments → Übernehmen-Dialog.
 * Gemockt sind nur Speicher, Sitzung und die Cloud-Abfrage (Olli listet in der Cloud nur Turniere, deren
 * Eigentümer er ist; ein Helfer darf ein fremdes Turnier einzeln lesen).
 *
 * Offene Produktfrage (nicht entschieden): Gehören Turniere, in denen Olli Co-Admin ist, zu „verwaltet“?
 * Dieser Test stützt sich nur auf den Eigentümer.
 *
 * Noch offen: Gegenbeispiel „Olli ist im Kreispokal nur Helfer und hat ihn auf dem Gerät geöffnet“. Heute bietet der
 * Dialog ihn an (die Helfer-Kopie trägt den Konto-Marker). Der erwartet rote Test folgt, sobald der Befund in der
 * Befundliste steht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const stores = vi.hoisted(() => {
  const repo: { current: unknown } = { current: null };
  return { raw: new Map<string, unknown>(), queue: new Map<string, string>(), repo };
});

vi.mock('../../../core/storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => {
        stores.raw.set(key, value);
        return Promise.resolve();
      },
    }),
}));

vi.mock('../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      stores.queue.set(key, value);
    }),
    setItemPersisted: vi.fn((key: string, value: string) => {
      stores.queue.set(key, value);
      return true;
    }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => {
      stores.queue.delete(key);
    }),
  },
}));

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: session.userId ? { user: { id: session.userId } } : null },
        error: null,
      })),
    },
  },
}));

// Der Dialog liest die Liste über useTournaments; das Repository ist das echte OfflineRepository.
vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => stores.repo.current,
  default: () => stores.repo.current,
}));
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, isGuest: false }),
}));
// Gast-Einträge der Spiel-Engine gehören nicht zum Szenario
vi.mock('../../../core/match/client/guestEngineEntries', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  filterWithoutGuestEngineEntries: (list: unknown[]) => Promise.resolve(list),
}));

import { OfflineRepository } from '../../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../../core/repositories/LocalStorageRepository';
import { readWithRevisions } from '../../../test/fakeCloudRepository';
import { createMockTournament } from '../../../test/factories';
import { MonitorTransferSheet } from '../MonitorTransferSheet';

const MONITOR: TournamentMonitor = {
  id: 'mon-1',
  name: 'Hallenmonitor Halle',
  defaultSlideDuration: 15,
  transition: 'fade',
  transitionDuration: 500,
  theme: 'dark',
  performanceMode: 'auto',
  overscanPercent: 7.5,
  slides: [{ id: 'sl-1', type: 'standings', config: {}, duration: null, order: 0 }],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function turnier(id: string, title: string, ownerId: string): Tournament {
  return createMockTournament({
    id,
    title,
    status: 'published',
    teams: [],
    matches: [],
    monitors: [MONITOR],
    sponsors: [],
    sportId: 'football-indoor',
    ownerId,
  });
}

const NORD = turnier('nord', 'Hallencup Nord', 'olli');
const SUED = turnier('sued', 'Hallencup Süd', 'olli');
const KREISPOKAL = turnier('kreispokal', 'Kreispokal', 'anna');

/** Cloud-Sicht von Olli: die Liste nennt nur seine eigenen Turniere, einzeln lesen darf er auch Fremdes als Helfer. */
function cloudOlli() {
  const all = [NORD, SUED, KREISPOKAL];
  const get = vi.fn(async (id: string) => all.find((t) => t.id === id) ?? null);
  return {
    get,
    getWithMatchRevisions: vi.fn(readWithRevisions(get)),
    save: vi.fn(async () => undefined),
    listForCurrentUser: vi.fn(async () => all.filter((t) => t.ownerId === 'olli')),
    getByShareCode: vi.fn(async () => null),
  };
}

async function openSuedSheet(repo: OfflineRepository) {
  stores.repo.current = repo;
  render(<MonitorTransferSheet tournament={SUED} onClose={() => undefined} onApply={async () => undefined} />);
  await waitFor(() => expect(screen.queryByText('monitors.transfer.loading')).toBeNull());
  await screen.findByTestId('transfer-source-nord');
}

describe('@ME-043 Monitore übernehmen: der Dialog bietet nur eigene Turniere als Quelle an', () => {
  const repos: OfflineRepository[] = [];

  beforeEach(() => {
    stores.raw.clear();
    stores.queue.clear();
    repos.length = 0;
    session.userId = 'olli';
  });

  afterEach(() => {
    repos.forEach((r) => r.mutationQueue.dispose());
  });

  function ollisRepo(): OfflineRepository {
    const repo = new OfflineRepository(new LocalStorageRepository(), cloudOlli() as never, 'olli');
    repos.push(repo);
    return repo;
  }

  it('@ME-043 Olli im „Hallencup Süd“: der Dialog bietet den „Hallencup Nord“ an, aber weder den „Kreispokal“ noch den „Hallencup Süd“ selbst', async () => {
    // Auf dem Gerät liegt auch eine Kopie des Kreispokals von Anna (ihr Konto, frühere Anmeldung)
    stores.raw.set('tournaments', [KREISPOKAL]);
    await openSuedSheet(ollisRepo());

    expect(screen.getByTestId('transfer-source-nord')).toBeInTheDocument();
    expect(screen.queryByTestId('transfer-source-kreispokal')).toBeNull();
    expect(screen.queryByTestId('transfer-source-sued')).toBeNull();
  });
});

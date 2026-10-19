/**
 * @ME-043 Monitore übernehmen kann nur, wer beide Turniere verwaltet (Nachtest NT1, B-22).
 *
 * Gegeben Olli verwaltet den „Hallencup Nord“ und den „Hallencup Süd“, nicht aber den „Kreispokal“
 * Wenn Olli im „Hallencup Süd“ „Monitore übernehmen“ wählt
 * Dann bietet die App den „Hallencup Nord“ an, aber nicht den „Kreispokal“
 *
 * Die Quellen-Liste kommt aus dem Turnier-Bestand des Kontos (listOwnedBy). Prüft den Bestand,
 * nicht die Anzeige im Dialog.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';
import type { TournamentMonitor } from '../../../types/monitor';

const storageGet = vi.fn<(key: string) => Promise<unknown>>();

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => storageGet(key),
      set: () => Promise.resolve(),
    } as unknown as IStorageAdapter),
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { LocalStorageRepository } from '../LocalStorageRepository';

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

function turnier(id: string, title: string, ownerId: string, withMonitor: boolean) {
  return {
    id,
    title,
    ownerId,
    status: 'published',
    createdAt: '2026-10-01T08:00:00.000Z',
    matches: [],
    teams: [],
    monitors: withMonitor ? [MONITOR] : [],
  };
}

describe('@ME-043 Monitore übernehmen: Quellen nur aus den eigenen Turnieren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageGet.mockResolvedValue([
      turnier('nord', 'Hallencup Nord', 'olli', true),
      turnier('sued', 'Hallencup Süd', 'olli', true),
      turnier('kreispokal', 'Kreispokal', 'anna', true),
    ]);
  });

  it('@ME-043 Olli bekommt als Quellen den „Hallencup Nord“ und den „Hallencup Süd“', async () => {
    const titel = (await new LocalStorageRepository().listOwnedBy('olli')).map((t) => t.title).sort();
    expect(titel).toEqual(['Hallencup Nord', 'Hallencup Süd']);
  });

  it('@ME-043 Gegenbeispiel: der „Kreispokal“ taucht nicht in Ollis Quellen auf, auch wenn er Monitore hat', async () => {
    const ids = (await new LocalStorageRepository().listOwnedBy('olli')).map((t) => t.id);
    expect(ids).not.toContain('kreispokal');
  });
});

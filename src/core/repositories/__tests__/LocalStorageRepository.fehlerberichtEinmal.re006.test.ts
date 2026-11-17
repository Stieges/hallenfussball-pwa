/**
 * @RE-006: Ein lokales Turnier, das die Pruefung beim Laden nicht besteht, wird in einer Sitzung genau
 * einmal gemeldet – nicht bei jedem Laden der Liste (Kontingent des Fehlerbericht-Dienstes).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';

const data = new Map<string, unknown>();
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(data.get(key) ?? null),
      set: (key: string, value: unknown) => {
        data.set(key, structuredClone(value));
        return Promise.resolve();
      },
    } as unknown as IStorageAdapter),
}));

const captureFeatureError = vi.fn();
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => captureFeatureError(...args),
}));

import { LocalStorageRepository } from '../LocalStorageRepository';
import { resetReportedOnceForTest } from '../reportOnce';

const base = {
  title: 'Gueltig',
  status: 'draft',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
  teams: [],
  matches: [],
  sport: 'football',
  sportId: 'football',
  tournamentType: 'classic',
  mode: 'classic',
};
const gut = { ...base, id: 'gut' };
// altes lokales Turnier ohne sportId besteht die Pruefung nicht
const { sportId: _weg, ...ohneSportId } = base;
const kaputt = { ...ohneSportId, id: 'kaputt', title: 'Alt A' };
const kaputt2 = { ...ohneSportId, id: 'kaputt2', title: 'Alt B' };

const berichteFuer = (id: string) =>
  captureFeatureError.mock.calls.filter((c) => (c[3] as { tournamentId?: string } | undefined)?.tournamentId === id && c[2] === 'loadList:validation');

describe('LocalStorageRepository – Fehlerbericht nur einmal je Turnier (@RE-006)', () => {
  beforeEach(() => {
    data.clear();
    vi.clearAllMocks();
    resetReportedOnceForTest();
  });

  it('@RE-006 hundertmal geladen: genau ein Bericht, Turnier jedes Mal in der Liste', async () => {
    data.set('tournaments', [kaputt]);
    const repo = new LocalStorageRepository();
    for (let i = 0; i < 100; i++) {
      const list = await repo.listForCurrentUser();
      expect(list.map((t) => t.id)).toEqual(['kaputt']);
    }
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
    expect(berichteFuer('kaputt')).toHaveLength(1);
  });

  it('@RE-006 zweites fehlerhaftes Turnier bekommt einen eigenen Bericht', async () => {
    data.set('tournaments', [kaputt, kaputt2]);
    const repo = new LocalStorageRepository();
    for (let i = 0; i < 5; i++) { await repo.listForCurrentUser(); }
    expect(captureFeatureError).toHaveBeenCalledTimes(2);
    expect(berichteFuer('kaputt')).toHaveLength(1);
    expect(berichteFuer('kaputt2')).toHaveLength(1);
  });

  it('@RE-006 nach dem Neuladen der Seite hoechstens ein Bericht je Turnier', async () => {
    data.set('tournaments', [kaputt, kaputt2]);
    const repo = new LocalStorageRepository();
    await repo.listForCurrentUser(); await repo.listForCurrentUser();
    expect(captureFeatureError).toHaveBeenCalledTimes(2);
    resetReportedOnceForTest(); // Seite neu geladen: Modulzustand ist leer
    await repo.listForCurrentUser(); await repo.listForCurrentUser();
    expect(captureFeatureError).toHaveBeenCalledTimes(4);
    expect(berichteFuer('kaputt')).toHaveLength(2);
  });

  it('@RE-006 Gegenbeispiel: gueltige Turniere melden nichts', async () => {
    data.set('tournaments', [gut]);
    const repo = new LocalStorageRepository();
    for (let i = 0; i < 3; i++) { await repo.listForCurrentUser(); }
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@RE-006 Gegenbeispiel: zwei Repository-Instanzen in einer Sitzung melden zusammen nur einmal', async () => {
    data.set('tournaments', [kaputt]);
    await new LocalStorageRepository().listForCurrentUser();
    await new LocalStorageRepository().listForCurrentUser();
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });

  it('@RE-006 Gegenbeispiel: das fehlerhafte Turnier kommt jedes Mal unveraendert (roh, hydriert) zurueck', async () => {
    data.set('tournaments', [kaputt]);
    const repo = new LocalStorageRepository();
    const erste = await repo.listForCurrentUser();
    const zweite = await repo.listForCurrentUser();
    expect(zweite).toEqual(erste);
    expect(erste).toHaveLength(1);
    expect(erste[0]).toMatchObject({ id: 'kaputt', title: 'Alt A', status: 'draft', teams: [], matches: [] });
    expect(erste[0]).not.toHaveProperty('sportId');
    expect(data.get('tournaments')).toEqual([kaputt]); // nichts verschwindet, nichts wird umgeschrieben
  });

  it('@RE-006 Kennung fehlt: faellt auf einen Schluessel zusammen, einmal melden reicht', async () => {
    data.set('tournaments', [{ ...ohneSportId, id: undefined }, { ...ohneSportId, id: 42 }]);
    const repo = new LocalStorageRepository();
    await repo.listForCurrentUser(); await repo.listForCurrentUser();
    // "undefined" und "42" sind verschiedene Zeichenketten: je eine Meldung, danach nie wieder
    expect(captureFeatureError.mock.calls.length).toBeLessThanOrEqual(2);
    const n = captureFeatureError.mock.calls.length;
    await repo.listForCurrentUser();
    expect(captureFeatureError).toHaveBeenCalledTimes(n);
  });

  it('@RE-006 Kante: dieselbe Kennung wird repariert und faellt wieder durch – bleibt „schon gemeldet“', async () => {
    const repo = new LocalStorageRepository();
    data.set('tournaments', [kaputt]);
    await repo.listForCurrentUser();
    data.set('tournaments', [{ ...gut, id: 'kaputt' }]);
    await repo.listForCurrentUser();
    data.set('tournaments', [kaputt]);
    await repo.listForCurrentUser();
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });
});

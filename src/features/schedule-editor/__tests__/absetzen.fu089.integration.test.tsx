/**
 * A-08f3e4 + c1 – @FU-089 als Integration (Brief A-08f3e4c1c2 § 2, Zeilen 1–2 der Lücken-Tabelle).
 * Gegeben ein geteiltes Turnier „Live-Cup“ mit Turnierleitung Olli und Co-Admin Maria · Und Olli hat auf seinem Gerät
 * Spiel 4 übersprungen · Wenn Maria danach die Anstoßzeit von Spiel 5 auf 14:40 verschiebt · Dann zeigt der Spielplan auf
 * Ollis Gerät Spiel 5 spätestens nach 10 Sekunden mit 14:40 · Und Spiel 4 steht auf Ollis Gerät weiter als übersprungen.
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Cloud, echte Spiel-Engine, echte Engine-Überlagerung.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
vi.mock('../../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'olli' } } }, error: null })) } },
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import { OfflineRepository } from '../../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../../core/repositories/LocalStorageRepository';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { MatchEngineContext } from '../../match-engine/matchEngineContextInstance';
import { FC_NORD, SV_SUED, makeScheduleEngine, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { createMockMatch, createMockTournament } from '../../../test/factories';
import { vs } from '../../../test/matchSlotFixtures';
import { useEngineOverlayForTournament } from '../../../hooks/useEngineOverlayForTournament';
import type { Match, Tournament } from '../../../types/tournament';
import { useMatchSkip } from '../hooks/useMatchSkip';

const KICKOFF_1430 = new Date('1970-01-01T14:30:00.000Z');
const KICKOFF_1440 = new Date('1970-01-01T14:40:00.000Z');

function liveCup(version: number, spiel5Kickoff = KICKOFF_1430): Tournament {
  const teams = [{ id: FC_NORD, name: 'FC Nord', group: 'A' }, { id: SV_SUED, name: 'SV Süd', group: 'A' }];
  const spiel = (id: string, matchNumber: number, extra: Partial<Match> = {}) =>
    createMockMatch({ id, matchNumber, group: 'A', phase: 'groupStage', ...vs(FC_NORD, SV_SUED), matchStatus: 'scheduled', scheduledTime: KICKOFF_1430, ...extra });
  return createMockTournament({
    id: 'T', ownerId: 'olli', version, title: 'Live-Cup', teams, numberOfTeams: 2, updatedAt: '2026-10-18T08:00:00.000Z',
    matches: [spiel('spiel-4', 4), spiel('spiel-5', 5, { scheduledTime: spiel5Kickoff })],
  });
}

const stored = (): Tournament => (stores.raw.get('tournaments') as Tournament[])[0];
async function loaded(read: Promise<Tournament | null>): Promise<Tournament> {
  const tournament = await read;
  if (!tournament) { throw new Error('Turnier fehlt'); }
  return tournament;
}

describe('A-08f3e4 @FU-089 Absetzen über den Server, danach kommt Marias Spielplan-Änderung an', () => {
  let h: ScheduleEngine;
  let repo: OfflineRepository;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('navigator', { onLine: true });
    stores.raw.clear();
    stores.queue.clear();
    stores.raw.set('tournaments', [liveCup(7)]);
    h = await makeScheduleEngine('olli');
  });
  afterEach(() => {
    repo.mutationQueue.dispose();
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-089 Olli setzt Spiel 4 ab (SKIP, lokale Version bleibt 7) → Maria 14:40 (Cloud v8) → Spiel 5 14:40, Spiel 4 weiter abgesetzt', async () => {
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: new Map([['spiel-4', 1], ['spiel-5', 1]]) });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    const updateMatches = vi.spyOn(repo, 'updateMatches');
    const save = vi.spyOn(repo, 'save');
    const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>;
    const hook = renderHook(({ tournament }: { tournament: Tournament }) => ({ skip: useMatchSkip(tournament), shown: useEngineOverlayForTournament(tournament) }),
      { wrapper, initialProps: { tournament: await loaded(repo.get('T')) } });

    let text: string | null = 'unberührt';
    await act(async () => { text = await hook.result.current.skip.skip('spiel-4'); await settle(); });
    expect(text).toBeNull();
    expect(updateMatches).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(stored().version).toBe(7);

    const cloud8 = liveCup(8, KICKOFF_1440); // Server hat den SKIP übernommen (Revision 2), Maria hat gespeichert (v8)
    cloud8.matches[0] = { ...cloud8.matches[0], matchStatus: 'skipped' };
    cloud.setState({ tournament: cloud8, revisions: new Map([['spiel-4', 2], ['spiel-5', 1]]) });
    const fresh = await loaded(repo.get('T', { fresh: true })); // Abfrage-Takt (≤ 5 s)
    await act(async () => { hook.rerender({ tournament: fresh }); await settle(); });

    const shown = hook.result.current.shown;
    expect(new Date(shown?.matches.find((m) => m.id === 'spiel-5')?.scheduledTime ?? 0).toISOString()).toBe(KICKOFF_1440.toISOString());
    expect(shown?.matches.find((m) => m.id === 'spiel-4')?.matchStatus).toBe('skipped');
  });
});

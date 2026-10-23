/**
 * C-SCHEMA-VERWIRFT-FELDER, Wirkung (Paket SK): speichern → lokal laden → in die Cloud schreiben.
 * Ein verworfenes `matchNumber`/`phase` machte aus einer Kopie `match_number = NULL` und `phase = 'groupStage'`
 * (`mapMatchToSupabase`), und das Komplett-Speichern aus der lokalen Kopie trug es in die Cloud.
 * Das vollständige Turnier ist gültig, die Prüfung des Schemas schlägt also wirklich zu (anders als bei
 * unvollständigen Beispieldaten, die als Rohdaten zurückfallen).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { TeamIdSchema } from '../../models/schemas/MatchSlotSchema';
import { mapMatchToSupabase, mapMatchToScheduleUpdate } from '../supabaseMappers';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => {
        stores.raw.set(key, JSON.parse(JSON.stringify(value)) as unknown);
        return Promise.resolve();
      },
    }),
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { LocalStorageRepository } from '../LocalStorageRepository';

const TEAM_A = TeamIdSchema.parse('11111111-1111-4111-8111-111111111111');
const TEAM_B = TeamIdSchema.parse('22222222-2222-4222-8222-222222222222');

const MATCH: Match = {
  id: 'm-11', round: 3, field: 1,
  slotA: { kind: 'team', teamId: TEAM_A },
  slotB: { kind: 'team', teamId: TEAM_B },
  isFinal: true, finalType: 'final',
  matchNumber: 11, phase: 'final',
  matchStatus: 'finished',
  correctionHistory: [{ timestamp: '2026-11-14T14:45:00.000Z', previousScoreA: 1, previousScoreB: 2, newScoreA: 2, newScoreB: 2, userName: 'Olli' }],
};

const TOURNAMENT = {
  id: 't-1', title: 'Hallencup', status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
  teams: [{ id: TEAM_A, name: 'FC Nord' }, { id: TEAM_B, name: 'SG Mitte' }],
  matches: [MATCH],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Tournament;

describe('C-SCHEMA-VERWIRFT-FELDER: speichern → lokal laden → Cloud-Zeile', () => {
  beforeEach(() => { stores.raw.clear(); });

  it('Spielnummer, Phase und Korrekturhistorie überstehen speichern und Laden', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(TOURNAMENT);
    const loaded = (await repo.get('t-1'))?.matches[0];
    expect(loaded?.matchNumber).toBe(11);
    expect(loaded?.phase).toBe('final');
    expect(loaded?.correctionHistory).toEqual(MATCH.correctionHistory);
  });

  it('ein Komplett-Speichern aus der lokalen Kopie schreibt match_number und phase unverändert in die Cloud-Zeile', async () => {
    const repo = new LocalStorageRepository();
    await repo.save(TOURNAMENT);
    const loaded = (await repo.get('t-1'))?.matches[0];
    expect(loaded).toBeDefined();
    const row = mapMatchToSupabase(loaded!, 't-1');
    expect(row.match_number).toBe(11);
    expect(row.phase).toBe('final');
    const update = mapMatchToScheduleUpdate(row);
    expect(update.match_number).toBe(11);
    expect(update.phase).toBe('final');
  });
});

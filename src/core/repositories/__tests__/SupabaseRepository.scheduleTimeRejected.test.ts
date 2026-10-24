/**
 * R8 (Befund C-VERSCHIEBEN-NUR-CLIENT, Migration 20261118_001): Der Server nimmt eine Uhrzeit nicht an, wenn das Spiel
 * schon angepfiffen oder beendet ist (@ZP-016) oder ein Spiel in die Vergangenheit vorgezogen würde (@ZP-057) – Fehlercode
 * HF005 (Trigger `matches_guard_schedule_times`). Die App meldet das ehrlich als „nicht übernommen“ (@FU-126) und
 * wiederholt es nicht. Uhrzeiten schreibt nur das Voll-Speichern (`save` → `mapMatchToScheduleUpdate`); `updateMatches`
 * sendet keine (`mapMatchUpdateToSupabase`), dort reicht der Code über `withPostgrestCode` (Test in errors/MutationQueue).
 * Supabase ist gemockt; die Antwort des Servers ist die, die der Container-Beweis `scripts/verschieben-server-check.sh` belegt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match, Tournament } from '../../models/types';
import { testUuid } from '../../../test/testIds';
import { testTeamSlot } from '../../../test/matchSlotFixtures';

type Row = Record<string, unknown>;

const hoisted = vi.hoisted(() => {
  const existingMatches = { rows: [] as Row[] };
  const updateResults = { byId: new Map<string, { data: Row[]; error: null | { message: string; code: string } }>() };
  const matchesUpdate = vi.fn((_update: Row) => ({
    eq: (_col: string, id: string) => ({
      eq: () => ({ select: () => Promise.resolve(updateResults.byId.get(id) ?? { data: [{ id }], error: null }) }),
    }),
  }));
  const from = vi.fn((table: string) => {
    if (table === 'tournaments') {
      return {
        upsert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 't' }], error: null }) }) }),
      };
    }
    if (table === 'teams') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === 'matches') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: existingMatches.rows, error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
        update: matchesUpdate,
      };
    }
    if (table === 'match_events') {
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
    }
    throw new Error(`unerwartete Tabelle im Test: ${table}`);
  });
  const supabase = { from, auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) } };
  return { existingMatches, updateResults, matchesUpdate, supabase };
});

vi.mock('../../../lib/supabase', () => ({ supabase: hoisted.supabase, isSupabaseConfigured: true }));

import { SupabaseRepository } from '../SupabaseRepository';
import { RepositoryError, definitiveRejectionReason, isTransientMutationError } from '../../errors';

const LOCKED = { message: 'SCHEDULE_LOCKED: Spiel m11 ist angepfiffen oder beendet (running), seine Uhrzeit bleibt.', code: 'HF005' };
const PAST = { message: 'SCHEDULE_PAST: Spiel m13 wuerde auf 15:15:00 ruecken, das liegt in der Vergangenheit.', code: 'HF005' };

const M11 = testUuid(111);
const M13 = testUuid(113);
const NORD = testUuid(201);
const SUED = testUuid(202);

function match(id: string, number: number, time: string): Match {
  return {
    id, round: 1, field: 1, slot: number, matchNumber: number, group: 'A', isFinal: false, phase: 'groupStage',
    slotA: testTeamSlot(NORD), slotB: testTeamSlot(SUED), scheduledTime: new Date(`2026-11-14T${time}:00`), matchStatus: 'scheduled',
  } as unknown as Match;
}

/** Olli hat ab 15:15 um 10 Minuten verschoben; Spiel 11 lief auf einem anderen Gerät schon (Server weiß es, das Gerät nicht). */
function hallencup(): Tournament {
  return {
    id: testUuid(1), title: 'Hallencup Ost', date: '2026-11-14', location: { name: 'Sporthalle Ost' },
    teams: [{ id: NORD, name: 'FC Nord', group: 'A' }, { id: SUED, name: 'SV Süd', group: 'A' }],
    matches: [match(M11, 11, '15:25'), match(M13, 13, '15:40')],
  } as unknown as Tournament;
}

beforeEach(() => {
  hoisted.updateResults.byId.clear();
  hoisted.matchesUpdate.mockClear();
  hoisted.existingMatches.rows = [M11, M13].map((id) => ({ id, match_status: 'scheduled', match_number: null, team_a_id: null, team_b_id: null }));
});

describe('R8: Server lehnt die Uhrzeit ab (HF005) – „nicht übernommen“, kein neuer Versuch', () => {
  it('@ZP-016 Voll-Speichern: Spiel 11 läuft schon -> RepositoryError mit HF005, eindeutig endgültig (invalidValue), nicht transient', async () => {
    hoisted.updateResults.byId.set(M11, { data: [], error: LOCKED });

    const error = await new SupabaseRepository().save(hallencup()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).originalError).toEqual(LOCKED);
    expect(definitiveRejectionReason(error)).toBe('invalidValue');
    expect(isTransientMutationError(error)).toBe(false);
  });

  it('@ZP-057 Voll-Speichern: Vorziehen von Spiel 13 in die Vergangenheit -> HF005 eindeutig endgültig, nicht transient', async () => {
    hoisted.updateResults.byId.set(M13, { data: [], error: PAST });

    const error = await new SupabaseRepository().save(hallencup()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect(definitiveRejectionReason(error)).toBe('invalidValue');
    expect(isTransientMutationError(error)).toBe(false);
  });

  it('Gegenbeispiel: ein Netzfehler beim Voll-Speichern bleibt unklar (kein „nicht übernommen“ wegen HF005)', async () => {
    hoisted.updateResults.byId.set(M11, { data: [], error: { message: 'Failed to fetch', code: '' } });

    const error = await new SupabaseRepository().save(hallencup()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).originalError).toBeUndefined();
    expect(definitiveRejectionReason(error)).toBeNull();
  });
});

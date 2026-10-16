/**
 * A-36a (MVP-Bauplan § 23, Brief Schritte 2–4): Herkunft des Platzes bis in die Cloud (H1).
 *
 * Der ganze Weg: Wizard veröffentlicht (`TournamentCreationService.publish`) bzw. Spielplan neu erzeugen
 * (`ScheduleService.regenerateSchedule`) → echtes `SupabaseRepository.save()` → gesendete Insert-Zeilen.
 * Supabase ist gemockt; geprüft werden die Zeilen, die tatsächlich an `matches.upsert` gehen.
 * Update-Wege (Voll-Speichern bestehender Spiele, `updateMatches`) senden `origin_*` nie – die Spalte ist
 * nach dem Anlegen unveränderlich (Trigger `matches_keep_origin`, Fehlercode HF002).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Match, Team, Tournament } from '../../models/types';
import type { ITournamentRepository } from '../ITournamentRepository';
import { testUuid } from '../../../test/testIds';

type Row = Record<string, unknown>;

const hoisted = vi.hoisted(() => {
  const matchesUpsert = vi.fn((_rows: Row[], _opts?: unknown) => Promise.resolve({ error: null }));
  const existingMatches = { rows: [] as Row[] };
  const updateResult = { value: { data: [{ id: 'x' }], error: null as null | { message: string; code: string } } };
  const matchesUpdate = vi.fn((_update: Row) => ({
    eq: () => ({ eq: () => ({ select: () => Promise.resolve(updateResult.value) }) }),
  }));
  const tournamentsUpdate = vi.fn((_update: Row) => ({
    eq: () => ({ select: () => Promise.resolve({ data: [{ id: 't' }], error: null }) }),
  }));
  const from = vi.fn((table: string) => {
    if (table === 'tournaments') {
      return { upsert: () => Promise.resolve({ error: null }), update: tournamentsUpdate };
    }
    if (table === 'teams') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
      };
    }
    if (table === 'matches') {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: existingMatches.rows, error: null }),
        }),
        upsert: matchesUpsert,
        update: matchesUpdate,
      };
    }
    if (table === 'match_events') {
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
    }
    throw new Error(`unerwartete Tabelle im Test: ${table}`);
  });
  const supabase = { from, auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) } };
  return { matchesUpsert, matchesUpdate, existingMatches, updateResult, supabase };
});

vi.mock('../../../lib/supabase', () => ({ supabase: hoisted.supabase, isSupabaseConfigured: true }));

import { SupabaseRepository } from '../SupabaseRepository';
import { TournamentCreationService } from '../../services/TournamentCreationService';
import { ScheduleService } from '../../services/ScheduleService';

function teams(): Team[] {
  return [
    ...[1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `FC Nord A${n}`, group: 'A' })),
    ...[1, 2, 3, 4].map((n) => ({ id: testUuid(10 + n), name: `SV Süd B${n}`, group: 'B' })),
  ];
}

/** 2 Gruppen à 4, Halbfinale über Kreuz + Finale (top-4). */
const hallencup: Partial<Tournament> = {
  title: 'Hallencup Nord',
  numberOfFields: 2,
  numberOfTeams: 8,
  numberOfGroups: 2,
  groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4' },
  teams: teams(),
};

const fakeRepository = (): ITournamentRepository => ({ save: vi.fn(() => Promise.resolve()) }) as unknown as ITournamentRepository;

function sentRows(): Row[] {
  return hoisted.matchesUpsert.mock.calls.flatMap(([rows]) => rows);
}

/** Zeile über die Herkunft der Besetzung finden (regenerateSchedule setzt kein Label/finalType). */
function bySlotSource(rows: Row[], source: Row): Row {
  const row = rows.find((r) => JSON.stringify(r.slot_a_source) === JSON.stringify(source));
  if (!row) {
    throw new Error(`Zeile mit slot_a_source ${JSON.stringify(source)} fehlt`);
  }
  return row;
}

function expectHallencupOrigins(rows: Row[]): void {
  const hf1 = bySlotSource(rows, { kind: 'groupRank', group: 'A', rank: 1 });
  const final = bySlotSource(rows, { kind: 'matchResult', matchId: hf1.id, role: 'winner' });
  expect(hf1.origin_a).toEqual({ kind: 'groupRank', group: 'A', rank: 1 });
  expect(hf1.origin_b).toEqual({ kind: 'groupRank', group: 'B', rank: 2 });
  expect(final.origin_a).toEqual({ kind: 'matchResult', matchId: hf1.id, role: 'winner' });
  const groupRows = rows.filter((r) => r.is_final === false);
  expect(groupRows.length).toBe(12);
  for (const row of groupRows) {
    expect('origin_a' in row).toBe(false);
    expect('origin_b' in row).toBe(false);
  }
}

beforeAll(() => {
  // publish() erzeugt einen Share-Code über window.crypto (utils/shareCode.ts).
  vi.stubGlobal('window', { crypto: globalThis.crypto });
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.existingMatches.rows = [];
  hoisted.updateResult.value = { data: [{ id: 'x' }], error: null };
});

describe('A-36a Herkunft des Platzes bis in die Cloud (Insert-Zeilen)', () => {
  it('@TM-015 Wizard-Veröffentlichen: HF1 origin_a = Erster A, origin_b = Zweiter B, Finale origin_a = Sieger HF1', async () => {
    const tournament = await new TournamentCreationService(fakeRepository()).publish({ ...hallencup });

    await new SupabaseRepository().save(tournament);

    expect(hoisted.matchesUpsert).toHaveBeenCalled();
    expectHallencupOrigins(sentRows());
  });

  it('@TM-015 Spielplan neu erzeugen (regenerateSchedule): dieselbe Herkunft in den Insert-Zeilen', async () => {
    const base = await new TournamentCreationService(fakeRepository()).publish({ ...hallencup });
    const stored: Tournament = { ...base, matches: [] };
    const cloud = new SupabaseRepository();
    const repository = {
      get: vi.fn(() => Promise.resolve(stored)),
      save: (t: Tournament) => cloud.save(t),
    } as unknown as ITournamentRepository;

    await new ScheduleService(repository).regenerateSchedule(stored.id);

    expectHallencupOrigins(sentRows());
  });

  it('Gegenbeispiel: Voll-Speichern eines BESTEHENDEN Spiels sendet keine origin_*-Spalte (Update-Weg)', async () => {
    const tournament = await new TournamentCreationService(fakeRepository()).publish({ ...hallencup });
    hoisted.existingMatches.rows = tournament.matches.map((m: Match) => ({
      id: m.id, match_status: 'scheduled', match_number: m.matchNumber ?? null, team_a_id: null, team_b_id: null,
    }));

    await new SupabaseRepository().save(tournament);

    expect(hoisted.matchesUpsert).not.toHaveBeenCalled();
    expect(hoisted.matchesUpdate).toHaveBeenCalledTimes(tournament.matches.length);
    for (const [update] of hoisted.matchesUpdate.mock.calls) {
      expect(Object.keys(update).filter((k) => k.startsWith('origin_'))).toEqual([]);
    }
  });
});

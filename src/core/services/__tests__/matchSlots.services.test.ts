/**
 * A-02 (MVP-Bauplan Spur A, GA1; Zusatz Controller aus A-01-Review I1): Neu erzeugte Turniere
 * tragen in jedem Spiel `slotA/slotB`. `TournamentCreationService.publish()` und
 * `ScheduleService.regenerateSchedule()` reichen die Slots aus dem Generator durch – sonst hätte
 * der Cloud-Mapper nichts zu schreiben und die Cloud lehnte jeden Eintrag ab.
 *
 * Anforderung: @FU-001 (Einträge eines frisch angelegten Turniers kommen in der Cloud an).
 */
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { TournamentCreationService } from '../TournamentCreationService';
import { ScheduleService } from '../ScheduleService';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import type { Match, Team, Tournament } from '../../models/types';
import { mapTournamentToSupabase } from '../../repositories/supabaseMappers';
import { testUuid } from '../../../test/testIds';

function teams(): Team[] {
  return [
    ...['A1', 'A2', 'A3'].map((n, i) => ({ id: testUuid(1 + i), name: `FC Nord ${n}`, group: 'A' })),
    ...['B1', 'B2', 'B3'].map((n, i) => ({ id: testUuid(11 + i), name: `SV Süd ${n}`, group: 'B' })),
  ];
}

/** 6 Teams in 2 Gruppen à 3, Halbfinale + Finale (top-4). */
const withFinals: Partial<Tournament> = {
  title: 'Hallencup',
  numberOfFields: 2,
  numberOfTeams: 6,
  numberOfGroups: 2,
  groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4' },
  teams: teams(),
};

function expectSlotsFromGenerator(matches: Match[], teamIds: Set<string>): void {
  expect(matches.length).toBeGreaterThan(0);
  for (const m of matches) {
    expect(m.slotA, `Spiel ${m.matchNumber ?? m.id} ohne slotA`).toBeDefined();
    expect(m.slotB, `Spiel ${m.matchNumber ?? m.id} ohne slotB`).toBeDefined();
    if (!m.isFinal) {
      expect(m.slotA?.kind === 'team' && teamIds.has(m.slotA.teamId)).toBe(true);
      expect(m.slotB?.kind === 'team' && teamIds.has(m.slotB.teamId)).toBe(true);
    }
  }
}

describe('A-02 – neu erzeugte Turniere tragen Slots bis in die Cloud-Zeile', () => {
  // publish() erzeugt einen Share-Code über window.crypto (utils/shareCode.ts); diese Datei läuft im
  // node-Projekt – Web-Crypto von Node genügt.
  beforeAll(() => {
    vi.stubGlobal('window', { crypto: globalThis.crypto });
  });

  it('@FU-001 publish(): jedes Spiel trägt slotA/slotB, Gruppenspiele mit Team-IDs, Finalrunde mit Herkunft', async () => {
    const save = vi.fn((_t: Tournament) => Promise.resolve());
    const service = new TournamentCreationService({ save } as unknown as ITournamentRepository);

    const tournament = await service.publish({ ...withFinals });

    const teamIds = new Set(tournament.teams.map((t) => t.id));
    expectSlotsFromGenerator(tournament.matches, teamIds);
    expect(tournament.matches.some((m) => m.isFinal && m.slotA?.kind === 'pending')).toBe(true);
  });

  it('@FU-001 Pflicht: die Cloud-Zeilen eines frisch angelegten Turniers tragen je Seite Team-ID oder Herkunft', async () => {
    const save = vi.fn((_t: Tournament) => Promise.resolve());
    const service = new TournamentCreationService({ save } as unknown as ITournamentRepository);
    const tournament = await service.publish({ ...withFinals });

    const { matchRows } = mapTournamentToSupabase(tournament, 'user-1');

    for (const row of matchRows) {
      expect(row.team_a_id !== null || row.slot_a_source !== null).toBe(true);
      expect(row.team_b_id !== null || row.slot_b_source !== null).toBe(true);
    }
    const groupRows = matchRows.filter((r) => r.is_final === false);
    expect(groupRows.length).toBe(6);
    for (const row of groupRows) {
      // append_match_events verlangt zwei Team-IDs (20261001_001: 22023 „noch keine zwei Teams“).
      expect(row.team_a_id).not.toBeNull();
      expect(row.team_b_id).not.toBeNull();
      expect(row.team_a_placeholder).toBeNull();
    }
  });

  it('@FU-001 Gegenbeispiel: kein Gruppenspiel trägt einen Teamnamen als Team-ID', async () => {
    const save = vi.fn((_t: Tournament) => Promise.resolve());
    const service = new TournamentCreationService({ save } as unknown as ITournamentRepository);
    const tournament = await service.publish({ ...withFinals });
    const names = new Set(tournament.teams.map((t) => t.name));

    const { matchRows } = mapTournamentToSupabase(tournament, 'user-1');

    for (const row of matchRows) {
      expect(names.has(String(row.team_a_id))).toBe(false);
      expect(names.has(String(row.team_b_id))).toBe(false);
    }
  });

  it('@FU-001 ScheduleService.regenerateSchedule(): jedes neu erzeugte Spiel trägt slotA/slotB', async () => {
    const save = vi.fn((_t: Tournament) => Promise.resolve());
    const creation = new TournamentCreationService({ save } as unknown as ITournamentRepository);
    const base = await creation.publish({ ...withFinals });
    const stored: Tournament = { ...base, matches: [] };
    const repository = {
      get: vi.fn(() => Promise.resolve(stored)),
      save,
    } as unknown as ITournamentRepository;

    const matches = await new ScheduleService(repository).regenerateSchedule(stored.id);

    expectSlotsFromGenerator(matches, new Set(stored.teams.map((t) => t.id)));
  });
});

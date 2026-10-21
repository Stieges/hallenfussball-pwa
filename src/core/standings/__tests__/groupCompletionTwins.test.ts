/**
 * GA4 A-13b-S Punkt 3 (task-GA4-plan-v2.md, Review-Auflagen 1, 7, 8 und Nachreview N2): Gleichlauf-Fixtures, TS-Seite.
 * Die SQL-Seite prüft scripts/group-completion-check.sh (Kategorie G) gegen dieselben Dateien in `../__fixtures__/`.
 *
 * - placements-to-play-out.json: parsePlacementsToPlayOut == match_engine.places_to_play_out
 * - standing-decision-shapes.json: StandingDecisionSchema (über parseStandingDecisions) + checkDraftFields ==
 *   match_engine.standing_decision_valid; wo TS heute lockerer ist, `it.fails` bis A-13b-S Punkt 7 (nach TB-B-Merge)
 * - shared-allowed.json: sharedPlaceAllowed == match_engine.shared_allowed (Spiele als Cloud-Zeilen über den Mapper)
 * - group-state.json: Zeilen ECHT ERZEUGT (publish → mapTournamentToSupabase, hier erneut erzeugt und verglichen);
 *   TS-Zwilling `expectedState` (A-13a, GroupCompletionService) über den Mapper zurück == `cases[].expected`
 * - group-key.json: TS-Zwilling `groupKeyOf` (A-13a, standingsGroups.ts) == `rows[].out`
 * Anforderungen: @TM-057, @TM-058, @TM-147, @W2A-048, @W2A-063, @W2A-064, @W2A-066, @W2A-067.
 */
import { describe, it, expect } from 'vitest';
import placementsFixture from '../__fixtures__/placements-to-play-out.json';
import shapesFixture from '../__fixtures__/standing-decision-shapes.json';
import sharedFixture from '../__fixtures__/shared-allowed.json';
import groupStateFixture from '../__fixtures__/group-state.json';
import groupKeyFixture from '../__fixtures__/group-key.json';
import { parsePlacementsToPlayOut } from '../playOutPlaces';
import { checkDraftFields, sharedPlaceAllowed } from '../decisions';
import { parseStandingDecisions } from '../../models/schemas/StandingDecisionSchema';
import { mapMatchFromSupabase } from '../../repositories/supabaseMappers';
import { generateRows, normalizeRows, type GeneratedRows, type GeneratedTournamentKey } from '../../../test/groupCompletionRows';
import type { Team } from '../../../types/tournament';
import { groupKeyOf } from '../../models/standingsGroups';
import { expectedState } from '../../services/GroupCompletionService';
import { tournamentFromFixture } from './groupCompletionKit';

type MatchRowInput = Parameters<typeof mapMatchFromSupabase>[0];

/** TS-Prüfung einer gespeicherten Entscheidung: lesen wie aus dem config, dann die Felder wie beim Eintragen. */
function tsValid(decision: unknown): boolean {
  const parsed = parseStandingDecisions([decision]);
  if (parsed?.length !== 1) {
    return false;
  }
  // Der Grund einer Reihenfolge wird getrennt geprüft (nicht Teil der gespeicherten Form, @W2A-072).
  return checkDraftFields({ ...parsed[0], reason: 'Grund' }) === null;
}

describe('A-13b-S Gleichlauf placements-to-play-out.json (parsePlacementsToPlayOut == places_to_play_out)', () => {
  for (const row of placementsFixture.rows) {
    const config = row.config as { placementsToPlayOut?: unknown };
    if ('tsHeute' in row) {
      it.fails(`${row.name} – TS heute ${JSON.stringify(row.tsHeute)} (bis A-13b-S Punkt 7, C-ENTSCHEIDUNG-TS-GRENZEN)`, () => {
        expect(parsePlacementsToPlayOut(config.placementsToPlayOut)).toEqual(row.expected);
      });
      it(`${row.name} – heutiger TS-Wert ist festgehalten`, () => {
        expect(parsePlacementsToPlayOut(config.placementsToPlayOut)).toEqual(row.tsHeute);
      });
    } else {
      it(row.name, () => {
        expect(parsePlacementsToPlayOut(config.placementsToPlayOut)).toEqual(row.expected);
      });
    }
  }
});

describe('A-13b-S Gleichlauf standing-decision-shapes.json (StandingDecisionSchema + checkDraftFields == standing_decision_valid)', () => {
  for (const row of shapesFixture.rows) {
    if ('tsHeute' in row && row.tsHeute !== row.ts) {
      it.fails(`${row.name} – TS heute ${String(row.tsHeute)} (bis A-13b-S Punkt 7, C-ENTSCHEIDUNG-TS-GRENZEN)`, () => {
        expect(tsValid(row.decision)).toBe(row.ts);
      });
    } else {
      it(row.name, () => {
        expect(tsValid(row.decision)).toBe(row.ts);
      });
    }
  }

  it('N2: die Zeilen „ohne Ergebnis“, „Sieger nicht größer“ und „Altfelder“ stehen in der Fixture', () => {
    const names = shapesFixture.rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining([
      'Strafstoßschießen ohne Ergebnis (N2)',
      'Strafstoßschießen 3:3 (Sieger nicht größer, N2)',
      "Altfelder decidedBy/decidedAt/reason (vor TB-3')",
    ]));
  });

  it('nur die Altfelder-Zeile weicht zwischen TS und SQL gewollt ab (Review N2)', () => {
    expect(shapesFixture.rows.filter((r) => r.ts !== r.sql).map((r) => r.name)).toEqual(["Altfelder decidedBy/decidedAt/reason (vor TB-3')"]);
  });
});

function matchFromRow(row: Record<string, unknown>): ReturnType<typeof mapMatchFromSupabase> {
  const full = {
    round: 1, field: 1, slot: null, score_a: null, score_b: null, group_letter: null, final_type: null, label: null,
    scheduled_start: null, phase: 'final', referee_number: null, match_status: 'scheduled', live_state: null,
    actual_end: null, timer_start_time: null, timer_paused_at: null, timer_elapsed_seconds: 0, overtime_score_a: null,
    overtime_score_b: null, penalty_score_a: null, penalty_score_b: null, decided_by: null, skipped_reason: null,
    skipped_at: null, ...row,
  } as unknown as MatchRowInput;
  return mapMatchFromSupabase(full, '2026-11-28');
}

describe('A-13b-S Gleichlauf shared-allowed.json (sharedPlaceAllowed == shared_allowed)', () => {
  for (const row of sharedFixture.rows) {
    it(row.name, () => {
      const teams = row.teams as Team[];
      const tournament = {
        teams,
        matches: (row.matches as Array<Record<string, unknown>>).map(matchFromRow),
        placementsToPlayOut: row.config.placementsToPlayOut,
      };
      expect(sharedPlaceAllowed(tournament, row.groupId, row.block)).toBe(row.expected);
    });
  }
});

describe('A-13b-S group-state.json: Zeilen echt erzeugt (Review-Auflage 1, R-GA4v2-7)', () => {
  const fixtureRows = groupStateFixture.tournaments as unknown as Record<GeneratedTournamentKey, GeneratedRows>;

  for (const key of ['nikolaus', 'hallencup'] as const) {
    it(`${key}: publish → mapTournamentToSupabase ergibt dieselben Zeilen wie die Fixture (Spiel-IDs normalisiert)`, async () => {
      expect(normalizeRows(await generateRows(key))).toEqual(normalizeRows(fixtureRows[key]));
    });
  }

  it('@TM-057 Nikolaus: alle 15 Spiele tragen group_letter „all“, die Teams keine Gruppe (drei Schreibweisen derselben Gruppe)', () => {
    const { matches, teams } = fixtureRows.nikolaus;
    expect(matches).toHaveLength(15);
    expect(new Set(matches.map((m) => m.group_letter))).toEqual(new Set(['all']));
    expect(new Set(teams.map((t) => t.group_letter))).toEqual(new Set([null]));
  });

  it('@W2A-048 Hallencup: 2×4 mit je 6 Gruppenspielen, Halbfinale 1 = Erster A gegen Zweiter B, Halbfinale 2 = Erster B gegen Zweiter A', () => {
    const { matches } = fixtureRows.hallencup;
    const group = (g: string) => matches.filter((m) => m.is_final === false && m.group_letter === g);
    expect([group('A').length, group('B').length]).toEqual([6, 6]);
    const semis = matches.filter((m) => m.is_final === true && (m.origin_a as { kind?: string } | null)?.kind === 'groupRank');
    expect(semis.map((m) => [m.origin_a, m.origin_b])).toEqual([
      [{ kind: 'groupRank', group: 'A', rank: 1 }, { kind: 'groupRank', group: 'B', rank: 2 }],
      [{ kind: 'groupRank', group: 'B', rank: 1 }, { kind: 'groupRank', group: 'A', rank: 2 }],
    ]);
  });

  it('Erwartung je Gruppe: Nikolaus "" = alle 15 Spiele, Hallencup A/B je 6, nie ein Finalspiel, „all“ ist keine Gruppe', () => {
    const count = (t: string, g: string) => groupStateFixture.cases.find((c) => c.tournament === t && c.group === g)?.expected.length;
    expect([count('nikolaus', ''), count('nikolaus', 'all'), count('hallencup', 'A'), count('hallencup', 'B'), count('hallencup', '')])
      .toEqual([15, 0, 6, 6, 0]);
    const finals = new Set(fixtureRows.hallencup.matches.filter((m) => m.is_final === true).map((m) => m.id));
    expect(groupStateFixture.cases.flatMap((c) => c.expected).some((e) => finals.has(e.id))).toBe(false);
  });

  for (const c of groupStateFixture.cases) {
    it(`@TM-057 @TM-058 A-13a: expectedState(${c.tournament}, „${c.group}“) aus den Zeilen (Mapper) == match_engine.group_state – ${c.note}`, () => {
      expect(expectedState(tournamentFromFixture(c.tournament as GeneratedTournamentKey), c.group)).toEqual(c.expected);
    });
  }
});

describe('A-13b-S group-key.json', () => {
  it('die Fixture deckt NULL, leer, „all“ und Buchstaben ab', () => {
    expect(groupKeyFixture.rows.map((r) => r.in)).toEqual(expect.arrayContaining([null, '', 'all', 'A']));
  });

  for (const row of groupKeyFixture.rows) {
    it(`@TM-057 A-13a: groupKeyOf == match_engine.group_key – ${row.name}`, () => {
      expect(groupKeyOf(row.in ?? undefined)).toBe(row.out);
      expect(groupKeyOf(row.in)).toBe(row.out);
    });
  }
});

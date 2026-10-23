/**
 * A-14b (GA4, @TM-017, @TM-051, @TM-052, @TM-061, @TM-067, @ET-002): EINE Sieger-Regel als Gleichlauf-Fixture.
 *
 * `__fixtures__/knockout-winner.json` hält Halbfinal-Zeilen im Spaltenformat der Cloud (`matches`) mit der erwarteten
 * Siegerseite. Hier laufen sie über den Mapper (`mapMatchFromSupabase`) in `getMatchWinner`, in die Besetzung der
 * Folgespiele (`resolveBracketAfterPlayoffMatch`) und in die Platzierung (`calculateFinalsPlacement`) -- alle drei
 * müssen dieselbe Seite nennen. Dieselbe Datei prüft in A-14c den SQL-Zwilling; deshalb nur Spalten der Tabelle.
 * Die erwartete Seite steht in der Fixture (aus dem Gherkin), sie wird nicht aus dem Code abgelesen.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import fixtureJson from '../__fixtures__/knockout-winner.json';
import { resolveBracketAfterPlayoffMatch } from '..';
import { mapMatchFromSupabase } from '../../repositories/supabaseMappers';
import { applyEngineOverlay, engineOverlayFields, type EngineOverlayFields } from '../../match/client/applyEngineOverlay';
import { initialState } from '../../match/applyEvent';
import type { MatchContext, MatchState } from '../../match/types';
import type { MatchEngineView } from '../../match/client/MatchEngine';
import { calculateFinalsPlacement, getMatchWinner } from '../../../utils/calculations';
import { createMockTournament } from '../../../test/factories';
import type { Database } from '../../../types/supabase';
import type { Match, MatchDecidedBy, Team } from '../../../types/tournament';

type MatchRow = Database['public']['Tables']['matches']['Row'];
type Side = 'A' | 'B';
interface FixtureRow {
  name: string;
  szenarien: string[];
  row: Record<string, unknown>;
  expect: { winner: Side | null };
}
interface Fixture {
  teams: Record<Side, string>;
  rows: FixtureRow[];
}

const fx = fixtureJson as unknown as Fixture;
const [NORD, BERG] = [fx.teams.A, fx.teams.B];
const SUED = '00000000-0000-4000-8000-000000000003';
const OST = '00000000-0000-4000-8000-000000000004';
const FINALE = '00000000-0000-4000-8000-000000000901';
const PLATZ3 = '00000000-0000-4000-8000-000000000902';
const TOURNAMENT_DATE = '2026-11-28';

/** Jede Spalte der Tabelle `matches` außer den Pflichtspalten; die Fixture-Zeile überschreibt. */
const NULL_COLUMNS: Omit<MatchRow, 'id' | 'round' | 'field' | 'tournament_id'> = {
  actual_end: null, actual_start: null, bib_side: null, created_at: null, decided_by: null, duration_minutes: null,
  final_type: null, forfeit_absent: null, group_letter: null, is_final: null, is_public: null, kit_color_a: null, kit_color_b: null,
  label: null, last_modified_by: null, live_state: null, match_number: null, match_status: null, origin_a: null,
  origin_b: null, overtime_score_a: null, overtime_score_b: null, owner_id: null, penalty_score_a: null,
  penalty_score_b: null, phase: null, referee_number: null, referee_team_id: null, scheduled_start: null,
  original_start: null, reassigned_at: null, score_a: null, score_b: null, skipped_at: null, skipped_reason: null, slot: null, slot_a_source: null,
  slot_b_source: null, team_a_id: null, team_a_placeholder: null, team_b_id: null, team_b_placeholder: null,
  timer_elapsed_seconds: null, timer_paused_at: null, timer_start_time: null, updated_at: null, version: null,
};
/** `forfeit_absent` kommt mit `20261110_005` (A-25b); die Fixture führt die Spalte schon, der Mapper ignoriert sie bis A-25c. */
const KNOWN_COLUMNS = new Set<string>([...Object.keys(NULL_COLUMNS), 'id', 'round', 'field', 'tournament_id', 'forfeit_absent']);

const toMatch = (columns: Record<string, unknown>): Match =>
  mapMatchFromSupabase({ ...NULL_COLUMNS, tournament_id: 't', ...columns } as unknown as MatchRow, TOURNAMENT_DATE);

const teams: Team[] = [
  { id: NORD, name: 'FC Nord' }, { id: BERG, name: 'DJK Berg' }, { id: SUED, name: 'SV Süd' }, { id: OST, name: 'SC Ost' },
];
const teamIdOf = (side: Side | null): string | null => (side === null ? null : side === 'A' ? NORD : BERG);
const otherIdOf = (side: Side): string => (side === 'A' ? BERG : NORD);
const rowNamed = (part: string): FixtureRow => {
  const found = fx.rows.find((r) => r.name.includes(part));
  if (found === undefined) {
    throw new Error(`Fixture-Zeile fehlt: ${part}`);
  }
  return found;
};
const sourceOf = (matchId: string, role: 'winner' | 'loser') => ({ kind: 'matchResult', matchId, role });
const slotTeam = (slot: Match['slotA'] | undefined): string | null => (slot?.kind === 'team' ? slot.teamId : null);

describe('A-14b Fixture knockout-winner.json: Form (keine Felder nur für TS, alle Fälle vorhanden)', () => {
  it('jede Spalte jeder Zeile gehört zur Tabelle matches (A-14c prüft dieselbe Datei gegen SQL)', () => {
    const fremd = fx.rows.flatMap((r) => Object.keys(r.row)).filter((key) => !KNOWN_COLUMNS.has(key));
    expect(fremd).toEqual([]);
  });

  it('die Fixture deckt Strafstoß, Verlängerung, Golden Goal, Nichtantritt A/B/beide, laufend, unterbrochen und 1:1 ohne Entscheidung ab', () => {
    const rows = fx.rows.map((r) => r.row);
    const has = (test: (row: Record<string, unknown>) => boolean): boolean => rows.some(test);
    expect(has((r) => r.decided_by === 'penalty')).toBe(true);
    expect(has((r) => r.decided_by === 'overtime')).toBe(true);
    expect(has((r) => r.decided_by === 'goldenGoal')).toBe(true);
    for (const absent of ['A', 'B', 'both']) {
      expect(has((r) => r.decided_by === 'forfeit' && r.forfeit_absent === absent)).toBe(true);
    }
    expect(has((r) => r.match_status === 'running')).toBe(true);
    expect(has((r) => r.match_status === 'paused')).toBe(true);
    expect(has((r) => r.match_status === 'finished' && r.score_a === r.score_b && r.decided_by === null)).toBe(true);
    expect(new Set(fx.rows.map((r) => r.expect.winner))).toEqual(new Set<Side | null>(['A', 'B', null]));
  });
});

describe('@ET-002 @TM-017:teil @TM-051:teil @TM-052:teil @TM-061:teil @TM-067:teil getMatchWinner über den Mapper', () => {
  it.each(fx.rows)('Sieger-Regel: $name', ({ row, expect: expected }) => {
    const result = getMatchWinner(toMatch(row));
    expect(result?.winner ?? null).toBe(teamIdOf(expected.winner));
    if (expected.winner !== null) {
      expect(result?.loser).toBe(otherIdOf(expected.winner));
    }
  });

  it('@TM-017:teil Gegenbeispiel: laufendes Halbfinale beim Stand 2:1 hat keinen Sieger', () => {
    expect(getMatchWinner(toMatch(rowNamed('läuft beim Stand 2:1').row))).toBeNull();
  });

  it('@TM-051:teil Gegenbeispiel: beendetes 1:1 ohne Entscheidung hat keinen Sieger', () => {
    expect(getMatchWinner(toMatch(rowNamed('1:1 ohne Entscheidung').row))).toBeNull();
  });

  it('@TM-061:teil Gegenbeispiel: Nichtantritt beider Seiten gibt keinen Sieger und kein Remis-Weiterkommen', () => {
    const match = toMatch(rowNamed('Nichtantritt beider Seiten').row);
    expect(getMatchWinner(match)).toBeNull();
  });
});

describe('@TM-017:teil @TM-052:teil @TM-061:teil Besetzung der Folgespiele folgt derselben Sieger-Regel', () => {
  const finalrunde = (hfRow: Record<string, unknown>): { hf: Match; finale: Match; platz3: Match; tournament: ReturnType<typeof createMockTournament> } => {
    const hf = toMatch(hfRow);
    const finale = toMatch({
      id: FINALE, round: 3, field: 1, is_final: true, final_type: 'final', phase: 'final', team_b_id: SUED,
      slot_a_source: sourceOf(hf.id, 'winner'),
    });
    const platz3 = toMatch({
      id: PLATZ3, round: 3, field: 2, is_final: true, final_type: 'thirdPlace', phase: 'thirdPlace', team_b_id: OST,
      slot_a_source: sourceOf(hf.id, 'loser'),
    });
    return { hf, finale, platz3, tournament: createMockTournament({ teams, matches: [hf, finale, platz3], groupSystem: 'groupsAndFinals' }) };
  };

  it.each(fx.rows)('Finale zeigt den Sieger, Platz 3 den Verlierer, sonst bleibt es offen: $name', ({ row, expect: expected }) => {
    const { tournament } = finalrunde(row);
    const resolution = resolveBracketAfterPlayoffMatch(tournament);
    const finale = tournament.matches.find((m) => m.id === FINALE);
    const platz3 = tournament.matches.find((m) => m.id === PLATZ3);
    if (expected.winner === null) {
      expect(resolution?.wasResolved).toBe(false);
      expect(finale?.slotA?.kind).toBe('pending');
      expect(platz3?.slotA?.kind).toBe('pending');
    } else {
      expect(resolution?.wasResolved).toBe(true);
      expect(slotTeam(finale?.slotA)).toBe(teamIdOf(expected.winner));
      expect(slotTeam(platz3?.slotA)).toBe(otherIdOf(expected.winner));
    }
  });
});

describe('@ET-002 @TM-052:teil Platzierung nutzt dieselbe Sieger-Regel', () => {
  it.each(fx.rows)('Finale auf Platz 1 und 2 nur mit Sieger: $name', ({ row, expect: expected }) => {
    const finale = toMatch({ ...row, final_type: 'final', phase: 'final' });
    const result = calculateFinalsPlacement(teams, [finale], []);
    const top = result.placements.filter((p) => p.rank <= 2).map((p) => [p.rank, p.team.id]);
    if (expected.winner === null) {
      expect(top).toEqual([]);
    } else {
      expect(top).toEqual([[1, teamIdOf(expected.winner)], [2, otherIdOf(expected.winner)]]);
    }
  });
});

// Befund C-DECIDEDBY-SHOOTOUT (keine Kennung im Titel, die Befund-Liste kennt ihn noch nicht als Testverweis).
describe('@ET-002 @TM-052:teil Doppelbenennung shootout/penalty: der Engine-Wert shootout erreicht die Sieger-Regel nur übersetzt', () => {
  const ctx: MatchContext = { matchId: fx.rows[0].row.id as string, teamAId: NORD, teamBId: BERG };
  const viewOf = (state: MatchState): MatchEngineView => ({ result: { state, localRejected: [], needsFullReload: false }, log: [], confirmedCount: 0 });
  const shootoutState = (overrides: Partial<MatchState>): MatchState => {
    const base = initialState(ctx);
    return {
      ...base,
      phase: 'shootout',
      scores: { [NORD]: { regular: 1, overtime: 0, shootout: 4 }, [BERG]: { regular: 1, overtime: 0, shootout: 3 } },
      ...overrides,
    };
  };
  /** Der Cloud-Stand ist noch „nicht angepfiffen“ -- der Engine-Zustand überlagert ihn. */
  const scheduled = (): Match => toMatch({ ...fx.rows[0].row, match_status: 'scheduled', score_a: null, score_b: null, decided_by: null });
  const overlaid = (state: MatchState): { fields: EngineOverlayFields; match: Match } => {
    const fields = engineOverlayFields(viewOf(state), ctx);
    const match = applyEngineOverlay({ matches: [scheduled()] }, new Map([[ctx.matchId, fields]])).matches[0];
    return { fields, match };
  };

  it('Strafstoßschießen 4:3 für Nord beendet das Spiel: die Projektion schreibt penalty, getMatchWinner nennt Nord', () => {
    const { fields, match } = overlaid(shootoutState({ status: 'finished', decidedBy: 'shootout', baseDecidedBy: 'shootout', finishedAt: 9999 }));
    expect(fields.decidedBy).toBe('penalty');
    expect(match.decidedBy).toBe('penalty');
    expect(getMatchWinner(match)).toEqual({ winner: NORD, loser: BERG });
  });

  it('Gegenbeispiel: läuft das Strafstoßschießen noch (4:3), gibt es noch keinen Sieger', () => {
    const { match } = overlaid(shootoutState({ status: 'shootout' }));
    expect(match.matchStatus).toBe('running');
    expect(getMatchWinner(match)).toBeNull();
  });

  it('die Projektion kann den Engine-Wert shootout gar nicht ausgeben (Typ ist der Wert der Spalte decided_by)', () => {
    expectTypeOf<EngineOverlayFields['decidedBy']>().toEqualTypeOf<MatchDecidedBy | undefined>();
    expect(['regular', 'overtime', 'goldenGoal', 'penalty']).toContain(
      overlaid(shootoutState({ status: 'finished', decidedBy: 'shootout', baseDecidedBy: 'shootout', finishedAt: 9999 })).fields.decidedBy,
    );
  });
});

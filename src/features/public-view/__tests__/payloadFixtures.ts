/**
 * Nutzlasten des Nikolaus-Turniers (6 Teams, Jeder gegen jeden, 15 Spiele) für die Byte-Messung und die Stub-Tests des
 * Server-Vertrags (B-15). Nur Testumgebung.
 *
 * Grundlage sind die echt erzeugten Cloud-Zeilen der Fixture `group-state.json` (publish → mapTournamentToSupabase). Wie
 * `select('*')` sie liefert, kommen alle Spalten der Tabelle dazu (fehlende als `null`, `created_at`/`updated_at` mit Zeit).
 * Stand der Lage: 8 Spiele beendet, Spiel 9 läuft (Feinstatus `live_state`), 6 Spiele offen.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import groupStateFixture from '../../../core/standings/__fixtures__/group-state.json';
import { testUuid } from '../../../test/testIds';

type Row = Record<string, unknown>;

interface FixtureRows {
  tournament: Row;
  teams: Row[];
  matches: Row[];
}

const FIXTURE = (groupStateFixture.tournaments as unknown as Record<'nikolaus', FixtureRows>).nikolaus;
const RESULTS = new Map(groupStateFixture.updates.filter((u) => u.tournament === 'nikolaus').map((u) => [u.id, u] as const));

const TIMESTAMP = '2026-10-21T00:44:01.347123+00:00';
const FINISHED_MATCHES = 8;
const RUNNING_MATCH_NUMBER = 9;
const TOURNAMENT_ID = String(FIXTURE.tournament.id);

/** Spaltennamen der Tabelle laut generierten Typen (`Row`), damit `select('*')` vollständig nachgebildet wird. */
function columnsOf(table: 'tournaments' | 'teams' | 'matches'): string[] {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../types/supabase.ts'), 'utf8');
  const start = source.indexOf(`      ${table}: {\n        Row: {`);
  const end = source.indexOf('        Insert: {', start);
  return [...source.slice(start, end).matchAll(/^ {10}([a-z_]+)\??:/gm)].map((match) => match[1]);
}

function fullRow(table: 'tournaments' | 'teams' | 'matches', row: Row): Row {
  const filled: Row = {};
  for (const column of columnsOf(table)) {
    filled[column] = column in row ? row[column] : column === 'created_at' || column === 'updated_at' ? TIMESTAMP : null;
  }
  return filled;
}

const LIVE_STATE = {
  status: 'running', phase: 'regular', section: 1, sections: 1, sectionSeconds: 600, overtimeSeconds: 300,
  sectionStartMs: 0, elapsedMs: 253000, anchorAt: 1_792_575_000_000,
  scores: {}, effectiveScores: {}, shootoutKicks: [], lastScoreEventId: null,
};

/** Alle Spielzeilen in Spielnummer-Reihenfolge, wie `select('*')` sie liefert. */
export function nikolausMatchRows(): Row[] {
  return [...FIXTURE.matches]
    .sort((a, b) => Number(a.match_number) - Number(b.match_number))
    .map((row) => {
      const number = Number(row.match_number);
      if (number <= FINISHED_MATCHES) {
        const result = RESULTS.get(String(row.id));
        return fullRow('matches', { ...row, score_a: result?.score_a, score_b: result?.score_b, match_status: 'finished', decided_by: 'regular' });
      }
      if (number === RUNNING_MATCH_NUMBER) {
        return fullRow('matches', { ...row, score_a: 1, score_b: 0, match_status: 'running', live_state: LIVE_STATE });
      }
      return fullRow('matches', row);
    });
}

export function nikolausTeamRows(): Row[] {
  return FIXTURE.teams.map((row) => fullRow('teams', row));
}

export function nikolausTournamentRow(): Row {
  return fullRow('tournaments', { ...FIXTURE.tournament, share_code: 'NIK6ST', is_public: true });
}

// --- Weg (a): drei Antworten von `select('*')` ------------------------------------------------------------------------

export function legacyResponses(): { tournament: string; teams: string; matches: string } {
  return {
    tournament: JSON.stringify(nikolausTournamentRow()),
    teams: JSON.stringify(nikolausTeamRows()),
    matches: JSON.stringify(nikolausMatchRows()),
  };
}

// --- Weg (b): Antworten von `public_tournament` nach dem B-14-Vertrag (Positivliste, E-A2) -------------------------------

const TOURNAMENT_PUBLIC_COLUMNS = [
  'id', 'title', 'date', 'start_time', 'status', 'sport', 'tournament_type', 'location_name', 'location_city',
  'number_of_fields', 'number_of_teams', 'number_of_groups', 'group_phase_duration', 'group_phase_break',
  'final_round_duration', 'final_round_break', 'point_system', 'finals_config', 'config', 'completed_at', 'version',
] as const;
const TEAM_PUBLIC_COLUMNS = ['id', 'name', 'group_letter', 'logo_path', 'color_primary', 'color_secondary', 'logo_background_color', 'is_removed'] as const;
const MATCH_PUBLIC_COLUMNS = [
  'id', 'round', 'field', 'slot', 'team_a_id', 'team_b_id', 'slot_a_source', 'slot_b_source', 'origin_a', 'origin_b', 'score_a', 'score_b',
  'group_letter', 'is_final', 'final_type', 'label', 'scheduled_start', 'match_number', 'phase', 'match_status', 'live_state',
  'decided_by', 'overtime_score_a', 'overtime_score_b', 'penalty_score_a', 'penalty_score_b', 'timer_elapsed_seconds',
  'timer_start_time', 'timer_paused_at', 'actual_end', 'kit_color_a', 'kit_color_b', 'bib_side',
] as const;

function pick(row: Row, columns: readonly string[]): Row {
  return Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]]));
}

/** Tore eines beendeten oder laufenden Spiels als Ereignisse in der öffentlichen Form des B-14-Vertrags. */
function eventsOf(row: Row, index: number): Row[] {
  const home = Number(row.score_a ?? 0);
  const away = Number(row.score_b ?? 0);
  const events: Row[] = [];
  for (let goal = 0; goal < home + away; goal += 1) {
    const forHome = goal < home;
    events.push({
      id: testUuid(5000 + index * 20 + goal),
      type: 'GOAL',
      team_id: forHome ? row.team_a_id : row.team_b_id,
      section: 1,
      clock_ms: (40 + goal * 70) * 1000,
      number: 3 + goal,
    });
  }
  return events;
}

function publicMatch(row: Row, index: number): Row {
  return { ...pick(row, MATCH_PUBLIC_COLUMNS), events: eventsOf(row, index) };
}

/** Serverzeit der Antworten (ms) und Version vor dem Tor. */
export const STUB_SERVER_NOW = 1_792_575_061_000;
export const STUB_VERSION = 412;

export function fullReply(version = STUB_VERSION): Row {
  return {
    state: 'full',
    version,
    server_now: STUB_SERVER_NOW,
    tournament: pick(nikolausTournamentRow(), TOURNAMENT_PUBLIC_COLUMNS),
    teams: nikolausTeamRows().map((row) => pick(row, TEAM_PUBLIC_COLUMNS)),
    matches: nikolausMatchRows().map(publicMatch),
  };
}

export function unchangedReply(version = STUB_VERSION): Row {
  return { state: 'unchanged', version, server_now: STUB_SERVER_NOW };
}

/** „Tor in Spiel 9“: das Spiel mit neuem Stand und seinen Ereignissen. */
export function deltaOneGoalReply(baseVersion = STUB_VERSION): Row {
  const index = nikolausMatchRows().findIndex((row) => Number(row.match_number) === RUNNING_MATCH_NUMBER);
  const running = { ...nikolausMatchRows()[index], score_a: 2, score_b: 0 };
  return {
    state: 'delta',
    version: baseVersion + 1,
    base_version: baseVersion,
    server_now: STUB_SERVER_NOW + 5000,
    tournament_date: String(FIXTURE.tournament.date),
    matches: [publicMatch(running, index)],
    removed_match_ids: [],
  };
}

export { TOURNAMENT_ID, RUNNING_MATCH_NUMBER };

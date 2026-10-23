/**
 * Test-Hilfen A-25c (Nichtantritts-Wertung in Gesamt- und Sondertabelle): Spiele und Turniere über den echten Lese-Weg
 * der Cloud – `select('*')`-Zeilen mit `decided_by 'forfeit'` und `forfeit_absent` (Spalte ab Migration
 * `20261110_005`) durch `mapMatchFromSupabase` bzw. `mapTournamentFromSupabase`. Nur Testumgebung.
 */
import type { Json } from '../../../types/supabase';
import type { ForfeitAbsent, Match, Team, Tournament } from '../../../types/tournament';
import { mapMatchFromSupabase, mapMatchToSupabase, mapTournamentFromSupabase } from '../../repositories/supabaseMappers';
import { createMatchRow, createTeamRow, createTournamentRow, type MatchRow } from '../../../../tests/factories/supabase';
import { testUuid, vs } from '../../../test/matchSlotFixtures';

export const TOURNAMENT_ID = 'tournament-1';
const DATE = '2026-12-06';

/**
 * Cloud-Zeile eines Spiels mit dem gespeicherten Stand; `absent` = wer fehlte (Wertung). `withColumn: false` bildet
 * eine Zeile vor `_005` nach (Spalte fehlt ganz); sonst trägt jede Zeile die Spalte (NULL ohne Wertung).
 */
export function cloudRow(match: Match, absent?: ForfeitAbsent, opts: { withColumn?: boolean } = {}): MatchRow {
  const finished = match.matchStatus === 'finished';
  const row = createMatchRow({
    ...mapMatchToSupabase(match, TOURNAMENT_ID),
    score_a: match.scoreA ?? null,
    score_b: match.scoreB ?? null,
    match_status: match.matchStatus ?? null,
    decided_by: absent !== undefined ? 'forfeit' : finished ? 'regular' : null,
  });
  if (opts.withColumn === false) {
    // Zeile wie vor 20261110_005: die Spalte fehlt ganz (die Fabrik setzt sie seit dem Typ-Abgleich 23.10. auf null).
    Reflect.deleteProperty(row, 'forfeit_absent');
    return row;
  }
  return Object.assign(row, { forfeit_absent: absent ?? null });
}

/** Ein Spiel nach dem Rundlauf über seine Cloud-Zeile. */
export const viaCloud = (match: Match, absent?: ForfeitAbsent): Match => mapMatchFromSupabase(cloudRow(match, absent), DATE);

/** Ein ganzes Turnier über die Cloud-Zeilen; `forfeits` = Spiel-ID → wer fehlte; `config` = `tournaments.config`. */
export function cloudTournament(
  teams: readonly Team[],
  matches: readonly Match[],
  forfeits: Readonly<Record<string, ForfeitAbsent>> = {},
  config: Record<string, Json> = {},
): Tournament {
  const teamRows = teams.map((t) => createTeamRow({ id: t.id, name: t.name, group_letter: t.group ?? null, tournament_id: TOURNAMENT_ID }));
  const matchRows = matches.map((m) => cloudRow(m, forfeits[m.id]));
  return mapTournamentFromSupabase(createTournamentRow({ id: TOURNAMENT_ID, date: DATE, config }), teamRows, matchRows);
}

/** Spiel-ID einer Paarung „H–G“ in einer Ergebnisliste von `parseMatches` (gleiches ID-Präfix). */
export function matchIdOf(results: string, pairing: string, idPrefix = 'm'): string {
  const index = results.split(';').map((p) => p.trim()).findIndex((p) => p.startsWith(`${pairing} `));
  if (index < 0) {
    throw new Error(`Fixture: Paarung ${pairing} fehlt`);
  }
  return `${idPrefix}-${String(index + 1)}`;
}

/** Teams mit freien Namen aus dem Gherkin („Team C“, „Team D“); IDs ab 50, damit sie die Kurzzeichen nicht treffen. */
export const namedTeams = (names: readonly string[], group?: string): Team[] =>
  names.map((name, i) => ({ id: testUuid(50 + i), name, ...(group !== undefined ? { group } : {}) }));

/** Ein Gruppenspiel zwischen zwei Teams; ohne Stand offen (`scheduled`), mit Stand beendet. */
export function game(id: string, home: Team, away: Team, score?: readonly [number, number], group?: string): Match {
  return {
    id,
    round: 1,
    field: 1,
    ...vs(home.id, away.id),
    ...(group !== undefined ? { group } : {}),
    ...(score === undefined ? { matchStatus: 'scheduled' as const } : { matchStatus: 'finished' as const, scoreA: score[0], scoreB: score[1] }),
  };
}

/**
 * Antwort der öffentlichen Server-Funktionen `public_tournament(share_code, since_version)` (Zuschauer) und
 * `display_tournament(tournament_id, monitor_id, since_version)` (heutiger Monitor-Link) -- B-14, E-A2.
 *
 * Vertrag (Server: supabase/migrations/20261117_104_public_payload.sql, Abschnitt 4):
 *   {state:'not_found'}                                         nicht geteilt oder unbekannt (nie bei einer Störung)
 *   {state:'unchanged', version, server_now}
 *   {state:'full', version, server_now, tournament, teams, matches[, scorers]}
 *   {state:'delta', version, base_version, server_now, tournament_date, matches, removed_match_ids[, scorers]}
 * `version`: ganze Zahl (Mikrosekunden der letzten öffentlich sichtbaren Änderung, steigt monoton); `server_now`: Serverzeit
 * in Millisekunden (@ZM-026). Zeilen tragen nur die Felder der Positivliste; Ereignisse haben die öffentliche Form
 * `{id, type, team_id, section, clock_ms, number?, duration_seconds?, scored?}` und werden hier in `RuntimeMatchEvent`
 * übersetzt. Unbekannte Felder fallen beim Prüfen weg (Schemas ohne `passthrough`, Review #342 A5 Punkt 5).
 * Rein, ohne React.
 */
import { z } from 'zod';
import type { Match, RuntimeMatchEvent, Tournament } from '../../types/tournament';
import { sortByMatchNumber } from '../models/matchNumbers';
import { mapMatchFromSupabase, mapTournamentFromSupabase } from './supabaseMappers';

const VersionSchema = z.number().int().nonnegative();
const optionalNullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const PublicEventSchema = z.object({
  id: z.string(),
  type: z.enum(['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'YELLOW_RED_CARD', 'RED_CARD', 'TIME_PENALTY', 'SHOOTOUT_KICK']),
  team_id: optionalNullable(z.string()),
  section: optionalNullable(z.number()),
  clock_ms: optionalNullable(z.number()),
  number: z.number().optional(),
  duration_seconds: z.number().optional(),
  scored: z.boolean().optional(),
});
export type PublicEvent = z.infer<typeof PublicEventSchema>;

const json = z.unknown();
const MatchRowSchema = z.object({
  id: z.string(),
  match_number: optionalNullable(z.number()),
  round: z.number(),
  field: z.number(),
  slot: optionalNullable(z.number()),
  phase: optionalNullable(z.string()),
  group_letter: optionalNullable(z.string()),
  team_a_id: z.string().nullable(),
  team_b_id: z.string().nullable(),
  slot_a_source: json.optional(),
  slot_b_source: json.optional(),
  origin_a: json.optional(),
  origin_b: json.optional(),
  is_final: optionalNullable(z.boolean()),
  final_type: optionalNullable(z.string()),
  label: optionalNullable(z.string()),
  scheduled_start: optionalNullable(z.string()),
  original_start: optionalNullable(z.string()),
  match_status: optionalNullable(z.string()),
  live_state: json.optional(),
  timer_start_time: optionalNullable(z.string()),
  timer_paused_at: optionalNullable(z.string()),
  timer_elapsed_seconds: optionalNullable(z.number()),
  actual_start: optionalNullable(z.string()),
  actual_end: optionalNullable(z.string()),
  skipped_at: optionalNullable(z.string()),
  kit_color_a: optionalNullable(z.string()),
  kit_color_b: optionalNullable(z.string()),
  bib_side: optionalNullable(z.string()),
  score_a: optionalNullable(z.number()),
  score_b: optionalNullable(z.number()),
  overtime_score_a: optionalNullable(z.number()),
  overtime_score_b: optionalNullable(z.number()),
  penalty_score_a: optionalNullable(z.number()),
  penalty_score_b: optionalNullable(z.number()),
  decided_by: optionalNullable(z.string()),
  forfeit_absent: optionalNullable(z.string()),
  referee_number: optionalNullable(z.number()),
  events: z.array(PublicEventSchema).optional(),
});
type PublicMatchRow = z.infer<typeof MatchRowSchema>;

const TeamRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  group_letter: optionalNullable(z.string()),
  is_removed: optionalNullable(z.boolean()),
  logo_path: optionalNullable(z.string()),
  logo_background_color: optionalNullable(z.string()),
  color_primary: optionalNullable(z.string()),
  color_secondary: optionalNullable(z.string()),
});

const TournamentRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  start_time: optionalNullable(z.string()),
  sport: optionalNullable(z.string()),
  tournament_type: optionalNullable(z.string()),
  status: optionalNullable(z.string()),
  location_name: optionalNullable(z.string()),
  location_street: optionalNullable(z.string()),
  location_city: optionalNullable(z.string()),
  location_postal_code: optionalNullable(z.string()),
  location_country: optionalNullable(z.string()),
  number_of_fields: optionalNullable(z.number()),
  number_of_teams: optionalNullable(z.number()),
  number_of_groups: optionalNullable(z.number()),
  group_phase_duration: optionalNullable(z.number()),
  group_phase_break: optionalNullable(z.number()),
  final_round_duration: optionalNullable(z.number()),
  final_round_break: optionalNullable(z.number()),
  point_system: json.optional(),
  finals_config: json.optional(),
  referee_config: json.optional(),
  is_public: optionalNullable(z.boolean()),
  share_code: optionalNullable(z.string()),
  completed_at: optionalNullable(z.string()),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
});

const ScorerSchema = z.object({ team_id: z.string(), number: z.number(), goals: z.number() });

const ReplySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_found') }),
  z.object({ state: z.literal('unchanged'), version: VersionSchema, server_now: z.number() }),
  z.object({
    state: z.literal('full'),
    version: VersionSchema,
    server_now: z.number(),
    tournament: TournamentRowSchema,
    teams: z.array(TeamRowSchema),
    matches: z.array(MatchRowSchema),
    scorers: z.array(ScorerSchema).optional(),
  }),
  z.object({
    state: z.literal('delta'),
    version: VersionSchema,
    base_version: VersionSchema,
    server_now: z.number(),
    tournament_date: z.string(),
    matches: z.array(MatchRowSchema),
    removed_match_ids: z.array(z.string()),
    scorers: z.array(ScorerSchema).optional(),
  }),
]);

export type PublicScorer = z.infer<typeof ScorerSchema>;

export type PublicReply =
  | { kind: 'not-found' }
  | { kind: 'unchanged'; version: number; serverNowMs: number }
  | { kind: 'full'; version: number; serverNowMs: number; tournament: Tournament; scorers?: PublicScorer[] }
  | {
    kind: 'delta';
    version: number;
    baseVersion: number;
    serverNowMs: number;
    matches: Match[];
    removedMatchIds: string[];
    scorers?: PublicScorer[];
  };

type MapperMatchRow = Parameters<typeof mapMatchFromSupabase>[0];
type MapperTournamentRow = Parameters<typeof mapTournamentFromSupabase>[0];
type MapperTeamRow = Parameters<typeof mapTournamentFromSupabase>[1][number];

/**
 * Öffentliche Ereignisse eines Spiels als `RuntimeMatchEvent` (Form wie `core/match/client/viewAdapters#toRuntimeEvents`):
 * Eigentor zählt für den Gegner, Gelb-Rot ist eine rote Karte mit `cardType` YELLOW_RED, Strafstöße erscheinen nicht.
 * `scoreAfter` läuft vom Spielstand rückwärts (ohne Stand: 0:0).
 */
export function toPublicRuntimeEvents(
  matchId: string,
  events: readonly PublicEvent[],
  sides: { sideA: string | null; sideB: string | null; goalsA?: number; goalsB?: number },
): RuntimeMatchEvent[] {
  const shown = events.filter((event) => event.type !== 'SHOOTOUT_KICK');
  let home = sides.goalsA ?? 0;
  let away = sides.goalsB ?? 0;
  const result = new Array<RuntimeMatchEvent>(shown.length);
  for (let i = shown.length - 1; i >= 0; i--) {
    const event = shown[i];
    const teamId = event.team_id ?? undefined;
    const other = teamId === sides.sideA ? sides.sideB : sides.sideA;
    const payload: RuntimeMatchEvent['payload'] = {};
    if (event.type === 'OWN_GOAL') {
      Object.assign(payload, { teamId: other ?? undefined, ownGoal: true, ownGoalTeamId: teamId });
    } else if (teamId !== undefined) {
      payload.teamId = teamId;
    }
    if (event.number !== undefined) {
      payload.playerNumber = event.number;
    }
    if (event.type === 'YELLOW_CARD') { payload.cardType = 'YELLOW'; }
    if (event.type === 'YELLOW_RED_CARD') { payload.cardType = 'YELLOW_RED'; }
    if (event.type === 'RED_CARD') { payload.cardType = 'RED'; }
    if (event.type === 'TIME_PENALTY' && event.duration_seconds !== undefined) {
      payload.penaltyDuration = event.duration_seconds;
      payload.durationSeconds = event.duration_seconds;
    }
    const type: RuntimeMatchEvent['type'] = event.type === 'OWN_GOAL' ? 'GOAL'
      : event.type === 'YELLOW_RED_CARD' ? 'RED_CARD' : (event.type as RuntimeMatchEvent['type']);
    result[i] = {
      id: event.id,
      matchId,
      timestampSeconds: Math.floor((event.clock_ms ?? 0) / 1000),
      type,
      payload,
      scoreAfter: { home, away },
    };
    if (type === 'GOAL') {
      const scoring = payload.teamId;
      if (scoring !== undefined && scoring === sides.sideA) { home = Math.max(0, home - 1); }
      if (scoring !== undefined && scoring === sides.sideB) { away = Math.max(0, away - 1); }
    }
  }
  return result;
}

function withoutEvents(row: PublicMatchRow): MapperMatchRow {
  const { events: _events, ...columns } = row;
  return columns as unknown as MapperMatchRow;
}

function withEvents(match: Match, row: PublicMatchRow | undefined): Match {
  if (row?.events === undefined || row.events.length === 0) {
    return match;
  }
  return {
    ...match,
    events: toPublicRuntimeEvents(row.id, row.events, {
      sideA: row.team_a_id, sideB: row.team_b_id, goalsA: row.score_a ?? undefined, goalsB: row.score_b ?? undefined,
    }),
  };
}

function toMatch(row: PublicMatchRow, tournamentDate: string): Match {
  return withEvents(mapMatchFromSupabase(withoutEvents(row), tournamentDate), row);
}

/** Prüft und übersetzt die Antwort; wirft bei jeder Abweichung vom Vertrag (die Aufrufer werten das als Störung). */
export function parsePublicPayload(raw: unknown): PublicReply {
  const reply = ReplySchema.parse(raw);
  switch (reply.state) {
    case 'not_found':
      return { kind: 'not-found' };
    case 'unchanged':
      return { kind: 'unchanged', version: reply.version, serverNowMs: reply.server_now };
    case 'full': {
      const mapped = mapTournamentFromSupabase(
        reply.tournament as unknown as MapperTournamentRow,
        reply.teams as unknown as MapperTeamRow[],
        reply.matches.map(withoutEvents),
      );
      const rowsById = new Map(reply.matches.map((row) => [row.id, row] as const));
      return {
        kind: 'full',
        version: reply.version,
        serverNowMs: reply.server_now,
        tournament: { ...mapped, matches: mapped.matches.map((match) => withEvents(match, rowsById.get(match.id))) },
        ...(reply.scorers === undefined ? {} : { scorers: reply.scorers }),
      };
    }
    case 'delta':
      return {
        kind: 'delta',
        version: reply.version,
        baseVersion: reply.base_version,
        serverNowMs: reply.server_now,
        matches: reply.matches.map((row) => toMatch(row, reply.tournament_date)),
        removedMatchIds: reply.removed_match_ids,
        ...(reply.scorers === undefined ? {} : { scorers: reply.scorers }),
      };
  }
}

/** Geänderte Spiele (Delta) auf einen gehaltenen Stand anwenden: nach Kennung ersetzen oder ergänzen, entfernte streichen. */
export function applyPublicMatches(previous: Tournament, matches: readonly Match[], removedMatchIds: readonly string[]): Tournament {
  const removed = new Set(removedMatchIds);
  const changed = new Map(matches.map((match) => [match.id, match] as const));
  const kept = previous.matches.filter((match) => !removed.has(match.id) && !changed.has(match.id));
  const next = [...kept, ...[...changed.values()].filter((match) => !removed.has(match.id))];
  return { ...previous, matches: sortByMatchNumber(next) };
}

/**
 * Antwort der Server-Funktion `public_tournament(share_code, since_version)` (B-14, Vertrag für B-15).
 *
 * ANNAHME zum Vertrag, bis B-14 gebaut ist (bei B-14 gegenzuzeichnen): die Antwort ist ein JSON-Objekt mit `state`:
 *   not_found                                              – nicht geteilt oder unbekannt (sicher, nie bei Störung)
 *   unchanged  { version, server_now }                     – seit `since_version` nichts geändert
 *   full       { version, server_now, tournament, teams, matches }
 *   delta      { version, base_version, server_now, tournament_date, matches, removed_match_ids, tournament?, teams? }
 * `version` ist eine ganze Zahl, die mit jeder öffentlich sichtbaren Änderung steigt; `server_now` ist die Serverzeit
 * in Epoch-Millisekunden (Zeitbezug der Spieluhr, @ZM-026). Zeilen haben das Spaltenformat der Tabellen, nur mit den
 * Feldern der Positivliste (E-A2); ein Spiel trägt seine Ereignisse als `events` (Form `RuntimeMatchEvent`).
 * Jede Abweichung ist „unlesbar“ und gilt als nicht erreichbar.
 */
import { z } from 'zod';
import type { Match, Tournament } from '../../types/tournament';
import { mapMatchFromSupabase, mapTeamFromSupabase, mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { RuntimeMatchEventSchema } from '../../core/models/schemas/CommonSchemas';
import { withEventTeamNames } from './publicDelta';
import type { PublicFetchResult } from './publicSource';

const VersionSchema = z.number().int().nonnegative();
const ServerNowSchema = z.number();

const TournamentRowSchema = z.looseObject({ id: z.string(), title: z.string(), date: z.string() });
const TeamRowSchema = z.looseObject({ id: z.string(), name: z.string() });
const MatchRowSchema = z.looseObject({ id: z.string(), events: z.array(RuntimeMatchEventSchema).optional() });

const ReplySchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_found') }),
  z.object({ state: z.literal('unchanged'), version: VersionSchema, server_now: ServerNowSchema }),
  z.object({
    state: z.literal('full'),
    version: VersionSchema,
    server_now: ServerNowSchema,
    tournament: TournamentRowSchema,
    teams: z.array(TeamRowSchema),
    matches: z.array(MatchRowSchema),
  }),
  z.object({
    state: z.literal('delta'),
    version: VersionSchema,
    base_version: VersionSchema,
    server_now: ServerNowSchema,
    tournament_date: z.string(),
    matches: z.array(MatchRowSchema),
    removed_match_ids: z.array(z.string()),
    tournament: TournamentRowSchema.optional(),
    teams: z.array(TeamRowSchema).optional(),
  }),
]);

type TournamentRow = Parameters<typeof mapTournamentFromSupabase>[0];
type TeamRow = Parameters<typeof mapTeamFromSupabase>[0];
type MatchRow = Parameters<typeof mapMatchFromSupabase>[0];

/** Die Zeilen der Positivliste haben nicht alle Spalten der Tabelle; fehlende Spalten lesen die Mapper als „leer“. */
const asTournamentRow = (row: unknown): TournamentRow => row as TournamentRow;
const asTeamRow = (row: unknown): TeamRow => row as TeamRow;
const asMatchRow = (row: unknown): MatchRow => row as MatchRow;

function withEvents(match: Match, events: z.infer<typeof MatchRowSchema>['events']): Match {
  return events === undefined ? match : { ...match, events };
}

function mapMatch(row: z.infer<typeof MatchRowSchema>, tournamentDate: string): Match {
  return withEvents(mapMatchFromSupabase(asMatchRow(row), tournamentDate), row.events);
}

export interface ParsedReply {
  result: PublicFetchResult;
  /** Serverzeit der Antwort (ms), `undefined` bei „nicht gefunden“ */
  serverNowMs?: number;
}

/** Prüft und übersetzt die Antwort; wirft bei einer Abweichung vom Vertrag. */
export function parsePublicReply(raw: unknown): ParsedReply {
  const reply = ReplySchema.parse(raw);
  switch (reply.state) {
    case 'not_found':
      return { result: { kind: 'not-found' } };
    case 'unchanged':
      return { result: { kind: 'unchanged', version: String(reply.version) }, serverNowMs: reply.server_now };
    case 'full': {
      const mapped = mapTournamentFromSupabase(
        asTournamentRow(reply.tournament), reply.teams.map(asTeamRow), reply.matches.map(asMatchRow),
      );
      const eventsOf = new Map(reply.matches.map((row) => [row.id, row.events] as const));
      const tournament: Tournament = withEventTeamNames({
        ...mapped,
        matches: mapped.matches.map((match) => withEvents(match, eventsOf.get(match.id))),
      });
      return { result: { kind: 'full', version: String(reply.version), tournament }, serverNowMs: reply.server_now };
    }
    case 'delta': {
      const header = reply.tournament === undefined
        ? undefined
        : (({ teams: _teams, matches: _matches, ...rest }: Tournament) => rest)(
          mapTournamentFromSupabase(asTournamentRow(reply.tournament), [], []),
        );
      return {
        result: {
          kind: 'delta',
          version: String(reply.version),
          baseVersion: String(reply.base_version),
          delta: {
            ...(header === undefined ? {} : { header }),
            ...(reply.teams === undefined ? {} : { teams: reply.teams.map(asTeamRow).map(mapTeamFromSupabase) }),
            matches: reply.matches.map((row) => mapMatch(row, reply.tournament_date)),
            removedMatchIds: reply.removed_match_ids,
          },
        },
        serverNowMs: reply.server_now,
      };
    }
  }
}

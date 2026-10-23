/**
 * Änderungen auf den gehaltenen Stand anwenden (B-15, Adapter (b)). Rein, ohne React.
 *
 * Spiele werden nach Kennung ersetzt oder ergänzt und danach in Spielnummer-Reihenfolge gebracht; Teams und Kopfdaten
 * ersetzt nur eine Antwort, die sie mitbringt. Ereignisse tragen den Teamnamen aus den (neuen) Teams.
 */
import type { Match, RuntimeMatchEvent, Team, Tournament } from '../../types/tournament';
import { sortByMatchNumber } from '../../core/models/matchNumbers';
import type { PublicDelta } from './publicSource';

function withTeamNames(match: Match, teams: readonly Team[]): Match {
  if (match.events === undefined || match.events.length === 0) {
    return match;
  }
  const nameOf = new Map(teams.map((team) => [team.id, team.name] as const));
  const events = match.events.map((event: RuntimeMatchEvent) => {
    const teamId = event.payload.teamId;
    if (teamId === undefined || event.payload.teamName !== undefined) {
      return event;
    }
    const teamName = nameOf.get(teamId);
    return teamName === undefined ? event : { ...event, payload: { ...event.payload, teamName } };
  });
  return { ...match, events };
}

/** Alle Ereignisse eines Turniers mit Teamnamen (nach einer vollen Antwort). */
export function withEventTeamNames(tournament: Tournament): Tournament {
  return { ...tournament, matches: tournament.matches.map((match) => withTeamNames(match, tournament.teams)) };
}

export function applyPublicDelta(previous: Tournament, delta: PublicDelta): Tournament {
  const teams = delta.teams ?? previous.teams;
  const removed = new Set(delta.removedMatchIds);
  const changed = new Map(delta.matches.map((match) => [match.id, match] as const));
  const kept = previous.matches.filter((match) => !removed.has(match.id) && !changed.has(match.id));
  const matches = sortByMatchNumber([...kept, ...[...changed.values()].filter((match) => !removed.has(match.id))])
    .map((match) => withTeamNames(match, teams));
  return { ...previous, ...(delta.header ?? {}), teams, matches };
}

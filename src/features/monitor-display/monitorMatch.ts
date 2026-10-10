/**
 * Monitor-Matchaufbereitung (B-04c, @W2A-009).
 *
 * `toLiveMatch` ermittelt die Entscheidung bei Unentschieden über dieselbe
 * exportierte Funktion wie die Spielsteuerung/Cockpit
 * (MatchExecutionService.initializeMatch → `resolveTiebreakMode`) — eine Quelle,
 * keine zweite, abweichende Ermittlung.
 */
import type { Tournament, Match, Team, TiebreakerMode } from '../../types/tournament';
import type { LiveMatch } from '../../hooks/useLiveMatches';
import { resolveTiebreakMode, knockoutRoundOf } from '../../core/match/tiebreakDecision';
import sportGlossary from '../../i18n/glossary.json';

export type MonitorLiveMatch = LiveMatch & {
  /** Entscheidung bei Unentschieden (dieselbe Quelle wie im Cockpit) */
  tiebreakerMode?: TiebreakerMode;
};

/**
 * Convert Tournament Match + Team[] to LiveMatch format for LiveMatchDisplay.
 */
export function toLiveMatch(match: Match, teams: Team[], tournament: Tournament): MonitorLiveMatch {
  const findTeam = (id: string) =>
    teams.find(t => t.id === id || t.name === id) ?? { id, name: id };

  const statusMap: Record<string, 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED'> = {
    running: 'RUNNING',
    finished: 'FINISHED',
    scheduled: 'NOT_STARTED',
    waiting: 'NOT_STARTED',
    skipped: 'FINISHED',
  };

  const durationMinutes = tournament.groupPhaseGameDuration ?? tournament.gameDuration ?? 8;

  // Derive referee name from referee number
  const refereeTeam = match.referee
    ? teams.find(t => t.name === `SR${match.referee}` || t.name === `Schiedsrichter ${match.referee}`)
    : undefined;

  return {
    id: match.id,
    number: match.matchNumber ?? match.round,
    phaseLabel: match.label ?? match.phase ?? sportGlossary.terms.groupStage.de,
    fieldId: `field-${match.field}`,
    field: match.field,
    scheduledKickoff: match.scheduledTime ? new Date(match.scheduledTime).toISOString() : '',
    durationSeconds: durationMinutes * 60,
    refereeName: refereeTeam?.name,
    homeTeam: findTeam(match.teamA),
    awayTeam: findTeam(match.teamB),
    homeScore: match.scoreA ?? 0,
    awayScore: match.scoreB ?? 0,
    status: statusMap[match.matchStatus ?? 'scheduled'] ?? 'NOT_STARTED',
    elapsedSeconds: match.timerElapsedSeconds ?? 0,
    events: [],
    timerStartTime: match.timerStartTime,
    timerPausedAt: match.timerPausedAt,
    timerElapsedSeconds: match.timerElapsedSeconds,
    group: match.group,
    tiebreakerMode: resolveTiebreakMode(tournament.finalsConfig, knockoutRoundOf(match.phase), match.finalType),
  };
}

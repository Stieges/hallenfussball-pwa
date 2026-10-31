/**
 * goalDescription: Wortlaut der Tor- und Eigentor-Zeile im Cockpit-Ereignisprotokoll (Sidebar und Handy-Liste).
 * @SL-019 „Tor FC Nord, Nr. 7“ (Spielzeit steht in der Zeitspalte), @SL-083 „Tor FC Nord, ohne Nr.“,
 * @SL-022 „Eigentor SV Süd, Nr. 4“ (schießendes Team, nicht das begünstigte).
 */
import type { TFunction } from 'i18next';
import type { RuntimeMatchEvent } from '../../../types/tournament';

export interface GoalTeams {
  homeTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
}

export function describeGoal(event: RuntimeMatchEvent, teams: GoalTeams, t: TFunction<'cockpit'>): string {
  const { payload } = event;
  const teamOf = (teamId: string | undefined): string => (teamId === teams.homeTeamId ? teams.homeTeamName : teams.awayTeamName);
  const player = payload.playerNumber
    ? t('sidebar.playerNumber', { number: payload.playerNumber })
    : t('sidebar.withoutNumber');
  if (payload.ownGoal === true) {
    return t('sidebar.ownGoalEvent', { teamName: teamOf(payload.ownGoalTeamId), player });
  }
  const teamName = payload.teamName ?? teamOf(payload.teamId);
  let text = t('sidebar.goalEvent', { teamName, player });
  const assists = payload.assists;
  if (assists && assists.length > 0) {
    text += ` ${t('sidebar.assistFormat', { assists: assists.map(a => `#${a}`).join(', ') })}`;
  }
  return text;
}

/**
 * Abzeichen der Live-Anzeige, wenn die Aufrufer-Ansicht keins mitgibt (@OB-066): Status der Live-Anzeige → Abzeichen.
 * Die Live-Folie des Monitors reicht `MatchView.badge` durch; dieser Rückfall kennt keinen Feinstatus
 * (Halbzeit, Verlängerung, Strafstoßschießen) und zeigt für ein geplantes Spiel die Anstoßzeit.
 */
import { matchBadgeModel, type MatchBadgeModel, type ViewMatchStatus } from '../../core/view';
import type { LiveMatch } from '../../hooks/useLiveMatches';

const VIEW_STATUS: Record<LiveMatch['status'], ViewMatchStatus> = {
  NOT_STARTED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

export function badgeOfLiveMatch(match: Pick<LiveMatch, 'status' | 'scheduledKickoff'>): MatchBadgeModel {
  const time = /T(\d{2}:\d{2})/.exec(match.scheduledKickoff)?.[1];
  return matchBadgeModel({
    status: VIEW_STATUS[match.status],
    ...(time === undefined ? {} : { kickoff: { date: '', time } }),
  });
}

/**
 * Abzeichen der Live-Anzeige, wenn die Aufrufer-Ansicht keins mitgibt (@OB-066): Status der Live-Anzeige → Abzeichen.
 * Die Live-Folie des Monitors reicht `MatchView.badge` durch; dieser Rückfall kennt keinen Feinstatus
 * (Halbzeit, Verlängerung, Strafstoßschießen) und zeigt für ein geplantes Spiel die Anstoßzeit.
 */
import { matchBadgeModel, type MatchBadgeModel, type MatchBadgeState, type ViewMatchStatus } from '../../core/view';
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

/** Zustände, die die Live-Sichten des Monitors nicht im Abzeichen zeigen: sie stehen als Symbol an der Uhr (@ZM-215, Daniel 2026-11-19: „jede Angabe nur an einer Stelle“). */
const AN_DER_UHR: ReadonlySet<MatchBadgeState> = new Set(['pause', 'halftime', 'overtime']);

/**
 * Abzeichen der Live-Sichten des Monitors (Folie „Spielfeld (fern)“ und Profil „Halle (sehr fern)“): oben links steht, was die Folie zeigt („Live“, „Nächstes Spiel“, „Strafstoßschießen“,
 * „Ende“); angehaltene Uhr, Pause und Verlängerung gehören der Uhr und stehen dort als Symbol. Bei ihnen bleibt das Abzeichen „Live“, das Spiel läuft ja noch.
 * Die Zuschauer-Seite, die Spielkarten und die Verwaltung bleiben bei der Ansicht (`MatchView.badge`), nur der Monitor bildet sie so ab (@OB-066).
 */
export function monitorLiveBadge(badge: MatchBadgeModel): MatchBadgeModel {
  return badge.kind === 'badge' && AN_DER_UHR.has(badge.state) ? { kind: 'badge', state: 'live' } : badge;
}

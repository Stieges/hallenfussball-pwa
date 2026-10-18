/**
 * Monitor-Matchaufbereitung (B-04c, @W2A-009; A-36c: aus der gemeinsamen Ansicht).
 *
 * `toLiveMatch` nimmt das Spiel der Ansicht (`MatchView`): Status, Bezeichnung, Anstoß in Turnier-Ortszeit, Seitentexte und
 * Endstand (inkl. Verlängerung, ohne Strafstoßschießen) kommen von dort – keine eigene Statusregel, kein Rohwert.
 * Die Entscheidung bei Unentschieden ermittelt weiter dieselbe Funktion wie Spielsteuerung/Cockpit
 * (Entscheidungsregel `resolveTiebreakMode`, dieselbe wie im Anpfiff) — eine Quelle, keine zweite Ermittlung.
 * Die Dauer- und Uhrzeilen (Spieldauer, Timer) gehören zum Paket „Monitor-Uhr“ und bleiben unverändert.
 */
import type { Tournament, Match, Team, TiebreakerMode } from '../../types/tournament';
import type { LiveMatch } from '../../hooks/useLiveMatches';
import type { MatchView, ViewMatchStatus } from '../../core/view';
import { resolveTiebreakMode, knockoutRoundOf } from '../../core/match/tiebreakDecision';
import sportGlossary from '../../i18n/glossary.json';
import { sideTeam } from './matchSides';

export type MonitorLiveMatch = LiveMatch & {
  /** Entscheidung bei Unentschieden (dieselbe Quelle wie im Cockpit) */
  tiebreakerMode?: TiebreakerMode;
};

type LiveStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

/**
 * Status der Ansicht → Status der Live-Anzeige. Ein ausgefallenes Spiel ist nie „beendet“ (@ZM-104):
 * es hat weder Endstand noch Sieger und bleibt „nicht gestartet“.
 */
const LIVE_STATUS: Record<ViewMatchStatus, LiveStatus> = {
  scheduled: 'NOT_STARTED',
  running: 'RUNNING',
  paused: 'PAUSED',
  finished: 'FINISHED',
  awarded: 'FINISHED',
  cancelled: 'NOT_STARTED',
};

/**
 * Spiel der Ansicht + Spiel des Turniers → LiveMatch-Form für LiveMatchDisplay.
 */
export function toLiveMatch(shown: MatchView, match: Match, teams: Team[], tournament: Tournament): MonitorLiveMatch {
  // Seiten aus der Ansicht (Merge I1): besetzt → Team (Logo/Farben), offen → Herkunft bzw. „noch offen“ (Regeln der Ansicht).
  const sideOf = (side: MatchView['home'], key: 'A' | 'B') =>
    sideTeam(side, teams) ?? { id: `${match.id}:${key}`, name: side.label };

  const durationMinutes = tournament.groupPhaseGameDuration ?? tournament.gameDuration ?? 8;

  // Derive referee name from referee number
  const refereeTeam = match.referee
    ? teams.find(t => t.name === `SR${match.referee}` || t.name === `Schiedsrichter ${match.referee}`)
    : undefined;

  return {
    id: match.id,
    number: shown.matchNumber ?? match.round,
    phaseLabel: shown.labelText ?? match.phase ?? sportGlossary.terms.groupStage.de,
    fieldId: `field-${match.field}`,
    field: match.field,
    // Anstoß als Wanduhr des Turniers (@ZM-111), nie als UTC/ISO der Gerätezeit
    scheduledKickoff: shown.kickoff ? `${shown.kickoff.date}T${shown.kickoff.time}` : '',
    durationSeconds: durationMinutes * 60,
    refereeName: refereeTeam?.name,
    homeTeam: sideOf(shown.home, 'A'),
    awayTeam: sideOf(shown.away, 'B'),
    // Tore inkl. Verlängerung, ohne Strafstoßschießen (@ET-013); ohne sichtbaren Stand 0:0 (Kindermodus blendet aus)
    homeScore: shown.score?.a ?? 0,
    awayScore: shown.score?.b ?? 0,
    status: LIVE_STATUS[shown.status],
    elapsedSeconds: match.timerElapsedSeconds ?? 0,
    events: [],
    timerStartTime: match.timerStartTime,
    timerPausedAt: match.timerPausedAt,
    timerElapsedSeconds: match.timerElapsedSeconds,
    group: match.group,
    tiebreakerMode: resolveTiebreakMode(tournament.finalsConfig, knockoutRoundOf(match.phase), match.finalType),
  };
}

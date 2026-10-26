/**
 * Was der Dialog „Turnier abschließen“ und die Verwaltung aus dem Turnier über den Endstand sagen (Plan R3-4; @LZ-007,
 * @LZ-008, @LZ-009, @ET-044): Siegerzeile mit Herkunft „per Strafstoßschießen“ (E6: aus `standingDecisions`, das Format des
 * gespeicherten Endstands bleibt unverändert), Plätze 1–3 mit Punkten, die drei Zahlen („15 von 15 gespielt“) und der Vorschlag
 * „Alles entschieden“. Rein, ohne React.
 */
import type { Tournament } from '../../../types/tournament';
import { OVERALL_GROUP, standingsGroups } from '../../../core/models/standingsGroups';
import { computeFinalStandings, type FinalStandingRow } from '../../../core/standings/finalStandings';
import { rankTournamentGroup, tableInput, type TableTournament } from '../../../core/standings/tournamentTable';
import { decisionBasis, findValidDecision } from '../../../core/standings/decisions';
import { hasFinalRound } from '../../../utils/openPlacements';
import type { TournamentLifecycle } from '../../../core/services/lifecycle';

type SummaryTournament = Pick<Tournament, 'teams' | 'matches' | 'groups' | 'groupCompletions' | 'finalsConfig' | 'groupSystem'
  | 'pointSystem' | 'placementLogic' | 'standingDecisions' | 'placementsToPlayOut' | 'forfeitScore'>;

/** Punkte je Team – nur bei Jeder gegen jeden (eine Tabellengruppe, keine Finalrunde); sonst sind Punkte kein Maß für den Platz. */
export function pointsByTeam(tournament: SummaryTournament): ReadonlyMap<string, number> | null {
  if (hasFinalRound(tournament) || standingsGroups(tournament.teams).length !== 1) {
    return null;
  }
  const table = rankTournamentGroup(tournament, OVERALL_GROUP);
  return new Map(table.rows.map((row) => [row.team.id, row.points]));
}

export interface ShootoutNote {
  /** Strafstoßschießen um Platz 1: Gewinner `winner`:`loser`. */
  winner: number;
  loser: number;
  otherName: string;
}

/** Was `shootoutNote` braucht, um die Gültigkeit der Entscheidung wie die Tabelle zu prüfen (Teams, Spiele, Wertung, Entscheidungen). */
export type ShootoutTournament = Pick<Tournament, 'teams' | 'matches'> & TableTournament;

/**
 * „Platz 1 per Strafstoßschießen entschieden: 4:3 gegen SV Süd“ (E6). Nur, wenn alles zutrifft: Platz 1 stammt aus Gruppenplatz 1
 * (Rangliste einer Gruppe, kein Finale), die Entscheidung `shootout` gehört zu dieser Gruppe, gilt noch (dieselbe Gültigkeit wie in
 * der Tabelle: `findValidDecision` mit `decisionBasis` über die Spiele der Gruppe) und setzt den Sieger vor das Team auf Platz 2;
 * sonst `null`. Verfallene Entscheidungen bleiben am Server im `config` stehen und dürfen nichts beschriften (Review #397 M-1).
 */
export function shootoutNote(tournament: ShootoutTournament, ranking: readonly FinalStandingRow[]): ShootoutNote | null {
  const first = ranking.find((row) => row.place === 1);
  const second = ranking.find((row) => row.place === 2);
  if (first === undefined || second === undefined || first.origin.kind !== 'groupPlace' || first.origin.place !== 1) {
    return null;
  }
  const group = first.origin.group;
  const candidates = (tournament.standingDecisions ?? []).filter((entry) => entry.kind === 'shootout' && entry.shootout !== undefined
    && entry.groupId === group && entry.order[0] === first.teamId && entry.order[1] === second.teamId);
  const input = tableInput(tournament.teams, tournament.matches, tournament, group);
  const decision = candidates.find((entry) => findValidDecision([entry], group, entry.teamIds, decisionBasis(input, entry.teamIds)) !== undefined);
  if (decision?.shootout === undefined) {
    return null;
  }
  return { winner: decision.shootout.winner, loser: decision.shootout.loser, otherName: second.teamName };
}

export interface FinishFacts {
  played: number;
  total: number;
  skipped: number;
  teams: number;
}

/** „15 von 15 Spielen gespielt · 0 ausgefallen · 6 Teams“. */
export function finishFacts(tournament: Pick<Tournament, 'teams' | 'matches'>): FinishFacts {
  const matches = tournament.matches;
  return {
    played: matches.filter((match) => match.matchStatus === 'finished').length,
    total: matches.length,
    skipped: matches.filter((match) => match.matchStatus === 'skipped').length,
    teams: tournament.teams.filter((team) => team.isRemoved !== true).length,
  };
}

/**
 * Schlägt die App den Abschluss vor (@LZ-007 „Alles entschieden – Endstand prüfen und Turnier abschließen“, @LZ-008)?
 * Nur im Zustand „Läuft“, ohne offenen Eintrag der Klärungsliste, mit jedem Spiel entschieden (beendet oder ausgefallen) und
 * einem festen Endstand (`complete`: Gruppe abgeschlossen, kein Gleichstand offen). Der Server prüft beim Abschluss alles
 * noch einmal; der Vorschlag ist nur ein Hinweis, nie die Bedingung.
 */
export function shouldSuggestFinish(
  tournament: SummaryTournament, lifecycle: TournamentLifecycle, openReviews: number,
): boolean {
  if (lifecycle !== 'running' || openReviews > 0 || tournament.matches.length === 0) {
    return false;
  }
  if (!tournament.matches.every((match) => match.matchStatus === 'finished' || match.matchStatus === 'skipped')) {
    return false;
  }
  return computeFinalStandings(tournament).state === 'complete';
}

/** Tage, nach denen die App an den offenen Abschluss erinnert (@LZ-005: „7 Tage danach“, 6 Tage noch nicht). */
export const LATE_FINISH_HINT_DAYS = 7;

/**
 * Hinweis „das Turnier läuft noch“ (@LZ-005): Das Turnier ist im Zustand „Läuft“, jedes Spiel ist entschieden, und das letzte
 * endete vor mindestens 7 Tagen. Ergebnis ist der Zeitpunkt des letzten Spiel-Endes (für „Das letzte Spiel war am …“), sonst `null`.
 * Das Datum, bis wann die öffentliche Ansicht läuft, nennt der Hinweis erst mit @LZ-082 (Plan R3 § 7 C1).
 */
export function lateFinishHint(
  tournament: Pick<Tournament, 'matches'> & Partial<Pick<Tournament, 'lastMatchEndedAt'>>, lifecycle: TournamentLifecycle, now: Date,
): string | null {
  if (lifecycle !== 'running') {
    return null;
  }
  let lastEnd: Date | null = null;
  if (tournament.matches.length === 0) {
    // Liste der Startseite (ohne Spiele): das Ende des letzten Spiels trägt die Listenabfrage
    lastEnd = tournament.lastMatchEndedAt === undefined ? null : new Date(tournament.lastMatchEndedAt);
  } else if (tournament.matches.every((match) => match.matchStatus === 'finished' || match.matchStatus === 'skipped')) {
    const ends = tournament.matches.flatMap((match) => (match.finishedAt === undefined ? [] : [new Date(match.finishedAt)]))
      .filter((date) => !Number.isNaN(date.getTime()));
    lastEnd = ends.length === 0 ? null : new Date(Math.max(...ends.map((date) => date.getTime())));
  }
  if (lastEnd === null || Number.isNaN(lastEnd.getTime())) {
    return null;
  }
  return Math.floor((now.getTime() - lastEnd.getTime()) / 86_400_000) >= LATE_FINISH_HINT_DAYS ? lastEnd.toISOString() : null;
}

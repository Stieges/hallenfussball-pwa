/**
 * Block „Mein Team“ der Zuschauer-Seite (@ZM-175, @ZM-196): das nächste Spiel des gewählten Teams und sein Tabellenplatz.
 * Beides kommt aus der gemeinsamen Ansicht: das nächste Spiel ist das früheste noch nicht angepfiffene Spiel des Teams (ein
 * laufendes steht schon im Kopfblock, @ZM-141; ausgefallene nie, @ZM-104), der Platz nur, wenn die Ansicht Tabellen zeigt
 * (`rules.tables`) und das Team schon gespielt hat (vorher steht kein Platz, @ZM-199).
 */
import { clockKey, type MatchView, type TournamentView } from '../../core/view';
import type { Standing } from '../../types/tournament';

export interface MyTeamNext {
  number?: number;
  time?: string;
  field: number;
  opponent: string;
}

export interface MyTeamTable {
  place: number;
  points: number;
  /** Nur bei mehr als einer Gruppe */
  group?: string;
}

export interface MyTeamFacts {
  next?: MyTeamNext;
  table?: MyTeamTable;
}

const byKickoff = (a: MatchView, b: MatchView): number => {
  const key = clockKey(a.kickoff).localeCompare(clockKey(b.kickoff));
  return key !== 0 ? key : (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
};

export interface MyTeamFactsInput {
  view: TournamentView;
  standings: readonly Standing[];
  teamId: string;
  groupCount: number;
}

export function myTeamFacts({ view, standings, teamId, groupCount }: MyTeamFactsInput): MyTeamFacts {
  const mine = view.matches.filter((m) => m.home.teamId === teamId || m.away.teamId === teamId);
  const upcoming = [...mine].filter((m) => m.isUpcoming).sort(byKickoff)[0];
  const facts: MyTeamFacts = {};
  if (upcoming !== undefined) {
    const other = upcoming.home.teamId === teamId ? upcoming.away : upcoming.home;
    facts.next = {
      ...(upcoming.matchNumber === undefined ? {} : { number: upcoming.matchNumber }),
      ...(upcoming.kickoff === undefined ? {} : { time: upcoming.kickoff.time }),
      field: upcoming.field,
      opponent: other.label,
    };
  }
  const standing = standings.find((s) => s.team.id === teamId);
  if (view.rules.tables && standing !== undefined && standing.played > 0 && standing.place !== undefined) {
    facts.table = {
      place: standing.place,
      points: standing.points,
      ...(groupCount > 1 && standing.team.group !== undefined ? { group: standing.team.group } : {}),
    };
  }
  return facts;
}

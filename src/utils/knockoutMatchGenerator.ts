import {
  TournamentCase,
  KnockoutMatch,
  PlacementMatch,
  TeamReference,
} from '../types/tournamentSchema';
import { Match, Tournament } from '../types/tournament';
import { calculateStandings } from './calculations';

/**
 * Generiert K.O.-Spiele basierend auf einem TournamentCase Schema
 */
export const generateKnockoutMatches = (
  tournamentCase: TournamentCase,
  tournament: Tournament
): Match[] => {
  const matches: Match[] = [];
  const { tournamentStructure } = tournamentCase;

  let matchCounter = 1;

  // Durchlaufe alle Phasen in der definierten Reihenfolge
  for (const phase of tournamentStructure.phaseOrder) {
    const phaseMatches = tournamentStructure.phases[phase];

    if (!phaseMatches || phaseMatches.length === 0) {
      // Phase ist leer - manuelle Konfiguration erforderlich
      continue;
    }

    // Generiere Matches für diese Phase
    for (const knockoutMatch of phaseMatches) {
      const match = createMatchFromTemplate(
        knockoutMatch,
        tournament,
        matchCounter,
        phase
      );

      if (match) {
        matches.push(match);
        matchCounter++;
      }
    }
  }

  return matches;
};

/**
 * Erstellt ein Match-Objekt aus einem KnockoutMatch Template
 */
const createMatchFromTemplate = (
  template: KnockoutMatch | PlacementMatch,
  tournament: Tournament,
  matchNumber: number,
  phase: string
): Match | null => {
  const homeTeamId = resolveTeamReference(template.home, tournament);
  const awayTeamId = resolveTeamReference(template.away, tournament);

  return {
    id: `match-${matchNumber}`,
    round: 1,
    field: 1,
    teamA: homeTeamId || 'TBD',
    teamB: awayTeamId || 'TBD',
    isFinal: true,
    label: phase,
  };
};


/**
 * Löst eine TeamReference auf und gibt die Team-ID zurück
 * Wenn das Team noch nicht bekannt ist (z.B. "Gewinner von SF1"), wird null zurückgegeben
 */
const resolveTeamReference = (
  ref: TeamReference,
  tournament: Tournament
): string | null => {
  switch (ref.source) {
    case 'groupStanding':
      return resolveGroupStanding(ref, tournament);

    case 'winnerOf':
      // Winner wird erst nach dem Spiel bekannt sein
      // Für jetzt geben wir eine Platzhalter-Beschreibung zurück
      return null;

    case 'loserOf':
      // Loser wird erst nach dem Spiel bekannt sein
      return null;

    case 'manual':
      return ref.teamId || null;

    default:
      return null;
  }
};

/**
 * Findet ein Team basierend auf Gruppenplatzierung
 * FIXED: Now properly calculates standings using calculateStandings()
 */
const resolveGroupStanding = (
  ref: TeamReference,
  tournament: Tournament
): string | null => {
  if (!ref.groupId || ref.position === undefined) {
    return null;
  }

  // Sonderfall: "bestSecond" für den besten Zweiten
  if (ref.groupId === 'bestSecond') {
    return resolveBestSecondPlace(tournament);
  }

  // Finde Teams in der angegebenen Gruppe
  const teamsInGroup = tournament.teams.filter((team) => team.group === ref.groupId);

  if (teamsInGroup.length < ref.position) {
    return null;
  }

  // ✅ FIX: Berechne tatsächliche Tabellenstände basierend auf Spielergebnissen
  const standings = calculateStandings(teamsInGroup, tournament.matches, tournament, ref.groupId);

  // Hole das Team an der gewünschten Position (1-indexed)
  if (standings.length >= ref.position) {
    return standings[ref.position - 1].team.id;
  }

  return null;
};

/**
 * Findet den besten Zweiten über alle Gruppen hinweg
 */
const resolveBestSecondPlace = (tournament: Tournament): string | null => {
  const groups = Array.from(new Set(tournament.teams.map(t => t.group).filter(Boolean)));
  const secondPlaceTeams: Array<{ teamId: string; points: number; goalDifference: number; goalsFor: number }> = [];

  for (const group of groups) {
    const teamsInGroup = tournament.teams.filter(t => t.group === group);
    const standings = calculateStandings(teamsInGroup, tournament.matches, tournament, group);

    if (standings.length >= 2) {
      const secondPlace = standings[1];
      secondPlaceTeams.push({
        teamId: secondPlace.team.id,
        points: secondPlace.points,
        goalDifference: secondPlace.goalDifference,
        goalsFor: secondPlace.goalsFor,
      });
    }
  }

  if (secondPlaceTeams.length === 0) {
    return null;
  }

  // Sortiere die Zweiten nach den gleichen Kriterien wie die Haupttabelle
  secondPlaceTeams.sort((a, b) => {
    // 1. Punkte
    if (b.points !== a.points) {return b.points - a.points;}
    // 2. Tordifferenz
    if (b.goalDifference !== a.goalDifference) {return b.goalDifference - a.goalDifference;}
    // 3. Erzielte Tore
    return b.goalsFor - a.goalsFor;
  });

  return secondPlaceTeams[0].teamId;
};

/**
 * Aktualisiert K.O.-Matches nach Spielergebnissen
 * Wird aufgerufen, wenn ein K.O.-Spiel beendet wird
 */
export const updateKnockoutMatchesAfterResult = (
  matches: Match[],
  completedMatchId: string,
  winnerId: string,
  loserId: string
): Match[] => {
  return matches.map((match) => {
    let updated = false;
    const newMatch = { ...match };

    // Prüfe Home Team (teamA)
    if (match.teamA === 'TBD') {
      const homeRef = findTeamReferenceForMatch(match, 'home', completedMatchId);

      if (homeRef?.source === 'winnerOf' && homeRef.matchId === completedMatchId) {
        newMatch.teamA = winnerId;
        updated = true;
      } else if (homeRef?.source === 'loserOf' && homeRef.matchId === completedMatchId) {
        newMatch.teamA = loserId;
        updated = true;
      }
    }

    // Prüfe Away Team (teamB)
    if (match.teamB === 'TBD') {
      const awayRef = findTeamReferenceForMatch(match, 'away', completedMatchId);

      if (awayRef?.source === 'winnerOf' && awayRef.matchId === completedMatchId) {
        newMatch.teamB = winnerId;
        updated = true;
      } else if (awayRef?.source === 'loserOf' && awayRef.matchId === completedMatchId) {
        newMatch.teamB = loserId;
        updated = true;
      }
    }

    return updated ? newMatch : match;
  });
};

/**
 * Findet die TeamReference für ein Match
 * (Diese Funktion würde in der Praxis eine Mapping-Struktur nutzen)
 */
const findTeamReferenceForMatch = (
  _match: Match,
  _side: 'home' | 'away',
  _completedMatchId: string
): TeamReference | null => {
  // Diese Funktion müsste Zugriff auf das ursprüngliche Schema haben
  // Für jetzt ist sie ein Platzhalter
  return null;
};

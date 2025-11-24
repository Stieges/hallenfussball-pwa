import { Match, Tournament, Standing, Team, PlacementCriterion } from '../types/tournament';

/**
 * Calculate standings for a group or all teams
 */
export const calculateStandings = (
  teams: Team[],
  matches: Match[],
  tournament: Tournament,
  group?: 'A' | 'B' | 'C' | 'D'
): Standing[] => {
  // Filter matches for the specific group if provided
  const relevantMatches = group
    ? matches.filter((m) => m.group === group && m.scoreA !== undefined && m.scoreB !== undefined)
    : matches.filter((m) => m.scoreA !== undefined && m.scoreB !== undefined && !m.isFinal);

  // Filter teams for the specific group
  const relevantTeams = group ? teams.filter((t) => t.group === group) : teams;

  // Initialize standings
  const standings: Standing[] = relevantTeams.map((team) => ({
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  // Calculate stats from matches
  relevantMatches.forEach((match) => {
    const teamAStanding = standings.find((s) => s.team.id === match.teamA);
    const teamBStanding = standings.find((s) => s.team.id === match.teamB);

    if (!teamAStanding || !teamBStanding || match.scoreA === undefined || match.scoreB === undefined) {
      return;
    }

    teamAStanding.played++;
    teamBStanding.played++;

    teamAStanding.goalsFor += match.scoreA;
    teamAStanding.goalsAgainst += match.scoreB;
    teamBStanding.goalsFor += match.scoreB;
    teamBStanding.goalsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      teamAStanding.won++;
      teamBStanding.lost++;
      teamAStanding.points += tournament.pointSystem.win;
      teamBStanding.points += tournament.pointSystem.loss;
    } else if (match.scoreA < match.scoreB) {
      teamBStanding.won++;
      teamAStanding.lost++;
      teamBStanding.points += tournament.pointSystem.win;
      teamAStanding.points += tournament.pointSystem.loss;
    } else {
      teamAStanding.drawn++;
      teamBStanding.drawn++;
      teamAStanding.points += tournament.pointSystem.draw;
      teamBStanding.points += tournament.pointSystem.draw;
    }

    teamAStanding.goalDifference = teamAStanding.goalsFor - teamAStanding.goalsAgainst;
    teamBStanding.goalDifference = teamBStanding.goalsFor - teamBStanding.goalsAgainst;
  });

  // Sort by placement logic
  return sortByPlacementLogic(standings, tournament.placementLogic);
};

/**
 * Sort standings according to placement logic criteria
 */
const sortByPlacementLogic = (standings: Standing[], placementLogic: PlacementCriterion[]): Standing[] => {
  const enabledCriteria = placementLogic.filter((c) => c.enabled);

  return standings.sort((a, b) => {
    for (const criterion of enabledCriteria) {
      let comparison = 0;

      switch (criterion.id) {
        case 'points':
          comparison = b.points - a.points;
          break;
        case 'goalDifference':
          comparison = b.goalDifference - a.goalDifference;
          break;
        case 'goalsFor':
          comparison = b.goalsFor - a.goalsFor;
          break;
        case 'goalsAgainst':
          comparison = a.goalsAgainst - b.goalsAgainst;
          break;
        case 'wins':
          comparison = b.won - a.won;
          break;
        case 'directComparison':
          // TODO: Implement direct comparison logic
          comparison = 0;
          break;
      }

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  });
};

/**
 * Get winners/qualified teams from standings
 */
export const getQualifiedTeams = (standings: Standing[], count: number): Team[] => {
  return standings.slice(0, count).map((s) => s.team);
};

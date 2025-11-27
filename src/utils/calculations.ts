import { Match, Tournament, Standing, Team, PlacementCriterion } from '../types/tournament';

/**
 * Calculate standings for a group or all teams
 */
export const calculateStandings = (
  teams: Team[],
  matches: Match[],
  tournament: Tournament,
  group?: string
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

  // Sort by placement logic (pass relevantMatches for direct comparison)
  return sortByPlacementLogic(standings, tournament.placementLogic, relevantMatches);
};

/**
 * Sort standings according to placement logic criteria
 */
const sortByPlacementLogic = (
  standings: Standing[],
  placementLogic: PlacementCriterion[],
  matches?: Match[]
): Standing[] => {
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
          // Direct comparison: only relevant if teams have equal points
          if (a.points === b.points && matches) {
            comparison = compareDirectMatches(a, b, matches);
          } else {
            comparison = 0;
          }
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
 * Compare two teams based on their direct matches (head-to-head)
 * Returns: > 0 if a is better, < 0 if b is better, 0 if equal
 *
 * Uses fixed criteria order:
 * 1. Points from direct matches
 * 2. Goal difference from direct matches
 * 3. Goals scored from direct matches
 */
const compareDirectMatches = (
  a: Standing,
  b: Standing,
  matches: Match[]
): number => {
  // Find all direct matches between these two teams
  const directMatches = matches.filter(
    (m) =>
      (m.scoreA !== undefined && m.scoreB !== undefined) &&
      ((m.teamA === a.team.id && m.teamB === b.team.id) ||
       (m.teamA === b.team.id && m.teamB === a.team.id))
  );

  if (directMatches.length === 0) {
    return 0; // No direct matches, teams are equal in direct comparison
  }

  // Calculate mini-table stats for direct matches only
  let aPoints = 0;
  let bPoints = 0;
  let aGoalsFor = 0;
  let bGoalsFor = 0;
  let aGoalsAgainst = 0;
  let bGoalsAgainst = 0;
  let aWins = 0;
  let bWins = 0;

  directMatches.forEach((match) => {
    const scoreA = match.scoreA!;
    const scoreB = match.scoreB!;
    const isAHome = match.teamA === a.team.id;

    const aScore = isAHome ? scoreA : scoreB;
    const bScore = isAHome ? scoreB : scoreA;

    aGoalsFor += aScore;
    aGoalsAgainst += bScore;
    bGoalsFor += bScore;
    bGoalsAgainst += aScore;

    if (aScore > bScore) {
      aWins++;
      aPoints += 3; // Assuming 3 points for win
    } else if (bScore > aScore) {
      bWins++;
      bPoints += 3;
    } else {
      aPoints += 1; // Draw
      bPoints += 1;
    }
  });

  // Apply FIXED criteria order for direct comparison:
  // 1. Points from direct matches
  // 2. Goal difference from direct matches
  // 3. Goals scored from direct matches

  // 1. Compare points from direct matches
  if (bPoints !== aPoints) {
    return bPoints - aPoints; // Higher points is better
  }

  // 2. Compare goal difference from direct matches
  const aDiff = aGoalsFor - aGoalsAgainst;
  const bDiff = bGoalsFor - bGoalsAgainst;
  if (bDiff !== aDiff) {
    return bDiff - aDiff; // Higher goal difference is better
  }

  // 3. Compare goals scored in direct matches
  if (bGoalsFor !== aGoalsFor) {
    return bGoalsFor - aGoalsFor; // More goals scored is better
  }

  return 0; // Teams are equal in direct comparison
};

/**
 * Get winners/qualified teams from standings
 */
export const getQualifiedTeams = (standings: Standing[], count: number): Team[] => {
  return standings.slice(0, count).map((s) => s.team);
};

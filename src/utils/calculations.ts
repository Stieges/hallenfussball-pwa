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
    // Match by team name OR ID (match.teamA/teamB can be either depending on context)
    // - In tournament.matches: usually team names (from schedule display)
    // - In ScheduledMatch: also team names (homeTeam/awayTeam resolved)
    // - In some edge cases: team IDs
    const teamAStanding = standings.find(
      (s) => s.team.name === match.teamA || s.team.id === match.teamA
    );
    const teamBStanding = standings.find(
      (s) => s.team.name === match.teamB || s.team.id === match.teamB
    );

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
          // Direct comparison: only applied if all previous criteria are equal
          // (the loop already ensures this - if we reach here, all previous criteria returned 0)
          if (matches) {
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
  // Helper to check if match team reference matches a standing's team (by ID or name)
  const matchesTeam = (matchTeam: string, standing: Standing) =>
    matchTeam === standing.team.id || matchTeam === standing.team.name;

  // Find all direct matches between these two teams
  const directMatches = matches.filter(
    (m) =>
      (m.scoreA !== undefined && m.scoreB !== undefined) &&
      ((matchesTeam(m.teamA, a) && matchesTeam(m.teamB, b)) ||
        (matchesTeam(m.teamA, b) && matchesTeam(m.teamB, a)))
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
  let _aWins = 0;
  let _bWins = 0;

  directMatches.forEach((match) => {
    // Scores are guaranteed defined by the filter above
    if (match.scoreA === undefined || match.scoreB === undefined) { return; }
    const scoreA = match.scoreA;
    const scoreB = match.scoreB;
    const isAHome = matchesTeam(match.teamA, a);

    const aScore = isAHome ? scoreA : scoreB;
    const bScore = isAHome ? scoreB : scoreA;

    aGoalsFor += aScore;
    aGoalsAgainst += bScore;
    bGoalsFor += bScore;
    bGoalsAgainst += aScore;

    if (aScore > bScore) {
      _aWins++;
      aPoints += 3; // Assuming 3 points for win
    } else if (bScore > aScore) {
      _bWins++;
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

// ============================================================================
// FINALS PLACEMENT CALCULATION
// ============================================================================

export interface FinalPlacement {
  rank: number;
  team: Team;
  decidedBy: 'playoff' | 'groupStage';
  matchLabel?: string; // e.g., "Finale", "Spiel um Platz 3"
}

export interface FinalsPlacementResult {
  placements: FinalPlacement[];
  allFinalsCompleted: boolean;
  completedFinalsCount: number;
  totalFinalsCount: number;
  playoffStatus: 'not-started' | 'in-progress' | 'completed';
}

/**
 * Determine the winner of a finals match considering overtime and penalties
 */
const getMatchWinner = (match: Match): { winner: string; loser: string } | null => {
  if (match.scoreA === undefined || match.scoreB === undefined) {
    return null; // Match not finished
  }

  let winnerTeam: string;
  let loserTeam: string;

  // Check if decided by penalties
  if (match.decidedBy === 'penalty' && match.penaltyScoreA !== undefined && match.penaltyScoreB !== undefined) {
    if (match.penaltyScoreA > match.penaltyScoreB) {
      winnerTeam = match.teamA;
      loserTeam = match.teamB;
    } else {
      winnerTeam = match.teamB;
      loserTeam = match.teamA;
    }
  }
  // Check if decided by overtime/golden goal
  else if ((match.decidedBy === 'overtime' || match.decidedBy === 'goldenGoal') &&
    match.overtimeScoreA !== undefined && match.overtimeScoreB !== undefined) {
    const totalA = match.scoreA + match.overtimeScoreA;
    const totalB = match.scoreB + match.overtimeScoreB;
    if (totalA > totalB) {
      winnerTeam = match.teamA;
      loserTeam = match.teamB;
    } else {
      winnerTeam = match.teamB;
      loserTeam = match.teamA;
    }
  }
  // Regular time decision
  else if (match.scoreA > match.scoreB) {
    winnerTeam = match.teamA;
    loserTeam = match.teamB;
  } else if (match.scoreB > match.scoreA) {
    winnerTeam = match.teamB;
    loserTeam = match.teamA;
  } else {
    // Draw in finals without tiebreaker - shouldn't happen, but handle gracefully
    return null;
  }

  return { winner: winnerTeam, loser: loserTeam };
};

/**
 * Calculate final placements based on playoff results
 *
 * This function determines actual placements from finals matches:
 * - Finale → 1st and 2nd place
 * - Spiel um Platz 3 → 3rd and 4th place
 * - Spiel um Platz 5 → 5th and 6th place
 * - Spiel um Platz 7 → 7th and 8th place
 *
 * Teams not participating in playoffs get their placement from group standings.
 */
export const calculateFinalsPlacement = (
  teams: Team[],
  matches: Match[],
  _groupStandings: Standing[]
): FinalsPlacementResult => {
  const finalsMatches = matches.filter(m => m.isFinal);

  if (finalsMatches.length === 0) {
    return {
      placements: [],
      allFinalsCompleted: false,
      completedFinalsCount: 0,
      totalFinalsCount: 0,
      playoffStatus: 'not-started',
    };
  }

  const completedFinals = finalsMatches.filter(
    m => m.scoreA !== undefined && m.scoreB !== undefined
  );

  const placements: FinalPlacement[] = [];
  const placedTeamIds = new Set<string>();

  // Helper to find team by name or ID
  const findTeam = (nameOrId: string): Team | undefined => {
    return teams.find(t => t.name === nameOrId || t.id === nameOrId);
  };

  // Process finals matches by finalType priority
  const finalTypeToRanks: Record<string, [number, number]> = {
    'final': [1, 2],
    'thirdPlace': [3, 4],
    'fifthSixth': [5, 6],
    'seventhEighth': [7, 8],
  };

  const finalTypeLabels: Record<string, string> = {
    'final': 'Finale',
    'thirdPlace': 'Spiel um Platz 3',
    'fifthSixth': 'Spiel um Platz 5',
    'seventhEighth': 'Spiel um Platz 7',
  };

  // Process each finalType
  for (const [finalType, [winnerRank, loserRank]] of Object.entries(finalTypeToRanks)) {
    const match = completedFinals.find(m => m.finalType === finalType);

    if (match) {
      const result = getMatchWinner(match);
      if (result) {
        const winnerTeam = findTeam(result.winner);
        const loserTeam = findTeam(result.loser);

        if (winnerTeam && !placedTeamIds.has(winnerTeam.id)) {
          placements.push({
            rank: winnerRank,
            team: winnerTeam,
            decidedBy: 'playoff',
            matchLabel: finalTypeLabels[finalType],
          });
          placedTeamIds.add(winnerTeam.id);
        }

        if (loserTeam && !placedTeamIds.has(loserTeam.id)) {
          placements.push({
            rank: loserRank,
            team: loserTeam,
            decidedBy: 'playoff',
            matchLabel: finalTypeLabels[finalType],
          });
          placedTeamIds.add(loserTeam.id);
        }
      }
    }
  }

  // Sort placements by rank
  placements.sort((a, b) => a.rank - b.rank);

  // Determine playoff status
  let playoffStatus: 'not-started' | 'in-progress' | 'completed';
  if (completedFinals.length === 0) {
    playoffStatus = 'not-started';
  } else if (completedFinals.length === finalsMatches.length) {
    playoffStatus = 'completed';
  } else {
    playoffStatus = 'in-progress';
  }

  return {
    placements,
    allFinalsCompleted: completedFinals.length === finalsMatches.length,
    completedFinalsCount: completedFinals.length,
    totalFinalsCount: finalsMatches.length,
    playoffStatus,
  };
};

/**
 * Merge finals placements with group standings for complete ranking
 *
 * Returns a unified ranking where:
 * 1. Playoff-decided placements come first (in rank order)
 * 2. Remaining teams are added from group standings
 */
export const getMergedFinalRanking = (
  teams: Team[],
  matches: Match[],
  groupStandings: Standing[],
  _tournament: Tournament
): { ranking: FinalPlacement[]; finalsResult: FinalsPlacementResult } => {
  const finalsResult = calculateFinalsPlacement(teams, matches, groupStandings);
  const ranking: FinalPlacement[] = [...finalsResult.placements];
  const placedTeamIds = new Set(ranking.map(p => p.team.id));

  // Find the next rank to assign
  let nextRank = ranking.length > 0
    ? Math.max(...ranking.map(p => p.rank)) + 1
    : 1;

  // Add remaining teams from group standings
  for (const standing of groupStandings) {
    if (!placedTeamIds.has(standing.team.id)) {
      ranking.push({
        rank: nextRank,
        team: standing.team,
        decidedBy: 'groupStage',
      });
      placedTeamIds.add(standing.team.id);
      nextRank++;
    }
  }

  return { ranking, finalsResult };
};

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

export interface Scorer {
  teamName: string;
  playerName: string;
  goals: number;
  assists: number;
}

export const calculateScorers = (tournament: Tournament): Scorer[] => {
  const scorerMap = new Map<string, Scorer>();

  const getKey = (teamId: string, playerNum?: number) => `${teamId}-${playerNum || 'unknown'}`;
  const getTeamName = (id: string) => tournament.teams.find(t => t.id === id)?.name || 'Unbekannt';

  tournament.matches.forEach(match => {
    if (match.events) {
      match.events.forEach(event => {
        if (event.type === 'GOAL') {
          const teamId = event.payload?.teamId;
          const playerNum = event.payload?.playerNumber;

          if (teamId) {
            const key = getKey(teamId, playerNum);
            let scorer = scorerMap.get(key);
            if (!scorer) {
              const teamName = getTeamName(teamId);
              scorer = {
                teamName,
                playerName: playerNum ? `#${playerNum}` : 'Unbekannt',
                goals: 0,
                assists: 0
              };
              scorerMap.set(key, scorer);
            }
            scorer.goals++;
          }

          // Assists
          if (event.payload?.assists) {
            event.payload.assists.forEach(assistNum => {
              // Assume assist is from same team
              const key = getKey(teamId!, assistNum);
              let scorer = scorerMap.get(key);
              if (!scorer) {
                const teamName = getTeamName(teamId!);
                scorer = {
                  teamName,
                  playerName: `#${assistNum}`,
                  goals: 0,
                  assists: 0
                };
                scorerMap.set(key, scorer);
              }
              scorer.assists++;
            });
          }
        }
      });
    }
  });

  return Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals || b.assists - a.assists);
};

export interface FairPlayEntry {
  teamName: string;
  points: number;
  yellowCards: number;
  redCards: number;
  timePenalties: number;
}

export const calculateFairPlay = (tournament: Tournament): FairPlayEntry[] => {
  const map = new Map<string, FairPlayEntry>();

  // Initialize all teams
  tournament.teams.forEach(t => {
    map.set(t.id, {
      teamName: t.name,
      points: 0,
      yellowCards: 0,
      redCards: 0,
      timePenalties: 0
    });
  });

  tournament.matches.forEach(match => {
    if (match.events) {
      match.events.forEach(event => {
        const teamId = event.payload?.teamId;
        if (!teamId) return;
        const entry = map.get(teamId);
        if (!entry) return;

        if (event.type === 'YELLOW_CARD') {
          entry.yellowCards++;
          entry.points += 1;
        } else if (event.type === 'TIME_PENALTY') {
          entry.timePenalties++;
          entry.points += 3; // 3 points for time penalty
        } else if (event.type === 'RED_CARD') {
          entry.redCards++;
          entry.points += 5; // 5 points for red card
        }
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.points - b.points); // Lower points is better
};

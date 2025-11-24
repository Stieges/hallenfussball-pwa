import { Tournament, Match } from '../types/tournament';

/**
 * Generate matches based on tournament configuration
 */
export const generateMatches = (tournament: Tournament): Match[] => {
  const matches: Match[] = [];

  if (tournament.mode === 'classic') {
    // Classic mode with groups
    if (tournament.groupSystem === 'twoGroups') {
      // Generate group stage matches
      matches.push(...generateGroupMatches(tournament));

      // Generate finals if enabled
      if (Object.values(tournament.finals).some(enabled => enabled)) {
        matches.push(...generateFinalMatches(tournament));
      }
    } else if (tournament.groupSystem === 'roundRobin') {
      // Round robin: Everyone plays everyone
      matches.push(...generateRoundRobinMatches(tournament));
    }
  } else if (tournament.mode === 'miniFussball') {
    // Mini-Fussball mode with multiple fields and rounds
    matches.push(...generateMiniFussballMatches(tournament));
  }

  return matches;
};

/**
 * Generate round-robin matches (everyone vs everyone)
 */
const generateRoundRobinMatches = (tournament: Tournament): Match[] => {
  const matches: Match[] = [];
  const teams = tournament.teams;
  let matchId = 1;
  let round = 1;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        id: `match-${matchId}`,
        round,
        field: ((matchId - 1) % tournament.numberOfFields) + 1,
        teamA: teams[i].id,
        teamB: teams[j].id,
      });
      matchId++;

      // Move to next round after using all fields
      if (matchId % tournament.numberOfFields === 1) {
        round++;
      }
    }
  }

  return matches;
};

/**
 * Generate group stage matches for classic mode
 */
const generateGroupMatches = (tournament: Tournament): Match[] => {
  const matches: Match[] = [];
  const groupA = tournament.teams.filter(t => t.group === 'A');
  const groupB = tournament.teams.filter(t => t.group === 'B');
  let matchId = 1;
  let round = 1;

  // Generate matches for Group A
  for (let i = 0; i < groupA.length; i++) {
    for (let j = i + 1; j < groupA.length; j++) {
      matches.push({
        id: `match-${matchId}`,
        round,
        field: 1,
        teamA: groupA[i].id,
        teamB: groupA[j].id,
        group: 'A',
      });
      matchId++;
      round++;
    }
  }

  // Reset round counter for Group B
  round = 1;

  // Generate matches for Group B
  for (let i = 0; i < groupB.length; i++) {
    for (let j = i + 1; j < groupB.length; j++) {
      matches.push({
        id: `match-${matchId}`,
        round,
        field: tournament.numberOfFields > 1 ? 2 : 1,
        teamA: groupB[i].id,
        teamB: groupB[j].id,
        group: 'B',
      });
      matchId++;
      round++;
    }
  }

  return matches;
};

/**
 * Generate final matches based on group results
 */
const generateFinalMatches = (tournament: Tournament): Match[] => {
  const matches: Match[] = [];
  let matchId = 1000; // Start with high ID to distinguish from group matches
  const finalRound = 100; // High round number for finals

  if (tournament.finals.final) {
    matches.push({
      id: `final-${matchId++}`,
      round: finalRound,
      field: 1,
      teamA: 'group-a-1st', // Placeholder - will be filled after group stage
      teamB: 'group-b-1st',
      isFinal: true,
      finalType: 'final',
    });
  }

  if (tournament.finals.thirdPlace) {
    matches.push({
      id: `final-${matchId++}`,
      round: finalRound,
      field: 2,
      teamA: 'group-a-2nd',
      teamB: 'group-b-2nd',
      isFinal: true,
      finalType: 'thirdPlace',
    });
  }

  if (tournament.finals.fifthSixth) {
    matches.push({
      id: `final-${matchId++}`,
      round: finalRound + 1,
      field: 1,
      teamA: 'group-a-3rd',
      teamB: 'group-b-3rd',
      isFinal: true,
      finalType: 'fifthSixth',
    });
  }

  if (tournament.finals.seventhEighth) {
    matches.push({
      id: `final-${matchId++}`,
      round: finalRound + 1,
      field: 2,
      teamA: 'group-a-4th',
      teamB: 'group-b-4th',
      isFinal: true,
      finalType: 'seventhEighth',
    });
  }

  return matches;
};

/**
 * Generate matches for Mini-Fussball mode
 */
const generateMiniFussballMatches = (tournament: Tournament): Match[] => {
  const matches: Match[] = [];
  const teams = tournament.teams;
  const numberOfFields = tournament.numberOfFields;
  const numberOfRounds = tournament.numberOfRounds || 5;

  let matchId = 1;

  // Simple rotation algorithm
  for (let round = 1; round <= numberOfRounds; round++) {
    for (let field = 1; field <= numberOfFields && field * 2 <= teams.length; field++) {
      const teamAIndex = ((round - 1) * numberOfFields + (field - 1) * 2) % teams.length;
      const teamBIndex = ((round - 1) * numberOfFields + (field - 1) * 2 + 1) % teams.length;

      if (teamAIndex < teams.length && teamBIndex < teams.length) {
        matches.push({
          id: `match-${matchId}`,
          round,
          field,
          teamA: teams[teamAIndex].id,
          teamB: teams[teamBIndex].id,
        });
        matchId++;
      }
    }
  }

  return matches;
};

/**
 * Generate unique match ID
 */
export const generateMatchId = (): string => {
  return `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

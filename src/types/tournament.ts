// Core Tournament Types
export type Sport = 'football' | 'other';
export type TournamentType = 'classic' | 'bambini';
export type TournamentMode = 'classic' | 'miniFussball';
export type GroupSystem = 'twoGroups' | 'roundRobin';
export type RoundLogic = 'fixed' | 'promotion';
export type ResultMode = 'goals' | 'winLossOnly';

export interface Team {
  id: string;
  name: string;
  group?: 'A' | 'B' | 'C' | 'D';
}

export interface PlacementCriterion {
  id: string;
  label: string;
  enabled: boolean;
}

export interface PointSystem {
  win: number;
  draw: number;
  loss: number;
}

export interface Finals {
  final: boolean;
  thirdPlace: boolean;
  fifthSixth: boolean;
  seventhEighth: boolean;
}

export interface Match {
  id: string;
  round: number;
  field: number;
  teamA: string;
  teamB: string;
  scoreA?: number;
  scoreB?: number;
  group?: 'A' | 'B';
  isFinal?: boolean;
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
}

export interface Tournament {
  id: string;

  // Step 1: Sport & Tournament Type
  sport: Sport;
  tournamentType: TournamentType;

  // Step 2: Mode & System
  mode: TournamentMode;
  numberOfFields: number;
  groupSystem?: GroupSystem;
  numberOfGroups?: number;
  gameDuration: number;
  breakDuration?: number;
  roundLogic?: RoundLogic;
  numberOfRounds?: number;
  placementLogic: PlacementCriterion[];
  finals: Finals;

  // Bambini Settings
  isKidsTournament: boolean;
  hideScoresForPublic: boolean;
  hideRankingsForPublic: boolean;
  resultMode: ResultMode;

  // Point System
  pointSystem: PointSystem;

  // Step 3: Metadata
  title: string;
  ageClass: string;
  date: string;
  timeSlot: string;
  location: string;

  // Step 4: Teams
  teams: Team[];

  // Generated data
  matches: Match[];
  createdAt: string;
  updatedAt: string;
}

export interface Standing {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

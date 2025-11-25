// Core Tournament Types
export type Sport = 'football' | 'other';
export type TournamentType = 'classic' | 'bambini';
export type TournamentMode = 'classic' | 'miniFussball';
export type GroupSystem = 'roundRobin' | 'groupsAndFinals';
export type RoundLogic = 'fixed' | 'promotion';
export type ResultMode = 'goals' | 'winLossOnly';
export type TournamentStatus = 'draft' | 'published';

export interface Team {
  id: string;
  name: string;
  group?: string;
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

/**
 * Playoff Match Configuration
 * Defines whether a specific playoff match can run in parallel with others
 */
export type PlayoffParallelMode = 'sequentialOnly' | 'parallelAllowed';

export interface PlayoffMatchConfig {
  id: string; // "semi1", "semi2", "thirdPlace", "final", etc.
  label: string;
  parallelMode: PlayoffParallelMode;
  enabled: boolean;
}

export interface PlayoffConfig {
  enabled: boolean;
  allowParallelMatches: boolean; // Global setting
  matches: PlayoffMatchConfig[];
}

export interface Match {
  id: string;
  round: number;
  field: number;
  slot?: number; // Time slot index for fair scheduling
  teamA: string;
  teamB: string;
  scoreA?: number;
  scoreB?: number;
  group?: string;
  isFinal?: boolean;
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
  scheduledTime?: Date; // Actual scheduled time
}

export interface Tournament {
  id: string;
  status: TournamentStatus; // 'draft' oder 'published'

  // Step 1: Sport & Tournament Type
  sport: Sport;
  tournamentType: TournamentType;

  // Step 2: Mode & System
  mode: TournamentMode;
  numberOfFields: number;
  numberOfTeams: number; // Anzahl teilnehmender Teams (Pflichtfeld)
  groupSystem?: GroupSystem;
  numberOfGroups?: number;

  // Gruppenphase Zeiten
  groupPhaseGameDuration: number; // Spieldauer in Gruppenphase (in Minuten)
  groupPhaseBreakDuration?: number; // Pause zwischen Spielen in Gruppenphase (in Minuten)

  // Finalrunde Zeiten (nur wenn groupSystem === 'groupsAndFinals')
  finalRoundGameDuration?: number; // Spieldauer in Finalrunde (in Minuten)
  finalRoundBreakDuration?: number; // Pause zwischen Spielen in Finalrunde (in Minuten)
  breakBetweenPhases?: number; // Pause zwischen Gruppenphase und Finalrunde (in Minuten)

  // Spielabschnitte (gelten für beide Phasen)
  gamePeriods?: number; // Anzahl Spielabschnitte (1 = durchgehend, 2 = zwei Halbzeiten, etc.)
  halftimeBreak?: number; // Pause zwischen Spielabschnitten (nur wenn gamePeriods > 1)

  // Legacy fields (deprecated, werden zu groupPhase* migriert)
  gameDuration?: number;
  breakDuration?: number;

  roundLogic?: RoundLogic;
  numberOfRounds?: number;
  placementLogic: PlacementCriterion[];
  finals: Finals;
  playoffConfig?: PlayoffConfig; // New: Playoff configuration
  minRestSlots?: number; // Minimum rest slots between matches for a team (default: 1)

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

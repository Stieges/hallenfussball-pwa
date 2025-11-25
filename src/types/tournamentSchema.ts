/**
 * Tournament Schema Types
 * Definiert die Struktur für konfigurierbare, mehrstufige Turniere
 */

export type ConditionOperator = '=' | '!=' | '>' | '<' | '>=' | '<=';

export interface ConditionExpression {
  var: string;
  op: ConditionOperator;
  value: string | number | boolean;
}

export interface Condition {
  all?: ConditionExpression[];
  any?: ConditionExpression[];
}

export interface SchemaInput {
  name: string;
  type: 'integer' | 'boolean' | 'string';
  description: string;
}

export interface Constraint {
  id: string;
  description: string;
  condition: Condition;
  result: {
    valid: boolean;
    reason: string;
  };
}

export type TeamSource = 'groupStanding' | 'winnerOf' | 'loserOf' | 'manual';

export interface TeamReference {
  source: TeamSource;
  groupId?: string;
  position?: number;
  matchId?: string;
  teamId?: string;
}

export interface KnockoutMatch {
  matchId: string;
  home: TeamReference;
  away: TeamReference;
  description?: string;
}

export interface PlacementMatch extends KnockoutMatch {
  placementRange: string; // z.B. "3-4", "5-6", "7-8"
}

export type PhaseType = 'quarterfinal' | 'semifinal' | 'final' | 'placement';

export interface TournamentPhases {
  quarterfinal?: KnockoutMatch[];
  semifinal?: KnockoutMatch[];
  final?: KnockoutMatch[];
  placement?: PlacementMatch[];
}

export interface TournamentStructure {
  phaseOrder: PhaseType[];
  phases: TournamentPhases;
  note?: string;
}

export interface TournamentCase {
  id: string;
  description: string;
  condition: Condition;
  tournamentStructure: TournamentStructure;
}

export interface TournamentSchema {
  schema_version: string;
  sport: 'football' | 'other';
  inputs: SchemaInput[];
  constraints: Constraint[];
  cases: TournamentCase[];
}

/**
 * Runtime-Konfiguration basierend auf User-Input
 */
export interface TournamentConfiguration {
  groupCount: number;
  totalTeams?: number;
  teamsPerGroup?: number;
  hasQuarterfinal: boolean;
  hasSemifinal: boolean;
  hasFinal: boolean;
  hasThirdPlace: boolean;
  hasFifthSixth: boolean;
  hasSeventhEighth: boolean;
  useDFBKeys?: boolean; // Ob DFB-Schlüsselsystem verwendet werden soll
  dfbKeyPattern?: string; // z.B. "1T06M" für 6 Teams
}

/**
 * Validierungs-Ergebnis
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  matchedCase?: TournamentCase;
}

/**
 * Format des Endstands (A-20a, Plan `plan-endstand-abschluss.md` § 3, Schnittstelle A-20a). Beim Turnierabschluss wird
 * genau dieses Format gespeichert (`tournament_final_standings`, A-21a-S); danach lesen App, Zuschauer, Monitor und PDF nur
 * noch die gespeicherte Kopie (@ET-045). Die Form prüft `FinalStandingsSnapshotSchema`
 * (`core/models/schemas/FinalStandingsSchema.ts`), am Server `match_engine.final_standings_shape_valid` gegen dieselbe
 * Gleichlauf-Datei `core/standings/__fixtures__/final-standings-shapes.json`. Rein, ohne React.
 */
import type { Match } from '../../../types/tournament';
import type { TeamId } from '../../models/schemas/MatchSlotSchema';

/** Platzierungsspiel (Finale, Spiel um Platz 3, 5, 7). */
export type FinalType = NonNullable<Match['finalType']>;

/** Herkunft eines Platzes im Endstand (Record Endstand „Wie ein Platz entsteht“). */
export type PlaceOrigin =
  | { kind: 'placementGame'; finalType: FinalType; role: 'winner' | 'loser' }
  | { kind: 'koRound'; round: 'semi' | 'quarter' | 'r16' }
  /** Gruppenplatz; `group` '' = Jeder gegen jeden (`OVERALL_GROUP`). */
  | { kind: 'groupPlace'; group: string; place: number }
  /** Nur im vorläufigen Endstand: Platzierungsspiel noch offen. */
  | { kind: 'open'; finalType?: FinalType };

/** Werte je Spiel (Ausgeschiedene derselben K.-o.-Runde, Teil F). */
export interface PerGameValues {
  points: number;
  goalDiff: number;
  goals: number;
  games: number;
}

/** Eine Zeile des Endstands; geteilte Plätze tragen dieselbe Platzziffer (2, 2, 2, 5). */
export interface FinalStandingRow {
  place: number;
  teamId: TeamId;
  teamName: string;
  origin: PlaceOrigin;
  perGame?: PerGameValues;
}

/** Zeile der Torschützenliste: Spieler mit Rang oder die Sammelzeilen „ohne Nummer“ / „Eigentore“ ohne Rang. */
export type ScorerRow =
  | { kind: 'player'; rank: number; teamId: TeamId; teamName: string; number: number; goals: number }
  | { kind: 'noNumber' | 'ownGoals'; rank: null; teamId: TeamId; teamName: string; goals: number };

/** Gespeicherter Endstand mit Torschützen; `appVersion` hält fest, mit welcher Rechnung er entstand (@ET-045). */
export interface FinalStandingsSnapshot {
  format: 1;
  ranking: FinalStandingRow[];
  scorers: ScorerRow[];
  appVersion: string;
  computedAt: string;
}

/** Endstand, wie er gerade steht: `complete` = fest bestimmbar, `provisional` = vorläufig (@ET-042, @TM-058). */
export interface ComputedFinalStandings {
  state: 'provisional' | 'complete';
  ranking: FinalStandingRow[];
}

/** Was die Ansichten zeigen: den gespeicherten Endstand oder den vorläufigen (R-EA-9). */
export type ReadFinalStandings =
  | { source: 'stored'; snapshot: FinalStandingsSnapshot }
  | { source: 'provisional'; ranking: FinalStandingRow[] };

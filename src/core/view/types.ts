/**
 * Typen der gemeinsamen Turnier-Ansicht (A-36b, Teilplan A-36 § 2.2, Brief A-36b R-A36b-1/-2).
 *
 * Eine Ansicht je Zielgruppe und Medium: Zuschauer-Seite, Monitor, PDF und Verwaltung lesen Status, Seitentexte,
 * Uhrzeit, Endstand und Sichtbarkeit aus EINEM Baustein (@TM-015, @ZM-102, @ZM-104, @ZM-111, @BM-032, @DR-005).
 */
import type { Match, MatchDecidedBy, Team, Tournament } from '../../types/tournament';
import type { SlotSource, TeamId } from '../models/schemas/MatchSlotSchema';
import type { MatchStatus as EngineStatus } from '../match/types';
import type { SlotDescription } from './originText';
import type { FinalScore } from './finalScore';

export type ViewAudience = 'organizer' | 'viewer' | 'screen';
/** print: die öffentlichen Schalter gelten auch für die Leitung (@BM-032). */
export type ViewMedium = 'app' | 'print';
export type ViewLocale = 'de' | 'en';
/** blank = Spielplan ohne Ergebnisse (Vorlage, @DR-005). */
export type ViewEdition = 'plan' | 'blank' | 'final';
/** Zuschauer-PDF-Wahl (ZM-Record Z. 58, W15). Vorbelegung 'planOnly'. */
export type ViewerPdfChoice = 'planOnly' | 'withResults' | 'none';

/**
 * Fachlicher Status. 'cancelled' = „ausgefallen“ (@ZM-104/@DR-001). 'paused' gibt es nur hier, nicht in
 * `types/tournament.ts` (R-A36b-2): der Cache bildet Unterbrechungen auf 'paused' ab, der Feinstatus kommt über die Engine.
 */
export type ViewMatchStatus = 'scheduled' | 'running' | 'paused' | 'finished' | 'cancelled' | 'awarded';

/**
 * Entscheidungsart, wie die Ansicht sie liest: die der Turnierkopie plus 'forfeit' („gewertet“, @ZM-104).
 * 'forfeit' liefert erst A-25 in den Daten; bis dahin nur in Einheitstests (F-WERT).
 */
export type ViewDecidedBy = MatchDecidedBy | 'forfeit';

/** Spielstatus aus Sicht der Ansicht: Cache-Status (auch 'paused' per Cache-Abbildung) und Entscheidungsart. */
export interface ViewStatusSource {
  matchStatus?: Match['matchStatus'] | 'paused';
  decidedBy?: ViewDecidedBy;
}

/** Wanduhr in Turnier-Ortszeit: Datum des Turniers + „HH:MM“ (@ZM-111, W14). Nie ein Date in Gerätezeit. */
export interface LocalClock {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
}

export interface ViewOptions {
  audience: ViewAudience;
  medium: ViewMedium;
  /** Pflicht: Zuschauer-Wahl, Monitor-Sprache, App-Sprache fürs PDF (@DR-022). */
  locale: ViewLocale;
  /** Vorgabe 'plan'. */
  edition?: ViewEdition;
  /** Nur viewer·print, Vorgabe 'planOnly'. */
  viewerPdf?: ViewerPdfChoice;
  /** Für current/currentFor; vom Aufrufer per `toTournamentLocal` berechnet. */
  now?: LocalClock;
}

export interface ViewRules {
  results: boolean;
  /** Heute = results; Schalter „Live-Stand“ (@ZM-004) liefert B-14/B-15. */
  liveScore: boolean;
  tables: boolean;
  /** Hängt NUR an Schaltern, nie an der PDF-Wahl (W4). */
  groupOrigin: boolean;
  awardedMark: boolean;
  /** „korrigiert hh:mm“ */
  correctedMark: boolean;
  /** isPublic ∧ shareCode (@BM-054). */
  viewerLinkAllowed: boolean;
  /** viewer: Knopf „Als PDF“ sichtbar (≠ 'none'). */
  viewerPdfOffered: boolean;
}

/** Beschreibung eines Herkunftstexts: fertiger Text oder Schlüssel + Werte; übersetzt nur `originText`. */
export type OriginDescription = SlotDescription;

export interface SideView {
  pending: boolean;
  teamId?: TeamId;
  teamName?: string;
  /** @ZM-088; welche Form, entscheidet die Oberfläche. Das Team-Modell hat heute keinen Kurznamen (Paket KN). */
  shortName?: string;
  /** Herkunft des PLATZES (match.originA/B), bleibt nach dem Besetzen. */
  origin?: SlotSource;
  /** Teamname | Herkunft | „noch offen“; nie gekürzt, nie Rohschlüssel. */
  label: string;
  /** „Erster Gruppe A“ klein unter besetztem Platz (@BM-014), nur wenn die Herkunft für dieses Team wahr ist. */
  subLabel?: string;
}

export interface MatchView {
  id: string;
  matchNumber?: number;
  field: number;
  /** W14 */
  kickoff?: LocalClock;
  /** @ZM-105, Darstellung B-27 */
  kickoffTentative: boolean;
  phase: 'groupStage' | 'final';
  group?: string;
  /** „Halbfinale 1“ / „Semifinal 1“ */
  labelText?: string;
  /** Für die Zielgruppe angepasst. */
  status: ViewMatchStatus;
  /** running ∨ paused */
  isLive: boolean;
  /** nur scheduled */
  isUpcoming: boolean;
  /** Endstand bzw. Zwischenstand aus `matchFinalScore` (R-A36b-1); Strafstoßschießen getrennt. */
  score?: FinalScore;
  /** organizer = correctionHistory; viewer/screen = Feld corrected_at aus B-14. */
  correctedAt?: LocalClock;
  home: SideView;
  away: SideView;
}

export interface CurrentView {
  live: MatchView[];
  next?: MatchView;
  lastFinished?: MatchView;
}

export interface PlacementView {
  state: 'open' | 'final';
  ranking?: { place: number; team: Pick<Team, 'id' | 'name'> }[];
  groupPhaseOpen: boolean;
  /** Nur bei rules.tables. */
  groupRanks?: ReadonlyMap<TeamId, { group: string; rank: number }>;
}

export interface TournamentView {
  rules: ViewRules;
  matches: MatchView[];
  byId: ReadonlyMap<string, MatchView>;
  /** Ganzes Turnier (@ZM-141). */
  current: CurrentView;
  /** Feld-Monitor (MVP: ein Live-Monitor je Feld). */
  currentFor(field: number): CurrentView;
  placement: PlacementView;
}

export type TournamentViewInput = Pick<
  Tournament,
  'teams' | 'groups' | 'matches' | 'date' | 'hideScoresForPublic' | 'hideRankingsForPublic' | 'isPublic' | 'shareCode'
> & {
  /** Feinstatus der Engine. Vorrang vor dem Cache (M4): Engine `finished`, Cache noch `running` → `finished`. */
  engineStatus?: (matchId: string) => EngineStatus | undefined;
  /** Nur öffentliche Leser: Korrekturzeit aus der Server-Funktion (B-14). Ohne sie hat viewer/screen kein correctedAt. */
  correctedAtPublic?: (matchId: string) => LocalClock | undefined;
  finalRanking?: PlacementView['ranking'];
  closed?: boolean;
  /**
   * Gruppenplätze aus der Tabellenrechnung des Aufrufers (`calculateStandings` braucht das ganze Turnier);
   * die Ansicht gibt sie nur bei rules.tables weiter. Abweichung von § 2.2 (Report A-36b).
   */
  groupStandings?: PlacementView['groupRanks'];
};

export type { EngineStatus };

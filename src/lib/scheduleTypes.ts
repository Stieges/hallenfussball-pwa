/**
 * Schedule Types - Type definitions for schedule generation
 */

import { RefereeConfig, LocationDetails, ContactInfo, Standing, TournamentGroup, TournamentField } from '../types/tournament'

// ============================================================================
// SCHEDULED MATCH
// ============================================================================

export interface ScheduledMatch {
  /** Match ID */
  id: string
  /** Spiel-Nummer (1-basiert) */
  matchNumber: number
  /** Uhrzeit (HH:MM) */
  time: string
  /** Feld-Nummer */
  field: number
  /** Heim-Team Name (übersetzt für Anzeige) */
  homeTeam: string
  /** Auswärts-Team Name (übersetzt für Anzeige) */
  awayTeam: string
  /** Original Team-ID oder Platzhalter (z.B. "group-a-1st" für Playoffs) */
  originalTeamA: string
  /** Original Team-ID oder Platzhalter (z.B. "group-b-2nd" für Playoffs) */
  originalTeamB: string
  /** Gruppe oder undefined für Finalspiele */
  group?: string
  /** Phase: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final' */
  phase: SchedulePhaseType
  /** Finaltyp (z.B. 'final', 'thirdPlace') */
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth'
  /** Label for playoff matches (e.g., '1. Halbfinale', '2. Halbfinale') */
  label?: string
  /** Spielbeginn als Date-Objekt */
  startTime: Date
  /** Spielende als Date-Objekt */
  endTime: Date
  /** Dauer in Minuten */
  duration: number
  /** Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.) */
  referee?: number
  /** Slot index für Schiedsrichter-Verteilung */
  slot?: number
  /** Score Heim-Team (optional, wird bei Ergebniseingabe gesetzt) */
  scoreA?: number
  /** Score Auswärts-Team (optional, wird bei Ergebniseingabe gesetzt) */
  scoreB?: number
}

export type SchedulePhaseType = 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final'

// ============================================================================
// SCHEDULE PHASE
// ============================================================================

export interface SchedulePhase {
  /** Phase-Name */
  name: string
  /** Display-Label */
  label: string
  /** Matches in dieser Phase */
  matches: ScheduledMatch[]
  /** Start-Zeit der Phase */
  startTime: Date
  /** End-Zeit der Phase */
  endTime: Date
}

// ============================================================================
// GENERATED SCHEDULE
// ============================================================================

export interface GeneratedSchedule {
  /** Turnier-Metadaten */
  tournament: {
    id: string
    title: string
    date: string
    location: LocationDetails
    ageClass: string
    organizer?: string
    contactInfo?: ContactInfo
    groups?: TournamentGroup[]
    fields?: TournamentField[]
  }

  /** Alle Spiele chronologisch sortiert */
  allMatches: ScheduledMatch[]

  /** Spiele gruppiert nach Phase */
  phases: SchedulePhase[]

  /** Start-Zeit des Turniers */
  startTime: Date

  /** End-Zeit des Turniers */
  endTime: Date

  /** Gesamtdauer in Minuten */
  totalDuration: number

  /** Anzahl parallele Felder */
  numberOfFields: number

  /** Teams mit Gruppen-Zuordnung */
  teams: Array<{
    id: string
    name: string
    group?: string
  }>

  /** Initial leere Tabelle (für Live-Updates) */
  initialStandings: Standing[]

  /** Schiedsrichter-Konfiguration */
  refereeConfig?: RefereeConfig
}

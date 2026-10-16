/**
 * Schedule Types - Type definitions for schedule generation
 */

import { RefereeConfig, LocationDetails, ContactInfo, Standing, TournamentGroup, TournamentField, RuntimeMatchEvent } from '../../types/tournament'
import type { MatchSlot, SlotSource } from '../models/schemas/MatchSlotSchema'

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
  /**
   * ÜBERGANG (Übergangsfeld `teamA` am Spiel seit A-36a gelöscht): Team-ID oder `'TBD'` für eine offene Seite,
   * abgeleitet aus `slotA` (`transitionalTeamRef`). Gelesen nur von `LiveViewScreen` (Spur B); neue Leser nutzen `slotA`.
   */
  originalTeamA: string
  /** ÜBERGANG, siehe `originalTeamA` (aus `slotB`). */
  originalTeamB: string
  /** Spielseite Heim als Slot (A-01), unverändert vom Spiel durchgereicht (A-02) */
  slotA: MatchSlot
  /** Spielseite Gast als Slot (A-01), unverändert vom Spiel durchgereicht (A-02) */
  slotB: MatchSlot
  /** A-36a: Herkunft des Heim-Platzes, unverändert vom Spiel durchgereicht (nur Finalrunde) */
  originA?: SlotSource
  /** A-36a: Herkunft des Gast-Platzes, siehe `originA` */
  originB?: SlotSource
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
  /** Is this a final match? */
  isFinal?: boolean
  /** Slot index für Schiedsrichter-Verteilung */
  slot?: number
  /** Score Heim-Team (optional, wird bei Ergebniseingabe gesetzt) */
  scoreA?: number
  /** Score Auswärts-Team (optional, wird bei Ergebniseingabe gesetzt) */
  scoreB?: number

  // DB-PERSISTENCE: Events for detailed match summary (scorers, cards)
  events?: RuntimeMatchEvent[]
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

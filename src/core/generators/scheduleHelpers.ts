/**
 * Schedule Helpers - Utility functions for schedule generation
 */

import { Match, Team, Standing, TournamentGroup } from '../../types/tournament'
import { transitionalTeamRef } from '../models/matchSlot'
import { matchOrigins } from '../models/matchOrigin'
import { slotLabel } from '../models/slotLabel'
import { ScheduledMatch, SchedulePhaseType } from './scheduleTypes'

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Parst Start-Zeit aus Datum + Zeitslot
 */
export function parseStartTime(date: string, timeSlot: string): Date {
  let parsedDate: Date

  // Parse Date
  if (date.includes('-')) {
    // ISO Format: YYYY-MM-DD
    parsedDate = new Date(date)
  } else if (date.includes('.')) {
    // German Format: DD.MM.YYYY
    const [day, month, year] = date.split('.').map(Number)
    parsedDate = new Date(year, month - 1, day)
  } else {
    // Fallback: heute
    parsedDate = new Date()
  }

  // Parse Time
  const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const [, hours, minutes] = timeMatch
    parsedDate.setHours(parseInt(hours, 10))
    parsedDate.setMinutes(parseInt(minutes, 10))
    parsedDate.setSeconds(0)
    parsedDate.setMilliseconds(0)
  }

  return parsedDate
}

/**
 * Addiert Minuten zu Date-Objekt
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

/**
 * Formatiert Date zu HH:MM
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// ============================================================================
// MATCH DURATION
// ============================================================================

/**
 * Berechnet Gesamt-Matchdauer inkl. Halbzeitpausen
 */
export function calculateTotalMatchDuration(
  gameDuration: number,
  gamePeriods: number,
  halftimeBreak: number
): number {
  if (gamePeriods <= 1) {
    return gameDuration
  }

  // Bei mehreren Abschnitten: Spielzeit + (Anzahl Pausen * Pausenzeit)
  const numberOfBreaks = gamePeriods - 1
  return gameDuration + numberOfBreaks * halftimeBreak
}

// ============================================================================
// PHASE DETECTION
// ============================================================================

type KnockoutPhase = Exclude<SchedulePhaseType, 'groupStage'>

function isKnockoutPhase(phase: string | undefined): phase is KnockoutPhase {
  return phase === 'roundOf16' || phase === 'quarterfinal' || phase === 'semifinal' || phase === 'final'
}

/**
 * Phase eines Finalspiels: die Phase, die der Generator am Spiel gesetzt hat (A-12a, aus der Vorlage), sonst `final`.
 * Früher wurde sie aus der Spiel-ID geraten – seit die IDs UUIDs sind, wurden so Halbfinale als `final` gespeichert
 * (C-FINALPHASE-AUS-ID).
 */
export function determineFinalPhase(match: Match): SchedulePhaseType {
  return isKnockoutPhase(match.phase) ? match.phase : 'final'
}

// ============================================================================
// STANDINGS
// ============================================================================

/**
 * Erstellt initiale Standings (alle Teams mit 0 Punkten)
 */
export function createInitialStandings(teams: Team[]): Standing[] {
  return teams.map((team) => ({
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }))
}

// ============================================================================
// MATCH SCHEDULING
// ============================================================================

export interface ScheduleMatchesOptions {
  matches: Match[]
  startTime: Date
  numberOfFields: number
  gameDuration: number
  breakDuration: number
  gamePeriods: number
  halftimeBreak: number
  phase: 'groupStage' | 'final'
  /** Teams des Turniers – Namen werden NUR über `team.id` gefunden (slotLabel). */
  teams: Team[]
  locale: 'de' | 'en'
  startMatchNumber: number
  groups?: TournamentGroup[]
}

/**
 * Scheduliert eine Liste von Matches mit Zeiten
 */
export function scheduleMatches(options: ScheduleMatchesOptions): ScheduledMatch[] {
  const {
    matches,
    startTime,
    gameDuration,
    breakDuration,
    gamePeriods,
    halftimeBreak,
    teams,
    locale,
    startMatchNumber,
    groups,
  } = options
  const labelContext = { teams, matches, groups, locale }

  const scheduled: ScheduledMatch[] = []
  let currentTime = new Date(startTime)
  let matchNumber = startMatchNumber

  // Sortiere Matches nach Slot (von Fair Scheduler) oder Round (Legacy)
  const sortedMatches = [...matches].sort((a, b) => {
    const slotA = a.slot ?? a.round - 1
    const slotB = b.slot ?? b.round - 1
    if (slotA !== slotB) { return slotA - slotB }
    return a.field - b.field
  })

  // Gruppiere Matches nach Slot
  const slots: Match[][] = []
  sortedMatches.forEach((match) => {
    const slot = match.slot ?? match.round - 1
    if (!slots[slot]) {
      slots[slot] = []
    }
    slots[slot].push(match)
  })

  // Scheduliere jeden Slot
  slots.forEach((slotMatches) => {
    slotMatches.forEach((match) => {
      const totalMatchDuration = calculateTotalMatchDuration(gameDuration, gamePeriods, halftimeBreak)

      const matchStartTime = new Date(currentTime)
      const matchEndTime = addMinutes(matchStartTime, totalMatchDuration)

      scheduled.push({
        id: match.id,
        matchNumber: matchNumber++,
        time: formatTime(matchStartTime),
        field: match.field,
        homeTeam: slotLabel(match.slotA, labelContext),
        awayTeam: slotLabel(match.slotB, labelContext),
        originalTeamA: transitionalTeamRef(match.slotA),
        originalTeamB: transitionalTeamRef(match.slotB),
        slotA: match.slotA,
        slotB: match.slotB,
        ...matchOrigins(match), // A-36a: Herkunft des Platzes durchreichen
        group: match.group,
        phase: match.isFinal ? determineFinalPhase(match) : 'groupStage',
        finalType: match.finalType,
        label: match.label,
        startTime: matchStartTime,
        endTime: matchEndTime,
        duration: totalMatchDuration,
        slot: match.slot ?? match.round - 1,
      })
    })

    // Nach jedem Slot: Match-Dauer + Pause
    const slotDuration = calculateTotalMatchDuration(gameDuration, gamePeriods, halftimeBreak)
    currentTime = addMinutes(currentTime, slotDuration + breakDuration)
  })

  return scheduled
}

/**
 * Schedule Helpers - Utility functions for schedule generation
 */

import { Match, Team, Standing, TournamentGroup } from '../types/tournament'
import { getGroupDisplayName } from '../utils/displayNames'
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

/**
 * Bestimmt Final-Phase aus Match
 */
export function determineFinalPhase(match: Match): SchedulePhaseType {
  if (match.finalType) {
    return 'final'
  }

  // Heuristik: Basierend auf Match-ID oder Round
  const matchId = match.id.toLowerCase()
  if (matchId.includes('r16') || matchId.startsWith('r16-')) {return 'roundOf16'}
  if (matchId.includes('qf')) {return 'quarterfinal'}
  if (matchId.includes('sf') || matchId.includes('semi')) {return 'semifinal'}

  return 'final'
}

// ============================================================================
// TEAM NAME RESOLUTION
// ============================================================================

/**
 * Löst Team-Namen auf (mit i18n für Platzhalter)
 */
export function resolveTeamName(
  teamId: string,
  teamMap: Map<string, string>,
  locale: 'de' | 'en',
  groups?: TournamentGroup[]
): string {
  // Wenn Team-Name existiert, verwende ihn
  const teamName = teamMap.get(teamId)
  if (teamName) {
    return teamName
  }

  // Ansonsten: Übersetze Platzhalter (mit custom Gruppennamen)
  return translatePlaceholder(teamId, locale, groups)
}

/**
 * Gibt das englische Ordinal-Suffix zurück (1st, 2nd, 3rd, 4th)
 */
function getOrdinalSuffix(n: number): string {
  if (n === 1) {return 'st'}
  if (n === 2) {return 'nd'}
  if (n === 3) {return 'rd'}
  return 'th'
}

/**
 * Übersetzt Platzhalter-Namen
 * Nutzt custom Gruppennamen wenn vorhanden (US-GROUPS-AND-FIELDS)
 */
export function translatePlaceholder(
  placeholder: string,
  locale: 'de' | 'en',
  groups?: TournamentGroup[]
): string {
  // Prüfe auf Gruppen-Platzhalter wie 'group-a-1st', 'group-b-2nd', etc.
  const groupMatch = placeholder.toLowerCase().match(/^group-([a-h])-(\d+)(st|nd|rd|th)$/)
  if (groupMatch) {
    const groupLetter = groupMatch[1].toUpperCase()
    const position = parseInt(groupMatch[2])

    // Hole custom Gruppenname (oder Fallback zu "Gruppe X")
    const groupName = getGroupDisplayName(groupLetter, { groups })

    // Generiere Platzierungs-Suffix
    const positionSuffix =
      locale === 'de' ? `${position}. Platz` : `${position}${getOrdinalSuffix(position)} Place`

    return `${groupName} - ${positionSuffix}`
  }

  // Finale-Platzhalter (keine Gruppen-Referenzen)
  const translated = FINAL_TRANSLATIONS[locale][placeholder.toLowerCase()]
  return translated || placeholder
}

/**
 * Übersetzungstabelle für Finale-Platzhalter
 */
const FINAL_TRANSLATIONS: Record<'de' | 'en', Record<string, string>> = {
  de: {
    // Finalrunden Platzhalter (Legacy-Format)
    'winner-qf-1': 'Sieger VF 1',
    'winner-qf-2': 'Sieger VF 2',
    'winner-qf-3': 'Sieger VF 3',
    'winner-qf-4': 'Sieger VF 4',
    'loser-qf-1': 'Verlierer VF 1',
    'loser-qf-2': 'Verlierer VF 2',
    'loser-qf-3': 'Verlierer VF 3',
    'loser-qf-4': 'Verlierer VF 4',
    'winner-sf-1': 'Sieger HF 1',
    'winner-sf-2': 'Sieger HF 2',
    'loser-sf-1': 'Verlierer HF 1',
    'loser-sf-2': 'Verlierer HF 2',
    // Neue Playoff-Platzhalter (aktuelles Format)
    'r16-1-winner': 'Sieger AF 1',
    'r16-2-winner': 'Sieger AF 2',
    'r16-3-winner': 'Sieger AF 3',
    'r16-4-winner': 'Sieger AF 4',
    'r16-5-winner': 'Sieger AF 5',
    'r16-6-winner': 'Sieger AF 6',
    'r16-7-winner': 'Sieger AF 7',
    'r16-8-winner': 'Sieger AF 8',
    'qf1-winner': 'Sieger VF 1',
    'qf2-winner': 'Sieger VF 2',
    'qf3-winner': 'Sieger VF 3',
    'qf4-winner': 'Sieger VF 4',
    'qf1-loser': 'Verlierer VF 1',
    'qf2-loser': 'Verlierer VF 2',
    'qf3-loser': 'Verlierer VF 3',
    'qf4-loser': 'Verlierer VF 4',
    'semi1-winner': 'Sieger HF 1',
    'semi2-winner': 'Sieger HF 2',
    'semi1-loser': 'Verlierer HF 1',
    'semi2-loser': 'Verlierer HF 2',
  },
  en: {
    // Finals Placeholders (Legacy)
    'winner-qf-1': 'Winner QF 1',
    'winner-qf-2': 'Winner QF 2',
    'winner-qf-3': 'Winner QF 3',
    'winner-qf-4': 'Winner QF 4',
    'loser-qf-1': 'Loser QF 1',
    'loser-qf-2': 'Loser QF 2',
    'loser-qf-3': 'Loser QF 3',
    'loser-qf-4': 'Loser QF 4',
    'winner-sf-1': 'Winner SF 1',
    'winner-sf-2': 'Winner SF 2',
    'loser-sf-1': 'Loser SF 1',
    'loser-sf-2': 'Loser SF 2',
    // New Playoff Placeholders
    'r16-1-winner': 'Winner R16-1',
    'r16-2-winner': 'Winner R16-2',
    'r16-3-winner': 'Winner R16-3',
    'r16-4-winner': 'Winner R16-4',
    'r16-5-winner': 'Winner R16-5',
    'r16-6-winner': 'Winner R16-6',
    'r16-7-winner': 'Winner R16-7',
    'r16-8-winner': 'Winner R16-8',
    'qf1-winner': 'Winner QF 1',
    'qf2-winner': 'Winner QF 2',
    'qf3-winner': 'Winner QF 3',
    'qf4-winner': 'Winner QF 4',
    'qf1-loser': 'Loser QF 1',
    'qf2-loser': 'Loser QF 2',
    'qf3-loser': 'Loser QF 3',
    'qf4-loser': 'Loser QF 4',
    'semi1-winner': 'Winner SF 1',
    'semi2-winner': 'Winner SF 2',
    'semi1-loser': 'Loser SF 1',
    'semi2-loser': 'Loser SF 2',
  },
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
  teamMap: Map<string, string>
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
    teamMap,
    locale,
    startMatchNumber,
    groups,
  } = options

  const scheduled: ScheduledMatch[] = []
  let currentTime = new Date(startTime)
  let matchNumber = startMatchNumber

  // Sortiere Matches nach Slot (von Fair Scheduler) oder Round (Legacy)
  const sortedMatches = [...matches].sort((a, b) => {
    const slotA = a.slot ?? a.round - 1
    const slotB = b.slot ?? b.round - 1
    if (slotA !== slotB) {return slotA - slotB}
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
        homeTeam: resolveTeamName(match.teamA, teamMap, locale, groups),
        awayTeam: resolveTeamName(match.teamB, teamMap, locale, groups),
        originalTeamA: match.teamA,
        originalTeamB: match.teamB,
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

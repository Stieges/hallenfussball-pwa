/**
 * Schedule Generator - Generiert druckfertigen Spielplan aus Tournament-Daten
 *
 * Erstellt einen kompletten Zeitplan mit:
 * - Chronologische Spiel-Liste mit Uhrzeit
 * - Live-Tabelle mit Punkten/Toren
 * - Finalrunden-Spiele
 * - Druckfreundliches Format (A4)
 */

import { Tournament, Match, Team } from '../types/tournament'
import { generateGroupPhaseSchedule } from '../utils/fairScheduler'
import {
  generatePlayoffSchedule,
  generatePlayoffDefinitions,
  generatePlayoffDefinitionsLegacy,
} from '../utils/playoffScheduler'
import { getUniqueGroups } from '../utils/groupHelpers'
import { assignReferees } from './refereeAssigner'
import { GroupSizeInfo } from './playoffGenerator'

// Re-export types for backwards compatibility
export type { ScheduledMatch, SchedulePhase, GeneratedSchedule } from './scheduleTypes'
export { formatScheduleForPrint, exportScheduleAsCSV, calculateScheduleStats } from './scheduleRenderer'

// Import internal helpers
import { SchedulePhase, GeneratedSchedule, ScheduledMatch } from './scheduleTypes'
import {
  parseStartTime,
  addMinutes,
  scheduleMatches,
  createInitialStandings,
} from './scheduleHelpers'

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export function generateFullSchedule(
  tournament: Tournament,
  locale: 'de' | 'en' = 'de'
): GeneratedSchedule {
  // Validierung
  if (!tournament.teams || tournament.teams.length === 0) {
    throw new Error('Tournament must have at least one team')
  }

  // Parse Start-Zeit
  const startTime = parseStartTime(tournament.date, tournament.timeSlot)

  // Team-Lookup erstellen
  const teamMap = new Map<string, string>()
  tournament.teams.forEach((team) => {
    teamMap.set(team.id, team.name)
  })

  // Generiere Matches
  const { groupStageMatches, finalMatches } = generateMatches(tournament, startTime)

  // Scheduliere Gruppenphase
  const scheduledGroupStage = scheduleMatches({
    matches: groupStageMatches,
    startTime,
    numberOfFields: tournament.numberOfFields,
    gameDuration: tournament.groupPhaseGameDuration,
    breakDuration: tournament.groupPhaseBreakDuration || 0,
    gamePeriods: tournament.gamePeriods || 1,
    halftimeBreak: tournament.halftimeBreak || 0,
    phase: 'groupStage',
    teamMap,
    locale,
    startMatchNumber: 1,
    groups: tournament.groups,
  })

  // Scheduliere Finalrunde
  const scheduledFinals = scheduleFinalMatches(
    finalMatches,
    scheduledGroupStage,
    startTime,
    tournament,
    teamMap,
    locale
  )

  // Kombiniere und weise Schiedsrichter zu
  let allMatches = [...scheduledGroupStage, ...scheduledFinals]

  if (tournament.refereeConfig && tournament.refereeConfig.mode !== 'none') {
    allMatches = assignReferees(allMatches, tournament.teams, tournament.refereeConfig)
  }

  // Erstelle Phasen
  const phases = createPhases(allMatches, scheduledGroupStage.length)

  // End-Zeit des Turniers
  const endTime = allMatches.length > 0 ? allMatches[allMatches.length - 1].endTime : startTime
  const totalDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  return {
    tournament: {
      id: tournament.id,
      title: tournament.title,
      date: tournament.date,
      location: tournament.location,
      ageClass: tournament.ageClass,
      organizer: tournament.organizer,
      contactInfo: tournament.contactInfo,
      groups: tournament.groups,
      fields: tournament.fields,
    },
    allMatches,
    phases,
    startTime,
    endTime,
    totalDuration,
    numberOfFields: tournament.numberOfFields,
    teams: tournament.teams.map((t) => ({
      id: t.id,
      name: t.name,
      group: t.group,
    })),
    initialStandings: createInitialStandings(tournament.teams),
    refereeConfig: tournament.refereeConfig,
  }
}

// ============================================================================
// MATCH GENERATION
// ============================================================================

function generateMatches(
  tournament: Tournament,
  startTime: Date
): { groupStageMatches: Match[]; finalMatches: Match[] } {
  let groupStageMatches: Match[] = []
  let finalMatches: Match[] = []

  // 1. Generiere Gruppenphase
  if (tournament.groupSystem === 'roundRobin' || tournament.groupSystem === 'groupsAndFinals') {
    groupStageMatches = generateGroupStageMatches(tournament, startTime)
  }

  // 2. Generiere Playoffs
  const shouldGeneratePlayoffs =
    tournament.groupSystem === 'groupsAndFinals' &&
    ((tournament.finalsConfig && tournament.finalsConfig.preset !== 'none') ||
      (tournament.finals && Object.values(tournament.finals).some(Boolean)))

  console.log('[ScheduleGenerator] Playoff check:', {
    groupSystem: tournament.groupSystem,
    finalsConfig: tournament.finalsConfig,
    finals: tournament.finals,
    shouldGeneratePlayoffs,
  })

  if (shouldGeneratePlayoffs) {
    finalMatches = generateFinalMatches(tournament, groupStageMatches, startTime)
  }

  return { groupStageMatches, finalMatches }
}

function generateGroupStageMatches(tournament: Tournament, startTime: Date): Match[] {
  const groupsMap = new Map<string, Team[]>()

  if (tournament.groupSystem === 'roundRobin') {
    groupsMap.set('all', tournament.teams)
  } else {
    const groupLabels = getUniqueGroups(tournament.teams)
    for (const label of groupLabels) {
      const teamsInGroup = tournament.teams.filter((t) => t.group === label)
      if (teamsInGroup.length > 0) {
        groupsMap.set(label, teamsInGroup)
      }
    }
  }

  return generateGroupPhaseSchedule({
    groups: groupsMap,
    numberOfFields: tournament.numberOfFields,
    slotDurationMinutes: tournament.groupPhaseGameDuration,
    breakBetweenSlotsMinutes: tournament.groupPhaseBreakDuration || 0,
    minRestSlotsPerTeam: tournament.minRestSlots ?? 1,
    startTime,
    dfbPatternCode: tournament.useDFBKeys ? tournament.dfbKeyPattern : undefined,
  })
}

function generateFinalMatches(
  tournament: Tournament,
  groupStageMatches: Match[],
  startTime: Date
): Match[] {
  const numberOfGroups = tournament.numberOfGroups || 2

  // Calculate group sizes
  const groupSizes: GroupSizeInfo = {}
  const groupLabels = getUniqueGroups(tournament.teams)
  for (const label of groupLabels) {
    const teamsInGroup = tournament.teams.filter((t) => t.group === label)
    groupSizes[label] = teamsInGroup.length
  }

  // Generate playoff definitions
  const playoffDefinitions = tournament.finalsConfig
    ? generatePlayoffDefinitions(numberOfGroups, tournament.finalsConfig, groupSizes)
    : generatePlayoffDefinitionsLegacy(numberOfGroups, tournament.finals)

  console.log('[ScheduleGenerator] Generated playoff definitions:', playoffDefinitions)

  // Calculate start slot
  const lastGroupSlot =
    groupStageMatches.length > 0
      ? Math.max(...groupStageMatches.map((m) => m.slot ?? m.round - 1))
      : -1

  const slotDuration =
    tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0)
  const breakSlots = tournament.breakBetweenPhases
    ? Math.ceil(tournament.breakBetweenPhases / slotDuration)
    : 1

  const playoffStartSlot = lastGroupSlot + 1 + breakSlots
  const playoffStartTime = new Date(startTime.getTime() + playoffStartSlot * slotDuration * 60000)

  return generatePlayoffSchedule({
    playoffDefinitions,
    numberOfFields: tournament.numberOfFields,
    slotDurationMinutes: tournament.finalRoundGameDuration || tournament.groupPhaseGameDuration,
    breakBetweenSlotsMinutes:
      tournament.finalRoundBreakDuration || tournament.groupPhaseBreakDuration || 0,
    minRestSlotsPerTeam: tournament.minRestSlots ?? 1,
    startSlot: playoffStartSlot,
    startTime: playoffStartTime,
    breakBetweenPhases: tournament.breakBetweenPhases,
  })
}

// ============================================================================
// FINALS SCHEDULING
// ============================================================================

function scheduleFinalMatches(
  finalMatches: Match[],
  scheduledGroupStage: ScheduledMatch[],
  startTime: Date,
  tournament: Tournament,
  teamMap: Map<string, string>,
  locale: 'de' | 'en'
): ScheduledMatch[] {
  if (finalMatches.length === 0) {
    return []
  }

  const groupStageEnd = scheduledGroupStage[scheduledGroupStage.length - 1]?.endTime || startTime
  const breakBetweenPhases = tournament.breakBetweenPhases || 0
  const finalStartTime = addMinutes(groupStageEnd, breakBetweenPhases)

  const startMatchNumber =
    scheduledGroupStage.length > 0
      ? scheduledGroupStage[scheduledGroupStage.length - 1].matchNumber + 1
      : 1

  return scheduleMatches({
    matches: finalMatches,
    startTime: finalStartTime,
    numberOfFields: tournament.numberOfFields,
    gameDuration: tournament.finalRoundGameDuration || tournament.groupPhaseGameDuration,
    breakDuration: tournament.finalRoundBreakDuration || tournament.groupPhaseBreakDuration || 0,
    gamePeriods: tournament.gamePeriods || 1,
    halftimeBreak: tournament.halftimeBreak || 0,
    phase: 'final',
    teamMap,
    locale,
    startMatchNumber,
    groups: tournament.groups,
  })
}

// ============================================================================
// PHASE CREATION
// ============================================================================

function createPhases(allMatches: ScheduledMatch[], groupStageCount: number): SchedulePhase[] {
  const phases: SchedulePhase[] = []
  const groupStageMatches = allMatches.slice(0, groupStageCount)
  const finalMatches = allMatches.slice(groupStageCount)

  if (groupStageMatches.length > 0) {
    phases.push({
      name: 'groupStage',
      label: 'Gruppenphase',
      matches: groupStageMatches,
      startTime: groupStageMatches[0].startTime,
      endTime: groupStageMatches[groupStageMatches.length - 1].endTime,
    })
  }

  if (finalMatches.length > 0) {
    const roundOf16 = finalMatches.filter((m) => m.phase === 'roundOf16')
    const quarterfinals = finalMatches.filter((m) => m.phase === 'quarterfinal')
    const semifinals = finalMatches.filter((m) => m.phase === 'semifinal')
    const finals = finalMatches.filter((m) => m.phase === 'final')

    if (roundOf16.length > 0) {
      phases.push({
        name: 'roundOf16',
        label: 'Achtelfinale',
        matches: roundOf16,
        startTime: roundOf16[0].startTime,
        endTime: roundOf16[roundOf16.length - 1].endTime,
      })
    }

    if (quarterfinals.length > 0) {
      phases.push({
        name: 'quarterfinal',
        label: 'Viertelfinale',
        matches: quarterfinals,
        startTime: quarterfinals[0].startTime,
        endTime: quarterfinals[quarterfinals.length - 1].endTime,
      })
    }

    if (semifinals.length > 0) {
      phases.push({
        name: 'semifinal',
        label: 'Halbfinale',
        matches: semifinals,
        startTime: semifinals[0].startTime,
        endTime: semifinals[semifinals.length - 1].endTime,
      })
    }

    if (finals.length > 0) {
      phases.push({
        name: 'final',
        label: 'Finalspiele',
        matches: finals,
        startTime: finals[0].startTime,
        endTime: finals[finals.length - 1].endTime,
      })
    }
  }

  return phases
}

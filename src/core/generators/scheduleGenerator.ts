/**
 * Schedule Generator - Generiert druckfertigen Spielplan aus Tournament-Daten
 *
 * Erstellt einen kompletten Zeitplan mit:
 * - Chronologische Spiel-Liste mit Uhrzeit
 * - Live-Tabelle mit Punkten/Toren
 * - Finalrunden-Spiele
 * - Druckfreundliches Format (A4)
 */

import { Team, Match, Tournament } from '../../types/tournament';
import { generateGroupPhaseScheduleWithReport } from './fairScheduler'
import { effectiveHostTeamIds } from '../models/hostTeams'
import { generatePlayoffSchedule } from './playoffScheduler'
import { legacyFinalsPreset } from './playoffGenerator'
import { assertValidFinalsPlan, buildFinalsTemplate, isFinalsPlanError } from './finalsTemplates'
import { getUniqueGroups } from '../../utils/groupHelpers'
import { assignReferees } from './refereeAssigner'
import { transitionalTeamRef } from '../models/matchSlot'
import { slotLabel } from '../models/slotLabel'
import { ensureMatchNumbers } from '../models/matchNumbers'
import sportGlossary from '../../i18n/glossary.json'

// Re-export types for backwards compatibility
export type { ScheduledMatch, SchedulePhase, GeneratedSchedule } from './scheduleTypes'
export { formatScheduleForPrint, exportScheduleAsCSV, calculateScheduleStats } from '../../lib/scheduleRenderer'

// Import internal helpers
import { SchedulePhase, GeneratedSchedule, ScheduledMatch, ScheduleNotice } from './scheduleTypes'
import {
  parseStartTime,
  addMinutes,
  formatTime,
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
  if (tournament.teams.length === 0) {
    throw new Error('Tournament must have at least one team')
  }

  // Parse Start-Zeit
  const startTime = parseStartTime(tournament.date, tournament.timeSlot)

  let allMatches: ScheduledMatch[]
  let groupStageMatches: Match[]
  let finalMatches: Match[]
  let scheduleNotices: ScheduleNotice[] = []
  let roundsPlan = false

  // Helper interfaces for imported data - separate from strict Match/Tournament interfaces
  // to avoid inheritance conflicts with different property types
  interface ExtendedMatchInput {
    id: string;
    phase?: string;
    isFinal?: boolean;
    scheduledTime?: Date | string;
  }

  // Check if tournament has custom matches that should be preserved
  const hasMatches = tournament.matches.length > 0


  if (hasMatches) {
    // USE ESTABLISHED MATCHES (Truth from Repository)
    // BUG-FIX: Calculate sequential times for imported matches that lack scheduledTime
    // Sort by slot (or round-1 as fallback) to determine time slots
    const sortedBySlot = [...tournament.matches].sort((a, b) => {
      const slotA = a.slot ?? (a.round - 1);
      const slotB = b.slot ?? (b.round - 1);
      if (slotA !== slotB) { return slotA - slotB; }
      return a.field - b.field;
    });

    // Calculate slot duration (game + break)
    const gameDuration = tournament.groupPhaseGameDuration;
    const breakDuration = tournament.groupPhaseBreakDuration ?? 0;
    const slotDuration = gameDuration + breakDuration;

    // Build a map from match ID to calculated time
    const matchTimeMap = new Map<string, { startTime: Date; endTime: Date }>();
    let currentSlot = -1;
    let currentSlotStartTime = startTime;

    for (const m of sortedBySlot) {
      const matchSlot = m.slot ?? (m.round - 1);

      // If we moved to a new slot, update the start time
      if (matchSlot !== currentSlot) {
        currentSlot = matchSlot;
        currentSlotStartTime = new Date(startTime.getTime() + matchSlot * slotDuration * 60000);
      }

      const matchEnd = new Date(currentSlotStartTime.getTime() + gameDuration * 60000);
      matchTimeMap.set(m.id, { startTime: currentSlotStartTime, endTime: matchEnd });
    }

    // Anzeigetexte der Seiten: eine Funktion (slotLabel), Namen nur über die Team-ID
    const labelContext = { teams: tournament.teams, matches: tournament.matches, groups: tournament.groups, locale }

    // C-SPIELNUMMER-FEHLT (@SL-049, @ZM-007): gespeicherte Nummer, sonst die Rückfallregel (Spielplan-Reihenfolge),
    // nie der Platz in der Liste (die Cloud liefert Spiele ohne Nummer in beliebiger Reihenfolge).
    const numberById = new Map(ensureMatchNumbers(tournament.matches).map((m) => [m.id, m.matchNumber]))

    // First, map all existing matches to ScheduledMatch format
    const mappedMatches = tournament.matches.map((m, index) => {
      const extMatch = m as unknown as ExtendedMatchInput;

      // Use persisted scheduledTime if available, otherwise use calculated time from slot
      const calculatedTime = matchTimeMap.get(m.id);
      const matchStart = m.scheduledTime
        ? new Date(m.scheduledTime)
        : (calculatedTime?.startTime ?? startTime);
      const matchEnd = m.scheduledTime
        ? new Date(new Date(m.scheduledTime).getTime() + gameDuration * 60000)
        : (calculatedTime?.endTime ?? new Date(startTime.getTime() + gameDuration * 60000));

      // BUG-FIX: Derive phase from isFinal for backward compatibility with old data
      const phase = m.phase ?? extMatch.phase ?? (m.isFinal ? 'final' : 'groupStage');

      return {
        ...m,
        id: m.id,
        matchNumber: numberById.get(m.id) ?? index + 1,
        startTime: matchStart,
        endTime: matchEnd,
        // Properties required by ScheduledMatch interface
        time: formatTime(matchStart),
        originalTeamA: transitionalTeamRef(m.slotA),
        originalTeamB: transitionalTeamRef(m.slotB),
        duration: gameDuration,

        homeTeam: slotLabel(m.slotA, labelContext),
        awayTeam: slotLabel(m.slotB, labelContext),
        phase: phase as ScheduledMatch['phase'],
        isFinal: !!m.isFinal || !!extMatch.isFinal,
        // Ensure scores are preserved
        scoreA: m.scoreA,
        scoreB: m.scoreB
      };
    })

    // Categorize into group/final for stats
    groupStageMatches = mappedMatches.filter(m => !m.isFinal && m.phase === 'groupStage').map(m => m as unknown as Match)
     
    finalMatches = mappedMatches.filter(m => m.isFinal || m.phase !== 'groupStage').map(m => m as unknown as Match)

    // HYBRID MODE: If we have group matches but NO final matches (or they look incomplete), check if we SHOULD have finals
    // This happens if matches were persisted before finals were configured or generated
    const shouldGeneratePlayoffs =
      tournament.groupSystem === 'groupsAndFinals' &&
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if either finalsConfig exists OR finals has any truthy values
      ((tournament.finalsConfig && tournament.finalsConfig.preset !== 'none') ||
        Object.values(tournament.finals).some(Boolean))

    // Check if we already have finals in the persisted data
    const hasExistingFinals = finalMatches.length > 0;



    // Also sanity check: If we have NO finals but we SHOULD, we must regenerate.
    // AND: Safety check - don't regenerate if we actually have finals but they are somehow miscategorized (unlikely with our robust filtering above)
    if (shouldGeneratePlayoffs && !hasExistingFinals && groupStageMatches.length > 0) {

      // Generate Finals dynamically even though we are in "Persisted Mode"
      // A-12a: Lesepfad (Public View, Export, Turnier-Manager) – eine nicht erzeugbare Vorlage (ab 3 Gruppen, fehlende
      // Gruppenzahl, fehlerhafte Herkunft) zeigt die gespeicherten Spiele statt abzustürzen. Sichtbar gemeldet wird der
      // Fehler beim Erzeugen bzw. Anlegen (Zweig „GENERATE MATCHES“).
      const generatedFinals = finalMatchesOrNone(tournament, groupStageMatches, startTime)


      // Schedule the finals (time slots)
      // Note: We need to convert mappedMatches back to scheduledGroupStage format for timing calc
      const scheduledFinalsByGen = scheduleFinalMatches(
        generatedFinals,
        mappedMatches.filter(m => !m.isFinal && m.phase === 'groupStage'),
        startTime,
        tournament,
        locale
      )

      // Merge: Existing Group Matches + Generated Final Matches
      allMatches = [...mappedMatches, ...scheduledFinalsByGen]
    } else {

      // Standard Case: Use what we loaded
      allMatches = mappedMatches
    }

  } else {
    // GENERATE MATCHES (Standard Behavior)
    const generated = generateMatches(tournament, startTime)
    groupStageMatches = generated.groupStageMatches
    finalMatches = generated.finalMatches
    scheduleNotices = generated.notices
    roundsPlan = generated.roundsPlan

    // Scheduliere Gruppenphase
    const scheduledGroupStage = scheduleMatches({
      matches: groupStageMatches,
      startTime,
      numberOfFields: tournament.numberOfFields,
      gameDuration: tournament.groupPhaseGameDuration,
      breakDuration: tournament.groupPhaseBreakDuration ?? 0,
      gamePeriods: tournament.gamePeriods ?? 1,
      halftimeBreak: tournament.halftimeBreak ?? 0,
      phase: 'groupStage',
      teams: tournament.teams,
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
      locale
    )

    allMatches = [...scheduledGroupStage, ...scheduledFinals]

    if (tournament.refereeConfig && tournament.refereeConfig.mode !== 'none') {
      allMatches = assignReferees(allMatches, tournament.teams, tournament.refereeConfig)
    }
  }

  // Erstelle Phasen
  const phases = createPhases(allMatches, groupStageMatches.length)

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
    scheduleNotices,
    roundsPlan,
  }
}

// ============================================================================
// MATCH GENERATION
// ============================================================================

function generateMatches(
  tournament: Tournament,
  startTime: Date
): { groupStageMatches: Match[]; finalMatches: Match[]; notices: ScheduleNotice[]; roundsPlan: boolean } {
  let groupStageMatches: Match[] = []
  let finalMatches: Match[] = []
  let notices: ScheduleNotice[] = []
  let roundsPlan = false

  // 1. Generiere Gruppenphase
  if (tournament.groupSystem === 'roundRobin' || tournament.groupSystem === 'groupsAndFinals') {
    const groupPhase = generateGroupStageMatches(tournament, startTime)
    groupStageMatches = groupPhase.matches
    notices = groupPhase.notices
    roundsPlan = groupPhase.roundsPlan
  }

  // 2. Generiere Playoffs
  const shouldGeneratePlayoffs =
    tournament.groupSystem === 'groupsAndFinals' &&
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: generate if finalsConfig exists OR legacy finals are set
    ((tournament.finalsConfig && tournament.finalsConfig.preset !== 'none') ||
      Object.values(tournament.finals).some(Boolean))

  if (shouldGeneratePlayoffs) {
    finalMatches = generateFinalMatches(tournament, groupStageMatches, startTime)
  }

  return { groupStageMatches, finalMatches, notices, roundsPlan }
}

function generateGroupStageMatches(tournament: Tournament, startTime: Date): ReturnType<typeof generateGroupPhaseScheduleWithReport> {
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

  return generateGroupPhaseScheduleWithReport({
    groups: groupsMap,
    numberOfFields: tournament.numberOfFields,
    slotDurationMinutes: tournament.groupPhaseGameDuration,
    breakBetweenSlotsMinutes: tournament.groupPhaseBreakDuration ?? 0,
    minRestSlotsPerTeam: tournament.minRestSlots ?? 1,
    startTime,
    // @W4-028: DFB-Schlüssel im MVP aus (Tabelle fehlerhaft, C-DFB-SCHLUESSEL-LUECKEN)
    dfbPatternCode: undefined,
    hostTeamIds: effectiveHostTeamIds(tournament.hostTeamIds, tournament.teams), // @W4-027, Reihenfolge = Teamliste
    openingMode: tournament.openingMode,
  })
}

function generateFinalMatches(
  tournament: Tournament,
  groupStageMatches: Match[],
  startTime: Date
): Match[] {
  // A-12a: echte Gruppen des Turniers (wie die Gruppenphase, `generateGroupStageMatches`) – die Vorlage nennt sie über
  // ihren Platz („erste Gruppe“), die Herkunft trägt die echte Gruppe (C-GENERATOR-HERKUNFT-GRUPPENNAMEN).
  const groupIds = getUniqueGroups(tournament.teams)
  const teamsPerGroup = groupIds.map((id) => tournament.teams.filter((t) => t.group === id).length)
  const finalsConfig = tournament.finalsConfig ?? { preset: legacyFinalsPreset(tournament.finals) }

  // Strenger Eingang: fehlende Gruppenzahl, ab 3 Gruppen, unbekannte Plätze → sichtbarer Fehler (kein `?? 2` mehr)
  const playoffDefinitions = buildFinalsTemplate(tournament.numberOfGroups, teamsPerGroup, finalsConfig)

  // Calculate start slot
  const lastGroupSlot =
    groupStageMatches.length > 0
      ? Math.max(...groupStageMatches.map((m) => m.slot ?? m.round - 1))
      : -1

  const slotDuration =
    tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration ?? 0)
  const breakSlots = tournament.breakBetweenPhases
    ? Math.ceil(tournament.breakBetweenPhases / slotDuration)
    : 1

  const playoffStartSlot = lastGroupSlot + 1 + breakSlots
  const playoffStartTime = new Date(startTime.getTime() + playoffStartSlot * slotDuration * 60000)

  const finalMatches = generatePlayoffSchedule({
    playoffDefinitions,
    numberOfFields: tournament.numberOfFields,
    slotDurationMinutes: tournament.finalRoundGameDuration ?? tournament.groupPhaseGameDuration,
    breakBetweenSlotsMinutes:
      tournament.finalRoundBreakDuration ?? tournament.groupPhaseBreakDuration ?? 0,
    minRestSlotsPerTeam: tournament.minRestSlots ?? 1,
    startSlot: playoffStartSlot,
    startTime: playoffStartTime,
    breakBetweenPhases: tournament.breakBetweenPhases,
    groupIds,
  })

  // A-12b-Prüfung auf dem fertigen Plan (@TM-013, @TM-002): jede Herkunft zeigt auf eine echte Gruppe mit genug Teams
  assertValidFinalsPlan(finalMatches, groupIds.map((id, index) => ({ id, teamCount: teamsPerGroup[index] })))
  return finalMatches
}

/**
 * Lesepfad: Finalrunde nachträglich erzeugen, bei einer nicht erzeugbaren Vorlage keine (gespeicherte Spiele bleiben).
 * Nur Vorlagen- und Prüffehler werden abgefangen; ein Programmfehler bleibt sichtbar.
 */
function finalMatchesOrNone(tournament: Tournament, groupStageMatches: Match[], startTime: Date): Match[] {
  try {
    return generateFinalMatches(tournament, groupStageMatches, startTime)
  } catch (error) {
    if (isFinalsPlanError(error)) {
      return []
    }
    throw error
  }
}

// ============================================================================
// FINALS SCHEDULING
// ============================================================================

function scheduleFinalMatches(
  finalMatches: Match[],
  scheduledGroupStage: ScheduledMatch[],
  startTime: Date,
  tournament: Tournament,
  locale: 'de' | 'en'
): ScheduledMatch[] {
  if (finalMatches.length === 0) {
    return []
  }

  const groupStageEnd = scheduledGroupStage[scheduledGroupStage.length - 1]?.endTime ?? startTime
  const breakBetweenPhases = tournament.breakBetweenPhases ?? 0
  const finalStartTime = addMinutes(groupStageEnd, breakBetweenPhases)

  // höchste Nummer der Gruppenphase, nicht die des letzten Listeneintrags (gespeicherte Spiele in beliebiger Reihenfolge)
  const startMatchNumber = Math.max(0, ...scheduledGroupStage.map((m) => m.matchNumber)) + 1

  return scheduleMatches({
    matches: finalMatches,
    startTime: finalStartTime,
    numberOfFields: tournament.numberOfFields,
    gameDuration: tournament.finalRoundGameDuration ?? tournament.groupPhaseGameDuration,
    breakDuration: tournament.finalRoundBreakDuration ?? tournament.groupPhaseBreakDuration ?? 0,
    gamePeriods: tournament.gamePeriods ?? 1,
    halftimeBreak: tournament.halftimeBreak ?? 0,
    phase: 'final',
    teams: tournament.teams,
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
  // A-12a: die Finalrunde ist EIN Abschnitt in Spielplan-Reihenfolge, auch wenn Halbfinale/Viertelfinale ihre eigene
  // Phase tragen (Spielplan, PDF und Public View reißen sie sonst auseinander; Auflage 15 Review GA4 v2).
  const finalMatches = allMatches.slice(groupStageCount).filter((m) => m.phase !== 'groupStage')

  if (groupStageMatches.length > 0) {
    phases.push({
      name: 'groupStage',
      label: sportGlossary.terms.groupStage.de,
      matches: groupStageMatches,
      startTime: groupStageMatches[0].startTime,
      endTime: groupStageMatches[groupStageMatches.length - 1].endTime,
    })
  }

  if (finalMatches.length > 0) {
    phases.push({
      name: 'final',
      label: 'Finalspiele',
      matches: finalMatches,
      startTime: finalMatches[0].startTime,
      endTime: finalMatches[finalMatches.length - 1].endTime,
    })
  }

  return phases
}

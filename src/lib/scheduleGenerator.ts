/**
 * Schedule Generator - Generiert druckfertigen Spielplan aus Tournament-Daten
 *
 * Erstellt einen kompletten Zeitplan mit:
 * - Chronologische Spiel-Liste mit Uhrzeit
 * - Live-Tabelle mit Punkten/Toren
 * - Finalrunden-Spiele
 * - Druckfreundliches Format (A4)
 */

import { Tournament, Match, Team, Standing, RefereeConfig, LocationDetails, ContactInfo } from '../types/tournament';
import { generateGroupPhaseSchedule } from '../utils/fairScheduler';
import { generatePlayoffSchedule, generatePlayoffDefinitions, generatePlayoffDefinitionsLegacy } from '../utils/playoffScheduler';
import { getUniqueGroups } from '../utils/groupHelpers';
import { assignReferees } from './refereeAssigner';
import { GroupSizeInfo } from './playoffGenerator';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ScheduledMatch {
  /** Match ID */
  id: string;
  /** Spiel-Nummer (1-basiert) */
  matchNumber: number;
  /** Uhrzeit (HH:MM) */
  time: string;
  /** Feld-Nummer */
  field: number;
  /** Heim-Team Name (übersetzt für Anzeige) */
  homeTeam: string;
  /** Auswärts-Team Name (übersetzt für Anzeige) */
  awayTeam: string;
  /** Original Team-ID oder Platzhalter (z.B. "group-a-1st" für Playoffs) */
  originalTeamA: string;
  /** Original Team-ID oder Platzhalter (z.B. "group-b-2nd" für Playoffs) */
  originalTeamB: string;
  /** Gruppe oder undefined für Finalspiele */
  group?: string;
  /** Phase: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final' */
  phase: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';
  /** Finaltyp (z.B. 'final', 'thirdPlace') */
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
  /** Label for playoff matches (e.g., '1. Halbfinale', '2. Halbfinale') */
  label?: string;
  /** Spielbeginn als Date-Objekt */
  startTime: Date;
  /** Spielende als Date-Objekt */
  endTime: Date;
  /** Dauer in Minuten */
  duration: number;
  /** Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.) */
  referee?: number;
  /** Slot index für Schiedsrichter-Verteilung */
  slot?: number;
  /** Score Heim-Team (optional, wird bei Ergebniseingabe gesetzt) */
  scoreA?: number;
  /** Score Auswärts-Team (optional, wird bei Ergebniseingabe gesetzt) */
  scoreB?: number;
}

export interface SchedulePhase {
  /** Phase-Name */
  name: string;
  /** Display-Label */
  label: string;
  /** Matches in dieser Phase */
  matches: ScheduledMatch[];
  /** Start-Zeit der Phase */
  startTime: Date;
  /** End-Zeit der Phase */
  endTime: Date;
}

export interface GeneratedSchedule {
  /** Turnier-Metadaten */
  tournament: {
    id: string;
    title: string;
    date: string;
    location: LocationDetails;
    ageClass: string;
    organizer?: string; // Veranstalter-Name (optional)
    contactInfo?: ContactInfo; // Kontaktinformationen (optional)
  };

  /** Alle Spiele chronologisch sortiert */
  allMatches: ScheduledMatch[];

  /** Spiele gruppiert nach Phase */
  phases: SchedulePhase[];

  /** Start-Zeit des Turniers */
  startTime: Date;

  /** End-Zeit des Turniers */
  endTime: Date;

  /** Gesamtdauer in Minuten */
  totalDuration: number;

  /** Anzahl parallele Felder */
  numberOfFields: number;

  /** Teams mit Gruppen-Zuordnung */
  teams: Array<{
    id: string;
    name: string;
    group?: string;
  }>;

  /** Initial leere Tabelle (für Live-Updates) */
  initialStandings: Standing[];

  /** Schiedsrichter-Konfiguration */
  refereeConfig?: RefereeConfig;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export function generateFullSchedule(tournament: Tournament, locale: 'de' | 'en' = 'de'): GeneratedSchedule {
  // Validierung
  if (!tournament.teams || tournament.teams.length === 0) {
    throw new Error('Tournament must have at least one team');
  }

  // Parse Start-Zeit
  const startTime = parseStartTime(tournament.date, tournament.timeSlot);

  // Team-Lookup erstellen
  const teamMap = new Map<string, string>();
  tournament.teams.forEach(team => {
    teamMap.set(team.id, team.name);
  });

  // *** FAIR SCHEDULER INTEGRATION ***
  // Generiere Matches mit Fair Scheduler für faire Verteilung
  let groupStageMatches: Match[] = [];
  let finalMatches: Match[] = [];

  // 1. Generiere Gruppenphase
  if (tournament.groupSystem === 'roundRobin' || tournament.groupSystem === 'groupsAndFinals') {
    // Organisiere Teams in Gruppen
    const groupsMap = new Map<string, Team[]>();

    if (tournament.groupSystem === 'roundRobin') {
      groupsMap.set('all', tournament.teams);
    } else {
      const groupLabels = getUniqueGroups(tournament.teams);
      for (const label of groupLabels) {
        const teamsInGroup = tournament.teams.filter(t => t.group === label);
        if (teamsInGroup.length > 0) {
          groupsMap.set(label, teamsInGroup);
        }
      }
    }

    // Fair Scheduler für Gruppenphase
    // Mit optionaler DFB-Schlüsselzahlen-Unterstützung
    groupStageMatches = generateGroupPhaseSchedule({
      groups: groupsMap,
      numberOfFields: tournament.numberOfFields,
      slotDurationMinutes: tournament.groupPhaseGameDuration,
      breakBetweenSlotsMinutes: tournament.groupPhaseBreakDuration || 0,
      minRestSlotsPerTeam: tournament.minRestSlots ?? 1,
      startTime,
      dfbPatternCode: tournament.useDFBKeys ? tournament.dfbKeyPattern : undefined,
    });
  }

  // 2. Generiere Playoffs
  const shouldGeneratePlayoffs = tournament.groupSystem === 'groupsAndFinals' && (
    (tournament.finalsConfig && tournament.finalsConfig.preset !== 'none') ||
    (tournament.finals && Object.values(tournament.finals).some(Boolean))
  );

  console.log('[ScheduleGenerator] Playoff check:', {
    groupSystem: tournament.groupSystem,
    finalsConfig: tournament.finalsConfig,
    finals: tournament.finals,
    shouldGeneratePlayoffs,
  });

  if (shouldGeneratePlayoffs) {
    const numberOfGroups = tournament.numberOfGroups || 2;

    // Calculate group sizes for dynamic placement matches
    const groupSizes: GroupSizeInfo = {};
    const groupLabels = getUniqueGroups(tournament.teams);
    for (const label of groupLabels) {
      const teamsInGroup = tournament.teams.filter(t => t.group === label);
      groupSizes[label] = teamsInGroup.length;
    }

    // Use new FinalsConfig if available, otherwise migrate from legacy
    const playoffDefinitions = tournament.finalsConfig
      ? generatePlayoffDefinitions(numberOfGroups, tournament.finalsConfig, groupSizes)
      : generatePlayoffDefinitionsLegacy(numberOfGroups, tournament.finals);

    console.log('[ScheduleGenerator] Generated playoff definitions:', playoffDefinitions);

    // Berechne Startslot für Playoffs
    const lastGroupSlot = groupStageMatches.length > 0
      ? Math.max(...groupStageMatches.map(m => m.slot ?? m.round - 1))
      : -1;

    const breakSlots = tournament.breakBetweenPhases
      ? Math.ceil(tournament.breakBetweenPhases / (tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0)))
      : 1;

    const playoffStartSlot = lastGroupSlot + 1 + breakSlots;

    // Playoff Start-Zeit
    let playoffStartTime: Date | undefined;
    if (startTime) {
      const slotDuration = tournament.groupPhaseGameDuration + (tournament.groupPhaseBreakDuration || 0);
      playoffStartTime = new Date(startTime.getTime() + playoffStartSlot * slotDuration * 60000);
    }

    finalMatches = generatePlayoffSchedule({
      playoffDefinitions,
      numberOfFields: tournament.numberOfFields,
      slotDurationMinutes: tournament.finalRoundGameDuration || tournament.groupPhaseGameDuration,
      breakBetweenSlotsMinutes: tournament.finalRoundBreakDuration || tournament.groupPhaseBreakDuration || 0,
      minRestSlotsPerTeam: tournament.minRestSlots ?? 1,
      startSlot: playoffStartSlot,
      startTime: playoffStartTime,
      breakBetweenPhases: tournament.breakBetweenPhases,
    });

    console.log('[ScheduleGenerator] Generated final matches:', finalMatches);
  }

  // Generiere Zeitplan für Gruppenphase
  const scheduledGroupStage = scheduleMatches(
    groupStageMatches,
    startTime,
    tournament.numberOfFields,
    tournament.groupPhaseGameDuration,
    tournament.groupPhaseBreakDuration || 0,
    tournament.gamePeriods || 1,
    tournament.halftimeBreak || 0,
    'groupStage',
    teamMap,
    locale,
    1 // Start mit Spielnummer 1
  );

  // Wenn Finalrunde existiert, berechne Start-Zeit nach Gruppenphase
  let scheduledFinals: ScheduledMatch[] = [];
  if (finalMatches.length > 0) {
    const groupStageEnd = scheduledGroupStage[scheduledGroupStage.length - 1]?.endTime || startTime;
    const breakBetweenPhases = tournament.breakBetweenPhases || 0;
    const finalStartTime = addMinutes(groupStageEnd, breakBetweenPhases);

    // Finalrunde-Nummerierung nach Gruppenphase fortsetzen
    const startMatchNumber = scheduledGroupStage.length > 0
      ? scheduledGroupStage[scheduledGroupStage.length - 1].matchNumber + 1
      : 1;

    scheduledFinals = scheduleMatches(
      finalMatches,
      finalStartTime,
      tournament.numberOfFields,
      tournament.finalRoundGameDuration || tournament.groupPhaseGameDuration,
      tournament.finalRoundBreakDuration || tournament.groupPhaseBreakDuration || 0,
      tournament.gamePeriods || 1,
      tournament.halftimeBreak || 0,
      'final',
      teamMap,
      locale,
      startMatchNumber // Fortlaufende Nummerierung
    );
  }

  // Kombiniere alle Matches
  let allMatches = [...scheduledGroupStage, ...scheduledFinals];

  // *** REFEREE ASSIGNMENT ***
  // Assign referees to all matches BEFORE creating phases
  if (tournament.refereeConfig && tournament.refereeConfig.mode !== 'none') {
    allMatches = assignReferees(allMatches, tournament.teams, tournament.refereeConfig);
  }

  // Split back into group stage and finals (now with referee assignments)
  const matchesWithRefereesGroupStage = allMatches.slice(0, scheduledGroupStage.length);
  const matchesWithRefereesFinals = allMatches.slice(scheduledGroupStage.length);

  // Erstelle Phasen (with referee-assigned matches)
  const phases: SchedulePhase[] = [];

  if (matchesWithRefereesGroupStage.length > 0) {
    phases.push({
      name: 'groupStage',
      label: 'Gruppenphase',
      matches: matchesWithRefereesGroupStage,
      startTime: matchesWithRefereesGroupStage[0].startTime,
      endTime: matchesWithRefereesGroupStage[matchesWithRefereesGroupStage.length - 1].endTime,
    });
  }

  if (matchesWithRefereesFinals.length > 0) {
    // Gruppiere Finals nach Phase (R16, QF, SF, Finals)
    const roundOf16 = matchesWithRefereesFinals.filter(m => m.phase === 'roundOf16');
    const quarterfinals = matchesWithRefereesFinals.filter(m => m.phase === 'quarterfinal');
    const semifinals = matchesWithRefereesFinals.filter(m => m.phase === 'semifinal');
    const finals = matchesWithRefereesFinals.filter(m => m.phase === 'final');

    if (roundOf16.length > 0) {
      phases.push({
        name: 'roundOf16',
        label: 'Achtelfinale',
        matches: roundOf16,
        startTime: roundOf16[0].startTime,
        endTime: roundOf16[roundOf16.length - 1].endTime,
      });
    }

    if (quarterfinals.length > 0) {
      phases.push({
        name: 'quarterfinal',
        label: 'Viertelfinale',
        matches: quarterfinals,
        startTime: quarterfinals[0].startTime,
        endTime: quarterfinals[quarterfinals.length - 1].endTime,
      });
    }

    if (semifinals.length > 0) {
      phases.push({
        name: 'semifinal',
        label: 'Halbfinale',
        matches: semifinals,
        startTime: semifinals[0].startTime,
        endTime: semifinals[semifinals.length - 1].endTime,
      });
    }

    if (finals.length > 0) {
      phases.push({
        name: 'final',
        label: 'Finalspiele',
        matches: finals,
        startTime: finals[0].startTime,
        endTime: finals[finals.length - 1].endTime,
      });
    }
  }

  // End-Zeit des gesamten Turniers
  const endTime = allMatches.length > 0
    ? allMatches[allMatches.length - 1].endTime
    : startTime;

  const totalDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  // Erstelle initiale Standings
  const initialStandings = createInitialStandings(tournament.teams);

  return {
    tournament: {
      id: tournament.id,
      title: tournament.title,
      date: tournament.date,
      location: tournament.location,
      ageClass: tournament.ageClass,
      organizer: tournament.organizer,
      contactInfo: tournament.contactInfo,
    },
    allMatches: allMatches,
    phases,
    startTime,
    endTime,
    totalDuration,
    numberOfFields: tournament.numberOfFields,
    teams: tournament.teams.map(t => ({
      id: t.id,
      name: t.name,
      group: t.group,
    })),
    initialStandings,
    refereeConfig: tournament.refereeConfig,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Scheduliert eine Liste von Matches mit Zeiten
 */
function scheduleMatches(
  matches: Match[],
  startTime: Date,
  _numberOfFields: number,
  gameDuration: number,
  breakDuration: number,
  gamePeriods: number,
  halftimeBreak: number,
  _phase: 'groupStage' | 'final',
  teamMap: Map<string, string>,
  locale: 'de' | 'en',
  startMatchNumber: number = 1
): ScheduledMatch[] {
  const scheduled: ScheduledMatch[] = [];
  let currentTime = new Date(startTime);
  let matchNumber = startMatchNumber;

  // Sortiere Matches nach Slot (von Fair Scheduler) oder Round (Legacy)
  const sortedMatches = [...matches].sort((a, b) => {
    const slotA = a.slot ?? a.round - 1;
    const slotB = b.slot ?? b.round - 1;
    if (slotA !== slotB) {return slotA - slotB;}
    return a.field - b.field;
  });

  // Gruppiere Matches nach Slot
  const slots: Match[][] = [];
  sortedMatches.forEach(match => {
    const slot = match.slot ?? match.round - 1;
    if (!slots[slot]) {
      slots[slot] = [];
    }
    slots[slot].push(match);
  });

  // Scheduliere jeden Slot
  slots.forEach(slotMatches => {
    slotMatches.forEach(match => {
      const totalMatchDuration = calculateTotalMatchDuration(
        gameDuration,
        gamePeriods,
        halftimeBreak
      );

      const matchStartTime = new Date(currentTime);
      const matchEndTime = addMinutes(matchStartTime, totalMatchDuration);

      scheduled.push({
        id: match.id,
        matchNumber: matchNumber++,
        time: formatTime(matchStartTime),
        field: match.field,
        homeTeam: resolveTeamName(match.teamA, teamMap, locale),
        awayTeam: resolveTeamName(match.teamB, teamMap, locale),
        originalTeamA: match.teamA, // Original ID/Placeholder für Persistenz
        originalTeamB: match.teamB, // Original ID/Placeholder für Persistenz
        group: match.group,
        phase: match.isFinal ? determineFinalPhase(match) : 'groupStage',
        finalType: match.finalType,
        label: match.label,
        startTime: matchStartTime,
        endTime: matchEndTime,
        duration: totalMatchDuration,
        // FIX: Add slot for proper match ID synchronization
        // Without this, slot-based matching fails and all matches with same field could get same ID
        slot: match.slot ?? match.round - 1,
      });
    });

    // Nach jedem Slot: Match-Dauer + Pause
    const slotDuration = calculateTotalMatchDuration(
      gameDuration,
      gamePeriods,
      halftimeBreak
    );
    currentTime = addMinutes(currentTime, slotDuration + breakDuration);
  });

  return scheduled;
}

/**
 * Berechnet Gesamt-Matchdauer inkl. Halbzeitpausen
 */
function calculateTotalMatchDuration(
  gameDuration: number,
  gamePeriods: number,
  halftimeBreak: number
): number {
  if (gamePeriods <= 1) {
    return gameDuration;
  }

  // Bei mehreren Abschnitten: Spielzeit + (Anzahl Pausen * Pausenzeit)
  const numberOfBreaks = gamePeriods - 1;
  return gameDuration + (numberOfBreaks * halftimeBreak);
}

/**
 * Bestimmt Final-Phase aus Match
 */
function determineFinalPhase(match: Match): 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final' {
  if (match.finalType) {
    return 'final';
  }

  // Heuristik: Basierend auf Match-ID oder Round
  const matchId = match.id.toLowerCase();
  if (matchId.includes('r16') || matchId.startsWith('r16-')) {return 'roundOf16';}
  if (matchId.includes('qf')) {return 'quarterfinal';}
  if (matchId.includes('sf') || matchId.includes('semi')) {return 'semifinal';}

  return 'final';
}

/**
 * Löst Team-Namen auf (mit i18n für Platzhalter)
 */
function resolveTeamName(teamId: string, teamMap: Map<string, string>, locale: 'de' | 'en'): string {
  // Wenn Team-Name existiert, verwende ihn
  const teamName = teamMap.get(teamId);
  if (teamName) {
    return teamName;
  }

  // Ansonsten: Übersetze Platzhalter
  return translatePlaceholder(teamId, locale);
}

/**
 * Übersetzt Platzhalter-Namen
 */
function translatePlaceholder(placeholder: string, locale: 'de' | 'en'): string {
  const translations: Record<string, Record<string, string>> = {
    de: {
      // Gruppen Platzhalter
      'group-a-1st': 'Gruppe A - 1. Platz',
      'group-a-2nd': 'Gruppe A - 2. Platz',
      'group-a-3rd': 'Gruppe A - 3. Platz',
      'group-a-4th': 'Gruppe A - 4. Platz',
      'group-b-1st': 'Gruppe B - 1. Platz',
      'group-b-2nd': 'Gruppe B - 2. Platz',
      'group-b-3rd': 'Gruppe B - 3. Platz',
      'group-b-4th': 'Gruppe B - 4. Platz',
      'group-c-1st': 'Gruppe C - 1. Platz',
      'group-c-2nd': 'Gruppe C - 2. Platz',
      'group-c-3rd': 'Gruppe C - 3. Platz',
      'group-c-4th': 'Gruppe C - 4. Platz',
      'group-d-1st': 'Gruppe D - 1. Platz',
      'group-d-2nd': 'Gruppe D - 2. Platz',
      'group-d-3rd': 'Gruppe D - 3. Platz',
      'group-d-4th': 'Gruppe D - 4. Platz',
      'group-e-1st': 'Gruppe E - 1. Platz',
      'group-e-2nd': 'Gruppe E - 2. Platz',
      'group-f-1st': 'Gruppe F - 1. Platz',
      'group-f-2nd': 'Gruppe F - 2. Platz',
      'group-g-1st': 'Gruppe G - 1. Platz',
      'group-g-2nd': 'Gruppe G - 2. Platz',
      'group-h-1st': 'Gruppe H - 1. Platz',
      'group-h-2nd': 'Gruppe H - 2. Platz',
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
      // Group Placeholders
      'group-a-1st': 'Group A - 1st Place',
      'group-a-2nd': 'Group A - 2nd Place',
      'group-a-3rd': 'Group A - 3rd Place',
      'group-a-4th': 'Group A - 4th Place',
      'group-b-1st': 'Group B - 1st Place',
      'group-b-2nd': 'Group B - 2nd Place',
      'group-b-3rd': 'Group B - 3rd Place',
      'group-b-4th': 'Group B - 4th Place',
      'group-c-1st': 'Group C - 1st Place',
      'group-c-2nd': 'Group C - 2nd Place',
      'group-c-3rd': 'Group C - 3rd Place',
      'group-c-4th': 'Group C - 4th Place',
      'group-d-1st': 'Group D - 1st Place',
      'group-d-2nd': 'Group D - 2nd Place',
      'group-d-3rd': 'Group D - 3rd Place',
      'group-d-4th': 'Group D - 4th Place',
      'group-e-1st': 'Group E - 1st Place',
      'group-e-2nd': 'Group E - 2nd Place',
      'group-f-1st': 'Group F - 1st Place',
      'group-f-2nd': 'Group F - 2nd Place',
      'group-g-1st': 'Group G - 1st Place',
      'group-g-2nd': 'Group G - 2nd Place',
      'group-h-1st': 'Group H - 1st Place',
      'group-h-2nd': 'Group H - 2nd Place',
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
  };

  const translated = translations[locale][placeholder.toLowerCase()];
  return translated || placeholder;
}

/**
 * Parst Start-Zeit aus Datum + Zeitslot
 */
function parseStartTime(date: string, timeSlot: string): Date {
  // Date Format: YYYY-MM-DD oder DD.MM.YYYY
  // TimeSlot Format: "HH:MM" oder "HH:MM - HH:MM"

  let parsedDate: Date;

  // Parse Date
  if (date.includes('-')) {
    // ISO Format: YYYY-MM-DD
    parsedDate = new Date(date);
  } else if (date.includes('.')) {
    // German Format: DD.MM.YYYY
    const [day, month, year] = date.split('.').map(Number);
    parsedDate = new Date(year, month - 1, day);
  } else {
    // Fallback: heute
    parsedDate = new Date();
  }

  // Parse Time
  const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const [, hours, minutes] = timeMatch;
    parsedDate.setHours(parseInt(hours, 10));
    parsedDate.setMinutes(parseInt(minutes, 10));
    parsedDate.setSeconds(0);
    parsedDate.setMilliseconds(0);
  }

  return parsedDate;
}

/**
 * Addiert Minuten zu Date-Objekt
 */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Formatiert Date zu HH:MM
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Erstellt initiale Standings (alle Teams mit 0 Punkten)
 */
function createInitialStandings(teams: Team[]): Standing[] {
  return teams.map(team => ({
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));
}

// ============================================================================
// EXPORT UTILITIES FOR RENDERING
// ============================================================================

/**
 * Formatiert Schedule für Druckansicht (HTML/PDF)
 */
export function formatScheduleForPrint(schedule: GeneratedSchedule): {
  header: string;
  matchList: string;
  standingsTable: string;
} {
  // Header
  const header = `
    <div class="schedule-header">
      <h1>${schedule.tournament.title}</h1>
      <div class="meta">
        <span>${schedule.tournament.ageClass}</span>
        <span>${schedule.tournament.date}</span>
        <span>${schedule.tournament.location}</span>
      </div>
      <div class="time-info">
        <span>Start: ${formatTime(schedule.startTime)}</span>
        <span>Ende: ${formatTime(schedule.endTime)}</span>
        <span>Dauer: ${schedule.totalDuration} Min.</span>
      </div>
    </div>
  `;

  // Match List (gruppiert nach Phase)
  let matchList = '<div class="match-list">';

  schedule.phases.forEach(phase => {
    matchList += `
      <div class="phase-section">
        <h2>${phase.label}</h2>
        <table class="matches-table">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Zeit</th>
              <th>Feld</th>
              <th>Begegnung</th>
              ${phase.name === 'groupStage' ? '<th>Gruppe</th>' : ''}
              <th>Ergebnis</th>
            </tr>
          </thead>
          <tbody>
    `;

    phase.matches.forEach(match => {
      matchList += `
        <tr>
          <td>${match.matchNumber}</td>
          <td>${match.time}</td>
          <td>${match.field}</td>
          <td>${match.homeTeam} - ${match.awayTeam}</td>
          ${phase.name === 'groupStage' ? `<td>${match.group || '-'}</td>` : ''}
          <td class="result">__ : __</td>
        </tr>
      `;
    });

    matchList += `
          </tbody>
        </table>
      </div>
    `;
  });

  matchList += '</div>';

  // Standings Table (Live-Tabelle)
  let standingsTable = '<div class="standings">';

  // Gruppiere nach Gruppen
  const groups = new Set(schedule.teams.map(t => t.group).filter(Boolean));

  if (groups.size > 0) {
    groups.forEach(group => {
      standingsTable += `
        <div class="group-standings">
          <h3>Gruppe ${group}</h3>
          <table class="standings-table">
            <thead>
              <tr>
                <th>Platz</th>
                <th>Team</th>
                <th>Sp.</th>
                <th>S</th>
                <th>U</th>
                <th>N</th>
                <th>Tore</th>
                <th>Diff.</th>
                <th>Pkt.</th>
              </tr>
            </thead>
            <tbody>
      `;

      const groupTeams = schedule.teams.filter(t => t.group === group);
      const groupStandings = schedule.initialStandings.filter(s =>
        groupTeams.some(t => t.id === s.team.id)
      );

      groupStandings.forEach((standing, index) => {
        standingsTable += `
          <tr>
            <td>${index + 1}</td>
            <td>${standing.team.name}</td>
            <td>${standing.played}</td>
            <td>${standing.won}</td>
            <td>${standing.drawn}</td>
            <td>${standing.lost}</td>
            <td>${standing.goalsFor}:${standing.goalsAgainst}</td>
            <td>${standing.goalDifference > 0 ? '+' : ''}${standing.goalDifference}</td>
            <td><strong>${standing.points}</strong></td>
          </tr>
        `;
      });

      standingsTable += `
            </tbody>
          </table>
        </div>
      `;
    });
  } else {
    // Keine Gruppen - eine einzige Tabelle
    standingsTable += `
      <div class="standings-single">
        <h3>Tabelle</h3>
        <table class="standings-table">
          <thead>
            <tr>
              <th>Platz</th>
              <th>Team</th>
              <th>Sp.</th>
              <th>S</th>
              <th>U</th>
              <th>N</th>
              <th>Tore</th>
              <th>Diff.</th>
              <th>Pkt.</th>
            </tr>
          </thead>
          <tbody>
    `;

    schedule.initialStandings.forEach((standing, index) => {
      standingsTable += `
        <tr>
          <td>${index + 1}</td>
          <td>${standing.team.name}</td>
          <td>${standing.played}</td>
          <td>${standing.won}</td>
          <td>${standing.drawn}</td>
          <td>${standing.lost}</td>
          <td>${standing.goalsFor}:${standing.goalsAgainst}</td>
          <td>${standing.goalDifference > 0 ? '+' : ''}${standing.goalDifference}</td>
          <td><strong>${standing.points}</strong></td>
        </tr>
      `;
    });

    standingsTable += `
          </tbody>
        </table>
      </div>
    `;
  }

  standingsTable += '</div>';

  return {
    header,
    matchList,
    standingsTable,
  };
}

/**
 * Exportiert Schedule als CSV
 */
export function exportScheduleAsCSV(schedule: GeneratedSchedule): string {
  let csv = 'Nr.,Zeit,Feld,Heim,Gast,Gruppe,Phase,Ergebnis\n';

  schedule.allMatches.forEach(match => {
    csv += `${match.matchNumber},${match.time},${match.field},"${match.homeTeam}","${match.awayTeam}",${match.group || ''},${match.phase},\n`;
  });

  return csv;
}

/**
 * Berechnet Statistiken für den Schedule
 */
export function calculateScheduleStats(schedule: GeneratedSchedule) {
  const stats = {
    totalMatches: schedule.allMatches.length,
    groupStageMatches: schedule.allMatches.filter(m => m.phase === 'groupStage').length,
    finalMatches: schedule.allMatches.filter(m => m.phase !== 'groupStage').length,
    averageMatchDuration: 0,
    matchesPerField: {} as Record<number, number>,
    peakTime: '',
  };

  // Average Match Duration
  const durations = schedule.allMatches.map(m => m.duration);
  stats.averageMatchDuration = Math.round(
    durations.reduce((sum, d) => sum + d, 0) / durations.length
  );

  // Matches per Field
  schedule.allMatches.forEach(match => {
    stats.matchesPerField[match.field] = (stats.matchesPerField[match.field] || 0) + 1;
  });

  return stats;
}

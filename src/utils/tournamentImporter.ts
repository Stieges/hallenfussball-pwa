/**
 * Tournament Importer Utility (US-005)
 *
 * Handles import of external tournament data from JSON and CSV formats.
 * FairScheduler constraints are NOT enforced - violations are only warnings.
 */

import {
  Tournament,
  Team,
  Match,
  ImportFormat,
  ImportValidationResult,
  ImportValidationError,
  ImportValidationWarning,
  PlacementCriterion,
  FinalsPreset,
  RefereeMode,
  FinalsRefereeMode,
} from '../types/tournament';
import { generateUniqueId } from './idGenerator';

// Default placement criteria (same as in TournamentCreationScreen)
const DEFAULT_PLACEMENT_CRITERIA: PlacementCriterion[] = [
  { id: 'points', label: 'Punkte', enabled: true },
  { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
  { id: 'goalsFor', label: 'Erzielte Tore', enabled: true },
  { id: 'directComparison', label: 'Direkter Vergleich', enabled: false },
];

/**
 * Main entry point for importing tournaments
 */
export function validateAndParseTournamentImport(
  content: string,
  format: ImportFormat
): ImportValidationResult {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationWarning[] = [];

  try {
    if (format === 'json') {
      return parseJSONTournament(content);
    }
    // format === 'csv' - ImportFormat type only allows 'json' | 'csv'
    return parseCSVTeamsToTournament(content);
  } catch (error) {
    errors.push({
      code: 'PARSE_ERROR',
      field: 'content',
      message: error instanceof Error ? error.message : 'Unbekannter Fehler beim Parsen',
    });
    return { isValid: false, errors, warnings };
  }
}

/**
 * Parse JSON tournament data
 */
function parseJSONTournament(content: string): ImportValidationResult {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationWarning[] = [];

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    errors.push({
      code: 'JSON_PARSE_ERROR',
      field: 'content',
      message: 'Ungültiges JSON-Format',
    });
    return { isValid: false, errors, warnings };
  }

  if (typeof data !== 'object' || data === null) {
    errors.push({
      code: 'INVALID_STRUCTURE',
      field: 'content',
      message: 'JSON muss ein Objekt sein',
    });
    return { isValid: false, errors, warnings };
  }

  const json = data as Record<string, unknown>;

  // Validate required fields
  if (!json.title || typeof json.title !== 'string') {
    errors.push({
      code: 'MISSING_TITLE',
      field: 'title',
      message: 'Turniername ist erforderlich',
    });
  }

  if (!json.teams || !Array.isArray(json.teams) || json.teams.length === 0) {
    errors.push({
      code: 'MISSING_TEAMS',
      field: 'teams',
      message: 'Mindestens ein Team ist erforderlich',
    });
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Create ID mappings for teams and matches
  const teamIdMap = new Map<string, string>();
  const teams: Team[] = (json.teams as Array<Record<string, unknown>>).map((t, index) => {
    const oldId = String(t.id ?? `imported-${index}`);
    const newId = generateUniqueId();
    teamIdMap.set(oldId, newId);

    return {
      id: newId,
      name: String(t.name ?? `Team ${index + 1}`),
      group: t.group ? String(t.group) : undefined,
    };
  });

  // Parse matches if provided
  let matches: Match[] = [];
  if (json.matches && Array.isArray(json.matches)) {
    matches = (json.matches as Array<Record<string, unknown>>).map((m, index) => {
      const teamAId = teamIdMap.get(String(m.teamA)) || String(m.teamA);
      const teamBId = teamIdMap.get(String(m.teamB)) || String(m.teamB);

      // Check if team IDs are valid
      if (!teams.find(t => t.id === teamAId)) {
        warnings.push({
          code: 'UNKNOWN_TEAM',
          field: `matches[${index}].teamA`,
          message: `Team A in Spiel ${index + 1} nicht gefunden`,
          severity: 'warning',
        });
      }
      if (!teams.find(t => t.id === teamBId)) {
        warnings.push({
          code: 'UNKNOWN_TEAM',
          field: `matches[${index}].teamB`,
          message: `Team B in Spiel ${index + 1} nicht gefunden`,
          severity: 'warning',
        });
      }

      return {
        id: generateUniqueId(),
        round: Number(m.round) || 1,
        field: Number(m.field) || 1,
        slot: m.slot ? Number(m.slot) : undefined,
        teamA: teamAId,
        teamB: teamBId,
        scoreA: m.scoreA !== undefined ? Number(m.scoreA) : undefined,
        scoreB: m.scoreB !== undefined ? Number(m.scoreB) : undefined,
        group: m.group ? String(m.group) : undefined,
        isFinal: Boolean(m.isFinal),
        finalType: m.finalType as Match['finalType'],
        label: m.label ? String(m.label) : undefined,
      };
    });
  }

  // Check fairness warnings (non-blocking)
  const fairnessWarnings = checkFairnessWarnings(matches, teams);
  warnings.push(...fairnessWarnings);

  // Determine number of groups
  const groups = new Set(teams.filter(t => t.group).map(t => t.group));
  const numberOfGroups = groups.size || 1;

  // Parse location object
  const locationData = json.location as Record<string, unknown> | undefined;
  const location = locationData && typeof locationData === 'object'
    ? {
        name: String(locationData.name ?? 'Importierter Ort'),
        street: locationData.street ? String(locationData.street) : undefined,
        postalCode: locationData.postalCode ? String(locationData.postalCode) : undefined,
        city: locationData.city ? String(locationData.city) : undefined,
        country: locationData.country ? String(locationData.country) : undefined,
      }
    : { name: 'Importierter Ort' };

  // Parse contact info
  const contactData = json.contactInfo as Record<string, unknown> | undefined;
  const contactInfo = contactData && typeof contactData === 'object'
    ? {
        name: contactData.name ? String(contactData.name) : undefined,
        email: contactData.email ? String(contactData.email) : undefined,
        phone: contactData.phone ? String(contactData.phone) : undefined,
        website: contactData.website ? String(contactData.website) : undefined,
      }
    : undefined;

  // Parse placement logic or use defaults
  const placementLogic = json.placementLogic && Array.isArray(json.placementLogic)
    ? (json.placementLogic as Array<Record<string, unknown>>).map(p => ({
        id: String(p.id),
        label: String(p.label),
        enabled: Boolean(p.enabled),
      }))
    : DEFAULT_PLACEMENT_CRITERIA;

  // Parse point system
  const pointSystemData = json.pointSystem as Record<string, unknown> | undefined;
  const pointSystem = pointSystemData && typeof pointSystemData === 'object'
    ? {
        win: Number(pointSystemData.win ?? 3),
        draw: Number(pointSystemData.draw ?? 1),
        loss: Number(pointSystemData.loss ?? 0),
      }
    : { win: 3, draw: 1, loss: 0 };

  // Parse finals config
  const finalsConfigData = json.finalsConfig as Record<string, unknown> | undefined;
  const finalsConfig = finalsConfigData && typeof finalsConfigData === 'object'
    ? {
        preset: (finalsConfigData.preset as FinalsPreset | undefined) ?? 'none',
        parallelSemifinals: Boolean(finalsConfigData.parallelSemifinals),
        parallelQuarterfinals: Boolean(finalsConfigData.parallelQuarterfinals),
        parallelRoundOf16: Boolean(finalsConfigData.parallelRoundOf16),
      }
    : undefined;

  // Parse legacy finals
  const finalsData = json.finals as Record<string, unknown> | undefined;
  const finals = finalsData && typeof finalsData === 'object'
    ? {
        final: Boolean(finalsData.final),
        thirdPlace: Boolean(finalsData.thirdPlace),
        fifthSixth: Boolean(finalsData.fifthSixth),
        seventhEighth: Boolean(finalsData.seventhEighth),
      }
    : { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false };

  // Parse referee config
  const refereeData = json.refereeConfig as Record<string, unknown> | undefined;
  const refereeConfig = refereeData && typeof refereeData === 'object'
    ? {
        mode: (refereeData.mode as RefereeMode | undefined) ?? 'none',
        numberOfReferees: refereeData.numberOfReferees ? Number(refereeData.numberOfReferees) : undefined,
        maxConsecutiveMatches: refereeData.maxConsecutiveMatches ? Number(refereeData.maxConsecutiveMatches) : undefined,
        refereeNames: refereeData.refereeNames as Record<number, string> | undefined,
        finalsRefereeMode: refereeData.finalsRefereeMode as FinalsRefereeMode | undefined,
      }
    : { mode: 'none' as const };

  // Determine import completeness
  const hasMatches = matches.length > 0;
  const externalSource = hasMatches ? 'Import (komplett)' : 'Import (nur Teams)';

  // Build the tournament object
  const tournament: Tournament = {
    id: generateUniqueId(),
    status: 'draft',
    isExternal: true,
    externalSource,

    // Step 1: Sport & Type
    sport: (json.sport as Tournament['sport'] | undefined) ?? 'football',
    tournamentType: (json.tournamentType as Tournament['tournamentType'] | undefined) ?? 'classic',

    // Step 2: Mode & System
    mode: (json.mode as Tournament['mode'] | undefined) ?? 'classic',
    numberOfFields: json.numberOfFields ? Number(json.numberOfFields) : Math.max(1, ...matches.map(m => m.field)),
    numberOfTeams: teams.length,
    groupSystem: (json.groupSystem as Tournament['groupSystem'] | undefined) ?? (numberOfGroups > 1 ? 'groupsAndFinals' : 'roundRobin'),
    numberOfGroups,

    // Timing - Group Phase
    groupPhaseGameDuration: json.groupPhaseGameDuration ? Number(json.groupPhaseGameDuration) : 10,
    groupPhaseBreakDuration: json.groupPhaseBreakDuration ? Number(json.groupPhaseBreakDuration) : 2,
    gamePeriods: json.gamePeriods ? Number(json.gamePeriods) : 1,
    halftimeBreak: json.halftimeBreak ? Number(json.halftimeBreak) : 1,

    // Timing - Finals
    finalRoundGameDuration: json.finalRoundGameDuration ? Number(json.finalRoundGameDuration) : undefined,
    finalRoundBreakDuration: json.finalRoundBreakDuration ? Number(json.finalRoundBreakDuration) : undefined,
    breakBetweenPhases: json.breakBetweenPhases ? Number(json.breakBetweenPhases) : undefined,
    minRestSlots: json.minRestSlots ? Number(json.minRestSlots) : 1,

    // Placement & Points
    placementLogic,
    pointSystem,

    // Finals Configuration
    finalsConfig,
    finals,

    // Referee Configuration
    refereeConfig,

    // Bambini Settings
    isKidsTournament: Boolean(json.isKidsTournament),
    hideScoresForPublic: Boolean(json.hideScoresForPublic),
    hideRankingsForPublic: Boolean(json.hideRankingsForPublic),
    resultMode: (json.resultMode as Tournament['resultMode'] | undefined) ?? 'goals',

    // Step 3: Metadata
    title: String(json.title),
    ageClass: String(json.ageClass ?? 'Herren'),
    date: String(json.date || new Date().toISOString().split('T')[0]),
    timeSlot: String(json.timeSlot ?? '09:00'),
    startDate: json.startDate ? String(json.startDate) : json.date ? String(json.date) : new Date().toISOString().split('T')[0],
    startTime: json.startTime ? String(json.startTime) : json.timeSlot ? String(json.timeSlot) : '09:00',
    location,
    organizer: json.organizer ? String(json.organizer) : undefined,
    contactInfo,

    // Step 4: Teams
    teams,

    // Generated data
    matches,

    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add info warning about import
  warnings.push({
    code: 'EXTERNAL_IMPORT',
    message: 'Dieses Turnier wurde importiert. Schiedsrichter- und Pausenregeln wurden nicht geprüft.',
    severity: 'info',
  });

  return {
    isValid: true,
    errors,
    warnings,
    tournament,
  };
}

/**
 * Parse CSV with team list (simple format: Team,Gruppe)
 */
export function parseCSVTeamsToTournament(content: string): ImportValidationResult {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationWarning[] = [];

  const lines = content.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

  if (lines.length < 2) {
    errors.push({
      code: 'INSUFFICIENT_DATA',
      field: 'content',
      message: 'CSV muss mindestens eine Header-Zeile und ein Team enthalten',
    });
    return { isValid: false, errors, warnings };
  }

  // Parse header
  const header = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
  const teamIndex = header.findIndex(h => h === 'team' || h === 'name' || h === 'teamname');
  const groupIndex = header.findIndex(h => h === 'gruppe' || h === 'group');

  if (teamIndex === -1) {
    errors.push({
      code: 'MISSING_HEADER',
      field: 'header',
      message: 'CSV muss eine Spalte "Team" oder "Name" enthalten',
    });
    return { isValid: false, errors, warnings };
  }

  // Parse teams
  const teams: Team[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,;]/).map(v => v.trim());
    const teamName = values[teamIndex];

    if (!teamName) {
      warnings.push({
        code: 'EMPTY_TEAM',
        field: `row[${i}]`,
        message: `Zeile ${i + 1} hat keinen Teamnamen`,
        severity: 'warning',
      });
      continue;
    }

    teams.push({
      id: generateUniqueId(),
      name: teamName,
      group: groupIndex !== -1 && values[groupIndex] ? values[groupIndex] : undefined,
    });
  }

  if (teams.length === 0) {
    errors.push({
      code: 'NO_TEAMS',
      field: 'content',
      message: 'Keine gültigen Teams gefunden',
    });
    return { isValid: false, errors, warnings };
  }

  // Determine groups
  const groups = new Set(teams.filter(t => t.group).map(t => t.group));
  const numberOfGroups = groups.size || 1;

  // Create tournament with teams only (no matches)
  const tournament: Tournament = {
    id: generateUniqueId(),
    status: 'draft',
    isExternal: true,
    externalSource: 'Import (nur Teams)',

    title: `Importiertes Turnier (${teams.length} Teams)`,
    sport: 'football',
    tournamentType: 'classic',
    mode: 'classic',

    teams,
    numberOfTeams: teams.length,
    numberOfFields: 1,
    numberOfGroups,
    groupSystem: numberOfGroups > 1 ? 'groupsAndFinals' : 'roundRobin',

    date: new Date().toISOString().split('T')[0],
    timeSlot: '09:00',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,

    location: { name: '' },
    ageClass: 'Herren',

    matches: [], // No matches from CSV

    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    placementLogic: DEFAULT_PLACEMENT_CRITERIA,
    finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  warnings.push({
    code: 'CSV_TEAMS_ONLY',
    message: 'CSV enthält nur Teams. Der Spielplan muss manuell erstellt oder generiert werden.',
    severity: 'info',
  });

  warnings.push({
    code: 'EXTERNAL_IMPORT',
    message: 'Dieses Turnier wurde importiert.',
    severity: 'info',
  });

  return {
    isValid: true,
    errors,
    warnings,
    tournament,
  };
}

/**
 * Check for fairness warnings (non-blocking)
 * These are informational only - FairScheduler constraints are NOT enforced
 */
export function checkFairnessWarnings(matches: Match[], teams: Team[]): ImportValidationWarning[] {
  const warnings: ImportValidationWarning[] = [];

  if (matches.length === 0) {
    return warnings;
  }

  // Check for consecutive matches per team
  const teamMatches = new Map<string, number[]>();

  matches.forEach((match, index) => {
    const teamAMatches = teamMatches.get(match.teamA) ?? [];
    const teamBMatches = teamMatches.get(match.teamB) ?? [];
    teamAMatches.push(index);
    teamBMatches.push(index);
    teamMatches.set(match.teamA, teamAMatches);
    teamMatches.set(match.teamB, teamBMatches);
  });

  // Check for back-to-back matches
  for (const [teamId, matchIndices] of teamMatches) {
    const team = teams.find(t => t.id === teamId);
    const teamName = team?.name || teamId;

    for (let i = 1; i < matchIndices.length; i++) {
      if (matchIndices[i] - matchIndices[i - 1] === 1) {
        warnings.push({
          code: 'CONSECUTIVE_MATCHES',
          message: `${teamName} hat aufeinanderfolgende Spiele (${matchIndices[i - 1] + 1} und ${matchIndices[i] + 1})`,
          severity: 'warning',
        });
      }
    }
  }

  // Check for teams playing against themselves
  for (const match of matches) {
    if (match.teamA === match.teamB) {
      const team = teams.find(t => t.id === match.teamA);
      warnings.push({
        code: 'SELF_MATCH',
        message: `Team "${team?.name || match.teamA}" spielt gegen sich selbst`,
        severity: 'warning',
      });
    }
  }

  // Check match count distribution
  const matchCounts = new Map<string, number>();
  for (const match of matches) {
    matchCounts.set(match.teamA, (matchCounts.get(match.teamA) ?? 0) + 1);
    matchCounts.set(match.teamB, (matchCounts.get(match.teamB) ?? 0) + 1);
  }

  const counts = Array.from(matchCounts.values());
  const minMatches = Math.min(...counts);
  const maxMatches = Math.max(...counts);

  if (maxMatches - minMatches > 2) {
    warnings.push({
      code: 'UNEVEN_MATCH_DISTRIBUTION',
      message: `Ungleichmäßige Spielverteilung: Teams haben zwischen ${minMatches} und ${maxMatches} Spiele`,
      severity: 'warning',
    });
  }

  return warnings;
}

/**
 * Detect import format from file extension or content
 */
export function detectImportFormat(filename: string, content: string): ImportFormat | null {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'json') {return 'json';}
  if (ext === 'csv') {return 'csv';}

  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  if (trimmed.includes(',') || trimmed.includes(';')) {
    return 'csv';
  }

  return null;
}

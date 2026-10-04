/**
 * replan — Neuplanung (Struktur ändern) vor dem ersten Anpfiff.
 *
 * Die Anpfiff-Prüfung nutzt die GEMEINSAME Funktion `getMatchStartState`
 * (src/utils/matchStartState.ts, @LZ-003 / B-01a) – keine Kopie.
 */
import type { Match, Tournament } from '../../../types/tournament';
import {
  generateFullSchedule,
  type GeneratedSchedule,
} from '../../../core/generators';
import { getMatchStartState } from '../../../utils/matchStartState';

export type ReplanAvailability = 'offered' | 'refused-after-kickoff';

export type ReplanPreviewResult =
  | { status: 'preview'; schedule: GeneratedSchedule; endTime: Date }
  | { status: 'impossible'; reason: string };

export function getReplanAvailability(
  tournament: Pick<Tournament, 'matches' | 'status' | 'publishedAt'>
): ReplanAvailability {
  const isEstablished =
    tournament.status === 'published' || tournament.publishedAt !== undefined;
  const startState = getMatchStartState(
    tournament.matches,
    undefined,
    isEstablished
  );
  return startState === 'not-started' ? 'offered' : 'refused-after-kickoff';
}

/**
 * C-WIZ-NOREGEN: Plant bei Strukturänderung (Teams/Felder) neu – der Generator
 * wird nur genutzt, nie geändert. isRemoved-Teams spielen nicht mit (Controller-
 * Zusatz: Neuplanung filtert !isRemoved).
 */
export function buildReplanPreview(
  tournament: Tournament
): ReplanPreviewResult {
  const activeTeams = tournament.teams.filter((team) => !team.isRemoved);
  const replanInput: Tournament = {
    ...tournament,
    teams: activeTeams,
    numberOfTeams: activeTeams.length,
    // C-WIZ-NOREGEN: mit vorhandenen matches behält der Generator den alten
    // Plan – die Neuplanung verlangt eine frische Losen- und Zeitvergabe.
    matches: [],
  };
  try {
    const schedule = generateFullSchedule(replanInput);
    return { status: 'preview', schedule, endTime: schedule.endTime };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { status: 'impossible', reason };
  }
}

/**
 * @W5-005: Nach Bestätigung ersetzt der neue Spielplan den alten.
 * Ersetzt ausschließlich matches – Einstellungen bleiben unangetastet.
 */
export function applyReplan(
  tournament: Tournament,
  preview: Extract<ReplanPreviewResult, { status: 'preview' }>
): Tournament {
  const matches: Match[] = preview.schedule.allMatches.map((m, index) => ({
    id: m.id,
    round: Math.floor(index / preview.schedule.numberOfFields) + 1,
    field: m.field,
    slot: m.slot,
    teamA: m.originalTeamA,
    teamB: m.originalTeamB,
    group: m.group,
    isFinal: m.phase !== 'groupStage',
    phase: m.phase,
    finalType: m.finalType,
    label: m.label,
    scheduledTime: m.startTime,
    referee: m.referee,
  }));
  return { ...tournament, matches };
}

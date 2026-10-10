/**
 * Reine Ansichts-Logik der Zuschauer-Seite (B-13c): Filter, Datenschutz-Ausblendung, Tabellen-Sichtbarkeit.
 * Ohne React. Die Logik ist 1:1 aus LiveViewScreen übernommen; die Ausblendung der Stände gilt für
 * Spielplan UND die Spielliste, die ScheduleDisplay wieder einmischt (F-B13-11, Ruling R1 überholt).
 */
import type { GeneratedSchedule } from '../../core/generators';
import type { Match, Standing, Tournament } from '../../types/tournament';
import { involvesTeam } from './matchSides';

export type PhaseFilter = 'all' | 'groupStage' | 'final';
export type StatusFilter = 'all' | 'scheduled' | 'live' | 'finished';

export interface ViewFilters {
  showOnlyMyTeam: boolean;
  myTeamId: string | null;
  selectedGroup: string | null;
  selectedPhase: PhaseFilter;
  selectedStatus: StatusFilter;
}

function withoutScore<T extends { scoreA?: number; scoreB?: number }>(item: T): T {
  return { ...item, scoreA: undefined, scoreB: undefined };
}

/** Nutzer-Filter (Mein Team, Gruppe, Phase, Status). Status wird am Turnier-Spiel abgelesen. */
export function applyViewFilters(
  schedule: GeneratedSchedule,
  tournament: Tournament,
  filters: ViewFilters
): GeneratedSchedule {
  let filteredMatches = [...schedule.allMatches];

  if (filters.showOnlyMyTeam && filters.myTeamId) {
    const teamId = filters.myTeamId;
    filteredMatches = filteredMatches.filter((m) => involvesTeam(m, teamId));
  }

  if (filters.selectedGroup) {
    const group = filters.selectedGroup;
    filteredMatches = filteredMatches.filter((m) => m.group === group);
  }

  if (filters.selectedPhase !== 'all') {
    filteredMatches = filteredMatches.filter((m) =>
      filters.selectedPhase === 'groupStage' ? m.phase === 'groupStage' : m.phase !== 'groupStage'
    );
  }

  if (filters.selectedStatus !== 'all') {
    filteredMatches = filteredMatches.filter((m) => {
      const matchStatus = tournament.matches.find((tm) => tm.id === m.id)?.matchStatus ?? 'scheduled';
      if (filters.selectedStatus === 'finished') {
        return matchStatus === 'finished';
      }
      // UI nennt den Status „live“, MatchStatus heißt er „running“
      if (filters.selectedStatus === 'live') {
        return matchStatus === 'running';
      }
      return matchStatus === 'scheduled' || matchStatus === 'waiting';
    });
  }

  const filteredPhases = schedule.phases
    .map((phase) => ({
      ...phase,
      matches: phase.matches.filter((m) => filteredMatches.some((fm) => fm.id === m.id)),
    }))
    .filter((phase) => phase.matches.length > 0);

  return { ...schedule, allMatches: filteredMatches, phases: filteredPhases };
}

/** Datenschutz: ohne Stände, wenn die Turnierleitung „Ergebnisse ausblenden“ gesetzt hat. */
export function applyScoreVisibility(schedule: GeneratedSchedule, tournament: Tournament): GeneratedSchedule {
  if (!tournament.hideScoresForPublic) {
    return schedule;
  }
  return {
    ...schedule,
    allMatches: schedule.allMatches.map(withoutScore),
    phases: schedule.phases.map((phase) => ({ ...phase, matches: phase.matches.map(withoutScore) })),
  };
}

/** Spielplan für die Anzeige: erst Nutzer-Filter, dann Ausblenden der Stände. */
export function publicSchedule(
  schedule: GeneratedSchedule,
  tournament: Tournament,
  filters: ViewFilters
): GeneratedSchedule {
  return applyScoreVisibility(applyViewFilters(schedule, tournament, filters), tournament);
}

/** Spielliste für ScheduleDisplay (dort werden Stände aus dieser Liste wieder eingemischt). */
export function publicMatches(tournament: Tournament): Match[] {
  return tournament.hideScoresForPublic ? tournament.matches.map(withoutScore) : tournament.matches;
}

/** Gruppentabellen nur, wenn die Turnierleitung sie nicht verbirgt. */
export function visibleStandings(tournament: Tournament, standings: Standing[]): Standing[] {
  return tournament.hideRankingsForPublic ? [] : standings;
}

export function uniqueGroups(tournament: Tournament): string[] {
  return Array.from(new Set(tournament.teams.map((t) => t.group).filter(Boolean))) as string[];
}

export function myTeamName(tournament: Tournament, teamId: string | null): string | null {
  if (!teamId) {
    return null;
  }
  return tournament.teams.find((t) => t.id === teamId)?.name ?? null;
}

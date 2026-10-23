/**
 * Reine Ansichts-Logik der Zuschauer-Seite (B-13c): Filter, Datenschutz-Ausblendung, Tabellen-Sichtbarkeit.
 * Ohne React. A-36c: Status und Sichtbarkeit kommen aus der gemeinsamen Ansicht (`MatchView`, `viewRules`) – hier
 * gibt es keine eigene Statusregel und keinen eigenen Schalter mehr. Die Ausblendung der Stände gilt für
 * Spielplan UND die Spielliste, die ScheduleDisplay wieder einmischt (F-B13-11, Ruling R1 überholt).
 */
import type { GeneratedSchedule } from '../../core/generators';
import type { TournamentView, ViewRules } from '../../core/view';
import { matchInvolvesTeam } from '../../core/models/matchSlot';
import type { Match, Standing, Tournament } from '../../types/tournament';

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

/**
 * Nutzer-Filter (Mein Team, Gruppe, Phase, Status). Der Status kommt aus der Ansicht: „Live“ = läuft ODER unterbrochen
 * (@ZM-039), „Geplant“ = nur kommende Spiele; ausgefallene Spiele stehen nur unter „Alle“ (@ZM-104).
 */
export function applyViewFilters(
  schedule: GeneratedSchedule,
  view: TournamentView,
  filters: ViewFilters
): GeneratedSchedule {
  let filteredMatches = [...schedule.allMatches];

  if (filters.showOnlyMyTeam && filters.myTeamId) {
    const teamId = filters.myTeamId;
    filteredMatches = filteredMatches.filter((m) => matchInvolvesTeam(m, teamId));
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
      const match = view.byId.get(m.id);
      switch (filters.selectedStatus) {
        case 'finished':
          return match?.status === 'finished' || match?.status === 'awarded';
        case 'live':
          return match?.isLive === true;
        default:
          return match?.isUpcoming === true;
      }
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

/** Datenschutz: ohne Stände, wenn die Regeln der Ansicht Ergebnisse verbergen (`rules.results`, Kindermodus). */
export function applyScoreVisibility(schedule: GeneratedSchedule, rules: Pick<ViewRules, 'results'>): GeneratedSchedule {
  if (rules.results) {
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
  view: TournamentView,
  filters: ViewFilters
): GeneratedSchedule {
  return applyScoreVisibility(applyViewFilters(schedule, view, filters), view.rules);
}

/** Spielliste für ScheduleDisplay (dort werden Stände aus dieser Liste wieder eingemischt). */
export function publicMatches(tournament: Tournament, rules: Pick<ViewRules, 'results'>): Match[] {
  return rules.results ? tournament.matches : tournament.matches.map(withoutScore);
}

/**
 * Gruppentabellen nur, wenn die Regeln der Ansicht sie zeigen (`rules.tables`): ohne Stände (Kindermodus) und bei
 * ausgeschalteten Tabellen gibt es keine Tabelle, also keinen Platz und keine Punkte (W2A-031, @ZM-005).
 */
export function visibleStandings(rules: Pick<ViewRules, 'tables'>, standings: Standing[]): Standing[] {
  return rules.tables ? standings : [];
}

/** Der Tabellen-Tab wird nur angeboten, wenn Stände sichtbar sein dürfen (W2A-031). */
export function standingsTabAvailable(rules: Pick<ViewRules, 'results'>): boolean {
  return rules.results;
}

/** Ein Direktaufruf des Tabellen-Tabs fällt auf den Spielplan zurück, wenn der Tab nicht angeboten wird. */
export function effectiveNavTab<T extends 'schedule' | 'standings' | 'settings'>(
  tab: T,
  rules: Pick<ViewRules, 'results'>
): T | 'schedule' {
  return tab === 'standings' && !standingsTabAvailable(rules) ? 'schedule' : tab;
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

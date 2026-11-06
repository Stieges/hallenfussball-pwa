/**
 * Abschnitte der Startseite (Reiter „Turniere“), rein ohne React (@OB-078, @OB-077, @OB-002, @LZ-001).
 *
 * Reihenfolge von oben: „Heute“ (alle Turniere des heutigen Tages im Zustand Läuft oder Bereit, laufende zuerst, dann nach
 * Beginn) · Läuft (nicht von heute, etwa über Mitternacht oder nie abgeschlossen) · Kommende Turniere (Bereit, nicht von heute)
 * · Entwürfe. Ein vergessener Lauf oder eine Probe-Kopie steht nie über „Heute“. Ein Turnier steht in genau einem Abschnitt.
 * Suche und Filter wirken vor dem Aufteilen; Abgeschlossene und Abgebrochene gehören ins Archiv, nicht in diesen Reiter.
 */
import type { Tournament } from '../types/tournament';
import { categorizeTournaments, getTournamentDateTime } from './tournamentCategories';
import { matchesTournamentSearch } from './tournamentSearch';

/** Filter im Reiter „Turniere“; „Beendet“ gibt es hier nicht (@OB-002), das Archiv ist ein eigener Reiter. */
export type FilterChip = 'running' | 'upcoming' | 'draft';

export const FILTER_CHIPS: readonly FilterChip[] = ['running', 'upcoming', 'draft'];

export interface StartseiteAbschnitte {
  heute: Tournament[];
  running: Tournament[];
  upcoming: Tournament[];
  draft: Tournament[];
}

/** Liest `?s=running,draft`; Unbekanntes (etwa der entfernte Filter „finished“) fällt weg. */
export function parseFilterChips(value: string | null): FilterChip[] {
  if (!value) {
    return [];
  }
  return FILTER_CHIPS.filter((chip) => value.split(',').includes(chip));
}

export function istAmSelbenTag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function beginnVon(tournament: Tournament): number {
  return getTournamentDateTime(tournament)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function baueStartseiteAbschnitte(
  activeTournaments: Tournament[],
  options: { now: Date; search: string; filters: FilterChip[] },
): StartseiteAbschnitte {
  const { now, search, filters } = options;
  const categorized = categorizeTournaments(activeTournaments);
  const mitFilter = (chip: FilterChip, list: Tournament[]): Tournament[] =>
    (filters.length === 0 || filters.includes(chip) ? list : []).filter((t) => matchesTournamentSearch(t, search));

  const running = mitFilter('running', categorized.running);
  const upcoming = mitFilter('upcoming', categorized.upcoming);
  const draft = mitFilter('draft', categorized.draft);

  const vonHeute = (t: Tournament): boolean => {
    const beginn = getTournamentDateTime(t);
    return beginn !== null && istAmSelbenTag(beginn, now);
  };

  // Läuft zuerst, dann nach Beginn; ein fehlendes Datum steht ganz hinten (stabil, nicht 0)
  const heute = [...running.filter(vonHeute).sort((a, b) => beginnVon(a) - beginnVon(b)), ...upcoming.filter(vonHeute).sort((a, b) => beginnVon(a) - beginnVon(b))];

  return {
    heute,
    running: running.filter((t) => !vonHeute(t)),
    upcoming: upcoming.filter((t) => !vonHeute(t)),
    draft,
  };
}

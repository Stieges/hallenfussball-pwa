/**
 * Spielplan-Filter <-> Adresse (@OB-029, @OB-030): Lesen und Schreiben der Query-Parameter.
 * Parameter nach .claude/conventions/URL-ROUTING.md: p (Phase: groupStage|finals), g (Gruppe), f (Feld),
 * s (Status, kommagetrennt), q (Teamsuche) -- dieselben Namen wie auf der Zuschauer-Seite (g/p/s).
 * Unbekannte oder nicht vorhandene Werte werden ignoriert; andere Parameter (z. B. matchId) bleiben unberührt.
 */
import { DEFAULT_FILTERS, type ScheduleFilters } from '../../../types/scheduleFilters';
import type { MatchStatus } from '../../../types/tournament';

export const FILTER_PARAM_KEYS = ['p', 'g', 'f', 's', 'q'] as const;

const VALID_STATUS: readonly MatchStatus[] = ['scheduled', 'waiting', 'running', 'finished', 'skipped'];

/** Wertebereich des Turniers; ohne Angabe wird nur die Form geprüft. */
export interface ScheduleFilterDomain {
  groups: readonly string[];
  fields: readonly number[];
}

export function parseScheduleFilterParams(params: URLSearchParams, domain?: ScheduleFilterDomain): ScheduleFilters {
  const filters: ScheduleFilters = { ...DEFAULT_FILTERS, status: [] };

  const phase = params.get('p');
  if (phase === 'groupStage' || phase === 'finals') {
    filters.phase = phase;
  }

  const group = params.get('g');
  if (group && (!domain || domain.groups.includes(group))) {
    filters.group = group;
  }

  const field = params.get('f');
  if (field && /^\d+$/.test(field)) {
    const fieldNumber = Number(field);
    if (fieldNumber > 0 && (!domain || domain.fields.includes(fieldNumber))) {
      filters.field = fieldNumber;
    }
  }

  const status = params.get('s');
  if (status) {
    filters.status = status.split(',').filter((s): s is MatchStatus => VALID_STATUS.includes(s as MatchStatus));
  }

  filters.teamSearch = params.get('q') ?? '';
  return filters;
}

/** Schreibt die Filter in eine Kopie der Parameter; Standardwerte entfallen. */
export function applyScheduleFiltersToParams(params: URLSearchParams, filters: ScheduleFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  FILTER_PARAM_KEYS.forEach((key) => next.delete(key));
  if (filters.phase !== 'all') { next.set('p', filters.phase); }
  if (filters.group) { next.set('g', filters.group); }
  if (filters.field !== null) { next.set('f', String(filters.field)); }
  if (filters.status.length > 0) { next.set('s', filters.status.join(',')); }
  if (filters.teamSearch) { next.set('q', filters.teamSearch); }
  return next;
}

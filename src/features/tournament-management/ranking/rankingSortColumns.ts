/**
 * Sortierspalten der Tabelle „Platzierung über alle Gruppen“ (@TS-002, @TS-014): die Spalten der Gruppentabelle plus „Gruppe“
 * (A–Z), die es nur gibt, wenn das Turnier Gruppen hat. Keine Spalte für „Entschieden durch“ (Herkunft des Platzes).
 * Rein, ohne React; Werte wie in der Tabelle angezeigt (fehlt die Zeile der Gruppentabelle, zählt 0).
 */
import type { SortColumnDef } from '../../../hooks/useTableSort';
import type { RankingRow } from './rankingTypes';

const BASE: SortColumnDef<RankingRow>[] = [
  { column: 'team', value: (r) => r.placement.team.name, bestFirst: 'asc' },
  { column: 'sp', value: (r) => r.standing?.played ?? 0, bestFirst: 'desc' },
  { column: 's', value: (r) => r.standing?.won ?? 0, bestFirst: 'desc' },
  { column: 'u', value: (r) => r.standing?.drawn ?? 0, bestFirst: 'desc' },
  { column: 'n', value: (r) => r.standing?.lost ?? 0, bestFirst: 'asc' },
  { column: 'tore', value: (r) => r.standing?.goalsFor ?? 0, bestFirst: 'desc' },
  { column: 'gegentore', value: (r) => r.standing?.goalsAgainst ?? 0, bestFirst: 'asc' },
  { column: 'diff', value: (r) => (r.standing ? r.standing.goalsFor - r.standing.goalsAgainst : 0), bestFirst: 'desc' },
  { column: 'pkt', value: (r) => r.standing?.points ?? 0, bestFirst: 'desc' },
];

const WITH_GROUP: SortColumnDef<RankingRow>[] = [
  ...BASE,
  { column: 'gruppe', value: (r) => r.groupSortKey, bestFirst: 'asc' },
];

/** Stabile Liste (der Sortier-Baustein vergleicht sie nach Identität). */
export const rankingSortColumns = (hasGroups: boolean): SortColumnDef<RankingRow>[] => (hasGroups ? WITH_GROUP : BASE);

/**
 * Sortierspalten des Endstands und der Torschützenliste (@TS-002, @TS-008, @TS-019): rein, ohne React.
 * Endstand: Team immer, Sp./Diff./Pkt. nur, wenn die Zeilen gespeicherte Tabellenwerte tragen (sonst gibt es die Spalten nicht).
 * Eine Zeile ohne Tabellenwerte (Platzierungsspiel) zählt als „weniger als jeder Wert“ (Spiele und Punkte −1, Differenz −∞).
 * Torschützen: Tore (meiste zuerst) und Team; sortiert werden nur Spielerzeilen, die Sammelzeilen bleiben am Ende (@TS-019).
 */
import type { SortColumnDef } from '../../../hooks/useTableSort';
import type { FinalStandingRow, ScorerRow } from '../../../core/standings/finalStandings';

export type PlayerRow = Extract<ScorerRow, { kind: 'player' }>;

const TEAM: SortColumnDef<FinalStandingRow> = { column: 'team', value: (r) => r.teamName, bestFirst: 'asc' };
const WITH_VALUES: SortColumnDef<FinalStandingRow>[] = [
  TEAM,
  { column: 'sp', value: (r) => r.tableValues?.games ?? -1, bestFirst: 'desc' },
  { column: 'diff', value: (r) => r.tableValues?.goalDiff ?? Number.NEGATIVE_INFINITY, bestFirst: 'desc' },
  { column: 'pkt', value: (r) => r.tableValues?.points ?? -1, bestFirst: 'desc' },
];
const TEAM_ONLY: SortColumnDef<FinalStandingRow>[] = [TEAM];

/** Stabile Listen (der Sortier-Baustein vergleicht sie nach Identität). */
export const finalSortColumns = (withValues: boolean): SortColumnDef<FinalStandingRow>[] => (withValues ? WITH_VALUES : TEAM_ONLY);

export const scorerSortColumns: SortColumnDef<PlayerRow>[] = [
  { column: 'tore', value: (r) => r.goals, bestFirst: 'desc' },
  { column: 'team', value: (r) => r.teamName, bestFirst: 'asc' },
];

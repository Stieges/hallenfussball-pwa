/**
 * „Platzierung über alle Gruppen“: wählt je nach Gerät die breite oder die Handy-Tabelle und sortiert sie einmal für beide
 * (@TS-002, @TS-005, @TS-012, @TS-014). Die Zeilen kommen in der Reihenfolge der Platzierung; der Rang hängt am Team, nicht an der Zeile.
 * Ohne Sortier-Provider (`useTableSortState` = `null`) bleiben die Köpfe einfacher Text wie bisher.
 */
import type { ReactNode } from 'react';
import type { Standing, Tournament } from '../../../types/tournament';
import type { FinalPlacement } from '../../../utils/calculations';
import { getGroupShortCode } from '../../../utils/displayNames';
import { tableKey } from '../../../core/standings/tableSortAddress';
import { useTableSort } from '../../../hooks/useTableSort';
import { useTableSortState } from '../../../hooks/useTableSortState';
import { GroupSortBar, type GroupSort } from '../../../components/schedule/GroupSortHeads';
import type { Medal } from '../tabellenAnsicht';
import { RankingDesktopTable } from './RankingDesktopTable';
import { RankingMobileTable } from './RankingMobileTable';
import { rankingSortColumns } from './rankingSortColumns';
import type { RankingRow } from './rankingTypes';

export interface RankingTablesProps {
  /** Reihenfolge der Platzierung (Vorgabe). */
  finalRanking: readonly FinalPlacement[];
  getStanding: (team: { id: string; name: string }) => Standing | undefined;
  tournament: Tournament;
  hasGroups: boolean;
  hasPlayoffs: boolean;
  isMobile: boolean;
  medalOf: (placement: FinalPlacement) => Medal;
  tieMarker: (teamId: string) => ReactNode;
  expandedRows: ReadonlySet<string>;
  onToggleRow: (rowKey: string) => void;
}

export function RankingTables({ finalRanking, getStanding, isMobile, expandedRows, onToggleRow, ...rest }: RankingTablesProps) {
  const handle = useTableSortState('gesamt');
  const base: RankingRow[] = finalRanking.map((placement) => {
    const group = placement.team.group;
    const groupCode = group ? getGroupShortCode(group, rest.tournament) : '';
    return { placement, standing: getStanding(placement.team), groupCode, groupSortKey: `${groupCode} ${group ?? ''}` };
  });
  const rows = useTableSort(base, rankingSortColumns(rest.hasGroups), handle?.state ?? null);
  const sort: GroupSort | null = handle === null ? null : { key: tableKey('gesamt'), state: handle.state, onTap: handle.tap };
  const goalsFocus = handle?.state?.column === 'tore' ? 'for' : handle?.state?.column === 'gegentore' ? 'against' : undefined;
  return (
    <div className="ranking-tables">
      {sort !== null && handle !== null && (
        <GroupSortBar sort={sort} onChange={handle.set} onReset={handle.reset} withGroup={rest.hasGroups} picker={isMobile} />
      )}
      {isMobile
        ? <RankingMobileTable rows={rows} expandedRows={expandedRows} onToggleRow={onToggleRow} sort={sort} goalsFocus={goalsFocus} {...rest} />
        : <RankingDesktopTable rows={rows} sort={sort} goalsFocus={goalsFocus} {...rest} />}
      {/* „Nach Platzierung“ und die Auswahl gehören nicht auf den Ausdruck */}
      <style>{`@media print { .ranking-tables .sort-reset-bar, .ranking-tables .sort-picker-mobile { display: none !important; } }`}</style>
    </div>
  );
}

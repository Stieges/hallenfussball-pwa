/**
 * „Platzierung über alle Gruppen“: wählt je nach Gerät die breite oder die Handy-Tabelle (aus `TabellenTab.tsx` herausgelöst).
 */
import type { ReactNode } from 'react';
import type { Standing, Tournament } from '../../../types/tournament';
import type { FinalPlacement } from '../../../utils/calculations';
import { getGroupShortCode } from '../../../utils/displayNames';
import type { Medal } from '../tabellenAnsicht';
import { RankingDesktopTable } from './RankingDesktopTable';
import { RankingMobileTable } from './RankingMobileTable';
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
  const rows: RankingRow[] = finalRanking.map((placement) => ({
    placement,
    standing: getStanding(placement.team),
    groupCode: placement.team.group ? getGroupShortCode(placement.team.group, rest.tournament) : '',
  }));
  return isMobile
    ? <RankingMobileTable rows={rows} expandedRows={expandedRows} onToggleRow={onToggleRow} {...rest} />
    : <RankingDesktopTable rows={rows} {...rest} />;
}

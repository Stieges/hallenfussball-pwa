/** Gemeinsame Typen der Platzierungstabellen („Platzierung über alle Gruppen“). */
import type { Standing, Tournament } from '../../../types/tournament';
import type { FinalPlacement } from '../../../utils/calculations';
import type { Medal } from '../tabellenAnsicht';
import type { ReactNode } from 'react';

/** Eine Zeile der Platzierung: die Platzierung des Teams samt seiner Gruppentabellen-Zeile (kann fehlen) und Gruppenkürzel. */
export interface RankingRow {
  placement: FinalPlacement;
  standing: Standing | undefined;
  /** Kurzform der Gruppe („A“); leer ohne Gruppe. */
  groupCode: string;
  /** Sortierwert „Gruppe“: Kürzel, bei gleichem Kürzel (z. B. „GR“ für „Gruppe A“ und „Gruppe B“) die Gruppen-ID. */
  groupSortKey: string;
}

export interface RankingTableProps {
  rows: readonly RankingRow[];
  tournament: Tournament;
  hasGroups: boolean;
  hasPlayoffs: boolean;
  /** Medaille am Team (liest `placement.rank`, nicht die Zeilennummer), @W2A-076. */
  medalOf: (placement: FinalPlacement) => Medal;
  /** Marke bei Gleichstand (nur „Jeder gegen jeden“, ohne Gruppen). */
  tieMarker: (teamId: string) => ReactNode;
}

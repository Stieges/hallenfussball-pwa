/**
 * Sortierbare Spalten der Handy-Tabellen (@TS-012, Entscheidung 27.11.): eine Quelle für die Köpfe der Handy-Tabelle UND die Optionen
 * von „Sortieren nach …“. Das Handy bietet nur an, was die Tabelle dort auch zeigt (plus „Nach Platzierung“). Reihenfolge = Reihenfolge der Köpfe.
 */
import type { SortedColumn } from '../../core/standings/tableSort';
import type { TableHeadTerm } from '../ui/atoms/shortTerms';

export interface MobileSortColumn {
  column: SortedColumn;
  term?: TableHeadTerm;
}

/** Gruppentabelle am Handy: Team, Sp., Diff., Pkt. (Platz ist „Nach Platzierung“). */
export const GROUP_MOBILE_COLUMNS: readonly MobileSortColumn[] = [
  { column: 'team' }, { column: 'sp', term: 'played' }, { column: 'diff', term: 'goalDifference' }, { column: 'pkt', term: 'points' },
];

/** Platzierung über alle Gruppen am Handy: Team, Pkt., Diff. („Gruppe“ steht als Kürzel unter dem Namen und kommt per `withGroup` dazu). */
export const RANKING_MOBILE_COLUMNS: readonly MobileSortColumn[] = [
  { column: 'team' }, { column: 'pkt', term: 'points' }, { column: 'diff', term: 'goalDifference' },
];

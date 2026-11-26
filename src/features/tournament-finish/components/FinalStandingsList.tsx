/**
 * Liste der Plätze im Endstand (@ET-041, @TS-002, @TS-021): Tabelle ohne `<table>` (`role="table"`), Kopfzeile sichtbar und bedienbar.
 * Die Zeilen kommen in der Reihenfolge des Endstands; sortiert wird nur die Anzeige, der Rang hängt am Team (Gold-Zeile bei Platz 1
 * bleibt bei Platz 1, nicht bei der obersten Zeile). Gespeicherte Zeilen werden in der Vorgabe nie umgeordnet (@ET-045).
 */
import { useTranslation } from 'react-i18next';
import type { FinalStandingRow } from '../../../core/standings/finalStandings';
import { tableKey } from '../../../core/standings/tableSortAddress';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useTableSort } from '../../../hooks/useTableSort';
import { useTableSortState } from '../../../hooks/useTableSortState';
import { formatSigned } from '../model/finishFormat';
import { TeamName } from './HyphenSafe';
import { finalSortColumns } from './finalSortColumns';
import { SortBar, SortHeadRow, type HeadSpec, type ListSort, type PickerColumn } from './FinalSortParts';
import { goldRowFirst, placeNumber, pointsCell, standingsHeader, standingsRow, standingsRowFirst, valueCell } from './finalStandingsStyles';
import { placeList, small, strong } from './finishStyles';

export interface FinalStandingsListProps {
  ranking: readonly FinalStandingRow[];
  /** Spalten Sp., Diff., Pkt. nur, wenn der gespeicherte Stand Tabellenwerte trägt (@ET-045). */
  withValues: boolean;
  provisional: boolean;
  gold: boolean;
  /** Herkunft des Platzes unter dem Namen; `null` = keine Zeile. */
  originOf: (row: FinalStandingRow) => string | null;
}

export function FinalStandingsList({ ranking, withValues, provisional, gold, originOf }: FinalStandingsListProps) {
  const { t } = useTranslation('tournament');
  const mobile = useIsMobile();
  const handle = useTableSortState('end');
  const columns = finalSortColumns(withValues);
  // Eine Spalte, die es hier nicht gibt (Adresse oder Gerät: `end.pkt` ohne Tabellenwerte), zählt nicht: Platzierung.
  const current = handle?.state ?? null;
  const state = current !== null && columns.some((c) => c.column === current.column) ? current : null;
  const rows = useTableSort(ranking, columns, state);
  const sort: ListSort | null = handle === null ? null : { key: tableKey('end'), state, onTap: handle.tap, onChange: handle.set, onReset: handle.reset };
  const teamText = t('finalStandings.columns.team');
  const specs: HeadSpec[] = [
    { column: 'platz', text: t('finalStandings.columns.place'), align: 'start' },
    { column: 'team', text: teamText, align: 'start' },
    ...(withValues ? ([
      { column: 'sp', term: 'played', align: 'end' },
      { column: 'diff', term: 'goalDifference', align: 'end' },
      { column: 'pkt', term: 'points', align: 'end' },
    ] as const) : []),
  ];
  const pickerColumns: PickerColumn[] = [
    { column: 'team', text: teamText },
    ...(withValues ? ([{ column: 'sp', term: 'played' }, { column: 'diff', term: 'goalDifference' }, { column: 'pkt', term: 'points' }] as const) : []),
  ];
  return (
    <>
      {sort !== null && <SortBar sort={sort} columns={pickerColumns} mobile={mobile} scope="final-standings-sort" />}
      <div style={placeList} role="table" aria-labelledby="final-standings-title">
        <SortHeadRow specs={specs} sort={sort} mobile={mobile} style={standingsHeader(withValues)} testId="final-standings-header" />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} role="rowgroup" data-testid="final-standings-list">
          {rows.map((row, index) => (
            <li key={row.teamId} role="row" style={{ ...standingsRow(withValues), ...(!provisional && row.place === 1 ? (gold ? goldRowFirst : standingsRowFirst) : {}), ...(index === rows.length - 1 ? { borderBottom: 'none' } : {}) }} data-testid="final-standing-row" data-place={row.place}>
              <span role="cell" style={placeNumber}>{row.place}</span>
              <span role="cell" style={{ display: 'grid', minWidth: 0 }}>
                <span style={strong} data-testid="final-standing-team"><TeamName name={row.teamName} /></span>
                {originOf(row) !== null && <span style={small} data-testid="final-standing-origin">{originOf(row)}</span>}
              </span>
              {withValues && (
                <>
                  <span role="cell" style={valueCell} data-testid="final-standing-games" aria-label={row.tableValues === undefined ? undefined : t('finalStandings.valueLabel.games', { value: row.tableValues.games })}>{row.tableValues?.games}</span>
                  <span role="cell" style={valueCell} data-testid="final-standing-diff" aria-label={row.tableValues === undefined ? undefined : t('finalStandings.valueLabel.goalDiff', { value: formatSigned(row.tableValues.goalDiff) })}>{row.tableValues === undefined ? null : formatSigned(row.tableValues.goalDiff)}</span>
                  <span role="cell" style={pointsCell} data-testid="final-standing-points" aria-label={row.tableValues === undefined ? undefined : t('finalStandings.valueLabel.points', { value: row.tableValues.points })}>{row.tableValues?.points}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

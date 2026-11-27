/**
 * Torschützenliste im Endstand (R3-5, @ET-041, Regeln @ET-036 bis @ET-040 stecken in `computeScorers`): Rang 1 bis 3 sichtbar,
 * der Rest hinter „Alle Torschützen anzeigen“; die Sammelzeilen „ohne Nummer“ und „Eigentore“ stehen ohne Rang am Ende.
 * Sortierbar nach Tore und Team (@TS-002, @TS-008, @TS-019): sortiert werden nur die Spielerzeilen, die Sammelzeilen bleiben immer am
 * Ende; solange anders sortiert ist, stehen alle Zeilen da (das Einklappen gilt nur in der Vorgabe). Nur Darstellung der übergebenen Zeilen.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScorerRow } from '../../../core/standings/finalStandings';
import { iconSizeValues } from '../../../design-tokens';
import { tableKey } from '../../../core/standings/tableSortAddress';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useTableSort } from '../../../hooks/useTableSort';
import { useTableSortState } from '../../../hooks/useTableSortState';
import { Icons } from '../../../components/ui/Icons';
import { TeamName } from './HyphenSafe';
import { scorerSortColumns, type PlayerRow } from './finalSortColumns';
import { SortBar, SortHeadRow, type HeadSpec, type ListSort } from './FinalSortParts';
import { pickerColumnsOf } from './pickerColumnsOf';
import { heading, placeList, secondaryButton, small, strong, tightStack } from './finishStyles';
import { scorerGoals, scorerHeader, scorerName, scorerRank, scorerRow } from './finalStandingsStyles';

const VISIBLE_RANK = 3;

const isPlayer = (row: ScorerRow): row is PlayerRow => row.kind === 'player';

export function ScorerList({ scorers, provisional, incomplete = false }: { scorers: readonly ScorerRow[]; provisional: boolean; incomplete?: boolean }) {
  const { t } = useTranslation('tournament');
  const [all, setAll] = useState(false);
  const mobile = useIsMobile();
  const handle = useTableSortState('tor');
  const players = scorers.filter(isPlayer);
  const collective = scorers.filter((row) => !isPlayer(row));
  // Eine Spalte, die es hier nicht gibt (z. B. `tor.pkt` in der Adresse), zählt nicht: Platzierung.
  const current = handle?.state ?? null;
  const state = current !== null && scorerSortColumns.some((c) => c.column === current.column) ? current : null;
  const sorted = useTableSort(players, scorerSortColumns, state);
  const sort: ListSort | null = handle === null ? null : { key: tableKey('tor'), state, onTap: handle.tap, onChange: handle.set, onReset: handle.reset };
  const sortedNow = state !== null;
  const isShort = (row: ScorerRow): boolean => row.kind === 'player' && row.rank <= VISIBLE_RANK;
  // Ohne Spielerzeile zeigt die Liste die Sammelzeilen („ohne Nummer“, „Eigentore“) gleich – nie ein leerer Kasten (Review #397 M-2).
  const hasPlayers = players.length > 0;
  const ordered: readonly ScorerRow[] = [...sorted, ...collective];
  const shown = all || sortedNow || !hasPlayers ? ordered : ordered.filter(isShort);
  const hasMore = hasPlayers && !sortedNow && scorers.some((row) => !isShort(row));
  const goalsText = t('groupTables.columns.goals');
  const teamText = t('finalStandings.columns.team');
  const specs: HeadSpec[] = [
    { column: 'plain', term: 'rank', align: 'start' },
    { column: 'team', text: teamText, align: 'start' },
    { column: 'tore', text: goalsText, align: 'end' },
  ];
  const pickerColumns = pickerColumnsOf(specs);
  const label = (row: ScorerRow) => {
    if (row.kind === 'player') {
      return <><span>#{row.number} </span><TeamName name={row.teamName} /></>;
    }
    return <TeamName name={t(row.kind === 'noNumber' ? 'finalStandings.scorerNoNumber' : 'finalStandings.scorerOwnGoals', { team: row.teamName })} />;
  };
  return (
    <section style={tightStack} aria-labelledby="final-scorers-title" data-testid="final-scorers">
      <h3 id="final-scorers-title" style={heading}>{t('finalStandings.scorers')}</h3>
      {incomplete && <p style={small} role="status" data-testid="final-scorers-incomplete">{t('finalStandings.scorersIncomplete')}</p>}
      {scorers.length === 0 ? <p style={small} data-testid="final-scorers-empty">{t(provisional ? 'finalStandings.scorersEmptyProvisional' : 'finalStandings.scorersEmptyStored')}</p> : (
        <>
          {sort !== null && hasPlayers && <SortBar sort={sort} columns={pickerColumns} mobile={mobile} scope="final-scorers-sort" />}
          <div style={placeList} role="table" aria-labelledby="final-scorers-title">
            <SortHeadRow specs={specs} sort={hasPlayers ? sort : null} mobile={mobile} style={scorerHeader} testId="final-scorers-header" />
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} role="rowgroup">
              {shown.map((row, index) => (
                <li key={`${row.kind}-${row.teamId}-${row.kind === 'player' ? row.number : ''}`} role="row" style={{ ...scorerRow, ...(index === shown.length - 1 ? { borderBottom: 'none' } : {}) }} data-testid="final-scorer-row">
                  <span role="cell" style={scorerRank}>{row.rank ?? ''}</span>
                  <span role="cell" style={{ ...strong, ...scorerName }}>{label(row)}</span>
                  <span role="cell" style={{ ...strong, ...scorerGoals }}>{t('finalStandings.goals', { count: row.goals })}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
      {hasMore && (
        <button type="button" style={secondaryButton} onClick={() => setAll((open) => !open)} aria-expanded={all} data-testid="final-scorers-toggle">
          <span>{t(all ? 'finalStandings.showFewerScorers' : 'finalStandings.showAllScorers')}</span>
          {all ? <Icons.ChevronUp size={iconSizeValues.sm} /> : <Icons.ChevronDown size={iconSizeValues.sm} />}
        </button>
      )}
    </section>
  );
}

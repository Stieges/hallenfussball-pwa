/**
 * Platzierung über alle Gruppen, Handy-Ansicht (Platz, Team, Pkt., Diff., Aufklappen); aus `TabellenTab.tsx` herausgelöst.
 * Die Köpfe sind am Handy nur Anzeige (Pfeil, `aria-sort`); sortiert wird über „Sortieren nach …“ (@TS-012).
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { GroupHeadCell, type GroupSort } from '../../../components/schedule/GroupSortHeads';
import { RANKING_MOBILE_COLUMNS } from '../../../components/schedule/mobileSortColumns';
import { focusStyle, goalDiffColor } from '../../../components/schedule/groupTablesStyle';
import { goalDiffLabel } from '../../../core/standings/goalDiffLabel';
import { placementBadgeText, placementRankText } from '../../../utils/calculations';
import { HighlightedCell } from '../components';
import { medalStyle, rankingStyles } from './rankingStyles';
import type { RankingTableProps } from './rankingTypes';

export interface RankingMobileTableProps extends RankingTableProps {
  /** Aufgeklappte Zeilen (Schlüssel `<Team-ID>-<Platz>`); der Zustand bleibt beim Aufrufer. */
  expandedRows: ReadonlySet<string>;
  onToggleRow: (rowKey: string) => void;
  sort?: GroupSort | null;
  goalsFocus?: 'for' | 'against';
}

/** Volle Zeile unter einer Tabellenzeile für die Marke (Handy); ohne Marke keine Zeile. */
const tieMarkerRow = (marker: ReactNode, columns: number): ReactNode =>
  marker === null ? null : (
    <tr data-testid="tie-marker-row">
      <td colSpan={columns} style={{ padding: `0 ${cssVars.spacing.sm} ${cssVars.spacing.sm}`, borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}` }}>{marker}</td>
    </tr>
  );

const detailLabel: CSSProperties = { color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' };
const detailValue: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary };

function Detail({ label, value, span, focus }: { label: string; value: number; span?: number; focus?: 'for' | 'against' }) {
  return (
    <div style={{ textAlign: 'center', ...(span ? { gridColumn: `span ${String(span)}` } : {}) }}>
      <div style={detailLabel}>{label}</div>
      <div style={{ ...detailValue, ...(focus === undefined ? {} : focusStyle) }} data-goals-focus={focus}>{value}</div>
    </div>
  );
}

export function RankingMobileTable({ rows, tournament, hasGroups, medalOf, tieMarker, expandedRows, onToggleRow, sort = null, goalsFocus }: RankingMobileTableProps) {
  const { t } = useTranslation('tournament');
  const { table, th, fixedTh, td } = rankingStyles(true);
  const enabledCriteria = tournament.placementLogic.filter((c) => c.enabled && c.id !== 'directComparison');
  const highlightPoints = enabledCriteria.some((c) => c.id === 'points');
  const highlightGoalDiff = enabledCriteria.some((c) => c.id === 'goalDifference');
  return (
    <table style={table}>
      <thead>
        <tr>
          <GroupHeadCell indicator sort={sort} column="platz" term="rank" style={fixedTh} />
          {RANKING_MOBILE_COLUMNS.map(({ column, term }) => (
            <GroupHeadCell key={column} indicator sort={sort} column={column} term={term} text={column === 'team' ? t('ranking.headers.team') : undefined} style={column === 'team' ? th : fixedTh} />
          ))}
          <th style={{ ...th, width: '30px', textAlign: 'center' }}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ placement, standing, groupCode }) => {
          const goalDiff = standing ? standing.goalsFor - standing.goalsAgainst : 0;
          const teamKey = `${placement.team.id}-${placement.rank}`;
          const isExpanded = expandedRows.has(teamKey);
          const medal = medalOf(placement);
          return (
            <React.Fragment key={teamKey}>
              <tr onClick={() => onToggleRow(teamKey)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, textAlign: 'center' }}>
                  <div style={medalStyle(medal, true)} data-testid="place-medal" data-medal={medal}>{placementRankText(placement)}</div>
                </td>
                <td style={{ ...td, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>
                  {placement.team.name}
                  {placement.decidedBy !== 'groupStage' ? (
                    <div style={{
                      fontSize: cssVars.fontSizes.xs, // F1-W3a: ≥ 11 px (grenzwerte schrift.min)
                      color: cssVars.colors.primary,
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}>
                      {placementBadgeText(placement, t)}
                    </div>
                  ) : hasGroups && placement.team.group ? (
                    <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '2px' }}>{groupCode}</div>
                  ) : null}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <HighlightedCell highlight={highlightPoints} baseWeight="bold" fontSize="lg">{standing?.points ?? '-'}</HighlightedCell>
                </td>
                <td style={{ ...td, textAlign: 'center', color: goalDiffColor(goalDiff) }}>
                  <HighlightedCell highlight={highlightGoalDiff} baseWeight="semibold" fontSize="md">{standing ? goalDiffLabel(goalDiff) : '-'}</HighlightedCell>
                </td>
                <td style={{ ...td, textAlign: 'center', padding: '10px 4px' }}>
                  <span style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.primary }}>{isExpanded ? '▼' : '▶'}</span>
                </td>
              </tr>
              {/* Paket TB-B: auf dem Handy steht die Marke als eigene Zeile über die volle Breite, nie in der schmalen Teamspalte */}
              {!hasGroups && tieMarkerRow(tieMarker(placement.team.id), 5)}
              {isExpanded && standing && (
                <tr key={`${teamKey}-details`}>
                  <td colSpan={5} style={{ padding: '12px', background: cssVars.colors.rankingExpandedBg, borderBottom: `1px solid ${cssVars.colors.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: cssVars.fontSizes.sm }}>
                      <Detail label={t('ranking.details.matches')} value={standing.played} />
                      <Detail label={t('ranking.details.wins')} value={standing.won} />
                      <Detail label={t('ranking.details.draws')} value={standing.drawn} />
                      <Detail label={t('ranking.details.losses')} value={standing.lost} />
                      <Detail label={t('ranking.details.goalsScored')} value={standing.goalsFor} span={2} focus={goalsFocus === 'for' ? 'for' : undefined} />
                      <Detail label={t('ranking.details.goalsConceded')} value={standing.goalsAgainst} span={2} focus={goalsFocus === 'against' ? 'against' : undefined} />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

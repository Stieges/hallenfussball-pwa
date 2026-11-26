/**
 * Platzierung über alle Gruppen, breite Ansicht (aus `TabellenTab.tsx` herausgelöst, @W2A-047, @W2A-076).
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { GoalsPair } from '../../../components/schedule/GoalsPair';
import { GroupHeadCell, type GroupSort } from '../../../components/schedule/GroupSortHeads';
import { goalDiffColor } from '../../../components/schedule/groupTablesStyle';
import { goalDiffLabel } from '../../../core/standings/goalDiffLabel';
import { placementBadgeText, placementRankText } from '../../../utils/calculations';
import { HighlightedCell } from '../components';
import { medalStyle, rankingStyles } from './rankingStyles';
import type { RankingTableProps } from './rankingTypes';

export interface RankingDesktopTableProps extends RankingTableProps {
  /** Sortierung der Tabelle; `null` = ohne Sortierung (kein Provider). */
  sort?: GroupSort | null;
  goalsFocus?: 'for' | 'against';
}

export function RankingDesktopTable({ rows, tournament, hasGroups, hasPlayoffs, medalOf, tieMarker, sort = null, goalsFocus }: RankingDesktopTableProps) {
  const { t } = useTranslation('tournament');
  const { table, th, fixedTh, td } = rankingStyles(false);
  const enabledCriteria = tournament.placementLogic.filter((c) => c.enabled && c.id !== 'directComparison');
  const has = (id: string) => enabledCriteria.some((c) => c.id === id);
  const highlightPoints = has('points');
  const highlightWins = has('wins');
  const highlightGoalDiff = has('goalDifference');
  const highlightGoals = has('goalsFor') || has('goalsAgainst');
  return (
    <table style={table}>
      <thead>
        <tr>
          <GroupHeadCell sort={sort} column="platz" text={t('ranking.headers.rank')} style={{ ...th, width: '60px', textAlign: 'center' }} />
          <GroupHeadCell sort={sort} column="team" text={t('ranking.headers.team')} style={th} />
          {hasPlayoffs && <th style={{ ...th, width: '120px', textAlign: 'center' }}>{t('ranking.headers.decidedBy')}</th>}
          {hasGroups && <GroupHeadCell sort={sort} column="gruppe" term="group" style={{ ...th, width: '80px', textAlign: 'center' }} />}
          <GroupHeadCell sort={sort} column="sp" term="played" style={fixedTh} />
          <GroupHeadCell sort={sort} column="s" term="won" style={fixedTh} />
          <GroupHeadCell sort={sort} column="u" term="drawn" style={fixedTh} />
          <GroupHeadCell sort={sort} column="n" term="lost" style={fixedTh} />
          <GroupHeadCell sort={sort} column="tore" text={t('ranking.headers.goals')} style={{ ...th, width: '100px', textAlign: 'center' }} />
          <GroupHeadCell sort={sort} column="diff" term="goalDifference" style={fixedTh} />
          <GroupHeadCell sort={sort} column="pkt" term="points" style={fixedTh} />
        </tr>
      </thead>
      <tbody>
        {rows.map(({ placement, standing, groupCode }) => {
          const medal = medalOf(placement);
          const goalDiff = standing ? standing.goalsFor - standing.goalsAgainst : 0;
          return (
            <tr key={`${placement.team.id}-${placement.rank}`}>
              <td style={{ ...td, textAlign: 'center' }}>
                <div style={medalStyle(medal, false)} data-testid="place-medal" data-medal={medal}>{placementRankText(placement)}</div>
              </td>
              <td style={{ ...td, fontWeight: cssVars.fontWeights.semibold }}>
                {placement.team.name}
                {!hasGroups && tieMarker(placement.team.id)}
              </td>
              {hasPlayoffs && (
                <td style={{ ...td, textAlign: 'center' }}>
                  {placement.decidedBy !== 'groupStage' ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      background: cssVars.colors.primaryLight,
                      borderRadius: '12px',
                      fontSize: cssVars.fontSizes.xs,
                      color: cssVars.colors.primary,
                      fontWeight: cssVars.fontWeights.semibold,
                    }}>
                      {placementBadgeText(placement, t)}
                    </span>
                  ) : (
                    <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }}>
                      {t('ranking.groupStage')}
                    </span>
                  )}
                </td>
              )}
              {hasGroups && (
                <td style={{ ...td, textAlign: 'center', fontWeight: cssVars.fontWeights.semibold }}>
                  {placement.team.group ? groupCode : '-'}
                </td>
              )}
              <td style={{ ...td, textAlign: 'center' }}>{standing?.played ?? '-'}</td>
              <td style={{ ...td, textAlign: 'center' }}>
                <HighlightedCell highlight={highlightWins}>{standing?.won ?? '-'}</HighlightedCell>
              </td>
              <td style={{ ...td, textAlign: 'center' }}>{standing?.drawn ?? '-'}</td>
              <td style={{ ...td, textAlign: 'center' }}>{standing?.lost ?? '-'}</td>
              <td style={{ ...td, textAlign: 'center' }}>
                <HighlightedCell highlight={highlightGoals && goalsFocus === undefined}>
                  {standing ? <GoalsPair goalsFor={standing.goalsFor} goalsAgainst={standing.goalsAgainst} focus={goalsFocus} /> : '-'}
                </HighlightedCell>
              </td>
              <td style={{ ...td, textAlign: 'center', color: goalDiffColor(goalDiff) }}>
                <HighlightedCell highlight={highlightGoalDiff} baseWeight="semibold">
                  {standing ? goalDiffLabel(goalDiff) : '-'}
                </HighlightedCell>
              </td>
              <td style={{ ...td, textAlign: 'center' }}>
                <HighlightedCell highlight={highlightPoints} baseWeight="bold" fontSize="lg">{standing?.points ?? '-'}</HighlightedCell>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Tabelle einer Gruppe in der breiten Ansicht (Tablet, Laptop, Druck): Platz, Team, Sp., S, U, N, Tore, Diff., Pkt.
 * Aus `GroupTables.tsx` ausgelagert; Platzziffer über `placeLabel` (@ZM-198, dieselbe Logik wie am Monitor).
 */
import { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { Standing } from '../../types/tournament';
import { ShortLabel } from '../ui/atoms';
import { placeLabel } from '../../core/standings/placeLabel';
import { StandingNameCell } from './StandingNameCell';
import { fixedColStyle, goalDiffColor, highlightStyle, tableStyle, tdStyle, thStyle, type PlacementHighlights } from './groupTablesStyle';

export interface GroupStandingsTableProps {
  standings: Standing[];
  highlights: PlacementHighlights;
  activeMatchTeamIds?: Set<string>;
  /** Marke unter dem Teamnamen (Verwaltung: Gleichstand; Zuschauer: offener Gleichstand, @W2A-059). */
  nameMark?: (teamId: string) => ReactNode;
}

const center: CSSProperties = { ...tdStyle, textAlign: 'center' };

export function GroupStandingsDesktopTable({ standings, highlights, activeMatchTeamIds, nameMark }: GroupStandingsTableProps) {
  const { t } = useTranslation('tournament');
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={fixedColStyle}><ShortLabel term="rank" /></th>
          <th style={thStyle}>{t('groupTables.columns.team')}</th>
          <th style={fixedColStyle}><ShortLabel term="played" /></th>
          <th style={fixedColStyle}><ShortLabel term="won" /></th>
          <th style={fixedColStyle}><ShortLabel term="drawn" /></th>
          <th style={fixedColStyle}><ShortLabel term="lost" /></th>
          <th style={fixedColStyle}>{t('groupTables.columns.goals')}</th>
          <th style={fixedColStyle}><ShortLabel term="goalDifference" /></th>
          <th style={fixedColStyle}><ShortLabel term="points" /></th>
        </tr>
      </thead>
      <tbody>
        {standings.map((standing, index) => {
          const goalDiff = standing.goalsFor - standing.goalsAgainst;
          const goalsHighlighted = highlights.goalsFor || highlights.goalsAgainst;
          return (
            <tr key={standing.team.id}>
              {/* Paket TB: gemeinsame Ziffer mit Sprung (2, 2, 4), @W2A-047; vor dem ersten Spiel „–“ (@ZM-198) */}
              <td style={{ ...center, fontWeight: cssVars.fontWeights.semibold }}>{placeLabel(standings, index)}</td>
              <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold }}>
                <StandingNameCell team={standing.team} playing={activeMatchTeamIds?.has(standing.team.id) === true} gap={cssVars.spacing.sm} />
                {nameMark?.(standing.team.id)}
              </td>
              <td style={center}>{standing.played}</td>
              <td style={center}>
                <span style={{ fontWeight: highlights.wins ? cssVars.fontWeights.bold : cssVars.fontWeights.normal, ...highlightStyle(highlights.wins) }}>{standing.won}</span>
              </td>
              <td style={center}>{standing.drawn}</td>
              <td style={center}>{standing.lost}</td>
              <td style={center}>
                <span style={{ fontWeight: goalsHighlighted ? cssVars.fontWeights.bold : cssVars.fontWeights.normal, ...highlightStyle(goalsHighlighted) }}>
                  {standing.goalsFor}:{standing.goalsAgainst}
                </span>
              </td>
              <td style={{ ...center, color: goalDiffColor(goalDiff) }}>
                <span style={{ fontWeight: highlights.goalDiff ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold, ...highlightStyle(highlights.goalDiff) }}>
                  {goalDiff > 0 ? '+' : ''}{goalDiff}
                </span>
              </td>
              <td style={center}>
                <span style={{ fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.md, ...highlightStyle(highlights.points) }}>{standing.points}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

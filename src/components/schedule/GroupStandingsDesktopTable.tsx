/**
 * Tabelle einer Gruppe in der breiten Ansicht (Tablet, Laptop, Druck): Platz, Team, Sp., S, U, N, Tore, Diff., Pkt.
 * Aus `GroupTables.tsx` ausgelagert; Platzziffer über `placeLabel` (@ZM-198, dieselbe Logik wie am Monitor).
 */
import { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { Standing } from '../../types/tournament';
import { goalDiffLabel } from '../../core/standings/goalDiffLabel';
import { StandingNameCell } from './StandingNameCell';
import { GroupHeadCell, type GroupSort } from './GroupSortHeads';
import { fixedColStyle, goalDiffColor, highlightStyle, tableStyle, tdStyle, thStyle, type PlacementHighlights } from './groupTablesStyle';

export interface GroupStandingsTableProps {
  standings: readonly Standing[];
  /** Platzziffer je Team, einmal aus der Reihenfolge der Platzierung gerechnet (der Platz hängt am Team, @TS-004). */
  placeOf: (teamId: string) => string;
  /** Sortierung der Karte; `null` = ohne Sortierung (Spielplan, Vorschau). */
  sort?: GroupSort | null;
  highlights: PlacementHighlights;
  activeMatchTeamIds?: Set<string>;
  /** Marke unter dem Teamnamen (Verwaltung: Gleichstand; Zuschauer: offener Gleichstand, @W2A-059). */
  nameMark?: (teamId: string) => ReactNode;
}

const center: CSSProperties = { ...tdStyle, textAlign: 'center' };

export function GroupStandingsDesktopTable({ standings, placeOf, sort = null, highlights, activeMatchTeamIds, nameMark }: GroupStandingsTableProps) {
  const { t } = useTranslation('tournament');
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <GroupHeadCell sort={sort} column="platz" term="rank" style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="team" text={t('groupTables.columns.team')} style={thStyle} />
          <GroupHeadCell sort={sort} column="sp" term="played" style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="s" term="won" style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="u" term="drawn" style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="n" term="lost" style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="tore" text={t('groupTables.columns.goals')} style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="diff" term="goalDifference" style={fixedColStyle} />
          <GroupHeadCell sort={sort} column="pkt" term="points" style={fixedColStyle} />
        </tr>
      </thead>
      <tbody>
        {standings.map((standing) => {
          const goalDiff = standing.goalsFor - standing.goalsAgainst;
          const goalsHighlighted = highlights.goalsFor || highlights.goalsAgainst;
          return (
            <tr key={standing.team.id}>
              {/* Paket TB: gemeinsame Ziffer mit Sprung (2, 2, 4), @W2A-047; vor dem ersten Spiel „–“ (@ZM-198) */}
              <td style={{ ...center, fontWeight: cssVars.fontWeights.semibold }}>{placeOf(standing.team.id)}</td>
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
                  {goalDiffLabel(goalDiff)}
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

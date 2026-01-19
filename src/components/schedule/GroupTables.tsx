/**
 * GroupTables - Displays group standings tables in MeinTurnierplan style
 * Fully responsive with mobile condensed view and expandable rows
 * Uses CSS media queries for responsive layout (no isMobile prop needed)
 */

import { CSSProperties, useState } from 'react';
import { cssVars } from '../../design-tokens'
import { Standing, Tournament, TeamLogo, TeamColors } from '../../types/tournament';
import { getGroupDisplayName } from '../../utils/displayNames';
import { TeamAvatar } from '../ui/TeamAvatar';
import styles from './GroupTables.module.css';

interface GroupTablesProps {
  standings: Standing[];
  teams: Array<{ id: string; name: string; group?: string; logo?: TeamLogo; colors?: TeamColors }>;
  tournament?: Tournament;
  /** Set of team IDs currently involved in a running match */
  activeMatchTeamIds?: Set<string>;
}

export const GroupTables: React.FC<GroupTablesProps> = ({
  standings,
  teams,
  tournament,
  activeMatchTeamIds,
}) => {
  const groupStandings = getGroupStandings(standings, teams);

  if (groupStandings.length === 0) {
    return (
      <div className="group-tables-empty" style={{
        textAlign: 'center',
        padding: '48px 24px',
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.lg,
      }}>
        Noch keine Spiele gespielt.
        <br />
        Die Tabelle wird nach den ersten Spielen angezeigt.
      </div>
    );
  }

  // Determine grid class based on number of groups
  const gridClass = groupStandings.length === 2
    ? styles.twoGroups
    : groupStandings.length > 2
      ? styles.manyGroups
      : '';

  return (
    <div style={{ padding: cssVars.spacing.lg }} className="group-tables-container">
      <div className={`${styles.tablesGrid} ${gridClass}`}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <StandingsTable
            key={group}
            standings={groupTeams}
            title={getGroupDisplayName(group, tournament)}
            tournament={tournament}
            activeMatchTeamIds={activeMatchTeamIds}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse-live {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 768px) {
          .group-tables-container {
            padding: 12px !important;
          }
          .group-tables-empty {
            padding: 24px 12px !important;
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
};

interface StandingsTableProps {
  standings: Standing[];
  title: string;
  tournament?: Tournament;
  activeMatchTeamIds?: Set<string>;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title, tournament, activeMatchTeamIds }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // ... (rest of logic)

  const toggleRowExpansion = (teamId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedRows(newExpanded);
  };

  const containerStyle: CSSProperties = {
    background: cssVars.colors.background,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.md,
    minWidth: 0,
    overflow: 'hidden',
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.primary,
    marginBottom: '12px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: cssVars.fontSizes.md,
  };

  const thStyle: CSSProperties = {
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.semibold,
    fontSize: cssVars.fontSizes.sm,
  };

  const tdStyle: CSSProperties = {
    padding: '10px 8px',
    borderBottom: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textPrimary,
  };

  // Get enabled placement criteria (with fallback if tournament is not provided)
  // Note: placementLogic can be undefined at runtime for older tournaments despite type definition
   
  const enabledCriteria = tournament?.placementLogic?.filter(c => c.enabled && c.id !== 'directComparison') ?? [];
  const highlightPoints = enabledCriteria.some(c => c.id === 'points');
  const highlightWins = enabledCriteria.some(c => c.id === 'wins');
  const highlightGoalDiff = enabledCriteria.some(c => c.id === 'goalDifference');
  const highlightGoalsFor = enabledCriteria.some(c => c.id === 'goalsFor');
  const highlightGoalsAgainst = enabledCriteria.some(c => c.id === 'goalsAgainst');

  return (
    <div style={containerStyle} className="standings-table">
      <h3 style={titleStyle}>{title}</h3>

      {/* Desktop Table View - hidden on mobile via CSS */}
      <div className="desktop-view" style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Pl.</th>
              <th style={thStyle}>Team</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Sp</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>S</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>U</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>N</th>
              <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Tore</th>
              <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Diff</th>
              <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Pkt</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const rank = index + 1;
              const goalDiff = standing.goalsFor - standing.goalsAgainst;

              return (
                <tr key={standing.team.id}>
                  <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold, textAlign: 'center' }}>
                    {rank}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: cssVars.spacing.sm,
                      // MOBILE-UX: No truncation - team names must be fully visible
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}>
                      <TeamAvatar team={standing.team} size="xs" />
                      {standing.team.name}
                      {/* LIVE INDICATOR */}
                      {activeMatchTeamIds?.has(standing.team.id) && (
                        <span
                          title="Gerade im Spiel"
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: cssVars.colors.statusLive,
                            animation: 'pulse-live 2s infinite',
                            marginLeft: '6px',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {standing.played}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontWeight: highlightWins ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
                      padding: highlightWins ? '2px 6px' : '0',
                      background: highlightWins ? cssVars.colors.rankingHighlightBg : 'transparent',
                      borderRadius: highlightWins ? '4px' : '0',
                    }}>
                      {standing.won}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {standing.drawn}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {standing.lost}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontWeight: (highlightGoalsFor || highlightGoalsAgainst) ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
                      padding: (highlightGoalsFor || highlightGoalsAgainst) ? '2px 6px' : '0',
                      background: (highlightGoalsFor || highlightGoalsAgainst) ? cssVars.colors.rankingHighlightBg : 'transparent',
                      borderRadius: (highlightGoalsFor || highlightGoalsAgainst) ? '4px' : '0',
                    }}>
                      {standing.goalsFor}:{standing.goalsAgainst}
                    </span>
                  </td>
                  <td style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: goalDiff > 0 ? cssVars.colors.primary : goalDiff < 0 ? cssVars.colors.error : cssVars.colors.textSecondary,
                  }}>
                    <span style={{
                      fontWeight: highlightGoalDiff ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold,
                      padding: highlightGoalDiff ? '2px 6px' : '0',
                      background: highlightGoalDiff ? cssVars.colors.rankingHighlightBg : 'transparent',
                      borderRadius: highlightGoalDiff ? '4px' : '0',
                    }}>
                      {goalDiff > 0 ? '+' : ''}{goalDiff}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontWeight: cssVars.fontWeights.bold,
                      fontSize: cssVars.fontSizes.md,
                      padding: highlightPoints ? '2px 6px' : '0',
                      background: highlightPoints ? cssVars.colors.rankingHighlightBg : 'transparent',
                      borderRadius: highlightPoints ? '4px' : '0',
                    }}>
                      {standing.points}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Condensed View - hidden on desktop via CSS */}
      <div className="mobile-view">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '35px', textAlign: 'center' }}>Pl.</th>
              <th style={thStyle}>Team</th>
              <th style={{ ...thStyle, width: '45px', textAlign: 'center' }}>Pkt</th>
              <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Diff</th>
              <th style={{ ...thStyle, width: '30px', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const rank = index + 1;
              const goalDiff = standing.goalsFor - standing.goalsAgainst;
              const teamKey = standing.team.id;
              const isExpanded = expandedRows.has(teamKey);

              return (
                <>
                  <tr
                    key={teamKey}
                    onClick={() => toggleRowExpansion(teamKey)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: cssVars.fontWeights.bold }}>
                      {rank}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: cssVars.spacing.xs,
                        // MOBILE-UX: No truncation - team names must be fully visible
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}>
                        <TeamAvatar team={standing.team} size="xs" />
                        {standing.team.name}
                        {/* LIVE INDICATOR */}
                        {activeMatchTeamIds?.has(standing.team.id) && (
                          <span
                            title="Gerade im Spiel"
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: cssVars.colors.statusLive,
                              animation: 'pulse-live 2s infinite',
                              marginLeft: '6px',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        fontWeight: cssVars.fontWeights.bold,
                        fontSize: cssVars.fontSizes.md,
                        padding: highlightPoints ? '2px 6px' : '0',
                        background: highlightPoints ? cssVars.colors.rankingHighlightBg : 'transparent',
                        borderRadius: highlightPoints ? '4px' : '0',
                      }}>
                        {standing.points}
                      </span>
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'center',
                      color: goalDiff > 0 ? cssVars.colors.primary : goalDiff < 0 ? cssVars.colors.error : cssVars.colors.textSecondary,
                    }}>
                      <span style={{
                        fontWeight: cssVars.fontWeights.semibold,
                        fontSize: cssVars.fontSizes.md,
                        padding: highlightGoalDiff ? '2px 6px' : '0',
                        background: highlightGoalDiff ? cssVars.colors.rankingHighlightBg : 'transparent',
                        borderRadius: highlightGoalDiff ? '4px' : '0',
                      }}>
                        {goalDiff > 0 ? '+' : ''}{goalDiff}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', padding: '10px 4px' }}>
                      <span style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.primary }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${teamKey}-details`}>
                      <td colSpan={5} style={{
                        padding: '12px',
                        background: cssVars.colors.rankingExpandedBg,
                        borderBottom: `1px solid ${cssVars.colors.border}`,
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '12px',
                          fontSize: cssVars.fontSizes.sm,
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Spiele</div>
                            <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                              {standing.played}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Siege</div>
                            <div style={{
                              fontWeight: cssVars.fontWeights.semibold,
                              color: cssVars.colors.textPrimary,
                              padding: highlightWins ? '2px 6px' : '0',
                              background: highlightWins ? cssVars.colors.rankingHighlightBg : 'transparent',
                              borderRadius: highlightWins ? '4px' : '0',
                              display: 'inline-block',
                            }}>
                              {standing.won}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Unent.</div>
                            <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                              {standing.drawn}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Niederl.</div>
                            <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                              {standing.lost}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Tore geschossen</div>
                            <div style={{
                              fontWeight: cssVars.fontWeights.semibold,
                              color: cssVars.colors.textPrimary,
                              padding: highlightGoalsFor ? '2px 6px' : '0',
                              background: highlightGoalsFor ? cssVars.colors.rankingHighlightBg : 'transparent',
                              borderRadius: highlightGoalsFor ? '4px' : '0',
                              display: 'inline-block',
                            }}>
                              {standing.goalsFor}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Tore kassiert</div>
                            <div style={{
                              fontWeight: cssVars.fontWeights.semibold,
                              color: cssVars.colors.textPrimary,
                              padding: highlightGoalsAgainst ? '2px 6px' : '0',
                              background: highlightGoalsAgainst ? cssVars.colors.rankingHighlightBg : 'transparent',
                              borderRadius: highlightGoalsAgainst ? '4px' : '0',
                              display: 'inline-block',
                            }}>
                              {standing.goalsAgainst}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CSS for responsive view switching */}
      <style>{`
        /* Hide mobile view by default (desktop first) */
        .standings-table .mobile-view {
          display: none;
        }

        /* Mobile: Show cards, hide table */
        @media (max-width: 768px) {
          .standings-table {
            padding: 12px !important;
          }
          .standings-table h3 {
            font-size: 14px !important;
            margin-bottom: 8px !important;
          }
          .standings-table .desktop-view {
            display: none;
          }
          .standings-table .mobile-view {
            display: block;
          }
          .standings-table table {
            font-size: 14px;
          }
          .standings-table th,
          .standings-table td {
            padding: 8px 6px;
          }
          .standings-table th {
            font-size: 12px;
          }
        }

        @media print {
          .standings-table .mobile-view {
            display: none !important;
          }
          .standings-table .desktop-view {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

function getGroupStandings(
  allStandings: Standing[],
  teams: Array<{ id: string; name: string; group?: string }>
): Array<{ group: string; groupStandings: Standing[] }> {
  const groups = new Set(teams.map(t => t.group).filter(Boolean)) as Set<string>;

  return Array.from(groups)
    .sort()
    .map(group => ({
      group,
      groupStandings: allStandings.filter(s =>
        teams.find(t => t.id === s.team.id)?.group === group
      ),
    }));
}

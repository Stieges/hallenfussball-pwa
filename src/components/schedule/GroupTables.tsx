/**
 * GroupTables - Displays group standings tables in MeinTurnierplan style
 * Fully responsive with mobile condensed view and expandable rows
 */

import { CSSProperties, useState } from 'react';
import { theme } from '../../styles/theme';
import { Standing, Tournament } from '../../types/tournament';

interface GroupTablesProps {
  standings: Standing[];
  teams: Array<{ id: string; name: string; group?: string }>;
  tournament?: Tournament;
  isMobile?: boolean;
}

export const GroupTables: React.FC<GroupTablesProps> = ({
  standings,
  teams,
  tournament,
  isMobile = false,
}) => {
  const groupStandings = getGroupStandings(standings, teams);

  if (groupStandings.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: isMobile ? '24px 12px' : '48px 24px',
        color: theme.colors.text.secondary,
        fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg,
      }}>
        Noch keine Spiele gespielt.
        <br />
        Die Tabelle wird nach den ersten Spielen angezeigt.
      </div>
    );
  }

  const containerStyle: CSSProperties = {
    padding: isMobile ? theme.spacing.md : theme.spacing.lg,
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile
      ? '1fr'
      : groupStandings.length === 1
        ? '1fr'
        : groupStandings.length === 2
          ? 'repeat(2, 1fr)'
          : 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: isMobile ? theme.spacing.md : theme.spacing.lg,
  };

  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <StandingsTable
            key={group}
            standings={groupTeams}
            title={`Gruppe ${group}`}
            tournament={tournament}
            isMobile={isMobile}
          />
        ))}
      </div>
    </div>
  );
};

interface StandingsTableProps {
  standings: Standing[];
  title: string;
  tournament?: Tournament;
  isMobile: boolean;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title, tournament, isMobile }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
    background: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    padding: isMobile ? '12px' : '16px',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.primary,
    marginBottom: isMobile ? '8px' : '12px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: isMobile ? '14px' : theme.fontSizes.md,
  };

  const thStyle: CSSProperties = {
    background: theme.colors.primary,
    color: theme.colors.background,
    padding: isMobile ? '8px 6px' : '10px 8px',
    textAlign: 'left',
    fontWeight: theme.fontWeights.semibold,
    fontSize: isMobile ? '12px' : '13px',
  };

  const tdStyle: CSSProperties = {
    padding: isMobile ? '10px 6px' : '10px 8px',
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.text.primary,
  };

  // Get enabled placement criteria (with fallback if tournament is not provided)
  const enabledCriteria = tournament?.placementLogic?.filter(c => c.enabled && c.id !== 'directComparison') || [];
  const highlightPoints = enabledCriteria.some(c => c.id === 'points');
  const highlightWins = enabledCriteria.some(c => c.id === 'wins');
  const highlightGoalDiff = enabledCriteria.some(c => c.id === 'goalDifference');
  const highlightGoalsFor = enabledCriteria.some(c => c.id === 'goalsFor');
  const highlightGoalsAgainst = enabledCriteria.some(c => c.id === 'goalsAgainst');

  return (
    <div style={containerStyle}>
      <h3 style={titleStyle}>{title}</h3>

      {/* Desktop Table View */}
      {!isMobile && (
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
                  <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold, textAlign: 'center' }}>
                    {rank}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold }}>
                    {standing.team.name}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {standing.played}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontWeight: highlightWins ? theme.fontWeights.bold : theme.fontWeights.normal,
                      padding: highlightWins ? '2px 6px' : '0',
                      background: highlightWins ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
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
                      fontWeight: (highlightGoalsFor || highlightGoalsAgainst) ? theme.fontWeights.bold : theme.fontWeights.normal,
                      padding: (highlightGoalsFor || highlightGoalsAgainst) ? '2px 6px' : '0',
                      background: (highlightGoalsFor || highlightGoalsAgainst) ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      borderRadius: (highlightGoalsFor || highlightGoalsAgainst) ? '4px' : '0',
                    }}>
                      {standing.goalsFor}:{standing.goalsAgainst}
                    </span>
                  </td>
                  <td style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: goalDiff > 0 ? theme.colors.primary : goalDiff < 0 ? theme.colors.error : theme.colors.text.secondary,
                  }}>
                    <span style={{
                      fontWeight: highlightGoalDiff ? theme.fontWeights.bold : theme.fontWeights.semibold,
                      padding: highlightGoalDiff ? '2px 6px' : '0',
                      background: highlightGoalDiff ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      borderRadius: highlightGoalDiff ? '4px' : '0',
                    }}>
                      {goalDiff > 0 ? '+' : ''}{goalDiff}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontWeight: theme.fontWeights.bold,
                      fontSize: '15px',
                      padding: highlightPoints ? '2px 6px' : '0',
                      background: highlightPoints ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
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
      )}

      {/* Mobile Condensed View */}
      {isMobile && (
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
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.bold }}>
                      {rank}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold, fontSize: '14px' }}>
                      {standing.team.name}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        fontWeight: theme.fontWeights.bold,
                        fontSize: '15px',
                        padding: highlightPoints ? '2px 6px' : '0',
                        background: highlightPoints ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        borderRadius: highlightPoints ? '4px' : '0',
                      }}>
                        {standing.points}
                      </span>
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'center',
                      color: goalDiff > 0 ? theme.colors.primary : goalDiff < 0 ? theme.colors.error : theme.colors.text.secondary,
                    }}>
                      <span style={{
                        fontWeight: theme.fontWeights.semibold,
                        fontSize: '14px',
                        padding: highlightGoalDiff ? '2px 6px' : '0',
                        background: highlightGoalDiff ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        borderRadius: highlightGoalDiff ? '4px' : '0',
                      }}>
                        {goalDiff > 0 ? '+' : ''}{goalDiff}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', padding: '10px 4px' }}>
                      <span style={{ fontSize: '16px', color: theme.colors.primary }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${teamKey}-details`}>
                      <td colSpan={5} style={{
                        padding: '12px',
                        background: 'rgba(0, 230, 118, 0.05)',
                        borderBottom: `1px solid ${theme.colors.border}`,
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '12px',
                          fontSize: '13px',
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: theme.colors.text.secondary, fontSize: '11px', marginBottom: '4px' }}>Spiele</div>
                            <div style={{ fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
                              {standing.played}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: theme.colors.text.secondary, fontSize: '11px', marginBottom: '4px' }}>Siege</div>
                            <div style={{
                              fontWeight: theme.fontWeights.semibold,
                              color: theme.colors.text.primary,
                              padding: highlightWins ? '2px 6px' : '0',
                              background: highlightWins ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                              borderRadius: highlightWins ? '4px' : '0',
                              display: 'inline-block',
                            }}>
                              {standing.won}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: theme.colors.text.secondary, fontSize: '11px', marginBottom: '4px' }}>Unent.</div>
                            <div style={{ fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
                              {standing.drawn}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: theme.colors.text.secondary, fontSize: '11px', marginBottom: '4px' }}>Niederl.</div>
                            <div style={{ fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
                              {standing.lost}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                            <div style={{ color: theme.colors.text.secondary, fontSize: '11px', marginBottom: '4px' }}>Tore geschossen</div>
                            <div style={{
                              fontWeight: theme.fontWeights.semibold,
                              color: theme.colors.text.primary,
                              padding: highlightGoalsFor ? '2px 6px' : '0',
                              background: highlightGoalsFor ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                              borderRadius: highlightGoalsFor ? '4px' : '0',
                              display: 'inline-block',
                            }}>
                              {standing.goalsFor}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                            <div style={{ color: theme.colors.text.secondary, fontSize: '11px', marginBottom: '4px' }}>Tore kassiert</div>
                            <div style={{
                              fontWeight: theme.fontWeights.semibold,
                              color: theme.colors.text.primary,
                              padding: highlightGoalsAgainst ? '2px 6px' : '0',
                              background: highlightGoalsAgainst ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
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
      )}
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

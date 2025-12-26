/**
 * RankingTab - Finale Platzierung des Turniers
 *
 * Zeigt die Endplatzierung basierend auf:
 * - Gruppenturniere: Gruppensieger, dann best platzierte
 * - Jeder-gegen-Jeden: Finale Tabelle
 * - Mit Playoffs: Playoff-Ergebnisse (Finale, Platz 3, Platz 5, etc.)
 */

import React, { CSSProperties, useState, useMemo } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
import { Card } from '../../components/ui';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import {
  calculateStandings,
  getMergedFinalRanking,
} from '../../utils/calculations';
import { getGroupShortCode } from '../../utils/displayNames';

interface RankingTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
}

export const RankingTab: React.FC<RankingTabProps> = ({
  tournament,
  schedule: _schedule,
  currentStandings,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useIsMobile();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const hasGroups = tournament.teams.some(t => t.group);
  const hasPlayoffs: boolean = Boolean(
    tournament.finals &&
    typeof tournament.finals === 'object' &&
    'enabled' in tournament.finals &&
    tournament.finals.enabled
  );

  // Calculate merged ranking with finals placements
  const { ranking: mergedRanking, finalsResult } = useMemo(() => {
    return getMergedFinalRanking(
      tournament.teams,
      tournament.matches,
      currentStandings,
      tournament
    );
  }, [currentStandings, tournament]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

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
    maxWidth: '1400px',
    margin: '0 auto',
    padding: isMobile ? '12px' : '24px',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.xl : fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  };

  const rankingTableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: isMobile ? '14px' : fontSizes.md,
  };

  const thStyle: CSSProperties = {
    background: colors.primary,
    color: colors.background,
    padding: isMobile ? '8px 6px' : '12px 16px',
    textAlign: 'left',
    fontWeight: fontWeights.semibold,
    borderBottom: `2px solid ${colors.border}`,
    fontSize: isMobile ? '12px' : fontSizes.md,
  };

  const tdStyle: CSSProperties = {
    padding: isMobile ? '10px 6px' : '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.textPrimary,
  };

  const medalStyle = (rank: number): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: isMobile ? '28px' : '32px',
    height: isMobile ? '28px' : '32px',
    borderRadius: '50%',
    fontWeight: fontWeights.bold,
    fontSize: isMobile ? '12px' : fontSizes.md,
    background: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : colors.surface,
    color: rank <= 3 ? '#000' : colors.textPrimary,
  });

  const fullscreenButtonStyle: CSSProperties = {
    position: 'fixed',
    top: isMobile ? spacing.sm : spacing.lg,
    right: isMobile ? spacing.sm : spacing.lg,
    padding: isMobile ? `${spacing.sm} ${spacing.md}` : `${spacing.md} ${spacing.lg}`,
    background: 'rgba(0, 230, 118, 0.15)',
    border: `1px solid ${colors.primary}`,
    borderRadius: borderRadius.lg,
    color: colors.primary,
    fontSize: isMobile ? '12px' : fontSizes.md,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    transition: 'all 0.2s ease',
    zIndex: 1000,
  };

  // Berechne finale Platzierung (Legacy-Funktion für Fallback)
  const getGroupBasedRanking = (): Standing[] => {
    if (!hasGroups) {
      // Jeder-gegen-Jeden: Verwende die bereits sortierten currentStandings
      return currentStandings;
    }

    // Gruppenturniere: Erst Gruppensieger, dann beste Zweite, etc.
    const groups = Array.from(new Set(tournament.teams.map(t => t.group).filter(Boolean)));
    const ranking: Standing[] = [];

    // Berechne Standings pro Gruppe
    const groupStandingsMap = new Map<string, Standing[]>();
    groups.forEach(group => {
      if (!group) {return;}
      const standings = calculateStandings(
        tournament.teams.filter(t => t.group === group),
        tournament.matches,
        tournament,
        group
      );
      groupStandingsMap.set(group, standings);
    });

    // Finde heraus, wie viele Teams pro Gruppe es gibt
    const maxTeamsPerGroup = Math.max(...Array.from(groupStandingsMap.values()).map(s => s.length));

    // Erst alle Ersten, dann alle Zweiten, etc.
    for (let position = 0; position < maxTeamsPerGroup; position++) {
      const teamsAtPosition: Standing[] = [];

      // Sammle alle Teams auf dieser Position aus allen Gruppen
      groups.forEach(group => {
        if (!group) {return;}
        const standings = groupStandingsMap.get(group);
        if (standings?.[position]) {
          teamsAtPosition.push(standings[position]);
        }
      });

      // Sortiere Teams auf gleicher Position nach Platzierungslogik
      const sortedTeamsAtPosition = [...teamsAtPosition].sort((a, b) => {
        const enabledCriteria = tournament.placementLogic.filter(c => c.enabled);

        for (const criterion of enabledCriteria) {
          let comparison = 0;

          switch (criterion.id) {
            case 'points':
              comparison = b.points - a.points;
              break;
            case 'goalDifference':
              comparison = b.goalDifference - a.goalDifference;
              break;
            case 'goalsFor':
              comparison = b.goalsFor - a.goalsFor;
              break;
            case 'goalsAgainst':
              comparison = a.goalsAgainst - b.goalsAgainst;
              break;
            case 'wins':
              comparison = b.won - a.won;
              break;
          }

          if (comparison !== 0) {
            return comparison;
          }
        }

        return 0;
      });

      ranking.push(...sortedTeamsAtPosition);
    }

    return ranking;
  };

  // Use merged ranking if playoffs exist, otherwise fall back to group-based ranking
  const finalRanking = hasPlayoffs ? mergedRanking : getGroupBasedRanking().map((standing, index) => ({
    rank: index + 1,
    team: standing.team,
    decidedBy: 'groupStage' as const,
  }));

  // Get standings map for displaying stats
  const standingsMap = useMemo(() => {
    const map = new Map<string, Standing>();
    currentStandings.forEach(s => {
      map.set(s.team.id, s);
      map.set(s.team.name, s);
    });
    return map;
  }, [currentStandings]);

  // Helper to get standing for a team
  const getStanding = (team: { id: string; name: string }): Standing | undefined => {
    return standingsMap.get(team.id) || standingsMap.get(team.name);
  };

  // Get playoff status info
  const getPlayoffStatusInfo = () => {
    if (!hasPlayoffs) {return null;}

    const { playoffStatus, completedFinalsCount, totalFinalsCount } = finalsResult;

    if (playoffStatus === 'not-started') {
      return {
        icon: '⏳',
        text: 'Playoffs noch nicht gestartet',
        color: colors.textSecondary,
        bgColor: 'rgba(100, 100, 100, 0.1)',
      };
    } else if (playoffStatus === 'in-progress') {
      return {
        icon: '▶',
        text: `Playoffs laufen (${completedFinalsCount}/${totalFinalsCount} Spiele)`,
        color: colors.warning,
        bgColor: 'rgba(255, 145, 0, 0.1)',
      };
    } else {
      return {
        icon: '✅',
        text: 'Turnier abgeschlossen',
        color: colors.primary,
        bgColor: 'rgba(0, 230, 118, 0.1)',
      };
    }
  };

  const playoffStatusInfo = getPlayoffStatusInfo();

  return (
    <div style={containerStyle}>
      {/* Fullscreen Button */}
      <button onClick={toggleFullscreen} style={fullscreenButtonStyle}>
        {isFullscreen ? '✕ Vollbild beenden' : '⛶ Vollbild'}
      </button>

      <Card>
        <div style={{ padding: isMobile ? spacing.md : spacing.lg }}>
          <h2 style={titleStyle}>Finale Platzierung</h2>

          {/* Platzierungslogik Anzeige */}
          <div style={{
            marginBottom: spacing.lg,
            padding: isMobile ? spacing.sm : spacing.md,
            background: 'rgba(0, 230, 118, 0.08)',
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.primary}40`,
          }}>
            <div style={{
              fontSize: isMobile ? '13px' : fontSizes.sm,
              fontWeight: fontWeights.semibold,
              color: colors.primary,
              marginBottom: '6px',
            }}>
              Platzierungslogik:
            </div>
            <div style={{
              fontSize: isMobile ? '12px' : fontSizes.sm,
              color: colors.textSecondary,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              lineHeight: isMobile ? '1.6' : '1.5',
            }}>
              {tournament.placementLogic
                .filter(c => c.enabled)
                .map((criterion, index) => (
                  <span key={criterion.id}>
                    <strong style={{ color: colors.textPrimary }}>
                      {index + 1}. {criterion.label}
                    </strong>
                    {index < tournament.placementLogic.filter(c => c.enabled).length - 1 && (
                      <span style={{ margin: '0 4px', color: colors.primary }}>→</span>
                    )}
                  </span>
                ))}
            </div>
          </div>

          {/* Playoff Status Banner */}
          {playoffStatusInfo && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              marginBottom: spacing.lg,
              padding: isMobile ? spacing.sm : spacing.md,
              background: playoffStatusInfo.bgColor,
              borderRadius: borderRadius.md,
              border: `1px solid ${playoffStatusInfo.color}40`,
            }}>
              <span style={{ fontSize: isMobile ? '16px' : '20px' }}>{playoffStatusInfo.icon}</span>
              <span style={{
                fontSize: isMobile ? fontSizes.sm : fontSizes.md,
                color: playoffStatusInfo.color,
                fontWeight: fontWeights.semibold,
              }}>
                {playoffStatusInfo.text}
              </span>
            </div>
          )}

          {/* Desktop Table View */}
          {!isMobile && (
            <table style={rankingTableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Platz</th>
                  <th style={thStyle}>Team</th>
                  {hasPlayoffs && <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Entschieden durch</th>}
                  {hasGroups && <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Gruppe</th>}
                  <th style={{ ...thStyle, width: '70px', textAlign: 'center' }}>Sp</th>
                  <th style={{ ...thStyle, width: '70px', textAlign: 'center' }}>S</th>
                  <th style={{ ...thStyle, width: '70px', textAlign: 'center' }}>U</th>
                  <th style={{ ...thStyle, width: '70px', textAlign: 'center' }}>N</th>
                  <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>Tore</th>
                  <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Diff</th>
                  <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Pkt</th>
                </tr>
              </thead>
              <tbody>
                {finalRanking.map((placement) => {
                  const standing = getStanding(placement.team);
                  const goalDiff = standing ? standing.goalsFor - standing.goalsAgainst : 0;

                  // Prüfe, welche Kriterien in der Platzierungslogik aktiv sind
                  const enabledCriteria = tournament.placementLogic.filter(c => c.enabled && c.id !== 'directComparison');
                  const highlightPoints = enabledCriteria.some(c => c.id === 'points');
                  const highlightWins = enabledCriteria.some(c => c.id === 'wins');
                  const highlightGoalDiff = enabledCriteria.some(c => c.id === 'goalDifference');
                  const highlightGoalsFor = enabledCriteria.some(c => c.id === 'goalsFor');
                  const highlightGoalsAgainst = enabledCriteria.some(c => c.id === 'goalsAgainst');

                  return (
                    <tr key={`${placement.team.id}-${placement.rank}`}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={medalStyle(placement.rank)}>{placement.rank}</div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: fontWeights.semibold }}>
                        {placement.team.name}
                      </td>
                      {hasPlayoffs && (
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {placement.decidedBy === 'playoff' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              background: 'rgba(0, 230, 118, 0.15)',
                              borderRadius: '12px',
                              fontSize: fontSizes.xs,
                              color: colors.primary,
                              fontWeight: fontWeights.semibold,
                            }}>
                              {placement.matchLabel ?? 'Playoff'}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: fontSizes.xs,
                              color: colors.textSecondary,
                            }}>
                              Gruppenphase
                            </span>
                          )}
                        </td>
                      )}
                      {hasGroups && (
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: fontWeights.semibold }}>
                          {placement.team.group ? getGroupShortCode(placement.team.group, tournament) : '-'}
                        </td>
                      )}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {standing?.played ?? '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          fontWeight: highlightWins ? fontWeights.bold : fontWeights.normal,
                          padding: highlightWins ? '2px 8px' : '0',
                          background: highlightWins ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                          borderRadius: highlightWins ? '4px' : '0',
                        }}>
                          {standing?.won ?? '-'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {standing?.drawn ?? '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {standing?.lost ?? '-'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          fontWeight: (highlightGoalsFor || highlightGoalsAgainst) ? fontWeights.bold : fontWeights.normal,
                          padding: (highlightGoalsFor || highlightGoalsAgainst) ? '2px 8px' : '0',
                          background: (highlightGoalsFor || highlightGoalsAgainst) ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                          borderRadius: (highlightGoalsFor || highlightGoalsAgainst) ? '4px' : '0',
                        }}>
                          {standing ? `${standing.goalsFor}:${standing.goalsAgainst}` : '-'}
                        </span>
                      </td>
                      <td style={{
                        ...tdStyle,
                        textAlign: 'center',
                        color: goalDiff > 0 ? colors.primary : goalDiff < 0 ? colors.error : colors.textSecondary,
                      }}>
                        <span style={{
                          fontWeight: highlightGoalDiff ? fontWeights.bold : fontWeights.semibold,
                          padding: highlightGoalDiff ? '2px 8px' : '0',
                          background: highlightGoalDiff ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                          borderRadius: highlightGoalDiff ? '4px' : '0',
                        }}>
                          {standing ? (goalDiff > 0 ? '+' : '') + goalDiff : '-'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          fontWeight: fontWeights.bold,
                          fontSize: fontSizes.lg,
                          padding: highlightPoints ? '2px 8px' : '0',
                          background: highlightPoints ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                          borderRadius: highlightPoints ? '4px' : '0',
                        }}>
                          {standing?.points ?? '-'}
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
            <table style={rankingTableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>Pl.</th>
                  <th style={thStyle}>Team</th>
                  <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Pkt</th>
                  <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>Diff</th>
                  <th style={{ ...thStyle, width: '30px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {finalRanking.map((placement) => {
                  const standing = getStanding(placement.team);
                  const goalDiff = standing ? standing.goalsFor - standing.goalsAgainst : 0;
                  const teamKey = `${placement.team.id}-${placement.rank}`;
                  const isExpanded = expandedRows.has(teamKey);

                  // Prüfe, welche Kriterien in der Platzierungslogik aktiv sind
                  const enabledCriteria = tournament.placementLogic.filter(c => c.enabled && c.id !== 'directComparison');
                  const highlightPoints = enabledCriteria.some(c => c.id === 'points');
                  const highlightGoalDiff = enabledCriteria.some(c => c.id === 'goalDifference');

                  return (
                    <React.Fragment key={teamKey}>
                      <tr
                        onClick={() => toggleRowExpansion(teamKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={medalStyle(placement.rank)}>{placement.rank}</div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: fontWeights.semibold, fontSize: '14px' }}>
                          {placement.team.name}
                          {/* Show playoff badge or group info */}
                          {placement.decidedBy === 'playoff' ? (
                            <div style={{
                              fontSize: '10px',
                              color: colors.primary,
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}>
                              {placement.matchLabel ?? 'Playoff'}
                            </div>
                          ) : hasGroups && placement.team.group ? (
                            <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                              {getGroupShortCode(placement.team.group, tournament)}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            fontWeight: fontWeights.bold,
                            fontSize: '15px',
                            padding: highlightPoints ? '2px 6px' : '0',
                            background: highlightPoints ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                            borderRadius: highlightPoints ? '4px' : '0',
                          }}>
                            {standing?.points ?? '-'}
                          </span>
                        </td>
                        <td style={{
                          ...tdStyle,
                          textAlign: 'center',
                          color: goalDiff > 0 ? colors.primary : goalDiff < 0 ? colors.error : colors.textSecondary,
                        }}>
                          <span style={{
                            fontWeight: fontWeights.semibold,
                            fontSize: '14px',
                            padding: highlightGoalDiff ? '2px 6px' : '0',
                            background: highlightGoalDiff ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                            borderRadius: highlightGoalDiff ? '4px' : '0',
                          }}>
                            {standing ? (goalDiff > 0 ? '+' : '') + goalDiff : '-'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', padding: '10px 4px' }}>
                          <span style={{ fontSize: '16px', color: colors.primary }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && standing && (
                        <tr key={`${teamKey}-details`}>
                          <td colSpan={5} style={{
                            padding: '12px',
                            background: 'rgba(0, 230, 118, 0.05)',
                            borderBottom: `1px solid ${colors.border}`,
                          }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '12px',
                              fontSize: '13px',
                            }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Spiele</div>
                                <div style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
                                  {standing.played}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Siege</div>
                                <div style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
                                  {standing.won}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Unent.</div>
                                <div style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
                                  {standing.drawn}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Niederl.</div>
                                <div style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
                                  {standing.lost}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                                <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Tore geschossen</div>
                                <div style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
                                  {standing.goalsFor}
                                </div>
                              </div>
                              <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                                <div style={{ color: colors.textSecondary, fontSize: '11px', marginBottom: '4px' }}>Tore kassiert</div>
                                <div style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
                                  {standing.goalsAgainst}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}


          {finalRanking.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: isMobile ? spacing.lg : spacing.xxl,
              color: colors.textSecondary,
              fontSize: isMobile ? '14px' : fontSizes.lg,
            }}>
              Noch keine Ergebnisse vorhanden.
              <br />
              Die Platzierung wird nach den ersten Spielen angezeigt.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

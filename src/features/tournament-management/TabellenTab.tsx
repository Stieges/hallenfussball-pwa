/**
 * TabellenTab - Kombinierte Ansicht für Gruppen-Tabellen und Platzierung
 *
 * Merged aus:
 * - TableTab (Gruppen-Tabellen)
 * - RankingTab (Finale Platzierung)
 *
 * Features:
 * - Segment Control zum Umschalten zwischen Ansichten
 * - Gruppen: Aktuelle Gruppenständs
 * - Platzierung: Finale Rangliste mit Playoff-Support
 * - Mobile-optimiert mit expandierbaren Zeilen
 */

import React, { CSSProperties, useState, useMemo } from 'react';
import { cssVars, fontSizesMd3 } from '../../design-tokens'
import { Card } from '../../components/ui';
import { GroupTables } from '../../components/schedule';
import { HighlightedCell } from './components';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../core/generators';
import {
  calculateStandings,
  getMergedFinalRanking,
} from '../../utils/calculations';
import { getGroupShortCode } from '../../utils/displayNames';

interface TabellenTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
}

type ViewMode = 'groups' | 'ranking';

export const TabellenTab: React.FC<TabellenTabProps> = ({
  tournament,
  schedule,
  currentStandings,
}) => {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('groups');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const hasGroups = tournament.teams.some(t => t.group);
  const hasPlayoffs: boolean = Boolean(
    typeof tournament.finals === 'object' &&
    'enabled' in tournament.finals &&
    tournament.finals.enabled
  );

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: isMobile ? '12px' : '24px',
  };

  // ============================================================================
  // SEGMENT CONTROL
  // ============================================================================

  const segmentContainerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: cssVars.spacing.lg,
  };

  const segmentGroupStyle: CSSProperties = {
    display: 'inline-flex',
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    padding: '4px',
    border: `1px solid ${cssVars.colors.border}`,
  };

  const getSegmentButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    background: isActive ? cssVars.colors.primary : 'transparent',
    color: isActive ? cssVars.colors.background : cssVars.colors.textSecondary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
    fontWeight: isActive ? cssVars.fontWeights.semibold : cssVars.fontWeights.normal,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: isMobile ? '80px' : '120px',
  });

  // ============================================================================
  // GROUPS VIEW (from TableTab)
  // ============================================================================

  const renderGroupsView = () => {
    const noGroupsStyle: CSSProperties = {
      textAlign: 'center',
      padding: isMobile ? '24px 12px' : '48px 24px',
      color: cssVars.colors.textSecondary,
      fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    };

    if (!hasGroups) {
      return (
        <div style={noGroupsStyle}>
          Dieses Turnier hat keine Gruppen.
          <br />
          Die Gruppen-Tabelle ist nur für Gruppenturniere verfügbar.
        </div>
      );
    }

    return (
      <GroupTables
        standings={currentStandings}
        teams={schedule.teams}
        tournament={tournament}
        isMobile={isMobile}
      />
    );
  };

  // ============================================================================
  // RANKING VIEW (from RankingTab)
  // ============================================================================

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

  // Berechne finale Platzierung (Legacy-Funktion für Fallback)
  const getGroupBasedRanking = (): Standing[] => {
    if (!hasGroups) {
      return currentStandings;
    }

    const groups = Array.from(new Set(tournament.teams.map(t => t.group).filter(Boolean)));
    const ranking: Standing[] = [];

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

    const maxTeamsPerGroup = Math.max(...Array.from(groupStandingsMap.values()).map(s => s.length));

    for (let position = 0; position < maxTeamsPerGroup; position++) {
      const teamsAtPosition: Standing[] = [];

      groups.forEach(group => {
        if (!group) {return;}
        const standings = groupStandingsMap.get(group);
        if (standings?.[position]) {
          teamsAtPosition.push(standings[position]);
        }
      });

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

  const finalRanking = hasPlayoffs ? mergedRanking : getGroupBasedRanking().map((standing, index) => ({
    rank: index + 1,
    team: standing.team,
    decidedBy: 'groupStage' as const,
  }));

  const standingsMap = useMemo(() => {
    const map = new Map<string, Standing>();
    currentStandings.forEach(s => {
      map.set(s.team.id, s);
      map.set(s.team.name, s);
    });
    return map;
  }, [currentStandings]);

  const getStanding = (team: { id: string; name: string }): Standing | undefined => {
    return standingsMap.get(team.id) ?? standingsMap.get(team.name);
  };

  const getPlayoffStatusInfo = () => {
    if (!hasPlayoffs) {return null;}

    const { playoffStatus, completedFinalsCount, totalFinalsCount } = finalsResult;

    if (playoffStatus === 'not-started') {
      return {
        icon: '⏳',
        text: 'Playoffs noch nicht gestartet',
        color: cssVars.colors.textSecondary,
        bgColor: cssVars.colors.neutralStatusBg,
      };
    } else if (playoffStatus === 'in-progress') {
      return {
        icon: '▶',
        text: `Playoffs laufen (${completedFinalsCount}/${totalFinalsCount} Spiele)`,
        color: cssVars.colors.warning,
        bgColor: cssVars.colors.warningBannerBgStrong,
      };
    } else {
      return {
        icon: '✅',
        text: 'Turnier abgeschlossen',
        color: cssVars.colors.primary,
        bgColor: cssVars.colors.editorEditModeBg,
      };
    }
  };

  const playoffStatusInfo = getPlayoffStatusInfo();

  // Styles for ranking view
  const titleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.xl : cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.lg,
    textAlign: 'center',
  };

  const rankingTableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: isMobile ? '14px' : cssVars.fontSizes.md,
  };

  const thStyle: CSSProperties = {
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    padding: isMobile ? '8px 6px' : '12px 16px',
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.semibold,
    borderBottom: `2px solid ${cssVars.colors.border}`,
    fontSize: isMobile ? '12px' : cssVars.fontSizes.md,
  };

  const tdStyle: CSSProperties = {
    padding: isMobile ? '10px 6px' : '12px 16px',
    borderBottom: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textPrimary,
  };

  const medalStyle = (rank: number): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: isMobile ? '28px' : '32px',
    height: isMobile ? '28px' : '32px',
    borderRadius: '50%',
    fontWeight: cssVars.fontWeights.bold,
    fontSize: isMobile ? '12px' : cssVars.fontSizes.md,
    background: rank === 1 ? cssVars.colors.medalGold : rank === 2 ? cssVars.colors.medalSilver : rank === 3 ? cssVars.colors.medalBronze : cssVars.colors.surface,
    color: rank <= 3 ? cssVars.colors.onWarning : cssVars.colors.textPrimary,
  });

  const fullscreenButtonStyle: CSSProperties = {
    position: 'fixed',
    top: isMobile ? cssVars.spacing.sm : cssVars.spacing.lg,
    right: isMobile ? cssVars.spacing.sm : cssVars.spacing.lg,
    padding: isMobile ? `${cssVars.spacing.sm} ${cssVars.spacing.md}` : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.primaryLight,
    border: `1px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.lg,
    color: cssVars.colors.primary,
    fontSize: isMobile ? '12px' : cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    transition: 'all 0.2s ease',
    zIndex: 1000,
  };

  const renderRankingView = () => {
    return (
      <div style={{ padding: isMobile ? cssVars.spacing.md : cssVars.spacing.lg }}>
        <h2 style={titleStyle}>Gesamtplatzierung</h2>

        {/* Platzierungslogik Anzeige */}
        <div style={{
          marginBottom: cssVars.spacing.lg,
          padding: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
          background: cssVars.colors.rankingPlacementBg,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.primary}40`,
        }}>
          <div style={{
            fontSize: cssVars.fontSizes.sm,
            fontWeight: cssVars.fontWeights.semibold,
            color: cssVars.colors.primary,
            marginBottom: '6px',
          }}>
            Platzierungslogik:
          </div>
          <div style={{
            fontSize: isMobile ? '12px' : cssVars.fontSizes.sm,
            color: cssVars.colors.textSecondary,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            lineHeight: isMobile ? '1.6' : '1.5',
          }}>
            {tournament.placementLogic
              .filter(c => c.enabled)
              .map((criterion, index) => (
                <span key={criterion.id}>
                  <strong style={{ color: cssVars.colors.textPrimary }}>
                    {index + 1}. {criterion.label}
                  </strong>
                  {index < tournament.placementLogic.filter(c => c.enabled).length - 1 && (
                    <span style={{ margin: '0 4px', color: cssVars.colors.primary }}>→</span>
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
            gap: cssVars.spacing.sm,
            marginBottom: cssVars.spacing.lg,
            padding: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
            background: playoffStatusInfo.bgColor,
            borderRadius: cssVars.borderRadius.md,
            border: `1px solid ${playoffStatusInfo.color}40`,
          }}>
            <span style={{ fontSize: isMobile ? '16px' : '20px' }}>{playoffStatusInfo.icon}</span>
            <span style={{
              fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
              color: playoffStatusInfo.color,
              fontWeight: cssVars.fontWeights.semibold,
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
                    <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold }}>
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
                            background: cssVars.colors.primaryLight,
                            borderRadius: '12px',
                            fontSize: cssVars.fontSizes.xs,
                            color: cssVars.colors.primary,
                            fontWeight: cssVars.fontWeights.semibold,
                          }}>
                            {placement.matchLabel ?? 'Playoff'}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: cssVars.fontSizes.xs,
                            color: cssVars.colors.textSecondary,
                          }}>
                            Gruppenphase
                          </span>
                        )}
                      </td>
                    )}
                    {hasGroups && (
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: cssVars.fontWeights.semibold }}>
                        {placement.team.group ? getGroupShortCode(placement.team.group, tournament) : '-'}
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {standing?.played ?? '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <HighlightedCell highlight={highlightWins}>
                        {standing?.won ?? '-'}
                      </HighlightedCell>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {standing?.drawn ?? '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {standing?.lost ?? '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <HighlightedCell highlight={highlightGoalsFor || highlightGoalsAgainst}>
                        {standing ? `${standing.goalsFor}:${standing.goalsAgainst}` : '-'}
                      </HighlightedCell>
                    </td>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'center',
                      color: goalDiff > 0 ? cssVars.colors.primary : goalDiff < 0 ? cssVars.colors.error : cssVars.colors.textSecondary,
                    }}>
                      <HighlightedCell highlight={highlightGoalDiff} baseWeight="semibold">
                        {standing ? (goalDiff > 0 ? '+' : '') + goalDiff : '-'}
                      </HighlightedCell>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <HighlightedCell highlight={highlightPoints} baseWeight="bold" fontSize="lg">
                        {standing?.points ?? '-'}
                      </HighlightedCell>
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
                      <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>
                        {placement.team.name}
                        {placement.decidedBy === 'playoff' ? (
                          <div style={{
                            fontSize: fontSizesMd3.statLabel,
                            color: cssVars.colors.primary,
                            marginTop: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}>
                            {placement.matchLabel ?? 'Playoff'}
                          </div>
                        ) : hasGroups && placement.team.group ? (
                          <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '2px' }}>
                            {getGroupShortCode(placement.team.group, tournament)}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <HighlightedCell highlight={highlightPoints} baseWeight="bold" fontSize="lg">
                          {standing?.points ?? '-'}
                        </HighlightedCell>
                      </td>
                      <td style={{
                        ...tdStyle,
                        textAlign: 'center',
                        color: goalDiff > 0 ? cssVars.colors.primary : goalDiff < 0 ? cssVars.colors.error : cssVars.colors.textSecondary,
                      }}>
                        <HighlightedCell highlight={highlightGoalDiff} baseWeight="semibold" fontSize="md">
                          {standing ? (goalDiff > 0 ? '+' : '') + goalDiff : '-'}
                        </HighlightedCell>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', padding: '10px 4px' }}>
                        <span style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.primary }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && standing && (
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
                              <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
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
                              <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                                {standing.goalsFor}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                              <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>Tore kassiert</div>
                              <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
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
            padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.xxl,
            color: cssVars.colors.textSecondary,
            fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
          }}>
            Noch keine Ergebnisse vorhanden.
            <br />
            Die Platzierung wird nach den ersten Spielen angezeigt.
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={containerStyle}>
      {/* Fullscreen Button (only in ranking view) */}
      {viewMode === 'ranking' && (
        <button onClick={toggleFullscreen} style={fullscreenButtonStyle}>
          {isFullscreen ? '✕ Vollbild beenden' : '⛶ Vollbild'}
        </button>
      )}

      <Card>
        {/* Segment Control */}
        <div style={segmentContainerStyle}>
          <div style={segmentGroupStyle}>
            <button
              style={getSegmentButtonStyle(viewMode === 'groups')}
              onClick={() => setViewMode('groups')}
            >
              Gruppen
            </button>
            <button
              style={getSegmentButtonStyle(viewMode === 'ranking')}
              onClick={() => setViewMode('ranking')}
            >
              Gesamtplatzierung
            </button>
          </div>
        </div>

        {/* View Content */}
        {viewMode === 'groups' ? renderGroupsView() : renderRankingView()}
      </Card>
    </div>
  );
};

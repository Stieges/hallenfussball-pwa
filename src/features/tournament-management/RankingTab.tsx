/**
 * RankingTab - Finale Platzierung des Turniers
 *
 * Zeigt die Endplatzierung basierend auf:
 * - Gruppenturniere: Gruppensieger, dann best platzierte
 * - Jeder-gegen-Jeden: Finale Tabelle
 * - Mit Playoffs: Playoff-Ergebnisse
 */

import { CSSProperties, useState } from 'react';
import { theme } from '../../styles/theme';
import { Card } from '../../components/ui';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { calculateStandings } from '../../utils/calculations';

interface RankingTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
}

export const RankingTab: React.FC<RankingTabProps> = ({
  tournament,
  currentStandings,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasGroups = tournament.teams.some(t => t.group);
  const hasPlayoffs = tournament.finals && typeof tournament.finals === 'object' && 'enabled' in tournament.finals && tournament.finals.enabled;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.xxl,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  };

  const rankingTableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.fontSizes.md,
  };

  const thStyle: CSSProperties = {
    background: theme.colors.primary,
    color: theme.colors.background,
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: theme.fontWeights.semibold,
    borderBottom: `2px solid ${theme.colors.border}`,
  };

  const tdStyle: CSSProperties = {
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.text.primary,
  };

  const medalStyle = (rank: number): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontWeight: theme.fontWeights.bold,
    fontSize: theme.fontSizes.md,
    background: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : theme.colors.surface,
    color: rank <= 3 ? '#000' : theme.colors.text.primary,
  });

  const fullscreenButtonStyle: CSSProperties = {
    position: 'fixed',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    background: 'rgba(0, 230, 118, 0.15)',
    border: `1px solid ${theme.colors.primary}`,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.primary,
    fontSize: theme.fontSizes.md,
    fontWeight: theme.fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: 'all 0.2s ease',
    zIndex: 1000,
  };

  // Berechne finale Platzierung
  const getFinalRanking = (): Standing[] => {
    if (!hasGroups) {
      // Jeder-gegen-Jeden: Verwende die bereits sortierten currentStandings
      // (calculateStandings verwendet bereits tournament.placementLogic)
      return currentStandings;
    }

    // Gruppenturniere: Erst Gruppensieger, dann beste Zweite, etc.
    const groups = Array.from(new Set(tournament.teams.map(t => t.group).filter(Boolean)));
    const ranking: Standing[] = [];

    // Berechne Standings pro Gruppe
    const groupStandingsMap = new Map<string, Standing[]>();
    groups.forEach(group => {
      if (!group) return;
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
        if (!group) return;
        const standings = groupStandingsMap.get(group);
        if (standings && standings[position]) {
          teamsAtPosition.push(standings[position]);
        }
      });

      // Sortiere Teams auf gleicher Position nach Platzierungslogik
      // (vergleiche nur gruppenübergreifend, nicht innerhalb der Gruppe)
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

  const finalRanking = getFinalRanking();

  return (
    <div style={containerStyle}>
      {/* Fullscreen Button */}
      <button onClick={toggleFullscreen} style={fullscreenButtonStyle}>
        {isFullscreen ? '✕ Vollbild beenden' : '⛶ Vollbild'}
      </button>

      <Card>
        <div style={{ padding: theme.spacing.lg }}>
          <h2 style={titleStyle}>🏆 Finale Platzierung</h2>

          {hasPlayoffs ? (
            <div style={{
              textAlign: 'center' as const,
              color: theme.colors.text.secondary,
              marginBottom: theme.spacing.lg,
              fontSize: theme.fontSizes.sm,
            }}>
              ℹ️ Die finale Platzierung wird nach Abschluss der Playoffs aktualisiert
            </div>
          ) : null}

          <table style={rankingTableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Platz</th>
                <th style={thStyle}>Team</th>
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
              {finalRanking.map((standing, index) => {
                const rank = index + 1;
                const goalDiff = standing.goalsFor - standing.goalsAgainst;

                // Prüfe, welche Kriterien in der Platzierungslogik aktiv sind
                const enabledCriteria = tournament.placementLogic.filter(c => c.enabled && c.id !== 'directComparison');
                const highlightPoints = enabledCriteria.some(c => c.id === 'points');
                const highlightWins = enabledCriteria.some(c => c.id === 'wins');
                const highlightGoalDiff = enabledCriteria.some(c => c.id === 'goalDifference');
                const highlightGoalsFor = enabledCriteria.some(c => c.id === 'goalsFor');
                const highlightGoalsAgainst = enabledCriteria.some(c => c.id === 'goalsAgainst');

                return (
                  <tr key={`${standing.team.id}-${standing.team.group || 'nogroup'}`}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={medalStyle(rank)}>{rank}</div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: theme.fontWeights.semibold }}>
                      {standing.team.name}
                    </td>
                    {hasGroups && (
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: theme.fontWeights.semibold }}>
                        {standing.team.group || '-'}
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {standing.played}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        fontWeight: highlightWins ? theme.fontWeights.bold : theme.fontWeights.normal,
                        padding: highlightWins ? '2px 8px' : '0',
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
                        padding: (highlightGoalsFor || highlightGoalsAgainst) ? '2px 8px' : '0',
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
                        padding: highlightGoalDiff ? '2px 8px' : '0',
                        background: highlightGoalDiff ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        borderRadius: highlightGoalDiff ? '4px' : '0',
                      }}>
                        {goalDiff > 0 ? '+' : ''}{goalDiff}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{
                        fontWeight: theme.fontWeights.bold,
                        fontSize: theme.fontSizes.lg,
                        padding: highlightPoints ? '2px 8px' : '0',
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

          {finalRanking.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: theme.spacing.xxl,
              color: theme.colors.text.secondary,
              fontSize: theme.fontSizes.lg,
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

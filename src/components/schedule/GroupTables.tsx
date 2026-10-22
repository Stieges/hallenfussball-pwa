/**
 * GroupTables - Displays group standings tables in MeinTurnierplan style
 * Fully responsive with mobile condensed view and expandable rows
 * Uses CSS media queries for responsive layout (no isMobile prop needed)
 */

import { CSSProperties, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, breakpointValues } from '../../design-tokens'
import { Standing, TeamLogo, TeamColors } from '../../types/tournament';
import type { ScheduleSource } from './scheduleSource';
import { getGroupDisplayName } from '../../utils/displayNames';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';
import { standingsGroups, OVERALL_GROUP } from '../../core/models/standingsGroups';
import { TeamAvatar } from '../ui/TeamAvatar';
import styles from './GroupTables.module.css';

interface GroupTablesProps {
  standings: Standing[];
  teams: Array<{ id: string; name: string; group?: string; logo?: TeamLogo; colors?: TeamColors }>;
  tournament?: ScheduleSource;
  /** Set of team IDs currently involved in a running match */
  activeMatchTeamIds?: Set<string>;
  /**
   * Paket TB-B (TB-6b): `app` zeigt Gleichstände mit Marke und Hinweis (Turnierleitung, Helfer), `public` nur Reihenfolge und
   * gemeinsame Platzziffer (Zuschauer, Monitor; @W2A-059). Vorgabe `public`.
   */
  tieDisplay?: 'app' | 'public';
  /** Nur bei `app`: Hinweise einer Gruppe (`''` = Jeder gegen jeden) und Marke je Team. */
  renderTieHint?: (groupId: string) => ReactNode;
  renderTieMarker?: (teamId: string, groupId: string) => ReactNode;
}

export const GroupTables: React.FC<GroupTablesProps> = ({
  standings,
  teams,
  tournament,
  activeMatchTeamIds,
  tieDisplay = 'public',
  renderTieHint,
  renderTieMarker,
}) => {
  const { t } = useTranslation('tournament');
  const groupStandings = getGroupStandings(standings, teams);
  const tieApp = tieDisplay === 'app';

  if (groupStandings.length === 0) {
    return (
      <div className="group-tables-empty" style={{
        textAlign: 'center',
        padding: '48px 24px',
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.lg,
      }}>
        {t('groupTables.empty.noGames')}
        <br />
        {t('groupTables.empty.showAfterGames')}
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
            title={group === OVERALL_GROUP ? t('groupTables.overall') : getGroupDisplayName(group, tournament)}
            tournament={tournament}
            activeMatchTeamIds={activeMatchTeamIds}
            tieHint={tieApp ? renderTieHint?.(group) : undefined}
            tieMarker={tieApp && renderTieMarker ? (teamId) => renderTieMarker(teamId, group) : undefined}
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
            padding: 0 !important;
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
  tournament?: ScheduleSource;
  activeMatchTeamIds?: Set<string>;
  /** TB-6b: Hinweise der Gruppe über der Tabelle und Marke unter dem Teamnamen (nur Ansicht `app`). */
  tieHint?: ReactNode;
  tieMarker?: (teamId: string) => ReactNode;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title, tournament, activeMatchTeamIds, tieHint, tieMarker }) => {
  const { t } = useTranslation('tournament');
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

  // Mobil (@ZM-088): Platz/Punkte/Differenz/Pfeil nehmen nur so viel Breite wie ihr Inhalt (statt fester Pixelbreiten),
  // der Rest gehört der Teamspalte – Teamnamen brechen nur an Leerzeichen, nie mitten im Wort.
  const mobileThStyle: CSSProperties = { ...thStyle, paddingLeft: cssVars.spacing.xs, paddingRight: cssVars.spacing.xs };
  const mobileTdStyle: CSSProperties = { ...tdStyle, paddingLeft: cssVars.spacing.xs, paddingRight: cssVars.spacing.xs };
  const mobileFixedColStyle: CSSProperties = { ...mobileThStyle, textAlign: 'center', whiteSpace: 'nowrap' };

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
      {tieHint}

      {/* Desktop Table View - hidden on mobile via CSS */}
      <div className="desktop-view" style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t('groupTables.columns.rank')}</th>
              <th style={thStyle}>{t('groupTables.columns.team')}</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t('groupTables.columns.played')}</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t('groupTables.columns.won')}</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t('groupTables.columns.drawn')}</th>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t('groupTables.columns.lost')}</th>
              <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>{t('groupTables.columns.goals')}</th>
              <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>{t('groupTables.columns.diff')}</th>
              <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>{t('groupTables.columns.points')}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const rank = standing.place ?? index + 1; // Paket TB: gemeinsame Ziffer mit Sprung (2, 2, 4), @W2A-047
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
                          title={t('groupTables.currentlyPlaying')}
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
                    {tieMarker?.(standing.team.id)}
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
      {/* overflowX: nur bei sehr langen Wörtern scrollt die Tabelle im Kasten; tabIndex/role/aria-label machen den Bereich per Tastatur erreichbar (axe scrollable-region-focusable) */}
      <div className="mobile-view" style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label={title}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...mobileFixedColStyle, width: '1%' }}>{t('groupTables.columns.rank')}</th>
              <th style={mobileThStyle}>{t('groupTables.columns.team')}</th>
              <th style={{ ...mobileFixedColStyle, width: '1%' }}>{t('groupTables.columns.points')}</th>
              <th style={{ ...mobileFixedColStyle, width: '1%' }}>{t('groupTables.columns.diff')}</th>
              <th style={{ ...mobileFixedColStyle, width: '1%' }}></th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => {
              const rank = standing.place ?? index + 1; // Paket TB: gemeinsame Ziffer mit Sprung (2, 2, 4), @W2A-047
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
                    <td style={{ ...mobileTdStyle, textAlign: 'center', fontWeight: cssVars.fontWeights.bold }}>
                      {rank}
                    </td>
                    <td style={{ ...mobileTdStyle, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: cssVars.spacing.xs,
                        // MOBILE-UX / @ZM-088: keine Kürzung; Umbruch nur an Leerzeichen und Bindestrichen, nie mitten im Wort (hyphens:auto ist ausserhalb Fliesstext verboten)
                        wordBreak: 'normal',
                        overflowWrap: 'normal',
                        hyphens: 'manual',
                      }}>
                        <TeamAvatar team={standing.team} size="xs" />
                        {/* @ZM-169: nur hier Vereinskürzel nach der Monitor-Liste; Desktop-Tabelle und Spielkarten zeigen den vollen Namen */}
                        {monitorTeamName(standing.team.name)}
                        {/* LIVE INDICATOR */}
                        {activeMatchTeamIds?.has(standing.team.id) && (
                          <span
                            title={t('groupTables.currentlyPlaying')}
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
                    <td style={{ ...mobileTdStyle, textAlign: 'center' }}>
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
                      ...mobileTdStyle,
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
                    <td style={{ ...mobileTdStyle, textAlign: 'center', paddingLeft: 0, paddingRight: 0 }}>
                      <span style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.primary }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </td>
                  </tr>
                  {/* TB-6b: auf dem Handy eigene Zeile über die volle Breite (nicht in der schmalen Teamspalte) */}
                  {tieMarker !== undefined && tieMarker(standing.team.id) !== null && (
                    <tr key={`${teamKey}-marke`} data-testid="tie-marker-row">
                      <td colSpan={5} style={{ ...mobileTdStyle, textAlign: 'left' }}>{tieMarker(standing.team.id)}</td>
                    </tr>
                  )}
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
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>{t('groupTables.details.played')}</div>
                            <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                              {standing.played}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>{t('groupTables.details.wins')}</div>
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
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>{t('groupTables.details.draws')}</div>
                            <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                              {standing.drawn}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>{t('groupTables.details.losses')}</div>
                            <div style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
                              {standing.lost}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', gridColumn: 'span 2' }}>
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>{t('groupTables.details.goalsFor')}</div>
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
                            <div style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs, marginBottom: '4px' }}>{t('groupTables.details.goalsAgainst')}</div>
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
            padding: var(--spacing-xs) !important;
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
            padding: var(--spacing-sm) var(--spacing-xs);
          }
          .standings-table th {
            font-size: 12px;
          }
        }

        /* Sehr schmale Handys (320-360): Teamspalte bekommt jeden Bildpunkt (@ZM-088, @OB-060) */
        @media (max-width: ${breakpointValues.narrowPhone}px) {
          .standings-table {
            padding-left: 0 !important;
            padding-right: 0 !important;
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

/** Eine Tabelle je Gruppe; ein Turnier ohne Gruppen ist eine Gruppe mit allen Teams (`standingsGroups`). */
function getGroupStandings(
  allStandings: Standing[],
  teams: Array<{ id: string; name: string; group?: string }>
): Array<{ group: string; groupStandings: Standing[] }> {
  return standingsGroups(teams).map(({ group, teams: groupTeams }) => ({
    group,
    groupStandings: allStandings.filter(s => groupTeams.some(team => team.id === s.team.id)),
  }));
}

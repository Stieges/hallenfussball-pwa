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
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { Card } from '../../components/ui';
import { GroupTables } from '../../components/schedule';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Tournament, Standing } from '../../types/tournament';
import { GeneratedSchedule } from '../../core/generators';
import {
  calculateStandings,
  getMergedFinalRanking, hasFinalRound,
} from '../../utils/calculations';
import { groupKeyOf } from '../../core/models/standingsGroups';
import { computeFinalStandings } from '../../core/standings/finalStandings';
import { resolvePlacementCriterionLabel } from '../tournament-creation/components/placementLogicLabels';
import { useTieRenderers } from './standings/useTieRenderers';
import { GroupCompletionTop } from './group-completion/GroupCompletionTop';
import { GroupStateDetails, GroupStateMarks } from './group-completion/GroupStateHead';
import { istEineTabelle, medalForRank, type Medal, tabellenAnsichtVorgabe, type TabellenAnsicht } from './tabellenAnsicht';
import { RankingTables } from './ranking/RankingTables';
import { FinalStandingsPanel } from '../tournament-finish/components/FinalStandingsPanel';

export interface TabellenTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  /** Tabelle je Gruppe hintereinander (Platzziffer `place` aus der Rechnung, Paket TB). */
  currentStandings: Standing[];
  /** Gruppenübergreifende Gesamtwertung für den Endstand; fehlt sie, rechnet der Tab sie selbst (Paket TB, Plan 3.3). */
  overallStandings?: Standing[];
  /** Gewählte Ansicht (aus der Adresse, `TabellenTabMitAdresse`); ohne Angabe hält der Tab sie selbst. */
  view?: TabellenAnsicht;
  onViewChange?: (view: TabellenAnsicht) => void;
}

export const TabellenTab: React.FC<TabellenTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  overallStandings,
  view,
  onViewChange,
}) => {
  const { t } = useTranslation('tournament');
  const { t: tWizard } = useTranslation('wizard');
  const isMobile = useIsMobile();
  const [localView, setLocalView] = useState<TabellenAnsicht>(tabellenAnsichtVorgabe(tournament));
  // R3-5: nach dem Abschluss gilt nur der gespeicherte Endstand; die errechnete Gesamtplatzierung gibt es dann nicht mehr (@ET-045)
  const finished = tournament.lifecycleStatus === 'finished';
  const chosenView = view ?? localView;
  const viewMode: TabellenAnsicht = finished && chosenView === 'ranking' ? 'final' : chosenView;
  const setViewMode = (next: TabellenAnsicht) => { (onViewChange ?? setLocalView)(next); };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const tieUi = useTieRenderers(tournament); // Paket TB-B: Hinweis und Marke bei Gleichstand (nur App-Ansicht)
  const singleTable = istEineTabelle(tournament); // Turniermodus „Jeder gegen jeden“, nicht die Gruppe der Teams (Review N1)
  const hasGroups = !singleTable;
  const hasPlayoffs = hasFinalRound(tournament); // Nachzug F1 A-36b: aus dem Turniermodell, nicht finals.enabled

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
    gap: cssVars.spacing.xs, // F-10: die Segmente berühren sich nicht
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.xs,
    border: `1px solid ${cssVars.colors.borderControl}`,
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
    minHeight: cssVars.touchTargets.minimum, // Touch-Ziel ≥ 44 px (R3-5, visual:metrics touch.min)
  });

  // ============================================================================
  // GROUPS VIEW (from TableTab)
  // ============================================================================

  const renderGroupsView = () => {
    return (
      <GroupTables
        standings={currentStandings}
        teams={schedule.teams}
        tournament={tournament}
        tieDisplay="app"
        renderTieHint={tieUi.hint}
        renderTieMarker={tieUi.marker}
        renderGroupState={(groupId) => ({ marks: <GroupStateMarks groupId={groupId} />, below: <GroupStateDetails groupId={groupId} /> })}
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
      overallStandings ?? calculateStandings(tournament.teams, tournament.matches, tournament),
      tournament
    );
  }, [overallStandings, tournament]);

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

  const roundRobinRanking = useMemo(() => computeFinalStandings(tournament).ranking, [tournament]);

  // Berechne finale Platzierung (Legacy-Funktion für Fallback)
  const getGroupBasedRanking = (): Standing[] => {
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

  // A-19a: Jeder gegen jeden zeigt den Endstand (Gruppenabschluss, Platzziffern mit Sprung, ohne entfernte Teams, @ET-022/@ET-058)
  const finalRanking = hasPlayoffs ? mergedRanking : hasGroups
    ? getGroupBasedRanking().map((standing, index) => ({ rank: index + 1, team: standing.team, decidedBy: 'groupStage' as const }))
    : roundRobinRanking.flatMap((row) => tournament.teams.filter((team) => team.id === row.teamId)
      .map((team) => ({ rank: row.place, team, decidedBy: 'groupStage' as const })));

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
        text: t('ranking.playoffNotStarted'),
        color: cssVars.colors.textSecondary,
        bgColor: cssVars.colors.neutralStatusBg,
        borderColor: cssVars.colors.borderSubtle,
      };
    } else if (playoffStatus === 'in-progress') {
      return {
        icon: '▶',
        text: t('ranking.playoffInProgress', { completed: completedFinalsCount, total: totalFinalsCount }),
        color: cssVars.colors.warning,
        bgColor: cssVars.colors.warningBannerBgStrong,
        borderColor: cssVars.colors.warningBorderStrong,
      };
    } else {
      return {
        icon: '✅',
        text: t('ranking.tournamentCompleted'),
        color: cssVars.colors.primary,
        bgColor: cssVars.colors.editorEditModeBg,
        borderColor: cssVars.colors.primaryBorderStrong,
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

  // @W2A-076: Solange der Platz als „Gleichstand – Entscheidung nötig“ / „Strafstoßschießen nötig“ offen ist, gibt es keine Medaille
  const medalOf = (placement: { rank: number; team: { id: string; group?: string }; decidedBy: string }): Medal =>
    placement.decidedBy === 'groupStage' && tieUi.isOpen(placement.team.id, hasGroups ? groupKeyOf(placement.team.group) : '') ? 'none' : medalForRank(placement.rank);

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
        {/* Gleichstand bei Jeder gegen jeden (eine Tabelle ohne Gruppen), Paket TB-B: ganz oben, die Taste bleibt ohne Scrollen erreichbar */}
        {!hasGroups && (
          <div style={{ marginBottom: cssVars.spacing.md }} data-testid="group-head-all">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, marginBottom: cssVars.spacing.sm }}>
              <GroupStateMarks groupId="" />
            </div>
            <GroupStateDetails groupId="" />
          </div>
        )}
        {!hasGroups && tieUi.hint('')}
        <h2 style={titleStyle}>{t('ranking.title')}</h2>

        {/* Platzierungslogik Anzeige */}
        <div style={{
          marginBottom: cssVars.spacing.lg,
          padding: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
          background: cssVars.colors.rankingPlacementBg,
          borderRadius: cssVars.borderRadius.md,
          border: `1px solid ${cssVars.colors.primaryBorderStrong}`,
        }}>
          <div style={{
            fontSize: cssVars.fontSizes.sm,
            fontWeight: cssVars.fontWeights.semibold,
            color: cssVars.colors.primary,
            marginBottom: '6px',
          }}>
            {t('ranking.placementLogic')}
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
                    {index + 1}. {resolvePlacementCriterionLabel(tWizard, criterion)}
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
            border: `1px solid ${playoffStatusInfo.borderColor}`,
          }}>
            <span style={{ fontSize: isMobile ? '16px' : '20px' }}>{playoffStatusInfo.icon}</span>
            <span style={{
              fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
              color: cssVars.colors.textPrimary, // F1-W3b: Kontrast ≥ 4,5:1, Farbe nur an Symbol und Rand
              fontWeight: cssVars.fontWeights.semibold,
            }}>
              {playoffStatusInfo.text}
            </span>
          </div>
        )}

        <RankingTables
          finalRanking={finalRanking}
          getStanding={getStanding}
          tournament={tournament}
          hasGroups={hasGroups}
          hasPlayoffs={hasPlayoffs}
          isMobile={isMobile}
          medalOf={medalOf}
          tieMarker={(teamId) => tieUi.marker(teamId, '')}
          expandedRows={expandedRows}
          onToggleRow={toggleRowExpansion}
        />

        {finalRanking.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: isMobile ? cssVars.spacing.lg : cssVars.spacing.xxl,
            color: cssVars.colors.textSecondary,
            fontSize: isMobile ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
          }}>
            {t('ranking.noResults')}
            <br />
            {t('ranking.noResultsInfo')}
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
          {isFullscreen ? t('ranking.exitFullscreen') : t('ranking.fullscreen')}
        </button>
      )}

      {/* Handy: schmales Polster der Karte (statt xl), damit der Tabelle Breite für Name, Sp., Diff., Pkt. und Taste bleibt (@ZM-205) */}
      <Card style={isMobile ? { padding: cssVars.spacing.sm } : undefined}>
        {/* GA4 A-13c: Zustand der Phasen und Vorschlag „Gruppe abschließen“ (nur Turnierleitung), nicht im Verwaltungskopf */}
        <GroupCompletionTop />
        {/* Segment Control */}
        <div style={segmentContainerStyle}>
          <div style={segmentGroupStyle}>
            <button
              style={getSegmentButtonStyle(viewMode === 'groups')}
              onClick={() => setViewMode('groups')}
            >
              {singleTable ? t('tables.single') : t('tables.groups')}
            </button>
            {!finished && (
              <button
                style={getSegmentButtonStyle(viewMode === 'ranking')}
                onClick={() => setViewMode('ranking')}
              >
                {t('ranking.title')}
              </button>
            )}
            <button
              style={getSegmentButtonStyle(viewMode === 'final')}
              onClick={() => setViewMode('final')}
              data-testid="tabellen-view-final"
            >
              {t('finalStandings.tab')}
            </button>
          </div>
        </div>

        {/* View Content */}
        {viewMode === 'groups' && renderGroupsView()}
        {viewMode === 'ranking' && renderRankingView()}
        {viewMode === 'final' && (
          <FinalStandingsPanel tournament={tournament} schedule={schedule} standings={currentStandings} />
        )}
      </Card>
    </div>
  );
};

/**
 * GroupTables - Displays group standings tables in MeinTurnierplan style
 * Fully responsive with mobile condensed view and expandable rows
 * Uses CSS media queries for responsive layout (no isMobile prop needed)
 */

import { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, breakpointValues } from '../../design-tokens'
import { Standing, TeamLogo, TeamColors } from '../../types/tournament';
import type { ScheduleSource } from './scheduleSource';
import { getGroupDisplayName } from '../../utils/displayNames';
import { standingsGroups, OVERALL_GROUP } from '../../core/models/standingsGroups';
import { GroupStandingsDesktopTable } from './GroupStandingsDesktopTable';
import { GroupStandingsMobileTable } from './GroupStandingsMobileTable';
import { placementHighlights } from './groupTablesStyle';
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
  /** Nur bei `public` (@W2A-059): kurze Markierung eines offenen Gleichstands unter dem Teamnamen, ohne Erklärtext. */
  renderPublicTieMarker?: (teamId: string, groupId: string) => ReactNode;
  /**
   * GA4 A-13c: Zustandsmarken neben dem Gruppennamen (`marks`) und Zähler, gesperrte Taste und Abschluss-Hinweis darunter (`below`);
   * nur bei `app`. `null` = nichts für diese Gruppe.
   */
  renderGroupState?: (groupId: string) => { marks: ReactNode; below: ReactNode } | null;
}

export const GroupTables: React.FC<GroupTablesProps> = ({
  standings,
  teams,
  tournament,
  activeMatchTeamIds,
  tieDisplay = 'public',
  renderTieHint,
  renderTieMarker,
  renderPublicTieMarker,
  renderGroupState,
}) => {
  const { t } = useTranslation('tournament');
  const groupStandings = getGroupStandings(standings, teams);
  const tieApp = tieDisplay === 'app';
  const tieMarkerFor = (group: string): ((teamId: string) => ReactNode) | undefined =>
    tieApp && renderTieMarker ? (teamId) => renderTieMarker(teamId, group) : undefined;
  const publicTieMarkerFor = (group: string): ((teamId: string) => ReactNode) | undefined =>
    !tieApp && renderPublicTieMarker ? (teamId) => renderPublicTieMarker(teamId, group) : undefined;

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
    <div style={{ padding: cssVars.spacing.lg, minWidth: 0, maxWidth: '100%' }} className="group-tables-container">
      <div className={`${styles.tablesGrid} ${gridClass}`}>
        {groupStandings.map(({ group, groupStandings: groupTeams }) => (
          <StandingsTable
            key={group}
            standings={groupTeams}
            title={group === OVERALL_GROUP ? t('groupTables.overall') : getGroupDisplayName(group, tournament)}
            tournament={tournament}
            activeMatchTeamIds={activeMatchTeamIds}
            tieHint={tieApp ? renderTieHint?.(group) : undefined}
            tieMarker={tieMarkerFor(group)}
            publicTieMarker={publicTieMarkerFor(group)}
            groupState={tieApp ? renderGroupState?.(group) ?? undefined : undefined}
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
  /** @W2A-059: Marke für Zuschauer, steht (Desktop wie Handy) in der Namenszelle unter dem Namen, nie als eigene Zeile. */
  publicTieMarker?: (teamId: string) => ReactNode;
  /** A-13c: Zustandsmarken neben dem Titel und Angaben darunter. */
  groupState?: { marks: ReactNode; below: ReactNode };
}

const containerStyle: CSSProperties = {
  background: cssVars.colors.background,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md,
  padding: cssVars.spacing.md,
  minWidth: 0,
  overflow: 'hidden',
};

const titleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.primary,
  marginBottom: cssVars.spacing.md,
};

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, title, tournament, activeMatchTeamIds, tieHint, tieMarker, publicTieMarker, groupState }) => {
  const highlights = placementHighlights(tournament);
  return (
    <div style={containerStyle} className="standings-table">
      {groupState === undefined ? <h3 style={titleStyle}>{title}</h3> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, marginBottom: cssVars.spacing.sm }}>
            <h3 style={{ ...titleStyle, marginBottom: 0 }}>{title}</h3>
            {groupState.marks}
          </div>
          <div style={{ marginBottom: cssVars.spacing.md }}>{groupState.below}</div>
        </>
      )}
      {tieHint}

      {/* Breite Ansicht - am Handy per CSS ausgeblendet */}
      <div className="desktop-view" style={{ overflowX: 'auto', position: 'relative' }}>
        <GroupStandingsDesktopTable
          standings={standings}
          highlights={highlights}
          activeMatchTeamIds={activeMatchTeamIds}
          nameMark={tieMarker ?? publicTieMarker}
        />
      </div>

      {/* Handy-Ansicht - in der breiten Ansicht per CSS ausgeblendet */}
      <GroupStandingsMobileTable
        standings={standings}
        title={title}
        highlights={highlights}
        activeMatchTeamIds={activeMatchTeamIds}
        publicTieMarker={publicTieMarker}
        tieMarker={tieMarker}
      />

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

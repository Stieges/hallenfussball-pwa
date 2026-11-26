/**
 * Karte einer Gruppentabelle (Titel, Zustandsmarken, breite und Handy-Tabelle). Aus `GroupTables.tsx` herausgelöst.
 */
import { CSSProperties, ReactNode } from 'react';
import { cssVars, breakpointValues } from '../../design-tokens';
import type { Standing } from '../../types/tournament';
import type { ScheduleSource } from './scheduleSource';
import { GroupStandingsDesktopTable } from './GroupStandingsDesktopTable';
import { GroupStandingsMobileTable } from './GroupStandingsMobileTable';
import { placementHighlights } from './groupTablesStyle';

export interface GroupStandingsCardProps {
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

export const GroupStandingsCard: React.FC<GroupStandingsCardProps> = ({ standings, title, tournament, activeMatchTeamIds, tieHint, tieMarker, publicTieMarker, groupState }) => {
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


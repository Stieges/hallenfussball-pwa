/**
 * LegacyPlayArea – heutige Spielfläche des Live-Cockpits (Scheibe 1, ohne Sichtänderung).
 *
 * Hinweis „Nächstes“, zwei Team-Spalten (`TeamColumn`, seit Aufgabe 3.3), `GameControls` und (ab
 * Desktop) die Ereignis-`Sidebar`. Uhr und Zustand zeigt seit Aufgabe 2.4 die Tafel (`ScoreboardArea`). Übergangsweise: die
 * Daumenleiste (3.6) und die Ereignisliste (4.1) ersetzen die Bausteine, 4.3 löscht den Bereich.
 */
import type { ReactElement } from 'react';
import type { Breakpoint } from '../../../hooks';
import type { ActivePenalty } from '../../../types/tournament';
import type { LiveMatch, MatchSummary } from '../types';
import { GameControls, Sidebar } from '../components';
import type { GameControlsProps, SidebarProps } from '../components';
import { TeamColumn, type TeamColumnProps } from './TeamColumn';
import styles from './LegacyAreas.module.css';

export interface LegacyPlayAreaProps {
  match: LiveMatch;
  nextMatch: MatchSummary | null;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isDesktop: boolean;
  /** readOnly oder beendetes Spiel: keine Bedienung. */
  isLocked: boolean;
  /** Die beiden Spalten in Anzeige-Reihenfolge (`useSideOrder`): wer links, wer rechts steht. */
  columns: { links: Omit<TeamColumnProps, 'kompakt' | 'breit'>; rechts: Omit<TeamColumnProps, 'kompakt' | 'breit'> };
  controls: Omit<GameControlsProps, 'status' | 'breakpoint' | 'disabled'>;
  sidebar: {
    activePenalties: ActivePenalty[];
    onEventEdit?: SidebarProps['onEventEdit'];
  };
}

const cls = (...names: Array<string | false>): string => names.filter(Boolean).join(' ');

export function LegacyPlayArea(props: LegacyPlayAreaProps): ReactElement {
  const { match, nextMatch, breakpoint, isMobile, isDesktop, isLocked, columns, controls, sidebar } = props;
  const spalte = (spaltenProps: LegacyPlayAreaProps['columns']['links']): ReactElement => (
    <TeamColumn {...spaltenProps} kompakt={isMobile} breit={isDesktop} />
  );

  return (
    <>
      {/* Next Banner */}
      {nextMatch && (
        <div className={styles.nextBanner}>
          <span className={styles.nextLabel}>Nächstes →</span>
          <span>
            {nextMatch.homeTeam.name} vs {nextMatch.awayTeam.name}
            {nextMatch.scheduledKickoff && ` (${nextMatch.scheduledKickoff})`}
          </span>
        </div>
      )}

      <div className={cls(styles.mainGrid, isDesktop && styles.mainGridDesktop)}>
        <div className={cls(styles.scoreboard, isMobile && styles.scoreboardMobile)}>
          {/* Team-Spalten – „Seiten tauschen“ vertauscht nur die Anzeige */}
          <div className={cls(styles.scoreRow, isMobile && styles.scoreRowMobile)}>
            {spalte(columns.links)}
            {spalte(columns.rechts)}
          </div>
          {/* Task R2: `disabled` sperrt Rückgängig/Start-Pause/Zeit/Seiten/Beenden bei
              readOnly/finished; Einstellungen und Ereignisprotokoll bleiben immer offen. */}
          <GameControls {...controls} status={match.status} breakpoint={breakpoint} disabled={isLocked} />
        </div>

        {/* Sidebar - Desktop only */}
        {isDesktop && (
          <Sidebar
            activePenalties={sidebar.activePenalties}
            events={match.events}
            retractedEvents={match.retractedEvents}
            homeTeamName={match.homeTeam.name}
            awayTeamName={match.awayTeam.name}
            homeTeamId={match.homeTeam.id}
            awayTeamId={match.awayTeam.id}
            // BUG-010 / Task R2 Fixrunde 2 (M2/Rule 1): Bearbeiten nur bei echter readOnly-Sperre
            // ausgeblendet (`undefined`), nicht bei beendetem Spiel allein.
            onEventEdit={sidebar.onEventEdit}
            matchId={match.id}
          />
        )}
      </div>
    </>
  );
}

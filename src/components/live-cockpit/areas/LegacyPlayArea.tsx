/**
 * LegacyPlayArea – heutige Spielfläche des Live-Cockpits (Scheibe 1, ohne Sichtänderung).
 *
 * Mobile Foul-Leiste, Hinweis „Nächstes“, Spieluhr, zwei `TeamBlock`, `GameControls` und (ab
 * Desktop) die Ereignis-`Sidebar`. Übergangsweise: die Team-Spalten (Aufgabe 3.3), die
 * Daumenleiste (3.6) und die Ereignisliste (4.1) ersetzen die Bausteine, 4.3 löscht den Bereich.
 */
import type { ReactElement } from 'react';
import type { Breakpoint } from '../../../hooks';
import type { TimerState } from '../../../hooks/useMatchTimer';
import type { ActivePenalty } from '../../../types/tournament';
import type { Side } from '../model/cockpitTypes';
import type { LiveMatch, MatchSummary } from '../types';
import { FoulBar, GameControls, Sidebar, TeamBlock } from '../components';
import type { GameControlsProps, SidebarProps, TeamBlockProps } from '../components';
import styles from './LegacyAreas.module.css';

/** Die acht Aktionen eines Team-Blocks, je Seite. */
export type TeamSideHandlers = Pick<
  TeamBlockProps,
  'onGoal' | 'onMinus' | 'onPenalty' | 'onYellowCard' | 'onYellowRedCard' | 'onRedCard' | 'onSubstitution' | 'onFoul'
>;

export interface LegacyPlayAreaProps {
  match: LiveMatch;
  nextMatch: MatchSummary | null;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isDesktop: boolean;
  /** readOnly oder beendetes Spiel: keine Bedienung. */
  isLocked: boolean;
  displaySeconds: number;
  timerState: TimerState;
  homeFouls: number;
  awayFouls: number;
  effectiveScore: { home: number; away: number };
  sidesSwapped: boolean;
  /** Klick auf die Spieluhr; `undefined`, wenn das Cockpit die Zeit nicht anpassen darf. */
  onTimerClick?: () => void;
  teams: {
    handlers: Record<Side, TeamSideHandlers>;
    /** Bedienbarkeit, Beschriftung mit Ziel und Hinweise je Seite (C3b-1). */
    extraProps: (side: Side) => Partial<TeamBlockProps>;
  };
  controls: Omit<GameControlsProps, 'status' | 'breakpoint' | 'disabled'>;
  sidebar: {
    activePenalties: ActivePenalty[];
    onEventEdit?: SidebarProps['onEventEdit'];
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const cls = (...names: Array<string | false>): string => names.filter(Boolean).join(' ');

export function LegacyPlayArea(props: LegacyPlayAreaProps): ReactElement {
  const { match, nextMatch, breakpoint, isMobile, isDesktop, isLocked, displaySeconds, timerState, homeFouls, awayFouls, effectiveScore, sidesSwapped, onTimerClick, teams, controls, sidebar } = props;
  const isNotStarted = match.status === 'NOT_STARTED';
  const foulsOf = (side: Side): number => (side === 'home' ? homeFouls : awayFouls);

  // Linkes/rechtes Team: „Seiten tauschen“ vertauscht nur die Anzeige.
  const renderTeam = (side: Side): ReactElement => (
    <TeamBlock
      teamName={side === 'home' ? match.homeTeam.name : match.awayTeam.name}
      teamLabel={side === 'home' ? 'Heim' : 'Gast'}
      score={side === 'home' ? effectiveScore.home : effectiveScore.away}
      fouls={foulsOf(side)}
      disabled={isLocked || isNotStarted}
      breakpoint={breakpoint}
      side={side}
      {...teams.handlers[side]}
      {...teams.extraProps(side)}
    />
  );

  return (
    <>
      {/* Foul Bar - Mobile only */}
      {isMobile && (
        <FoulBar
          homeTeamName={match.homeTeam.name}
          awayTeamName={match.awayTeam.name}
          homeFouls={homeFouls}
          awayFouls={awayFouls}
          variant="bar"
        />
      )}

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
          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>Spielzeit</span>
            <span
              className={cls(styles.timer, isMobile && styles.timerMobile)}
              data-timer-state={timerState}
              onClick={() => {
                // @OB-002 (Platzhalter Nr. 2): „Spielzeit anpassen“ für neue Spiele ausgeblendet
                if (onTimerClick && !isLocked && !isNotStarted) {
                  onTimerClick();
                }
              }}
              role="button"
              tabIndex={0}
              aria-disabled={isLocked}
              data-testid="match-timer-display"
            >
              {formatTime(displaySeconds)}
            </span>
            <span className={styles.timerTotal}>/ {formatTime(match.durationSeconds)}</span>
          </div>

          {/* Score Row - Teams können mit "Seiten tauschen" vertauscht werden */}
          <div className={cls(styles.scoreRow, isMobile && styles.scoreRowMobile)}>
            {renderTeam(sidesSwapped ? 'away' : 'home')}
            <span className={styles.scoreDivider}>:</span>
            {renderTeam(sidesSwapped ? 'home' : 'away')}
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
          />
        )}
      </div>
    </>
  );
}

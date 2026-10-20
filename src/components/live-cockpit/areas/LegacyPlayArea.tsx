/**
 * LegacyPlayArea – heutige Spielfläche des Live-Cockpits (Scheibe 1, ohne Sichtänderung).
 *
 * Hinweis „Nächstes“, zwei Team-Spalten (`TeamColumn`, seit Aufgabe 3.3) und (ab Desktop) die Ereignis-`Sidebar`.
 * Uhr und Zustand zeigt seit Aufgabe 2.4 die Tafel (`ScoreboardArea`), die Bedienung seit Aufgabe 3.6 die Daumenleiste
 * (`ThumbBarArea`, von der Hülle gerendert). Platz der Spalten je Zustand: Entscheidung offen zeigt keine, das
 * Strafstoßschießen seine Form (sonst die Spalten). Übergangsweise: die Ereignisliste (4.1) ersetzt die Sidebar, 4.3 löscht den Bereich.
 */
import type { ReactElement, ReactNode } from 'react';
import type { ActivePenalty } from '../../../types/tournament';
import type { LiveMatch, MatchSummary } from '../types';
import { Sidebar } from '../components';
import type { SidebarProps } from '../components';
import type { CockpitZustand } from '../model/cockpitPhase';
import { TeamColumn, type TeamColumnProps } from './TeamColumn';
import styles from './LegacyAreas.module.css';

export interface LegacyPlayAreaProps {
  match: LiveMatch;
  nextMatch: MatchSummary | null;
  isMobile: boolean;
  isDesktop: boolean;
  /** Zustand des Spiels: bestimmt den Platz der Spalten-Fläche. */
  zustand: CockpitZustand;
  /** Form des Strafstoßschießens (B-09b); ohne sie bleiben im Zustand `strafstoss` die Spalten stehen. */
  strafstossForm?: ReactNode;
  /** Die beiden Spalten in Anzeige-Reihenfolge (`useSideOrder`): wer links, wer rechts steht. */
  columns: { links: Omit<TeamColumnProps, 'kompakt' | 'breit'>; rechts: Omit<TeamColumnProps, 'kompakt' | 'breit'> };
  sidebar: {
    activePenalties: ActivePenalty[];
    onEventEdit?: SidebarProps['onEventEdit'];
  };
}

const cls = (...names: Array<string | false>): string => names.filter(Boolean).join(' ');

export function LegacyPlayArea(props: LegacyPlayAreaProps): ReactElement {
  const { match, nextMatch, isMobile, isDesktop, zustand, strafstossForm, columns, sidebar } = props;
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
          {zustand === 'strafstoss' && strafstossForm ? strafstossForm : zustand !== 'entscheidung' && (
            /* Team-Spalten – „Seiten tauschen“ vertauscht nur die Anzeige */
            <div className={cls(styles.scoreRow, isMobile && styles.scoreRowMobile)}>
              {spalte(columns.links)}
              {spalte(columns.rechts)}
            </div>
          )}
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

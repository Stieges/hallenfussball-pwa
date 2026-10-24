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
import type { LiveMatch } from '../types';
import { Sidebar } from '../components';
import type { SidebarProps } from '../components';
import type { CockpitZustand } from '../model/cockpitPhase';
import type { TeamSummaryModel } from '../model/toTeamSummaryModel';
import { TeamColumn, type TeamColumnProps } from './TeamColumn';
import { TeamSummary } from './TeamSummary';
import styles from './LegacyAreas.module.css';

export interface LegacyPlayAreaProps {
  match: LiveMatch;
  /** Zeile „Nächstes“ im Fluss unter der Tafel (LT-3, `NextMatchArea`). */
  naechstes?: ReactNode;
  isMobile: boolean;
  isDesktop: boolean;
  /** Tafel, Hinweise und Ausgangs-Meldung: stehen über den Spalten, im Laptop-Layout links neben der Liste (Mockup Rahmen a). */
  kopf: ReactNode;
  /** Zustand des Spiels: bestimmt den Platz der Spalten-Fläche. */
  zustand: CockpitZustand;
  /** Form des Strafstoßschießens (B-09b); ohne sie bleiben im Zustand `strafstoss` die Spalten stehen. */
  strafstossForm?: ReactNode;
  /** Die beiden Spalten in Anzeige-Reihenfolge (`useSideOrder`): wer links, wer rechts steht. */
  columns: { links: Omit<TeamColumnProps, 'kompakt' | 'breit'>; rechts: Omit<TeamColumnProps, 'kompakt' | 'breit'> };
  /** Nach dem Abpfiff statt der Tastenblöcke: Tore, Karten, Zeitstrafen, Fouls je Team (@SL-048); in Anzeige-Reihenfolge. */
  zusammenfassung?: { links: TeamSummaryModel; rechts: TeamSummaryModel } | null;
  sidebar: {
    activePenalties: ActivePenalty[];
    onEventEdit?: SidebarProps['onEventEdit'];
  };
}

const cls = (...names: Array<string | false>): string => names.filter(Boolean).join(' ');

export function LegacyPlayArea(props: LegacyPlayAreaProps): ReactElement {
  const { match, naechstes, isMobile, isDesktop, kopf, zustand, strafstossForm, columns, zusammenfassung, sidebar } = props;
  const spalte = (spaltenProps: LegacyPlayAreaProps['columns']['links']): ReactElement => (
    <TeamColumn {...spaltenProps} kompakt={isMobile} breit={isDesktop} />
  );

  return (
    <div className={cls(styles.flaeche, isDesktop && styles.flaecheBreit, !isDesktop && styles.flaecheDaumen)} data-testid="cockpit-flaeche">
      <div className={cls(styles.links, isDesktop && styles.linksBreit, isMobile && styles.linksMobile, !isDesktop && styles.linksDaumen)}>
        {kopf}
        {naechstes}
        <div data-testid="cockpit-tastenflaeche" className={cls(styles.scoreboard, isMobile && styles.scoreboardMobile, isDesktop && styles.scoreboardBreit, !isDesktop && styles.scoreboardDaumen)}>
          {zustand === 'strafstoss' && strafstossForm ? strafstossForm : zustand !== 'entscheidung' && (
            /* Team-Spalten – „Seiten tauschen“ vertauscht nur die Anzeige */
            <div className={cls(styles.scoreRow, isMobile && styles.scoreRowMobile)}>
              {zusammenfassung ? <TeamSummary model={zusammenfassung.links} breit={isDesktop} /> : spalte(columns.links)}
              {zusammenfassung ? <TeamSummary model={zusammenfassung.rechts} breit={isDesktop} /> : spalte(columns.rechts)}
            </div>
          )}
        </div>
      </div>

      {/* Liste der Einträge neben der Fläche – nur ab 1024 px, eigenes Scrollen (Plan LT-2) */}
      {isDesktop && (
        <div className={styles.ereignisse}>
          <Sidebar
            activePenalties={sidebar.activePenalties}
            events={match.events}
            retractedEvents={match.retractedEvents}
            discardedEntries={match.discardedEntries}
            homeTeamName={match.homeTeam.name}
            awayTeamName={match.awayTeam.name}
            homeTeamId={match.homeTeam.id}
            awayTeamId={match.awayTeam.id}
            // BUG-010 / Task R2 Fixrunde 2 (M2/Rule 1): Bearbeiten nur bei echter readOnly-Sperre
            // ausgeblendet (`undefined`), nicht bei beendetem Spiel allein.
            onEventEdit={sidebar.onEventEdit}
            matchId={match.id}
          />
        </div>
      )}
    </div>
  );
}

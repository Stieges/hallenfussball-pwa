/**
 * ScheduleListHead – Listenkopf über den Spielen der Turnierleitung (@ZP-113): „Spiele“ links, „Beginn 09:00 Uhr · Ende etwa 11:30 Uhr · 10 Minuten je Spiel“ rechts (die Spielzeit fiel mit der Eckdaten-Karte weg, Mockup Runde 4).
 * Ersetzt am Handy die Eckdaten-Karte mit acht Zeilen. Die Uhrzeiten sind die Wanduhr des Turniers (`kickoffLocal`, wie im übrigen Spielplan),
 * nie die Gerätezeit; reicht die Breite nicht, rutscht die nächste Angabe in die nächste Zeile; ist selbst eine Angabe breiter als die Zeile, bricht sie um (nichts wird abgeschnitten).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import styles from './ScheduleListHead.module.css';
import { kickoffLocal } from '../../core/view';
import type { GeneratedSchedule } from '../../core/generators';

export interface ScheduleListHeadProps {
  schedule: Pick<GeneratedSchedule, 'startTime' | 'endTime' | 'tournament' | 'phases'>;
}

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: cssVars.spacing.md,
  rowGap: cssVars.spacing.xs,
  margin: `${cssVars.spacing.md} 0 ${cssVars.spacing.sm}`,
};
const titleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.xl, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const timesStyle: CSSProperties = { fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };

export function ScheduleListHead({ schedule }: ScheduleListHeadProps): ReactElement {
  const { t } = useTranslation('tournament');
  const date = schedule.tournament.date;
  const start = kickoffLocal(date, schedule.startTime)?.time;
  const end = kickoffLocal(date, schedule.endTime)?.time;
  // Spielzeit wie in der Eckdaten-Karte (`TournamentHeader`): das erste Spiel der Gruppenphase
  const minutes = schedule.phases.find((p) => p.name === 'groupStage')?.matches[0]?.duration ?? 0;
  return (
    <div style={wrapStyle} data-testid="schedule-list-head">
      <h2 style={titleStyle}>{t('scheduleHead.title')}</h2>
      {start !== undefined && end !== undefined && (
        // Trenner kommen aus dem Stylesheet (nie als Textknoten): bricht eine Angabe um, steht kein Trenner lose in der Zeile
        <p className={styles.rahmen} style={timesStyle}>
          <span className={styles.reihe}>
            <span className={styles.teil} data-testid="schedule-list-start">{t('scheduleHead.start', { start })}</span>
            <span className={styles.teil} data-testid="schedule-list-end">{t('scheduleHead.end', { end })}</span>
            {minutes > 0 && (
              <span className={styles.teil} data-testid="schedule-list-duration">{t('scheduleHead.duration', { count: minutes })}</span>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

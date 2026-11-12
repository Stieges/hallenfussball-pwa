/**
 * ScheduleListHead – Listenkopf über den Spielen der Turnierleitung (@ZP-113): „Spiele“ links, „Beginn 09:00 Uhr · Ende etwa 11:30 Uhr“ rechts.
 * Ersetzt am Handy die Eckdaten-Karte mit acht Zeilen. Die Uhrzeiten sind die Wanduhr des Turniers (`kickoffLocal`, wie im übrigen Spielplan),
 * nie die Gerätezeit; reicht die Breite nicht, rutscht die Zeitangabe in die zweite Zeile (nichts wird abgeschnitten).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { kickoffLocal } from '../../core/view';
import type { GeneratedSchedule } from '../../core/generators';

export interface ScheduleListHeadProps {
  schedule: Pick<GeneratedSchedule, 'startTime' | 'endTime' | 'tournament'>;
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
const timesStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };

export function ScheduleListHead({ schedule }: ScheduleListHeadProps): ReactElement {
  const { t } = useTranslation('tournament');
  const date = schedule.tournament.date;
  const start = kickoffLocal(date, schedule.startTime)?.time;
  const end = kickoffLocal(date, schedule.endTime)?.time;
  return (
    <div style={wrapStyle} data-testid="schedule-list-head">
      <h2 style={titleStyle}>{t('scheduleHead.title')}</h2>
      {start !== undefined && end !== undefined && (
        <p style={timesStyle} data-testid="schedule-list-times">{t('scheduleHead.times', { start, end })}</p>
      )}
    </div>
  );
}

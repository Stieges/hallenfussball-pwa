/**
 * KickoffClock – Anstoßzeit der Live-Folie vor dem Anpfiff (@ZM-195): steht genau an der Stelle der Uhr, in Größe und Schrift der Uhr
 * (`matchTimerStyles`), mit „Anstoß“ darüber. Kästen, Namen und Uhr-Bereich liegen so wie nach dem Anpfiff; nichts rückt.
 */
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';
import { STUFEN, clockBoxStyle, containerStyle, labelRowStyle, labelStyle, timeStyle, type MatchTimerSize } from './matchTimerStyles';

export interface KickoffClockProps {
  /** „hh:mm“ in der Wanduhr des Turniers */
  time: string;
  size?: MatchTimerSize;
  theme?: MonitorTheme;
  /** Zusatzzeile unter der Uhrzeit, z. B. „(war 14:20)“ */
  notes?: ReactNode;
}

export function KickoffClock({ time, size = 'xl', theme = 'dark', notes }: KickoffClockProps): ReactElement {
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);
  const stufe = STUFEN[size];
  return (
    <div style={containerStyle(stufe)} data-testid="monitor-kickoff">
      <div style={labelRowStyle(size, stufe)}>
        <div style={labelStyle(stufe, themeColors)} data-testid="kickoff-label">{t('slides.live.kickoff')}</div>
      </div>
      <div style={clockBoxStyle(size)} data-testid="monitor-clock" data-phase="anstoss">
        <span style={timeStyle(stufe, themeColors, false)} data-monitor="uhr" data-testid="kickoff-time">{time}</span>
      </div>
      {notes}
    </div>
  );
}

/**
 * KickoffClock – Anstoßzeit der Live-Folie vor dem Anpfiff (@ZM-195, @ZM-215): steht genau an der Stelle der Uhr, in Größe und Schrift der Uhr
 * (`matchTimerStyles`), mit „Anstoß“ links daneben (wie die Wörter der laufenden Uhr). Kästen, Namen und Uhr-Bereich liegen so wie nach dem Anpfiff; nichts rückt.
 */
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';
import { STUFEN, clockBoxStyle, clockRowStyle, containerStyle, timeStyle, wordStyle, type MatchTimerSize } from './matchTimerStyles';

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
      <div style={clockRowStyle(size)}>
        <div style={wordStyle(stufe, themeColors)} data-testid="kickoff-label">{t('slides.live.kickoff')}</div>
        <div style={clockBoxStyle(size)} data-testid="monitor-clock" data-phase="anstoss">
          <span style={timeStyle(stufe, themeColors, false)} data-monitor="uhr" data-testid="kickoff-time">{time}</span>
        </div>
      </div>
      {notes}
    </div>
  );
}

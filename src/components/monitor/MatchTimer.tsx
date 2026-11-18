/**
 * MatchTimer – Uhr des Hallenmonitors (R5 PR 2; @ZM-176, @ZM-084, @ZM-139, @ZM-145, @ZM-165, @ZM-166, @ZM-137, @ME-031).
 *
 * - Restzeit des Abschnitts bzw. der Pause aus `monitorUhrOf` (core/view): Feinstatus `live_state` in Serverzeit,
 *   „jetzt“ aus `NowSourceContext` (die Monitor-Seite stellt Serverzeit bereit, C-MONITOR-UHR-RECHNER).
 * - Takt an der Sekundengrenze: die Anzeige wechselt kurz nach dem Sekundenwechsel der Spieluhr, nicht bis zu 1 s später.
 * - Sperre gegen Rückwärts je Uhr-Anker (`monitorUhrMitSperre`).
 * - Text über der Uhr: „Restzeit“ | „angehalten“ | „Pause · Halbzeit“ | „Pause“ | „Verlängerung“ | „Zeit abgelaufen“.
 * - Zeitbalken = `ui/atoms/ZeitBalken` (dieselbe Regel wie die Cockpit-Tafel): nimmt ab, nie Rot, keiner im
 *   Strafstoßschießen und nach dem Ende.
 *
 * Ohne Ansicht (`uhr` fehlt, Vorschau/Tests) gilt ein einziger Abschnitt der Länge `durationSeconds` aus den Zeitfeldern.
 */
import { useTranslation } from 'react-i18next';
import { useMonitorTheme } from '../../hooks';
import { formatRemaining } from '../../core/view';
import { ZeitBalken } from '../ui/atoms/ZeitBalken';
import { STUFEN, balkenRahmenStyle, clockBoxStyle, containerStyle, labelRowStyle, labelStyle, timeStyle } from './matchTimerStyles';
import { UHR_TEXT_KEY, useMonitorUhr, type MatchTimerProps } from './useMonitorUhr';

export type { MatchTimerProps, MatchTimerUhrQuelle } from './useMonitorUhr';

export const MatchTimer: React.FC<MatchTimerProps> = (props) => {
  const { size = 'lg', showProgress = true, theme = 'dark' } = props;
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);
  const uhr = useMonitorUhr(props);
  const stufe = STUFEN[size];

  return (
    <div style={containerStyle(stufe)}>
      <div style={labelRowStyle(size, stufe)} data-testid="clock-hints">
        {uhr && <div style={labelStyle(stufe, themeColors)} data-testid="clock-label" data-text={uhr.text}>{t(`liveMatch.clock.${UHR_TEXT_KEY[uhr.text]}`)}</div>}
      </div>
      {uhr?.restSekunden !== undefined && uhr.restSekunden !== null && (
        <div style={clockBoxStyle(size)} data-testid="monitor-clock" data-phase={uhr.schlussphase ? 'schlussphaseAngehalten' : uhr.text === 'zeitAbgelaufen' ? 'abgelaufen' : 'normal'}>
          <span style={timeStyle(stufe, themeColors, uhr.schlussphase)} data-monitor="uhr">{formatRemaining(uhr.restSekunden)}</span>
        </div>
      )}
      {showProgress && uhr?.balken && (
        <div style={balkenRahmenStyle(size, stufe)}>
          <ZeitBalken anteil={uhr.balken.anteil} ton={uhr.balken.ton} hoehe={stufe.progress} spur={themeColors.progressTrack} testId="monitor-zeitbalken" />
        </div>
      )}
    </div>
  );
};

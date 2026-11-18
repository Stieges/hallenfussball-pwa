/**
 * MatchTimer – Uhr des Hallenmonitors (R5 PR 2; @ZM-176, @ZM-084, @ZM-139, @ZM-145, @ZM-165, @ZM-166, @ZM-137, @ME-031).
 *
 * - Restzeit des Abschnitts bzw. der Pause aus `monitorUhrOf` (core/view): Feinstatus `live_state` in Serverzeit,
 *   „jetzt“ aus `NowSourceContext` (die Monitor-Seite stellt Serverzeit bereit, C-MONITOR-UHR-RECHNER).
 * - Takt an der Sekundengrenze: die Anzeige wechselt kurz nach dem Sekundenwechsel der Spieluhr, nicht bis zu 1 s später.
 * - Sperre gegen Rückwärts je Uhr-Anker (`monitorUhrMitSperre`).
 * - Wort neben der Uhr (@ZM-215): nur bei Abweichung vom laufenden Spiel, „angehalten“ | „Pause · Halbzeit“ | „Pause“ | „Verlängerung“ | „Zeit abgelaufen“;
 *   das Wort „Restzeit“ gibt es nicht, über der Uhr steht nichts.
 * - Zeitbalken = `ui/atoms/ZeitBalken` (dieselbe Regel wie die Cockpit-Tafel): beginnt voll und nimmt mit der Restzeit ab (links verankert), die abgelaufene Strecke
 *   bleibt als Bahn sichtbar (Farben `displayBar`, wie im Profil „Halle (sehr fern)“), nie Rot, keiner im Strafstoßschießen und nach dem Ende.
 *
 * Ohne Ansicht (`uhr` fehlt, Vorschau/Tests) gilt ein einziger Abschnitt der Länge `durationSeconds` aus den Zeitfeldern.
 */
import { useTranslation } from 'react-i18next';
import { useMonitorTheme } from '../../hooks';
import { displayBar } from '../../design-tokens';
import { formatRemaining } from '../../core/view';
import { ZeitBalken } from '../ui/atoms/ZeitBalken';
import { STUFEN, balkenRahmenStyle, clockBoxStyle, clockRowStyle, containerStyle, timeStyle, wordStyle } from './matchTimerStyles';
import { UHR_TEXT_KEY, useMonitorUhr, type MatchTimerProps } from './useMonitorUhr';

export type { MatchTimerProps, MatchTimerUhrQuelle } from './useMonitorUhr';

export const MatchTimer: React.FC<MatchTimerProps> = (props) => {
  const { size = 'lg', showProgress = true, theme = 'dark' } = props;
  const { t } = useTranslation('monitor');
  const { themeColors, resolvedTheme } = useMonitorTheme(theme);
  const uhr = useMonitorUhr(props);
  const stufe = STUFEN[size];

  const barColors = displayBar.colors[resolvedTheme === 'light' ? 'light' : 'dark'];
  // Ein Wort nur, wenn etwas anders ist als im laufenden Spiel (@ZM-215)
  const wort = uhr !== null && uhr.text !== 'restzeit' ? t(`liveMatch.clock.${UHR_TEXT_KEY[uhr.text]}`) : null;

  return (
    <div style={containerStyle(stufe)}>
      <div style={clockRowStyle(size)} data-testid="clock-row">
        {uhr !== null && wort !== null && <div style={wordStyle(stufe, themeColors)} data-testid="clock-label" data-text={uhr.text}>{wort}</div>}
        {uhr?.restSekunden !== undefined && uhr.restSekunden !== null && (
          <div style={clockBoxStyle(size)} data-testid="monitor-clock" data-phase={uhr.schlussphase ? 'schlussphaseAngehalten' : uhr.text === 'zeitAbgelaufen' ? 'abgelaufen' : 'normal'}>
            <span style={timeStyle(stufe, themeColors, uhr.schlussphase)} data-monitor="uhr">{formatRemaining(uhr.restSekunden)}</span>
          </div>
        )}
      </div>
      {showProgress && uhr?.balken && (
        <div style={balkenRahmenStyle(size, stufe)}>
          <ZeitBalken anteil={uhr.balken.anteil} ton={uhr.balken.ton} hoehe={stufe.progress} spur={barColors.track} farben={barColors} testId="monitor-zeitbalken" />
        </div>
      )}
    </div>
  );
};

/**
 * MatchTimer – Uhr des Hallenmonitors (R5 PR 2; @ZM-176, @ZM-084, @ZM-139, @ZM-145, @ZM-165, @ZM-166, @ZM-137, @ME-031).
 *
 * - Restzeit des Abschnitts bzw. der Pause aus `monitorUhrOf` (core/view): Feinstatus `live_state` in Serverzeit,
 *   „jetzt“ aus `NowSourceContext` (die Monitor-Seite stellt Serverzeit bereit, C-MONITOR-UHR-RECHNER).
 * - Takt an der Sekundengrenze: die Anzeige wechselt kurz nach dem Sekundenwechsel der Spieluhr, nicht bis zu 1 s später.
 * - Sperre gegen Rückwärts je Uhr-Anker (`monitorUhrMitSperre`).
 * - Symbol neben der Uhr (@ZM-215, Daniel 2026-11-19: Symbole statt Text): nur bei Abweichung vom laufenden Spiel, Pause-Symbol (angehalten, Ziffern gedämpft) | halber Kreis (Pause) |
 *   Pfeife (Zeit abgelaufen) | Kreis mit Plus (Verlängerung), jedes mit dem bisherigen Wort als zugänglichem Namen; rechts neben der Uhr die Punkte des Abschnitts (nur bei mehr als einem Abschnitt).
 *   Das Wort „Restzeit“ gibt es nicht, über der Uhr steht nichts; das Abzeichen oben links sagt nichts über die Uhr (`LiveHeader`).
 * - Zeitbalken = `ui/atoms/ZeitBalken` (dieselbe Regel wie die Cockpit-Tafel): beginnt voll und nimmt mit der Restzeit ab (links verankert), die abgelaufene Strecke
 *   bleibt als Bahn sichtbar (Farben `displayBar`, wie im Profil „Halle (sehr fern)“), nie Rot, keiner im Strafstoßschießen und nach dem Ende.
 *
 * Ohne Ansicht (`uhr` fehlt, Vorschau/Tests) gilt ein einziger Abschnitt der Länge `durationSeconds` aus den Zeitfeldern.
 */
import { useMonitorTheme } from '../../hooks';
import { displayBar } from '../../design-tokens';
import { formatRemaining } from '../../core/view';
import { ZeitBalken } from '../ui/atoms/ZeitBalken';
import { STUFEN, balkenRahmenStyle, clockBoxStyle, clockRowStyle, containerStyle, sectionColumnStyle, symbolColumnStyle, timeStyle } from './matchTimerStyles';
import { useMonitorUhr, type MatchTimerProps } from './useMonitorUhr';
import { AbschnittAnzeige, UhrZustand } from './uhrZustand';
import { abschnittVon, uhrSymbole, ziffernGedaempft } from './uhrSymbole';

export type { MatchTimerProps, MatchTimerUhrQuelle } from './useMonitorUhr';

export const MatchTimer: React.FC<MatchTimerProps> = (props) => {
  const { size = 'lg', showProgress = true, theme = 'dark' } = props;
  const { themeColors, resolvedTheme } = useMonitorTheme(theme);
  const uhr = useMonitorUhr(props);
  const stufe = STUFEN[size];

  const barColors = displayBar.colors[resolvedTheme === 'light' ? 'light' : 'dark'];
  // Ein Symbol nur, wenn etwas anders ist als im laufenden Spiel (@ZM-215)
  const symbole = uhr === null ? [] : uhrSymbole(uhr);
  const abschnitt = abschnittVon(uhr);

  return (
    <div style={containerStyle(stufe)}>
      <div style={clockRowStyle(size)} data-testid="clock-row">
        {uhr !== null && symbole.length > 0 && (
          <div style={symbolColumnStyle(themeColors)}>
            <UhrZustand symbole={symbole} size={stufe.symbol} gap={stufe.symbolGap} testId="clock-label" text={uhr.text} />
          </div>
        )}
        {uhr?.restSekunden !== undefined && uhr.restSekunden !== null && (
          <div style={clockBoxStyle(size)} data-testid="monitor-clock" data-phase={uhr.schlussphase ? 'schlussphaseAngehalten' : uhr.text === 'zeitAbgelaufen' ? 'abgelaufen' : 'normal'}>
            <span style={timeStyle(stufe, themeColors, uhr.schlussphase, ziffernGedaempft(uhr))} data-monitor="uhr">{formatRemaining(uhr.restSekunden)}</span>
          </div>
        )}
        {abschnitt !== null && (
          <div style={sectionColumnStyle(themeColors)}>
            <AbschnittAnzeige current={abschnitt.current} total={abschnitt.total} size={stufe.dot} gap={stufe.dotGap} border={stufe.dotBorder} testId="clock-section" />
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

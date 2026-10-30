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
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MonitorTheme } from '../../types/monitor';
import type { MatchStatus } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';
import { DEFAULT_CLOCK_MODE, type ClockMode } from '../../core/match/clockDisplay';
import { monitorUhrMitSperre, monitorUhrOf, type MatchView, type MonitorUhrEingabe, type MonitorUhrModell, type MonitorUhrText } from '../../core/view';
import { NowSourceContext } from '../schedule/useTickingNow';
import { cachedElapsedSeconds } from '../schedule/matchResult';
import { ZeitBalken } from '../ui/atoms/ZeitBalken';
import {
  STUFEN, balkenRahmenStyle, clockBoxStyle, containerStyle, labelRowStyle, labelStyle, timeStyle, type MatchTimerSize,
} from './matchTimerStyles';

/** Die Uhr eines Spiels der Ansicht (Monitor-Seite). */
export interface MatchTimerUhrQuelle {
  match: Pick<MatchView, 'isLive' | 'clockRules'>;
  /** `matches.live_state` (Serverzeit) */
  liveState?: unknown;
  /** Zeitfelder des Zwischenspeichers, nur ohne Feinstatus */
  timerStartTime?: string;
  timerElapsedSeconds?: number;
  /** Die Uhr steht laut Zwischenspeicher (unterbrochen) */
  steht?: boolean;
}

export interface MatchTimerProps {
  /** Ohne Ansicht: gespielte Sekunden (Vorbelegung, falls kein Zeitstempel) */
  elapsedSeconds?: number;
  /** Ohne Ansicht: Länge des einzigen Abschnitts in Sekunden */
  durationSeconds?: number;
  /** Ohne Ansicht: Status des Spiels */
  status?: MatchStatus;
  size?: MatchTimerSize;
  /** Zeitbalken zeigen */
  showProgress?: boolean;
  timerStartTime?: string;
  timerElapsedSeconds?: number;
  theme?: MonitorTheme;
  /** Ohne Ansicht: Uhr-Art des Turniers */
  clockMode?: ClockMode;
  /** Die Uhr aus der Ansicht des Spiels (hat Vorrang) */
  uhr?: MatchTimerUhrQuelle;
}

/** Kurzer Nachlauf nach dem berechneten Sekundenwechsel, damit die Rundung sicher umspringt. */
const TICK_NACHLAUF_MS = 15;

type UhrTextKey = 'remaining' | 'stopped' | 'pauseHalftime' | 'pause' | 'overtime' | 'ended';

const TEXT_KEY: Record<MonitorUhrText, UhrTextKey> = {
  restzeit: 'remaining',
  angehalten: 'stopped',
  pauseHalbzeit: 'pauseHalftime',
  pause: 'pause',
  verlaengerung: 'overtime',
  zeitAbgelaufen: 'ended',
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function eingabeOf(props: MatchTimerProps, nowMs: number): MonitorUhrEingabe {
  const { uhr } = props;
  if (uhr !== undefined) {
    return {
      match: uhr.match, liveState: uhr.liveState, nowMs, cacheSteht: uhr.steht === true,
      // Ohne Zeitfelder wie bisher am Monitor: gespielt 0 (volle Abschnittslänge)
      cacheElapsedSec: cachedElapsedSeconds(uhr.steht === true ? { timerElapsedSeconds: uhr.timerElapsedSeconds } : uhr, nowMs) ?? 0,
      cacheAnker: [uhr.timerStartTime, uhr.timerElapsedSeconds, uhr.steht].map(String).join('|'),
    };
  }
  // Ohne Ansicht: ein Abschnitt der Länge `durationSeconds` (Vorschau, ältere Aufrufer)
  const status = props.status ?? 'RUNNING';
  const laeuft = status === 'RUNNING';
  const zeitfelder = { timerStartTime: laeuft ? props.timerStartTime : undefined, timerElapsedSeconds: props.timerElapsedSeconds ?? props.elapsedSeconds ?? 0 };
  return {
    match: {
      isLive: status !== 'FINISHED',
      clockRules: { sections: 1, sectionSeconds: props.durationSeconds ?? 0, overtimeSeconds: 0, clockMode: props.clockMode ?? DEFAULT_CLOCK_MODE },
    },
    nowMs, cacheSteht: !laeuft,
    cacheElapsedSec: status === 'NOT_STARTED' ? 0 : cachedElapsedSeconds(zeitfelder, nowMs),
    cacheAnker: [status, zeitfelder.timerStartTime, zeitfelder.timerElapsedSeconds].map(String).join('|'),
  };
}

/** Uhr mit Takt an der Sekundengrenze und Sperre gegen Rückwärts. */
function useMonitorUhr(props: MatchTimerProps): MonitorUhrModell | null {
  const jetzt = useContext(NowSourceContext);
  const [takt, setTakt] = useState(0);
  const vorher = useRef<MonitorUhrModell | null>(null);
  const uhr = monitorUhrMitSperre(monitorUhrOf(eingabeOf(props, jetzt())), vorher.current);
  useEffect(() => { vorher.current = uhr; });
  const warten = uhr?.msBisWechsel ?? null;
  useEffect(() => {
    if (warten === null) { return undefined; }
    const timer = setTimeout(() => setTakt((n) => n + 1), warten + TICK_NACHLAUF_MS);
    return () => clearTimeout(timer);
  }, [warten, takt]);
  return uhr;
}

export const MatchTimer: React.FC<MatchTimerProps> = (props) => {
  const { size = 'lg', showProgress = true, theme = 'dark' } = props;
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);
  const uhr = useMonitorUhr(props);
  const stufe = STUFEN[size];

  return (
    <div style={containerStyle(stufe)}>
      <div style={labelRowStyle(size, stufe)} data-testid="clock-hints">
        {uhr && <div style={labelStyle(stufe, themeColors)} data-testid="clock-label" data-text={uhr.text}>{t(`liveMatch.clock.${TEXT_KEY[uhr.text]}`)}</div>}
      </div>
      {uhr?.restSekunden !== undefined && uhr.restSekunden !== null && (
        <div style={clockBoxStyle(size)} data-testid="monitor-clock" data-phase={uhr.schlussphase ? 'schlussphaseAngehalten' : uhr.text === 'zeitAbgelaufen' ? 'abgelaufen' : 'normal'}>
          <span style={timeStyle(stufe, themeColors, uhr.schlussphase)} data-monitor="uhr">{formatTime(uhr.restSekunden)}</span>
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

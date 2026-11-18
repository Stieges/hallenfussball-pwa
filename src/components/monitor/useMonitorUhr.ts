/**
 * Uhr des Hallenmonitors als Hook (R5 PR 2; @ZM-176, @ZM-084, @ZM-139, @ZM-145, @ZM-165, @ZM-166, @ZM-137, @ME-031).
 *
 * Die Rechnung steht in `core/view` (`monitorUhrOf`); hier der Takt an der Sekundengrenze, die Sperre gegen Rückwärts und die
 * Zuordnung der Zeitfelder. Eine Quelle für die Uhr der Live-Folie (`MatchTimer`) und des Profils „Halle (sehr fern)“ (`HallBand`).
 *
 * Ohne Ansicht (`uhr` fehlt, Vorschau/Tests) gilt ein einziger Abschnitt der Länge `durationSeconds` aus den Zeitfeldern.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import type { MonitorTheme } from '../../types/monitor';
import type { MatchStatus } from '../../hooks/useLiveMatches';
import { DEFAULT_CLOCK_MODE, type ClockMode } from '../../core/match/clockDisplay';
import { monitorUhrMitSperre, monitorUhrOf, type MatchView, type MonitorUhrEingabe, type MonitorUhrModell, type MonitorUhrText } from '../../core/view';
import { NowSourceContext } from '../schedule/useTickingNow';
import { cachedElapsedSeconds } from '../schedule/matchResult';
import type { MatchTimerSize } from './matchTimerStyles';

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

export type UhrTextKey = 'remaining' | 'stopped' | 'pauseHalftime' | 'pause' | 'overtime' | 'ended';

export const UHR_TEXT_KEY: Record<MonitorUhrText, UhrTextKey> = {
  restzeit: 'remaining',
  angehalten: 'stopped',
  pauseHalbzeit: 'pauseHalftime',
  pause: 'pause',
  verlaengerung: 'overtime',
  zeitAbgelaufen: 'ended',
};

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
export function useMonitorUhr(props: MatchTimerProps): MonitorUhrModell | null {
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

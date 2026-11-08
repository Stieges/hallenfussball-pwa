/**
 * Zustandsregeln des Monitors (B-16b1) – rein, ohne React.
 *
 * Regeln wörtlich aus MonitorDisplayPage.loadData (Lade-Regeln). Die Seite nutzt diese Bausteine
 * noch nicht; die Verdrahtung folgt in B-16b2.
 */
import type { Tournament } from '../../types/tournament';
import type { TournamentMonitor } from '../../types/monitor';
import type { DisplayDelta, DisplayOrigin } from './monitorDataSource';

/**
 * Warum der Monitor keinen Stand hat. Nur ein Grund, nie ein Text: die Seite zeigt in jedem Fall die ruhige Seite
 * „Warte auf Verbindung“, ohne Kennung und ohne Fehlertext (@ME-009, @ME-016, @ME-034).
 */
export type MonitorDisplayError = 'connection' | 'tournamentNotFound' | 'monitorNotFound' | 'fetchFailed';

export interface MonitorDisplayState {
  tournament: Tournament | null;
  monitor: TournamentMonitor | null;
  origin: DisplayOrigin | null;
  loading: boolean;
  error: MonitorDisplayError | null;
  lastFetch: number;
  hasData: boolean;
}

export const initialDisplayState: MonitorDisplayState = {
  tournament: null,
  monitor: null,
  origin: null,
  loading: true,
  error: null,
  lastFetch: 0,
  hasData: false,
};

export interface DisplayContext {
  tournamentId: string;
  monitorId: string;
  now: number;
  /**
   * Herkunft für den F-324-Schutz. Fehlt sie, gilt `state.origin`. Die Seite setzt sie beim
   * Ziel-Wechsel auf null (wie der frühere dataSourceRef), ohne `origin` der Realtime-Anbindung zu löschen.
   */
  guardOrigin?: DisplayOrigin | null;
}

/**
 * Hat der Server geantwortet? Auch „unverändert“ und eine unlesbare Antwort sind Antworten; eine lokale Kopie als Rückfall nach
 * gescheiterter Cloud-Abfrage (`lookupFailed`) und ein gescheiterter Abruf nicht. Grundlage des Hinweises „Stand von hh:mm“
 * (@ME-030, @ZM-085).
 */
export function istAntwort(delta: DisplayDelta): boolean {
  return delta.kind === 'unchanged' || delta.kind === 'unreadable' || !delta.lookupFailed;
}

/**
 * Wendet einen Abruf-Ergebnis-Delta an. Gibt bei „nichts ändern“ dieselbe Referenz zurück.
 */
export function applyDelta(
  state: MonitorDisplayState,
  delta: DisplayDelta,
  ctx: DisplayContext
): MonitorDisplayState {
  if (delta.kind === 'unchanged') {
    return state;
  }

  // B-19b (@ME-032): unlesbare Antwort – das letzte Bild bleibt, ohne Fehlertext (die Seite lädt neu).
  if (delta.kind === 'unreadable') {
    return state;
  }

  if (delta.kind === 'missing') {
    // Nur ein echter Fehlschlag rechtfertigt es, einen bestehenden Stand zu halten.
    if (state.hasData && delta.lookupFailed) {
      return state;
    }
    if (delta.lookupFailed) {
      return { ...state, error: 'connection', loading: false };
    }
    // Sauber bestätigt weg – auch mit vorhandenen Daten sichtbar machen.
    return { ...state, error: 'tournamentNotFound', loading: false };
  }

  // F-324: Ein Cloud-Aussetzer darf einen laufenden Bildschirm nicht auf die lokale Kopie
  // zurückstufen (lokal kann älter sein als das, was gerade zu sehen ist).
  const guardOrigin = ctx.guardOrigin !== undefined ? ctx.guardOrigin : state.origin;
  if (state.hasData && delta.lookupFailed && delta.origin === 'local' && guardOrigin === 'cloud') {
    return state;
  }

  if (!delta.monitor) {
    // Turnier-Abruf war erfolgreich; der Monitor existiert nicht mehr. Kein hasData-Schutz.
    return { ...state, error: 'monitorNotFound', loading: false };
  }

  return {
    ...state,
    tournament: delta.tournament,
    monitor: delta.monitor,
    origin: delta.origin,
    lastFetch: ctx.now,
    error: null,
    loading: false,
    hasData: true,
  };
}

/**
 * Abruf-Fehler: Mit vorhandenen Daten bleibt der Bildschirm unverändert.
 */
export function applyFetchError(state: MonitorDisplayState, _err?: unknown): MonitorDisplayState {
  if (state.hasData) {
    return state;
  }
  return {
    ...state,
    error: 'fetchFailed',
    loading: false,
  };
}

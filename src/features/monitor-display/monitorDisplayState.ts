/**
 * Zustandsregeln des Monitors (B-16b1) – rein, ohne React.
 *
 * Regeln wörtlich aus MonitorDisplayPage.loadData (Lade-Regeln). Die Seite nutzt diese Bausteine
 * noch nicht; die Verdrahtung folgt in B-16b2.
 */
import i18n from 'i18next';
import type { Tournament } from '../../types/tournament';
import type { TournamentMonitor } from '../../types/monitor';
import type { DisplayDelta, DisplayOrigin } from './monitorDataSource';

export interface MonitorDisplayState {
  tournament: Tournament | null;
  monitor: TournamentMonitor | null;
  origin: DisplayOrigin | null;
  loading: boolean;
  error: string | null;
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

function connectionError(): string {
  return i18n.t('monitor:error.connection');
}

function notFoundError(tournamentId: string): string {
  return i18n.t('monitor:error.tournamentNotFound', { id: tournamentId });
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

  if (delta.kind === 'missing') {
    // Nur ein echter Fehlschlag rechtfertigt es, einen bestehenden Stand zu halten.
    if (state.hasData && delta.lookupFailed) {
      return state;
    }
    if (delta.lookupFailed) {
      return { ...state, error: connectionError(), loading: false };
    }
    // Sauber bestätigt weg – auch mit vorhandenen Daten sichtbar machen.
    return { ...state, error: notFoundError(ctx.tournamentId), loading: false };
  }

  // F-324: Ein Cloud-Aussetzer darf einen laufenden Bildschirm nicht auf die lokale Kopie
  // zurückstufen (lokal kann älter sein als das, was gerade zu sehen ist).
  const guardOrigin = ctx.guardOrigin !== undefined ? ctx.guardOrigin : state.origin;
  if (state.hasData && delta.lookupFailed && delta.origin === 'local' && guardOrigin === 'cloud') {
    return state;
  }

  if (!delta.monitor) {
    // Turnier-Abruf war erfolgreich; der Monitor existiert nicht mehr. Kein hasData-Schutz.
    return { ...state, error: i18n.t('monitor:error.monitorNotFound', { id: ctx.monitorId }), loading: false };
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
export function applyFetchError(state: MonitorDisplayState, err: unknown): MonitorDisplayState {
  if (state.hasData) {
    return state;
  }
  return {
    ...state,
    error: err instanceof Error ? err.message : i18n.t('monitor:error.fetchFailed'),
    loading: false,
  };
}

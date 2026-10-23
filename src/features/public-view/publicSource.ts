/**
 * Abfrage-Schnittstelle der Zuschauer-Seite (B-15, @ZM-021, @ZM-109).
 *
 * Die Seite fragt eine Quelle mit `fetch(shareCode, sinceVersion)` und bekommt eine von fünf Antworten: nichts geändert,
 * das ganze Turnier, nur die Änderungen, „nicht gefunden“ oder „nicht erreichbar“. Hinter der Schnittstelle liegen zwei
 * Adapter: der heutige Weg (`legacyPublicSource.ts`, liefert immer voll, Version aus dem Inhalt) und die künftige
 * Server-Funktion `public_tournament(share_code, since_version)` (`rpcPublicSource.ts`, B-14).
 *
 * Eine Störung ist nie „nicht gefunden“ (@ZM-109): „nicht gefunden“ meldet nur eine Quelle, die es sicher weiß.
 */
import type { Match, Team, Tournament } from '../../types/tournament';

/** Änderungen seit `baseVersion`: Spiele nach Kennung ersetzt, Teams und Kopfdaten nur, wenn sie sich geändert haben. */
export interface PublicDelta {
  /** Kopfdaten des Turniers (ohne Teams und Spiele), nur bei Änderung (z. B. Abschluss) */
  header?: Omit<Tournament, 'teams' | 'matches'>;
  /** Alle Teams, nur bei Änderung */
  teams?: Team[];
  /** Geänderte oder neue Spiele, jeweils vollständig (mit ihren Ereignissen) */
  matches: Match[];
  removedMatchIds: string[];
}

export type PublicFetchResult =
  /** Seit `sinceVersion` hat sich nichts geändert */
  | { kind: 'unchanged'; version: string }
  | { kind: 'full'; version: string; tournament: Tournament }
  | { kind: 'delta'; version: string; baseVersion: string; delta: PublicDelta }
  /** Die Quelle weiß sicher, dass es das Turnier öffentlich nicht gibt */
  | { kind: 'not-found' }
  /** Netz, Zeitüberschreitung, Serverfehler, unlesbare Antwort */
  | { kind: 'unreachable' };

export interface PublicTournamentSource {
  /** Welcher Adapter; ein gespeicherter Stand gilt nur für denselben (Versionen sind nicht vergleichbar) */
  readonly kind: 'legacy' | 'rpc';
  /**
   * Takt im Vordergrund (ms); `null` = kein fester Takt. Dann wird nur beim Öffnen, bei Rückkehr in den Vordergrund, bei Netz und
   * auf Wunsch (Herunterziehen) abgerufen.
   */
  readonly pollIntervalMs: number | null;
  fetch(shareCode: string, sinceVersion: string | null): Promise<PublicFetchResult>;
  /** Jetzt in Serverzeit (ms, @ZM-026); ohne Abgleich die Geräteuhr */
  nowMs(): number;
}

/** Takt der Zuschauer-Seite im Vordergrund: höchstens 6 Anfragen je Minute (B-15, @ZM-021). */
export const PUBLIC_POLL_INTERVAL_MS = 10_000;

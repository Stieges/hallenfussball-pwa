/**
 * matchEvents — Normalisierung des Ereignis-Payloads an der Prop-Grenze
 *
 * Für dasselbe Ereignis existieren zwei Schreibweisen:
 *
 *   Draht-Format (Speicher, `MatchExecutionService`):
 *     `{ team: 'home' | 'away', delta: 1 | -1, durationSeconds: 300 }`
 *   UI-Format (Cockpit, `RuntimeMatchEvent`):
 *     `{ teamId, teamName, direction: 'INC' | 'DEC', penaltyDuration: 300 }`
 *
 * Gelesen wird das UI-Format an mindestens vier Stellen (Foulzähler in
 * `LiveCockpit`, `Sidebar`, `EventLogBottomSheet`, `EventEditDialog`). Jede
 * dieser Stellen einzeln zu patchen würde die nächste übersehen — deshalb wird
 * **einmal** umgerechnet, dort wo ein Core-Match zur Cockpit-Prop wird.
 *
 * Verlustfrei: alle übrigen payload-Felder (`playerNumber`, `assists`,
 * `playersIn`, `playersOut`, `toStatus`, `incomplete`, …) werden übernommen.
 * Die Draht-Felder bleiben zusätzlich erhalten, damit nichts verloren geht.
 *
 * Nur Lesepfad: der Schreibpfad (`onUpdateEvent` → Service) übernimmt
 * ausschließlich `playerNumber` und `incomplete`, das UI-Format erreicht den
 * Speicher also nie.
 */

import type { RuntimeMatchEvent } from '../types/tournament';

/** Minimal benötigte Mannschaftsdaten (passt auf `LiveTeamInfo` wie auf `Team`). */
export interface MatchEventTeamRef {
  id: string;
  name: string;
}

/**
 * Ereignis so, wie es aus dem Speicher kommt: Draht-Felder gesetzt, UI-Felder
 * in aller Regel nicht. Strukturell kompatibel zu `core/models/LiveMatch#MatchEvent`.
 */
export interface WireMatchEvent {
  id: string;
  matchId?: string;
  timestampSeconds: number;
  type: RuntimeMatchEvent['type'];
  payload: RuntimeMatchEvent['payload'];
  scoreAfter: {
    home: number;
    away: number;
  };
  incomplete?: boolean;
}

/**
 * Rechnet ein gespeichertes Ereignis in das vom Cockpit gelesene UI-Format um.
 *
 * - `payload.team` → `teamId` / `teamName` der passenden Mannschaft
 * - `payload.delta` → `direction` (`1` → `'INC'`, `-1` → `'DEC'`)
 * - `payload.durationSeconds` → `penaltyDuration`
 * - alle übrigen payload-Felder bleiben erhalten
 *
 * Bereits normalisierte Ereignisse (UI-Felder gesetzt, Draht-Felder nicht)
 * überstehen den Durchlauf unverändert.
 */
export function toRuntimeMatchEvent(
  event: WireMatchEvent,
  homeTeam: MatchEventTeamRef,
  awayTeam: MatchEventTeamRef
): RuntimeMatchEvent {
  const payload = event.payload;
  const side =
    payload.team === 'home' ? homeTeam : payload.team === 'away' ? awayTeam : undefined;

  const direction: RuntimeMatchEvent['payload']['direction'] =
    payload.delta === undefined
      ? payload.direction
      : payload.delta > 0
        ? 'INC'
        : payload.delta < 0
          ? 'DEC'
          : payload.direction;

  return {
    id: event.id,
    matchId: event.matchId,
    timestampSeconds: event.timestampSeconds,
    type: event.type,
    scoreAfter: event.scoreAfter,
    incomplete: event.incomplete,
    payload: {
      ...payload,
      teamId: side?.id ?? payload.teamId,
      teamName: side?.name ?? payload.teamName,
      direction,
      penaltyDuration: payload.durationSeconds ?? payload.penaltyDuration,
    },
  };
}

/** Bequemlichkeits-Wrapper für eine ganze Ereignisliste. */
export function toRuntimeMatchEvents(
  events: readonly WireMatchEvent[],
  homeTeam: MatchEventTeamRef,
  awayTeam: MatchEventTeamRef
): RuntimeMatchEvent[] {
  return events.map((event) => toRuntimeMatchEvent(event, homeTeam, awayTeam));
}

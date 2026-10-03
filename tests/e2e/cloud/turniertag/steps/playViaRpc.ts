/**
 * Spielt Spiele des Turniertag-Cups über `append_match_events` als Turnierleitung (Owner-JWT).
 * Die Schritte D8-D10 brauchen Ergebnisse, ohne jedes Spiel über die Oberfläche zu bedienen.
 */
import { randomUUID } from 'node:crypto';
import { appendAsRole, type AppendAsRoleEvent, type AppendAsRoleResult } from '../../engineHelpers';
import type { TurniertagMatch } from './shared';

const SPAN_MS = 600_000;

function event(type: string, at: number, extra: Partial<AppendAsRoleEvent> = {}): AppendAsRoleEvent {
  return { id: randomUUID(), type, at, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {}, ...extra };
}

/** Anpfiff, `goalsA`/`goalsB` Tore (Zeiten streng aufsteigend), Abpfiff -- alles in der Vergangenheit. */
export function regularResultEvents(match: TurniertagMatch, goalsA: number, goalsB: number, startedOffsetMs = SPAN_MS): AppendAsRoleEvent[] {
  const start = Date.now() - startedOffsetMs;
  const events: AppendAsRoleEvent[] = [event('MATCH_START', start)];
  let at = start;
  for (let i = 0; i < goalsA; i++) {
    at += 1000;
    events.push(event('GOAL', at, { clockMs: at - start, teamId: match.team_a_id }));
  }
  for (let i = 0; i < goalsB; i++) {
    at += 1000;
    events.push(event('GOAL', at, { clockMs: at - start, teamId: match.team_b_id }));
  }
  events.push(event('MATCH_END', at + 1000, { clockMs: at + 1000 - start }));
  return events;
}

export async function appendOwner(matchId: string, events: readonly AppendAsRoleEvent[]): Promise<AppendAsRoleResult> {
  return appendAsRole('owner', matchId, events);
}

export function eventOf(type: string, at: number, start: number, extra: Partial<AppendAsRoleEvent> = {}): AppendAsRoleEvent {
  return event(type, at, { clockMs: at - start, ...extra });
}

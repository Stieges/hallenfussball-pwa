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

/** Anpfiff, Tore in zwei Abschnitten mit Halbzeit, Abpfiff -- alles in der Vergangenheit. */
export function regularResultEvents(match: TurniertagMatch, goalsA: number, goalsB: number, startedOffsetMs = SPAN_MS): AppendAsRoleEvent[] {
  const start = Date.now() - startedOffsetMs;
  const events: AppendAsRoleEvent[] = [event('MATCH_START', start)];
  let at = start;
  const halfA = Math.ceil(goalsA / 2);
  const halfB = Math.ceil(goalsB / 2);
  for (let i = 0; i < halfA; i++) {
    at += 1000;
    events.push(event('GOAL', at, { clockMs: at - start, teamId: match.team_a_id }));
  }
  for (let i = 0; i < halfB; i++) {
    at += 1000;
    events.push(event('GOAL', at, { clockMs: at - start, teamId: match.team_b_id }));
  }
  at += 1000;
  events.push(event('SECTION_END', at, { clockMs: at - start }));
  at += 1000;
  events.push(event('SECTION_START', at, { clockMs: at - start, section: 2 }));
  for (let i = halfA; i < goalsA; i++) {
    at += 1000;
    events.push(event('GOAL', at, { clockMs: at - start, teamId: match.team_a_id, section: 2 }));
  }
  for (let i = halfB; i < goalsB; i++) {
    at += 1000;
    events.push(event('GOAL', at, { clockMs: at - start, teamId: match.team_b_id, section: 2 }));
  }
  events.push(event('MATCH_END', at + 1000, { clockMs: at + 1000 - start, section: 2 }));
  return events;
}

export async function appendOwner(matchId: string, events: readonly AppendAsRoleEvent[]): Promise<AppendAsRoleResult> {
  return appendAsRole('owner', matchId, events);
}

export function eventOf(type: string, at: number, start: number, extra: Partial<AppendAsRoleEvent> = {}): AppendAsRoleEvent {
  return event(type, at, { clockMs: at - start, ...extra });
}

export function finishingEvents(rows: readonly { type: string }[], events: AppendAsRoleEvent[]): AppendAsRoleEvent[] {
  if (!rows.some((r) => r.type === 'MATCH_START')) {
    return events;
  }
  const inBreak = rows.some((r) => r.type === 'SECTION_END') && !rows.some((r) => r.type === 'SECTION_START');
  return inBreak ? [eventOf('SECTION_START', Date.now() - 600_000, Date.now() - 599_000, { section: 2 }), ...events.slice(-1)] : events.slice(-1);
}

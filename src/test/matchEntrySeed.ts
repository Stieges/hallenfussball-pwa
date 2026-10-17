/**
 * Testgerüst A-08f3e4 (nur Testumgebung): legt für ein Spiel des Schedule-Turniers `n` echte Einträge über die
 * Spiel-Engine an (Anpfiff, Tore, Abpfiff) -- „Spiel 7 hat 5 Einträge“ aus @FU-090 bzw. „hat Einträge“ aus @FU-091.
 */
import { MatchCommands } from '../core/match/client';
import { RULES } from '../core/match/client/__tests__/fixtures';
import { buildValidMatches } from '../hooks/engineMatchModel';
import { scheduleTournament, settle, type ScheduleEngine } from './scheduleEngineHarness';
import type { Tournament } from '../types/tournament';

/** Anpfiff, Tore (erst Heim, dann Gast), Abpfiff: 2:1 ergibt 5 Einträge. */
export async function seedEntries(h: ScheduleEngine, matchId: string, score: { home: number; away: number }, tournament: Tournament = scheduleTournament()): Promise<void> {
  const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
  if (!entry) { throw new Error(`Spiel ${matchId} hat keine zwei Teams`); }
  const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.value.sender, accountId: h.value.accountId });
  await h.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
  await commands.start(entry.matchId, entry.ctx, 'leitung', RULES);
  for (let goal = 0; goal < score.home + score.away; goal++) {
    await commands.goal(entry.matchId, entry.ctx, 'leitung', goal < score.home ? entry.ctx.teamAId : entry.ctx.teamBId, false);
  }
  await commands.finish(entry.matchId, entry.ctx, 'leitung');
  await settle();
}

/** Anzahl der Einträge der lokalen Kopie (bestätigt, angenommen, wartend). */
export async function entryCount(h: ScheduleEngine, matchId: string): Promise<number> {
  const copy = await h.store.load(h.value.accountId, matchId);
  return copy ? copy.confirmed.length + copy.acked.length + copy.pending.length : 0;
}

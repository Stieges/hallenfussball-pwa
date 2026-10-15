/**
 * Engine-Weg für Regel-Szenariotests (A-08d1): echte `MatchEngine` (über `makeEngineContext`).
 * Einrichten = Spiel in der Engine anlegen (ohne Anpfiff). Anpfiff = `MatchCommands.start` mit
 * `serverRulesFor` (dieselbe Funktion wie der Produktivaufrufer, `src/hooks/engineServerRules.ts`).
 * Die Regel, die das Cockpit auf dem Engine-Weg verwendet, ist der Engine-Stand nach dem Anpfiff.
 */
import { vi } from 'vitest';
import type { Actor, MatchContext, MatchRules } from '../core/match';
import { MatchCommands, emptyOutboxStatus } from '../core/match/client';
import { serverRulesFor } from '../hooks/engineServerRules';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import type { Match, Tournament } from '../types/tournament';
import { makeEngineContext } from './engineContextFixture';

/** Spiel als Eingabe der Regel: Phase und Platzierungs-Kennzeichen (Engine kennt nur die Phase). */
export type RegelSpiel = Pick<Match, 'phase' | 'finalType'>;

export interface EingerichtetesEngineSpiel {
  matchId: string;
  ctx: MatchContext;
  value: MatchEngineContextValue;
  commands: MatchCommands;
}

export interface EngineSpiel extends EingerichtetesEngineSpiel {
  /** Startregel, die die Engine beim Anpfiff übernommen hat. */
  rules: MatchRules;
  /**
   * Entscheidungsmodus auf dem Engine-Weg: `rules.tiebreak` in einer K.-o.-Runde, sonst `undefined`
   * (Gruppenphase = `knockout: false`).
   */
  tiebreakerMode: NonNullable<MatchRules['tiebreak']> | undefined;
}

let counter = 0;

/** Legt das Engine-Spiel an, ohne Anpfiff (MATCH_START folgt in `anpfiffEngineSpiel`). */
export async function einrichtenEngineSpiel(): Promise<EingerichtetesEngineSpiel> {
  counter += 1;
  const matchId = `engine-spiel-${counter}`;
  const ctx: MatchContext = { matchId, teamAId: 'teama', teamBId: 'teamb' };
  const value = await makeEngineContext(matchId);
  const sender = {
    kick: vi.fn().mockResolvedValue(undefined),
    getStatus: () => emptyOutboxStatus(),
    subscribe: () => () => undefined,
    dismissRejected: vi.fn().mockResolvedValue(undefined),
  };
  const commands = new MatchCommands({ engine: value.engine, store: value.store, sender, accountId: value.accountId });
  return { matchId, ctx, value, commands };
}

/** Anpfiff mit der Regel des übergebenen Turnier-Stands (Produktionsfunktion `serverRulesFor`). */
export async function anpfiffEngineSpiel(
  spiel: EingerichtetesEngineSpiel,
  tournament: Tournament,
  match: RegelSpiel,
): Promise<EngineSpiel> {
  const rules = serverRulesFor(tournament, match);
  const actor: Actor = 'leitung';
  await spiel.commands.start(spiel.matchId, spiel.ctx, actor, rules);
  const view = spiel.value.engine.view(spiel.matchId);
  if (!view) {
    throw new Error('keine Engine-Ansicht nach MATCH_START');
  }
  const engineRules = view.result.state.rules ?? rules;
  return {
    ...spiel,
    rules: engineRules,
    tiebreakerMode: engineRules.knockout ? (engineRules.tiebreak ?? undefined) : undefined,
  };
}

/** Einrichten und Anpfiff in einem Schritt. */
export async function startEngineSpiel(tournament: Tournament, match: RegelSpiel): Promise<EngineSpiel> {
  return anpfiffEngineSpiel(await einrichtenEngineSpiel(), tournament, match);
}

/**
 * Engine-Weg fuer Regel-Szenariotests (A-08d1): echte `MatchEngine` (über `makeEngineContext`), Spiel per
 * `MatchCommands.start` mit derselben `serverRules`-Eingabe wie der Produktivaufrufer
 * (`useEngineCommandWiring.serverRulesFor`). Der Engine-Stand (`view.result.state.rules`) ist die Regel,
 * die das Cockpit auf dem Engine-Weg verwendet.
 */
import { vi } from 'vitest';
import { serverRules, type Actor, type MatchContext, type MatchRules } from '../core/match';
import { MatchCommands, emptyOutboxStatus } from '../core/match/client';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import type { Tournament } from '../types/tournament';
import { makeEngineContext } from './engineContextFixture';

export interface EngineSpiel {
  matchId: string;
  ctx: MatchContext;
  value: MatchEngineContextValue;
  commands: MatchCommands;
  /** Startregel, die die Engine beim Anpfiff übernommen hat. */
  rules: MatchRules;
  /**
   * Entscheidungsmodus auf dem Engine-Weg: `rules.tiebreak` in einer K.-o.-Runde, sonst `undefined`
   * (Gruppenphase = `knockout: false`).
   */
  tiebreakerMode: NonNullable<MatchRules['tiebreak']> | undefined;
}

let counter = 0;

/**
 * Startet ein Engine-Spiel für `phase` (`null` = Gruppenphase) mit der Regel des gespeicherten Turniers.
 * Die Engine-Teams sind `teama`/`teamb` (wie im Fixture).
 */
export async function startEngineSpiel(tournament: Tournament, phase: string | null): Promise<EngineSpiel> {
  counter += 1;
  const matchId = `engine-spiel-${counter}`;
  const ctx: MatchContext = { matchId, teamAId: 'teama', teamBId: 'teamb' };
  const value = await makeEngineContext(matchId);
  const rules = serverRules({
    durationMinutes: null,
    phase,
    groupPhaseDuration: tournament.groupPhaseGameDuration,
    finalRoundDuration: tournament.finalRoundGameDuration ?? null,
    config: {
      gamePeriods: tournament.gamePeriods,
      halftimeBreak: tournament.halftimeBreak,
      matchCockpitSettings: tournament.matchCockpitSettings,
    },
    finalsConfig: tournament.finalsConfig ?? null,
  });
  const sender = {
    kick: vi.fn().mockResolvedValue(undefined),
    getStatus: () => emptyOutboxStatus(),
    subscribe: () => () => undefined,
    dismissRejected: vi.fn().mockResolvedValue(undefined),
  };
  const commands = new MatchCommands({ engine: value.engine, store: value.store, sender, accountId: value.accountId });
  const actor: Actor = 'leitung';
  await commands.start(matchId, ctx, actor, rules);
  const view = value.engine.view(matchId);
  if (!view) {
    throw new Error('keine Engine-Ansicht nach MATCH_START');
  }
  const engineRules = view.result.state.rules ?? rules;
  return {
    matchId,
    ctx,
    value,
    commands,
    rules: engineRules,
    tiebreakerMode: engineRules.knockout ? (engineRules.tiebreak ?? undefined) : undefined,
  };
}

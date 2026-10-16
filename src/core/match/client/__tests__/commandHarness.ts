/**
 * B-07: In-Memory-Geruest fuer `MatchCommands` -- echte Rechenfunktion (`reduceMatch`), Log und Store
 * als Feld, Serverzeit frei stellbar. So lassen sich Zustaende wie `section_break`,
 * `decision_pending`, `shootout` oder `finished` direkt aus einem Vorlauf-Log herstellen, ohne
 * fuer jeden Zeitpunkt eine neue `MatchEngine` mit IndexedDB zu bauen (Muster
 * `MatchCommands.test.ts`).
 */
import { vi } from 'vitest';
import { reduceMatch, type EngineEvent, type MatchContext, type MatchRules } from '../../';
import { MatchCommands } from '../MatchCommands';
import type { MatchEngineView } from '../MatchEngine';

export const B07_CTX: MatchContext = { matchId: 'spiel-11', teamAId: 'fc-nord', teamBId: 'sv-sued' };

export const B07_RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

/** Anpfiff-Zeitpunkt (Serverzeit) aller Vorlauf-Logs. */
export const KICKOFF_AT = 1_790_000_000_000;

export interface CommandHarness {
  commands: MatchCommands;
  /** gespeicherte Eintraege (Vorlauf + neu), in Einfuegereihenfolge */
  log: EngineEvent[];
  /** nur die von `MatchCommands` neu gespeicherten Eintraege */
  stored: EngineEvent[];
  kick: ReturnType<typeof vi.fn>;
  setNow(at: number): void;
}

export function makeHarness(preLog: EngineEvent[], now: number, accountId = 'acc-b07'): CommandHarness {
  const log: EngineEvent[] = [...preLog];
  const stored: EngineEvent[] = [];
  let serverNow = now;
  const kick = vi.fn(async () => undefined);
  const save = async (_account: string, _matchId: string, event: EngineEvent): Promise<void> => {
    log.push(event);
    stored.push(event);
  };
  const commands = new MatchCommands({
    engine: {
      view: (): MatchEngineView => ({
        result: { state: reduceMatch(log, B07_CTX).state, localRejected: [], needsFullReload: false },
        log: [...log],
        confirmedCount: 0,
      }),
      serverNow: () => serverNow,
      notifyStoreChange: async () => undefined,
    },
    store: { addPending: save, addConfirmedLocal: save },
    sender: { kick },
    accountId,
  });
  return {
    commands,
    log,
    stored,
    kick,
    setNow: (at: number) => {
      serverNow = at;
    },
  };
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function kickoff(rules: MatchRules = B07_RULES): EngineEvent {
  return {
    id: nextId('start'),
    type: 'MATCH_START',
    actor: 'helper',
    at: KICKOFF_AT,
    section: 1,
    clockMs: 0,
    teamId: null,
    targetId: null,
    payload: { rules },
  };
}

export function plain(
  type: EngineEvent['type'],
  at: number,
  clockMs: number | null,
  section: number,
  extra: Partial<EngineEvent> = {},
): EngineEvent {
  return {
    id: nextId(type.toLowerCase()),
    type,
    actor: 'helper',
    at,
    section,
    clockMs,
    teamId: null,
    targetId: null,
    payload: {},
    ...extra,
  };
}

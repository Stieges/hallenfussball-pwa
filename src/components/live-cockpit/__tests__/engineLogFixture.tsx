/**
 * Testgerüst B-08b: eine echte `MatchEngine` aus einem fertigen Log (bestätigt, wie vom Server geladen) und der
 * Provider dazu. Für Tests, in denen das Cockpit ein Spiel zeigt, dessen Zustand schon feststeht (Verlängerung,
 * Spielzeit überschritten) und von selbst weiterschalten soll. Zeit über `Date` (Fake-Timer), Speicher fake-indexeddb.
 */
import type { ReactElement, ReactNode } from 'react';
import type { EngineEvent, MatchContext } from '../../../core/match';
import { LocalMatchStore } from '../../../core/match/client';
import type { MatchEngineContextValue } from '../../../features/match-engine/matchEngineContextInstance';
import { MatchEngineContext } from '../../../features/match-engine/matchEngineContextInstance';
import { storeSender, type HarnessSender } from './engineHarnessSupport';
import { geraetAuf, type EngineSpiel, type Geraet } from './enginePhaseFixture';

export interface EngineAusLog {
  geraet: Geraet;
  store: LocalMatchStore;
  accountId: string;
  sender: HarnessSender;
  /** Provider-Hülle um das Cockpit. */
  mitEngine: (kinder: ReactNode) => ReactElement;
  /** Ereignisse eines Typs im Log der Engine (bestätigte und wartende). */
  eintraege: (type: string) => EngineEvent[];
}

let zaehler = 0;

export async function engineAusLog(log: readonly EngineEvent[], ctx: MatchContext): Promise<EngineAusLog> {
  zaehler += 1;
  const accountId = `acc-log-${zaehler}`;
  const store = new LocalMatchStore();
  const geraet = await geraetAuf(store, accountId);
  await geraet.engine.ensureMatch(ctx.matchId, ctx);
  await store.applyConfirmed(accountId, ctx.matchId, log.map((event, index) => ({ ...event, seq: index + 1 })), log.length);
  await geraet.engine.notifyStoreChange(ctx.matchId);
  const sender = storeSender(store, accountId, 'tour-1');
  const wert = { engine: geraet.engine, store, sender, accountId } as unknown as MatchEngineContextValue;
  return {
    geraet, store, accountId, sender,
    mitEngine: (kinder) => <MatchEngineContext.Provider value={wert}>{kinder}</MatchEngineContext.Provider>,
    eintraege: (type) => (geraet.engine.view(ctx.matchId)?.log ?? []).filter((event) => event.type === type),
  };
}

/** Provider-Hülle um ein mit `spielAnlegen` erzeugtes Spiel (Gerät A). */
export function engineHuelle(spiel: EngineSpiel): (kinder: ReactNode) => ReactElement {
  const wert = {
    engine: spiel.a.engine, store: spiel.store, sender: storeSender(spiel.store, spiel.accountId, 'tour-1'), accountId: spiel.accountId,
  } as unknown as MatchEngineContextValue;
  return (kinder) => <MatchEngineContext.Provider value={wert}>{kinder}</MatchEngineContext.Provider>;
}

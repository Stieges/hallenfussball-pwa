/**
 * useFreshEntryCommands – Nachtrag der Rückennummer (AMEND) und Zurücknehmen (RETRACT) gegen den JEDERZEIT frischen Stand
 * der Engine (Aufgabe 3.4, RF3). Die Nummer kommt, wenn das Tor schon gespeichert ist, aber ein neues Rendern die Engine-
 * Ansicht vielleicht noch nicht übernommen hat; deshalb hängt dieser Weg nicht am Render (`useEngineEventEditing`), sondern
 * liest den Stand erst beim Senden (`MatchCommands.submitNow`). Fehler werden gemeldet (Stufe 2), nie still verschluckt.
 * Ohne Engine-Kontext (Altspiel) tut er nichts.
 */
import { useCallback, useMemo } from 'react';
import { LocalStoreFullError, MatchCommands } from '../../../core/match/client';
import type { MatchContext } from '../../../core/match';
import { useMatchEngineContextOptional } from '../../../features/match-engine/useMatchEngineContext';
import { useActorRole } from '../../../hooks/useActorRole';
import type { Uebersetzer } from '../model/cockpitTypes';
import type { NoticeStufe } from './useCockpitNotices';

export interface FreshEntryCommands {
  nummer: (eventId: string, nummer: number) => Promise<void>;
  zuruecknehmen: (eventId: string) => Promise<void>;
}

export interface FreshEntryParams {
  tournamentId: string;
  matchId: string | undefined;
  teamAId: string;
  teamBId: string;
  melde: (stufe: NoticeStufe, text: string) => void;
  t: Uebersetzer;
}

export function useFreshEntryCommands({ tournamentId, matchId, teamAId, teamBId, melde, t }: FreshEntryParams): FreshEntryCommands {
  const context = useMatchEngineContextOptional();
  const actor = useActorRole(tournamentId);
  const commands = useMemo(
    () => (context ? new MatchCommands({ engine: context.engine, store: context.store, sender: context.sender, accountId: context.accountId }) : null),
    [context],
  );

  const sende = useCallback(async (job: (c: MatchCommands, ctx: MatchContext) => Promise<unknown>): Promise<void> => {
    if (!commands || !matchId) { return; }
    try {
      await job(commands, { matchId: matchId.toLowerCase(), teamAId, teamBId });
    } catch (error) {
      melde(2, t(error instanceof LocalStoreFullError ? 'engine.storeFull' : 'engine.invalid'));
    }
  }, [commands, matchId, teamAId, teamBId, melde, t]);

  const nummer = useCallback(
    (eventId: string, n: number) => sende((c, ctx) => c.amend(ctx.matchId, ctx, actor, eventId, { playerNumber: n }, [])),
    [sende, actor],
  );
  const zuruecknehmen = useCallback(
    (eventId: string) => sende((c, ctx) => c.retract(ctx.matchId, ctx, actor, eventId)),
    [sende, actor],
  );
  return useMemo(() => ({ nummer, zuruecknehmen }), [nummer, zuruecknehmen]);
}

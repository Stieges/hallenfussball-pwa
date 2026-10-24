/**
 * B-50: Entscheidungen eines Falls senden (Hook um `sendReviewDecisions`) und die Engine-Ansicht für die Vorschau liefern.
 * Das Spiel kommt aus dem Turnier (`buildValidMatches`, Engine-Schlüssel klein); fehlt es dort, gibt es weder Vorschau noch
 * Senden (Hinweis „noch nicht geladen“).
 */
import { useCallback, useMemo } from 'react';
import type { Tournament } from '../../types/tournament';
import { buildValidMatches, type ValidMatchEntry } from '../../hooks/engineMatchModel';
import { serverRulesFor } from '../../hooks/engineServerRules';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useMatchEngineContextOptional } from '../match-engine/useMatchEngineContext';
import type { MatchState } from '../../core/match';
import type { ReviewDecision } from '../../core/match/review/reviewDecision';
import { sendReviewDecisions, type DecisionOutcome } from './sendReviewDecisions';

export interface ReviewDecisionApi {
  /** Engine-Eintrag des Spiels (Kontext, Nummer); `null`, wenn das Spiel hier nicht bekannt ist. */
  entryFor: (matchId: string) => ValidMatchEntry | null;
  /** Heutiger Stand des Spiels aus der Engine (für die Vorschau), `null` ohne geladenes Spiel. */
  stateFor: (matchId: string) => MatchState | null;
  serverNow: () => number;
  /** Strafzeit des Turniers (Kopplung Gegentor + Zeitstrafe, @FU-096). */
  penaltySeconds: number;
  decide: (matchId: string, decisions: ReviewDecision[]) => Promise<DecisionOutcome | { status: 'unknownMatch' }>;
  /** Spiel in die Engine holen und abgleichen (für die Vorschau); Fehler bleiben still (dann ohne Stand). */
  prepare: (matchId: string) => Promise<void>;
}

export function useReviewDecision(tournament: Tournament): ReviewDecisionApi {
  const context = useMatchEngineContextOptional();
  const { isOnline } = useOnlineStatus();
  const entries = useMemo(() => buildValidMatches(tournament), [tournament]);
  const penaltySeconds = useMemo(() => serverRulesFor(tournament, undefined).penaltySeconds, [tournament]);

  const entryFor = useCallback(
    (matchId: string) => entries.find((entry) => entry.matchId === matchId.toLowerCase()) ?? null,
    [entries],
  );
  const stateFor = useCallback(
    (matchId: string) => context?.engine.view(matchId.toLowerCase())?.result.state ?? null,
    [context],
  );
  const serverNow = useCallback(() => context?.engine.serverNow() ?? Date.now(), [context]);

  const decide = useCallback(async (matchId: string, decisions: ReviewDecision[]) => {
    const entry = entryFor(matchId);
    if (!entry || !context) {
      return { status: 'unknownMatch' as const };
    }
    return sendReviewDecisions({
      engine: context.engine,
      sender: context.sender,
      online: () => isOnline,
      tournamentId: tournament.id,
      matchId: entry.matchId,
      ctx: entry.ctx,
      decisions,
    });
  }, [context, entryFor, isOnline, tournament.id]);

  const prepare = useCallback(async (matchId: string) => {
    const entry = entryFor(matchId);
    if (!entry || !context) {
      return;
    }
    try {
      await context.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
      await context.engine.catchUp(entry.matchId);
    } catch {
      // ohne Stand zeigt die Vorschau nur, was übernommen wird
    }
  }, [context, entryFor, tournament.id]);

  return { entryFor, stateFor, serverNow, penaltySeconds, decide, prepare };
}

/**
 * useMatchSkip (A-08f3e4 Punkt 1): Spiel absetzen und wieder einplanen über den Server (`SKIP`/`UNSKIP` über den
 * Engine-Ausgang), Muster `useScheduleResultEntry`. Kein lokales Schreiben ins Turnier, kein `updateMatches`: die Anzeige
 * kommt über die Engine-Überlagerung (`useEngineOverlayForTournament`), der Server führt Status und `skipped_*`.
 *
 * Ablauf: beide Teams fest? (sonst Hinweis, kein `ensureMatch`, @FU-092 -- der Server würfe `22023`) → Rolle Leitung?
 * (sonst „nur Turnierleitung“, @FU-071) → `ensureMatch` → `catchUp` → Befehl, geprüft gegen die Engine-Ansicht nach dem
 * Nachladen (N-4; beendet/laufend → `INVALID_TRANSITION`). Liefert den Hinweistext bei Ablehnung, sonst `null`.
 * Sichtbarer Einstieg „Spiel absetzen“: B-12/A-14b (Befund C-ABSETZEN-OHNE-EINSTIEG); hier nur „wieder einplanen“.
 * Szenarien: @FU-089, @FU-092, @FU-071 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import { ERROR_CODES } from '../../../core/match';
import { MatchCommands, MatchCommandRejectedError } from '../../../core/match/client';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';
import { useActorRole } from '../../../hooks/useActorRole';
import { buildValidMatches } from '../../../hooks/engineMatchModel';
import { rejectionMessageKey } from '../../../hooks/engineCommandWiringHelpers';

export interface MatchSkip {
  /** Absetzen; Hinweistext bei Ablehnung, sonst `null`. */
  skip: (matchId: string, reason?: string) => Promise<string | null>;
  /** Wieder einplanen; Hinweistext bei Ablehnung, sonst `null`. */
  unskip: (matchId: string) => Promise<string | null>;
}

export function useMatchSkip(tournament: Tournament): MatchSkip {
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');
  const context = useMatchEngineContextOptional();
  const actor = useActorRole(tournament.id);
  const commands = useMemo(
    () => (context ? new MatchCommands({ engine: context.engine, store: context.store, sender: context.sender, accountId: context.accountId }) : null),
    [context],
  );

  const run = useCallback(async (matchId: string, unskip: boolean, reason?: string): Promise<string | null> => {
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
    if (!entry) {
      return t('schedule.skip.teamsMissing');
    }
    if (!context || !commands) {
      return t('schedule.skip.unavailable');
    }
    if (actor !== 'leitung') {
      return t('schedule.resultEntry.leadOnly');
    }
    try {
      await context.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
      await context.engine.catchUp(entry.matchId);
      await (unskip
        ? commands.unskip(entry.matchId, entry.ctx, actor)
        : commands.skip(entry.matchId, entry.ctx, actor, reason));
      return null;
    } catch (error) {
      if (error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.FORBIDDEN_ACTOR) {
        return t('schedule.resultEntry.leadOnly');
      }
      return tCockpit(rejectionMessageKey(error));
    }
  }, [tournament, context, commands, actor, t, tCockpit]);

  return useMemo(() => ({
    skip: (matchId: string, reason?: string) => run(matchId, false, reason),
    unskip: (matchId: string) => run(matchId, true),
  }), [run]);
}

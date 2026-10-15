/**
 * useCockpitExecution (A-08a, @FU-069/@FU-025): Cockpit-Hook NUR über Engine-Ereignisse.
 *
 * Ersetzt `useMatchExecution` für die Turnierleitung. Es gibt keinen Altweg mehr: kein
 * `liveMatchRepository`, kein Altservice, kein lokaler `liveMatches`-State. Ein Spiel, das die
 * Engine nicht tragen kann, wirft `MatchNotOnEngineError` (bzw. `MatchAwaitingTeamsError` bei einer
 * offenen Seite), statt auf einen Altpfad auszuweichen.
 *
 * Realtime-Abo: nur `engine.catchUp` für Engine-Spiele plus Kanalstatus (@FU-025). Die
 * Schreibhandler kommen aus `useEngineCommandWiring`. Ohne Engine-Kontext oder ohne Teams gibt es
 * keinen Schreibzugriff: der vorläufige Ablehnungs-Fallback zeigt nur einen Hinweis (A-08b entfernt ihn).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../types/tournament';
import type { ScheduledMatch } from '../core/generators';
import type { LiveMatch } from '../core/models/LiveMatch';
import { matchSideTeamId } from '../core/models/matchSlot';
import {
  MatchAwaitingTeamsError,
  MatchNotOnEngineError,
  type MatchNotOnEngineReason,
} from '../core/errors';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { useToast } from '../components/ui/Toast/ToastContext';
import { captureFeatureError } from '../lib/sentry';
import { useEngineExecutionBridge } from './useEngineExecutionBridge';
import { useEngineCommandWiring } from './useEngineCommandWiring';
import type { EngineCommandFallbackHandlers } from './engineCommandWiringTypes';
import { trackRealtimeChannelStatus } from './realtimeChannelStatus';

export type UseCockpitExecutionReturn = EngineCommandFallbackHandlers & {
  liveMatches: Map<string, LiveMatch>;
  /** Engine-Ansicht eines Spiels; wirft, wenn das Spiel nicht über die Engine leitbar ist. */
  getLiveMatchData: (matchData: ScheduledMatch) => Promise<LiveMatch>;
  hasRunningMatch: () => LiveMatch | undefined;
};

/** Konstante leere Map: das Cockpit hat keinen lokalen Altzustand mehr (A-08a). */
const LEERE_MAP = new Map<string, LiveMatch>();

function notOnEngineReason(tournament: Tournament, matchId: string): MatchNotOnEngineReason {
  const source = tournament.matches.find((m) => m.id === matchId);
  const status = source?.matchStatus;
  if (status === 'skipped') { return 'skipped'; }
  if (status === 'finished') { return 'resultEntered'; }
  // A3: ein laufendes Spiel hat einen Projektionsstand (anderes Gerät), kein Altergebnis.
  // (`MatchStatus` kennt kein 'paused'; Pausen laufen als 'running'.)
  if (status === 'running') { return 'other'; }
  const hasResult = (source?.scoreA ?? 0) > 0 || (source?.scoreB ?? 0) > 0;
  return hasResult ? 'resultEntered' : 'other';
}

function openSidesOf(tournament: Tournament, matchId: string): ('A' | 'B')[] {
  const source = tournament.matches.find((m) => m.id === matchId);
  if (!source) { return []; }
  return (['A', 'B'] as const).filter((side) => matchSideTeamId(source, side) === undefined);
}

/** Vorläufiger Ablehnungs-Fallback (A-08a): jede Aktion ohne Engine-Weg zeigt nur einen Hinweis. */
function useRejectingFallback(): EngineCommandFallbackHandlers {
  const { t } = useTranslation('cockpit');
  const { showWarning } = useToast();
  return useMemo(() => {
    const reject = async (): Promise<void> => { showWarning(t('engine.invalid')); };
    return {
      handleStart: async () => { showWarning(t('engine.invalid')); return false; },
      handlePause: reject,
      handleResume: reject,
      handleFinish: reject,
      handleForceFinish: reject,
      handleGoal: reject,
      handleCard: reject,
      handleTimePenalty: reject,
      handleSubstitution: reject,
      handleFoul: reject,
      handleStartOvertime: reject,
      handleStartGoldenGoal: reject,
      handleStartPenaltyShootout: reject,
      handleRecordPenaltyResult: reject,
      handleCancelTiebreaker: reject,
      handleAbortPenaltyShootout: reject,
      handleManualEditResult: reject,
      handleAdjustTime: reject,
      handleSkipMatch: reject,
      handleUnskipMatch: reject,
      handleUndoLastEvent: reject,
      handleUpdateEvent: reject,
      handleDeleteEvent: reject,
    };
  }, [showWarning, t]);
}

export function useCockpitExecution(tournament: Tournament): UseCockpitExecutionReturn {
  // Nur die Realtime-Quelle; kein Live-Match-Repository, kein Schreibweg über den Repo.
  const { isRealtimeEnabled, supabaseLiveMatchRepo } = useRepositories();
  const realtimeRepo = isRealtimeEnabled ? supabaseLiveMatchRepo : null;

  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;

  const {
    mergedLiveMatches, matchEngineContext, engineLiveMatches, isEngineMatchId,
    isEngineDestinedMatchId, isForeignCandidateMatchId, ensureEngineMatchReady, resolveEngineLiveMatchData,
  } = useEngineExecutionBridge(tournament, isRealtimeEnabled, LEERE_MAP);

  const fallback = useRejectingFallback();
  const handlers = useEngineCommandWiring(
    tournament,
    matchEngineContext,
    engineLiveMatches,
    fallback,
    isEngineDestinedMatchId,
    ensureEngineMatchReady,
    isForeignCandidateMatchId,
  );

  // Realtime: nur Engine-Spiele holen nach (catchUp); Kanalstatus für @FU-025.
  const handleRealtimeChange = useCallback((matchId: string, match: LiveMatch | null) => {
    if (!match) { return; }
    if (isEngineMatchId(matchId)) {
      // A4 (Fehlerpolitik): ein fehlgeschlagenes catchUp wird gemeldet, nicht verschluckt.
      matchEngineContext?.engine.catchUp(matchId).catch((error: unknown) => {
        captureFeatureError(error instanceof Error ? error : new Error(String(error)), 'hooks', 'cockpitCatchUp', { matchId });
      });
    }
  }, [matchEngineContext, isEngineMatchId]);

  useEffect(() => {
    if (!realtimeRepo || !tournament.id) { return; }
    const tournamentId = tournament.id;
    const tracker = trackRealtimeChannelStatus(tournamentId);
    realtimeRepo.subscribe(tournamentId, {
      onMatchChange: handleRealtimeChange,
      onStatusChange: tracker.onStatusChange,
      onError: (error) => {
        captureFeatureError(error, 'hooks', 'cockpitRealtime', { tournamentId });
      },
    });
    return () => {
      tracker.stop();
      realtimeRepo.unsubscribe(tournamentId);
    };
  }, [tournament.id, realtimeRepo, handleRealtimeChange]);

  const getLiveMatchData = useCallback(async (matchData: ScheduledMatch): Promise<LiveMatch> => {
    const engineView = await resolveEngineLiveMatchData(matchData.id);
    if (engineView) { return engineView; }
    const openSides = openSidesOf(tournamentRef.current, matchData.id);
    if (openSides.length > 0) { throw new MatchAwaitingTeamsError(matchData.id, openSides); }
    throw new MatchNotOnEngineError(notOnEngineReason(tournamentRef.current, matchData.id));
  }, [resolveEngineLiveMatchData]);

  const hasRunningMatch = useCallback((): LiveMatch | undefined => {
    return Array.from(mergedLiveMatches.values()).find((m) => m.status === 'RUNNING');
  }, [mergedLiveMatches]);

  return {
    liveMatches: mergedLiveMatches,
    getLiveMatchData,
    hasRunningMatch,
    ...handlers,
  };
}

/**
 * useEngineMatchInit – lädt das Spiel des Felds in die Engine und meldet den Zustand (aus `ManagementTab` ausgelagert, unverändert).
 *
 * Unterscheidet „wird geladen“, „wartet auf Teams“ (@TM-033), „nicht über die Engine leitbar“ (A-08a, @FU-069) und „Engine nicht bereit“ (P7).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScheduledMatch } from '../../../core/generators';
import { MatchAwaitingTeamsError, MatchNotOnEngineError, type MatchNotOnEngineReason } from '../../../core/errors';
import { captureFeatureError } from '../../../lib/sentry';
import { useToast } from '../../../components/ui/Toast/ToastContext';

export interface EngineMatchInitParams {
  currentMatchData: ScheduledMatch | undefined;
  liveMatches: ReadonlyMap<string, unknown>;
  getLiveMatchData: (match: ScheduledMatch) => Promise<unknown>;
}

export function useEngineMatchInit({ currentMatchData, liveMatches, getLiveMatchData }: EngineMatchInitParams) {
  const { t } = useTranslation('tournament');
  const { showError } = useToast();
  const [isInitializingMatch, setIsInitializingMatch] = useState<boolean>(false);
  // P7: `getLiveMatchData` kann werfen -- unterscheidet "kein Spiel" von "noch nicht bereit".
  const [engineReadyError, setEngineReadyError] = useState<boolean>(false);
  // @TM-033: das Spiel hat noch eine offene Seite – kein Fehler, sondern ein Wartegrund
  const [awaitingTeams, setAwaitingTeams] = useState<boolean>(false);
  // A-08a (@FU-069): Spiel ist nicht über die Engine leitbar (z. B. Ergebnis schon eingetragen)
  const [notOnEngineReason, setNotOnEngineReason] = useState<MatchNotOnEngineReason | null>(null);
  // Minor 4: "Erneut versuchen" erzwingt einen neuen Ladeversuch ueber diesen Zaehler.
  const [retryToken, setRetryToken] = useState(0);

  // C-3 FIX: cancellation bei schnellem Feldwechsel. Minor 2: Reset VOR jedem fruehen Ausstieg.
  useEffect(() => {
    setEngineReadyError(false);
    setAwaitingTeams(false);
    setNotOnEngineReason(null);
    // @FU-004 (C-COCKPIT-LAEDT-NACH-ABPFIFF): auch "wird geladen" vor jedem frühen Ausstieg zurücksetzen --
    // ein abgebrochener Lauf (cancelled) setzt es nicht mehr zurück und ließe den Ladehinweis stehen.
    setIsInitializingMatch(false);
    if (!currentMatchData) {
      return;
    }
    const matchId = currentMatchData.id;
    const existingMatch = liveMatches.get(matchId);
    if (existingMatch) {
      // Match already exists, no need to initialize
      return;
    }

    let cancelled = false;

    setIsInitializingMatch(true);

    void getLiveMatchData(currentMatchData)
      .catch((error: unknown) => {
        if (cancelled) { return; }
        // @TM-033: offene Seite = Wartegrund, kein Fehler (kein Toast, keine Sentry-Meldung)
        if (error instanceof MatchAwaitingTeamsError) {
          setAwaitingTeams(true);
          return;
        }
        // A-08a (@FU-069)/A-08e W1: nicht leitbar -> Hinweis bzw. "wird vorbereitet" statt Fehlerzweig (kein Toast, kein Sentry)
        if (error instanceof MatchNotOnEngineError) {
          if (error.reason === 'other') { setEngineReadyError(true); } else { setNotOnEngineReason(error.reason); }
          return;
        }
        // P7: Toast + Sentry statt stiller Leeranzeige; "Spiel wird vorbereitet" statt "Keine Spiele".
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        captureFeatureError(normalizedError, 'tournament', 'ensureEngineMatchReady');
        showError(t('management.engineReadyError'));
        setEngineReadyError(true);
      })
      .finally(() => {
        // Only update state if this effect hasn't been cancelled
        if (!cancelled) {
          setIsInitializingMatch(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // C-3 FIX: Intentionally only depend on ID to prevent re-init on other property changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatchData?.id, getLiveMatchData, liveMatches, retryToken]);

  // Minor 4: erhoeht `retryToken` (s. Abhaengigkeitsliste oben), der Effekt laeuft dadurch erneut.
  const handleRetryEngineReady = useCallback(() => setRetryToken((n) => n + 1), []);

  return { isInitializingMatch, engineReadyError, awaitingTeams, notOnEngineReason, handleRetryEngineReady };
}

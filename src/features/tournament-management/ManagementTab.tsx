/**
 * ManagementTab - Turnierleitung (Kampfgericht)
 *
 * Live-Spielverwaltung mit LiveCockpit:
 * - Timer-Management für jedes Spiel
 * - Live-Torzählung mit Event-Tracking
 * - Speicherung in tournament.matches
 * - Persistierung in localStorage
 * - Match-Selektor für flexible Auswahl
 * - Zeit-Editor für manuelle Anpassungen
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../core/generators';
import { LiveCockpit } from '../../components/live-cockpit';
import type { MatchSummary } from '../../components/live-cockpit/types';
import { useCockpitExecution } from '../../hooks/useCockpitExecution';
import { useCockpitLeerGrund } from './hooks/useCockpitLeerGrund';
import { useTournamentMembers } from '../auth/hooks/useTournamentMembers';
import { useEffectiveTournamentRole } from '../auth/hooks/useMyTournamentRole';
import { canEditResults, canManageTournament } from '../auth/utils/permissions';
import { RulesLockProvider } from '../../components/match-settings/RulesLockContext';
import { useToast } from '../../components/ui/Toast/ToastContext';
import { captureFeatureError } from '../../lib/sentry';
import { MatchAwaitingTeamsError, MatchNotOnEngineError, type MatchNotOnEngineReason } from '../../core/errors';
import { matchLabelText } from '../../core/models/slotLabel';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { buildSideContext, sideDisplay, sideName } from '../../components/schedule/matchSides';
import styles from './ManagementTab.module.css';

interface ManagementTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  /**
   * Task A1 (Sofortschutz): NUR lokales State-Update, KEIN Speicherpfad — siehe
   * `UseMatchExecutionProps.onLocalTournamentUpdate`. Von `onTournamentUpdate` oben getrennt,
   * weil `handleUpdateSettings` unten weiterhin echt speichern muss (Turnier-Einstellungen).
   */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  /** Initial match ID to select (from schedule navigation) */
  initialMatchId?: string | null;
  /** Callback when initial match has been consumed */
  onInitialMatchConsumed?: () => void;
}

export const ManagementTab: React.FC<ManagementTabProps> = ({
  tournament,
  schedule,
  onTournamentUpdate,
  initialMatchId,
  onInitialMatchConsumed,
}) => {
  const { t } = useTranslation('tournament');
  const { t: tCommon } = useTranslation('common');
  const { t: tCockpit } = useTranslation('cockpit');
  const { showError } = useToast();
  const [selectedFieldNumber, setSelectedFieldNumber] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isInitializingMatch, setIsInitializingMatch] = useState<boolean>(false);
  // P7: `getLiveMatchData` kann werfen -- unterscheidet "kein Spiel" von "noch nicht bereit".
  const [engineReadyError, setEngineReadyError] = useState<boolean>(false);
  // @TM-033: das Spiel hat noch eine offene Seite – kein Fehler, sondern ein Wartegrund
  const [awaitingTeams, setAwaitingTeams] = useState<boolean>(false);
  // A-08a (@FU-069): Spiel ist nicht über die Engine leitbar (z. B. Ergebnis schon eingetragen)
  const [notOnEngineReason, setNotOnEngineReason] = useState<MatchNotOnEngineReason | null>(null);
  const { isOnline } = useOnlineStatus();
  // Minor 4: "Erneut versuchen" erzwingt einen neuen Ladeversuch ueber diesen Zaehler (s. u.).
  const [retryToken, setRetryToken] = useState(0);

  // A-08a: Cockpit nur über Engine-Ereignisse (kein Altservice, kein Altweg)
  const {
    liveMatches,
    getLiveMatchData,
    handleStart: hookHandleStart,
    handlePause,
    handleResume,
    handleFinish,
    handleGoal,
    handleTimePenalty,
    handleCard,
    handleSubstitution,
    handleFoul,
  } = useCockpitExecution(tournament);

  // Permission check: Get current user's role in this tournament
  const { myMembership, isLoading: membersLoading } = useTournamentMembers(tournament.id);

  // Spielregeln (@W2A-030) ändert nur die Turnierleitung: vorhandene Rechte-Logik, keine Sonderregel
  const { role: myRole } = useEffectiveTournamentRole(tournament.id, myMembership, membersLoading);
  const canChangeRules = myRole ? canManageTournament(myRole) : false;


  // Determine if user can edit results for a specific match
  const userTeamIds = useMemo(() => myMembership?.teamIds ?? [], [myMembership?.teamIds]);
  const checkCanEditMatch = useCallback((matchTeamIds: string[]) => {
    if (!myMembership) {
      return true; // No membership info = allow by default (offline/local mode)
    }
    return canEditResults(myMembership.role, userTeamIds, matchTeamIds);
  }, [myMembership, userTeamIds]);

  // Handle initial match ID from navigation (e.g., from ScheduleTab "Zum Cockpit", URL `?matchId=`).
  // C-COCKPIT-MATCHID-BEENDET: Öffnen beendet nie ein anderes Spiel (@SL-010, ein Gerät je Feld) –
  // laufende Spiele bleiben laufen, das Cockpit zeigt nur das gewählte.
  useEffect(() => {
    if (initialMatchId) {
      // Find the match to get its field number
      const match = schedule.allMatches.find(m => m.id === initialMatchId);
      if (match) {
        // Set the field and match selection
        setSelectedFieldNumber(match.field);
        setSelectedMatchId(initialMatchId);
      }
      // Consume the initial match ID
      onInitialMatchConsumed?.();
    }
  }, [initialMatchId, schedule.allMatches, onInitialMatchConsumed]);

  // Spielseiten: Team über die Team-ID, offene Seite über ihre Herkunft (@TM-015) – nie über gespeicherte Namen
  const sides = useMemo(
    () => buildSideContext(
      { teams: tournament.teams, groups: tournament.groups, matches: schedule.allMatches },
    ),
    [tournament.teams, tournament.groups, schedule.allMatches],
  );

  // Convert ScheduledMatch to MatchSummary
  const toMatchSummary = useCallback((sm: ScheduledMatch): MatchSummary => {
    const home = sideDisplay(sm, 'A', sides);
    const away = sideDisplay(sm, 'B', sides);
    return {
      id: sm.id,
      number: sm.matchNumber,
      phaseLabel: sm.label ? matchLabelText(sm.label) : (sm.phase === 'groupStage' ? t('management.groupStage') : t('management.finalRound')),
      scheduledKickoff: sm.time,
      fieldId: `field-${sm.field}`,
      homeTeam: { id: home.id, name: home.name },
      awayTeam: { id: away.id, name: away.name },
      tournamentPhase: sm.phase, // For detecting phase changes
    };
  }, [sides, t]);

  // Get matches for selected field
  const fieldMatches = useMemo(() =>
    schedule.allMatches
      .filter((m) => m.field === selectedFieldNumber)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
    [schedule.allMatches, selectedFieldNumber]
  );

  // Find current match (selected OR running OR first without result)
  const currentMatchData = useMemo((): ScheduledMatch | undefined => {
    if (selectedMatchId) {
      return fieldMatches.find(m => m.id === selectedMatchId);
    }
    // Automatic selection: Running match or first without result
    const runningMatch = fieldMatches.find((m) => {
      const liveMatch = liveMatches.get(m.id);
      return liveMatch && liveMatch.status !== 'FINISHED';
    });
    return runningMatch ?? fieldMatches.find((m) =>
      m.scoreA === undefined || m.scoreB === undefined
    );
  }, [selectedMatchId, fieldMatches, liveMatches]);

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

  // Current match as LiveMatch (derived from state)
  const currentMatch = useMemo(() =>
    currentMatchData ? liveMatches.get(currentMatchData.id) ?? null : null,
    [currentMatchData, liveMatches]
  );

  // Find last finished match
  const lastFinishedMatchData = useMemo(() => {
    const finishedMatches = fieldMatches.filter((m) =>
      m.scoreA !== undefined && m.scoreB !== undefined
    ) as (ScheduledMatch & { scoreA: number; scoreB: number })[];
    return finishedMatches[finishedMatches.length - 1];
  }, [fieldMatches]);

  const lastFinishedMatch = useMemo(() =>
     
    lastFinishedMatchData ? {
      match: toMatchSummary(lastFinishedMatchData),
      homeScore: lastFinishedMatchData.scoreA,
      awayScore: lastFinishedMatchData.scoreB,
    } : null,
    [lastFinishedMatchData, toMatchSummary]
  );

  // Upcoming matches (matches after current)
  const upcomingMatches = useMemo(() => {
    const currentIndex = fieldMatches.findIndex((m) => m.id === currentMatchData?.id);
    return currentIndex !== -1
      ? fieldMatches.slice(currentIndex + 1).map(toMatchSummary)
      : fieldMatches.map(toMatchSummary);
  }, [fieldMatches, currentMatchData, toMatchSummary]);

  // Handler: Match selection change – C-COCKPIT-MATCHID-BEENDET: beendet kein laufendes Spiel (@SL-010)
  const handleMatchSelectionChange = useCallback((newMatchId: string | null) => {
    setSelectedMatchId(newMatchId);
  }, []);

  // Handler: Load next match on current field
  // BUG-FIX: Improved logic - find next unplayed match on current field
  const handleLoadNextMatch = useCallback(() => {
    // Find next unplayed match on current field after current match
    const currentIndex = fieldMatches.findIndex(m => m.id === currentMatchData?.id);
    const nextMatchOnField = fieldMatches
      .slice(currentIndex + 1)
      .find(m => m.scoreA === undefined || m.scoreB === undefined);

    if (nextMatchOnField) {
      setSelectedMatchId(nextMatchOnField.id);
    } else {
      // If no more matches on current field, find first unplayed match on any field
      const firstUnplayedMatch = schedule.allMatches.find(
        m => m.scoreA === undefined || m.scoreB === undefined
      );
      if (firstUnplayedMatch && firstUnplayedMatch.field !== selectedFieldNumber) {
        // Switch to that field and select the match
        setSelectedFieldNumber(firstUnplayedMatch.field);
        setSelectedMatchId(firstUnplayedMatch.id);
      } else {
        // Reset selection to auto-select
        setSelectedMatchId(null);
      }
    }
  }, [fieldMatches, currentMatchData, schedule.allMatches, selectedFieldNumber]);

  const handleFinishAndReset = useCallback((matchId: string): Promise<string | null> => handleFinish(matchId).then((eventId) => {
    setTimeout(() => { setSelectedMatchId(null); }, 0);
    return eventId;
  }), [handleFinish]);

  const handleUpdateSettings = useCallback(async (settings: import('../../types/tournament').MatchCockpitSettings) => {
    // @W2A-030: Regelfelder speichert nur die Turnierleitung. Alle anderen behalten den
    // gespeicherten Stand, auch wenn die Eingabe im Dialog etwas anderes sagt.
    const gespeichert = tournament.matchCockpitSettings ?? DEFAULT_MATCH_COCKPIT_SETTINGS;
    const erlaubt = canChangeRules
      ? settings
      : {
          ...settings,
          timePenaltyDurationSeconds: gespeichert.timePenaltyDurationSeconds,
          penaltyShootersPerTeam: gespeichert.penaltyShootersPerTeam,
        };
    // Merge with existing tournament settings
    const updatedTournament = {
      ...tournament,
      matchCockpitSettings: erlaubt,
    };
    // Persist
    onTournamentUpdate(updatedTournament);
  }, [tournament, onTournamentUpdate, canChangeRules]);

  // A-08d2b (B1): Ereignisse kommen vom Engine-Weg bereits im Laufzeitformat (teamId) -- keine
  // Umrechnung mehr an der Prop-Grenze. Das Cockpit bekommt das Match unveraendert.

  // Kein Spiel im Cockpit: die Tafel nennt den Grund (@SL-052, @SL-054); Sperr-Hinweise nach Rot (@SL-089)
  const { leer, sperrHinweise, leerProps } = useCockpitLeerGrund({
    tournament, allMatches: schedule.allMatches, currentMatchData, awaitingTeams, isOnline, sides, selectedFieldNumber,
    upcomingMatches, onLoadNextMatch: handleLoadNextMatch,
  });

  return (
    <div className={styles.container}>
      {/* FIELD SELECTOR (if multiple fields) */}
      {tournament.numberOfFields > 1 && (
        <div className={styles.fieldSelector}>
          {Array.from({ length: tournament.numberOfFields }, (_, i) => i + 1).map((fieldNum) => (
            <button
              key={fieldNum}
              data-testid={`field-button-${fieldNum}`}
              className={`${styles.fieldButton} ${fieldNum === selectedFieldNumber ? styles.fieldButtonActive : ''}`}
              onClick={() => {
                setSelectedFieldNumber(fieldNum);
                setSelectedMatchId(null);
              }}
            >
              {t('management.field', { number: fieldNum })}
            </button>
          ))}
        </div>
      )}

      {/* MATCH SELECTOR */}
      <div className={styles.matchSelector}>
        <label className={styles.matchSelectorLabel}>
          {t('management.selectMatch')}
        </label>
        <select
          className={styles.matchSelect}
          value={selectedMatchId ?? ''}
          onChange={(e) => { handleMatchSelectionChange(e.target.value || null); }}
        >
          <option value="">{t('management.autoNextMatch')}</option>
          {fieldMatches.map(match => (
            <option key={match.id} value={match.id}>
              #{match.matchNumber} - {sideName(match, 'A', sides)} vs {sideName(match, 'B', sides)} ({match.time})
              {match.scoreA !== undefined ? ` [${match.scoreA}:${match.scoreB}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* LIVE COCKPIT */}
      {currentMatch ? (
        <RulesLockProvider value={!canChangeRules}>
          <LiveCockpit
            fieldName={t('management.field', { number: selectedFieldNumber })}
            tournamentName={tournament.title}
            tournamentId={tournament.id}
            cockpitSettings={tournament.matchCockpitSettings}
            readOnly={!checkCanEditMatch([currentMatch.homeTeam.id, currentMatch.awayTeam.id])}
            currentMatch={currentMatch}
            sperrHinweise={sperrHinweise}
            lastFinishedMatch={lastFinishedMatch}
            upcomingMatches={upcomingMatches}
            highlightNextMatchMinutesBefore={5}
            onStart={(matchId) => { void hookHandleStart(matchId); }}
            onPause={(matchId) => { void handlePause(matchId); }}
            onResume={(matchId) => { void handleResume(matchId); }}
            onFinish={handleFinishAndReset}
            onGoal={(matchId, teamId, delta, options) => handleGoal(matchId, teamId, delta, options)}
            // A-08c (@FU-071): Undo, Direkteintrag, Zeit, Wiedereröffnen, K.-o.-/Strafstoß-Handler und
            // Ereignis-Bearbeiten/-Löschen haben keinen Engine-Weg und werden NICHT übergeben
            // -- das Cockpit blendet die zugehörigen Knöpfe aus.
            onLoadNextMatch={handleLoadNextMatch}
            // Event tracking callbacks
            onTimePenalty={(matchId, teamId, options) => { void handleTimePenalty(matchId, teamId, options); }}
            onCard={(matchId, teamId, type, options) => { void handleCard(matchId, teamId, type, options); }}
            onSubstitution={(matchId, teamId, options) => { void handleSubstitution(matchId, teamId, options); }}
            onFoul={(matchId, teamId) => { void handleFoul(matchId, teamId); }}
            onUpdateSettings={(settings) => { void handleUpdateSettings(settings); }}
          />
        </RulesLockProvider>
      ) : leer?.art === 'wartetAufHerkunft' ? (
        <LiveCockpit {...leerProps} />
      ) : isInitializingMatch ? (
        <div className={styles.noMatches}>
          {t('management.matchLoading')}
        </div>
      ) : notOnEngineReason ? (
        <div className={styles.noMatches} data-testid="cockpit-not-on-engine">
          {notOnEngineReason === 'resultEntered'
            ? tCockpit('engine.retract.hint.goalFinished')
            : t('filter.status.skipped')}
        </div>
      ) : engineReadyError ? (
        <div className={styles.noMatches}>
          {t('management.enginePreparing')}
          <div><button type="button" className={styles.retryButton} data-testid="engine-ready-retry" onClick={handleRetryEngineReady}>{tCommon('actions.retry')}</button></div>
        </div>
      ) : leer?.art === 'keinSpiel' ? (
        <LiveCockpit {...leerProps} />
      ) : (
        <div className={styles.noMatches}>
          {t('management.noMatchesOnField')}
        </div>
      )}

      {/* CONFIRM DIALOGS */}
    </div>
  );
};

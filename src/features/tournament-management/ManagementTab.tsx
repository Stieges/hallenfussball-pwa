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
import { Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../core/generators';
import { LiveCockpit } from '../../components/live-cockpit';
import { MatchSummary } from '../../components/match-cockpit/MatchCockpit';
import { ConfirmDialog, useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useMatchExecution } from '../../hooks/useMatchExecution';
import { useTournamentMembers } from '../auth/hooks/useTournamentMembers';
import { canEditResults } from '../auth/utils/permissions';
import styles from './ManagementTab.module.css';

interface ManagementTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
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
  const [selectedFieldNumber, setSelectedFieldNumber] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isInitializingMatch, setIsInitializingMatch] = useState<boolean>(false);

  // Use extracted hook for live match management
  const {
    liveMatches,
    getLiveMatchData,
    handleStart: hookHandleStart,
    handlePause,
    handleResume,
    handleFinish,
    handleForceFinish,
    handleGoal,
    handleTimePenalty,
    handleCard,
    handleSubstitution,
    handleFoul,
    handleUndoLastEvent,
    handleManualEditResult,
    handleAdjustTime,
    handleReopenMatch,
    hasRunningMatch,
    // Tiebreaker handlers
    handleStartOvertime,
    handleStartGoldenGoal,
    handleStartPenaltyShootout,
    handleRecordPenaltyResult,
    handleCancelTiebreaker,
    handleUpdateEvent,
  } = useMatchExecution({ tournament, onTournamentUpdate });

  // Permission check: Get current user's role in this tournament
  const { myMembership } = useTournamentMembers(tournament.id);

  // Determine if user can edit results for a specific match
  const userTeamIds = useMemo(() => myMembership?.teamIds ?? [], [myMembership?.teamIds]);
  const checkCanEditMatch = useCallback((matchTeamIds: string[]) => {
    if (!myMembership) {
      return true; // No membership info = allow by default (offline/local mode)
    }
    return canEditResults(myMembership.role, userTeamIds, matchTeamIds);
  }, [myMembership, userTeamIds]);

  // Confirm dialogs
  const startWithResultDialog = useConfirmDialog({
    title: t('management.existingResults'),
    message: '',
    variant: 'warning',
    confirmText: t('management.startAnyway'),
    cancelText: t('common.cancel'),
  });

  const switchMatchDialog = useConfirmDialog({
    title: t('management.runningMatch'),
    message: '',
    variant: 'warning',
    confirmText: t('management.switch'),
    cancelText: t('common.cancel'),
  });

  // Handle initial match ID from navigation (e.g., from ScheduleTab "Zum Cockpit")
  // BUG-FIX: When navigating from ScheduleTab with a running match, we need to
  // end the running match first. The user already confirmed in ScheduleTab.
  useEffect(() => {
    if (initialMatchId) {
      // Check if there's a running match that needs to be ended
      const runningMatch = hasRunningMatch();
      if (runningMatch && runningMatch.id !== initialMatchId) {
        // End the running match first - user already confirmed in ScheduleTab
        void handleFinish(runningMatch.id);
      }

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
  }, [initialMatchId, schedule.allMatches, onInitialMatchConsumed, hasRunningMatch, handleFinish]);

  // Helper: Check if a team reference is a placeholder (not a real team ID)
  const isPlaceholder = useCallback((teamRef: string): boolean => {
    return (
      teamRef === 'TBD' ||
      teamRef.includes('-winner') ||
      teamRef.includes('-loser') ||
      teamRef.startsWith('group-') ||
      teamRef.startsWith('semi') ||
      teamRef.startsWith('quarter') ||
      teamRef.startsWith('final')
    );
  }, []);

  // Helper: Get team name from team ID
  const getTeamName = useCallback((teamId: string): string | null => {
    const team = schedule.teams.find(t => t.id === teamId);
    return team?.name ?? null;
  }, [schedule.teams]);

  // Convert ScheduledMatch to MatchSummary with proper team resolution
  // BUG-FIX: Use originalTeamA/B as IDs and resolve actual team names
  const toMatchSummary = useCallback((sm: ScheduledMatch): MatchSummary => {
    // Use original team references as IDs
    const homeId = sm.originalTeamA || sm.homeTeam;
    const awayId = sm.originalTeamB || sm.awayTeam;

    // Resolve team names - prefer lookup from teams array if not a placeholder
    let homeName = sm.homeTeam;
    let awayName = sm.awayTeam;

    if (!isPlaceholder(homeId)) {
      const resolved = getTeamName(homeId);
      if (resolved) { homeName = resolved; }
    }

    if (!isPlaceholder(awayId)) {
      const resolved = getTeamName(awayId);
      if (resolved) { awayName = resolved; }
    }

    return {
      id: sm.id,
      number: sm.matchNumber,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty label should use phase-based default
      phaseLabel: sm.label || (sm.phase === 'groupStage' ? t('management.groupStage') : t('management.finalRound')),
      scheduledKickoff: sm.time,
      fieldId: `field-${sm.field}`,
      homeTeam: { id: homeId, name: homeName },
      awayTeam: { id: awayId, name: awayName },
      tournamentPhase: sm.phase, // For detecting phase changes
    };
  }, [isPlaceholder, getTeamName, t]);

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

  // C-3 FIX: Ensure match is initialized with proper cancellation to prevent race conditions
  // When currentMatchData changes rapidly (e.g., quick field switching), we cancel pending inits
  useEffect(() => {
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
      .catch((error) => {
        console.error('[ManagementTab] Match initialization failed:', error);
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
  }, [currentMatchData?.id, getLiveMatchData, liveMatches]);

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

  // Handler: Start match with confirmation for existing results
  const handleStart = useCallback(async (matchId: string) => {
    const match = liveMatches.get(matchId);
    if (!match) { return; }

    const hasExistingResult = match.homeScore > 0 || match.awayScore > 0;

    if (hasExistingResult && match.status === 'NOT_STARTED') {
      const confirmed = await startWithResultDialog.confirm({
        message: t('management.existingResultsMessage', { homeScore: match.homeScore, awayScore: match.awayScore }),
        details: t('management.matchDetails', { number: match.number, home: match.homeTeam.name, away: match.awayTeam.name }),
      });

      if (!confirmed) { return; }
    }

    void hookHandleStart(matchId);
  }, [liveMatches, hookHandleStart, startWithResultDialog, t]);

  // Handler: Match selection change with warning for running match
  const handleMatchSelectionChange = useCallback(async (newMatchId: string | null) => {
    const runningMatch = hasRunningMatch();

    if (runningMatch && runningMatch.id !== newMatchId) {
      const confirmed = await switchMatchDialog.confirm({
        message: t('management.switchMatchMessage', { number: runningMatch.number, home: runningMatch.homeTeam.name, away: runningMatch.awayTeam.name, homeScore: runningMatch.homeScore, awayScore: runningMatch.awayScore }),
        confirmText: t('management.endAndSwitch'),
      });

      if (!confirmed) { return; }

      void handleFinish(runningMatch.id);
    }

    setSelectedMatchId(newMatchId);
  }, [hasRunningMatch, handleFinish, switchMatchDialog, t]);

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

  // Handler: Reopen last match
  const handleReopenLastMatch = useCallback(() => {
     
    if (!lastFinishedMatchData) { return; }
    setSelectedMatchId(lastFinishedMatchData.id);
    void handleReopenMatch(lastFinishedMatchData);
  }, [lastFinishedMatchData, handleReopenMatch]);

  const handleFinishAndReset = useCallback(async (matchId: string) => {
    await handleFinish(matchId);
    setTimeout(() => { setSelectedMatchId(null); }, 0);
  }, [handleFinish]);

  const handleUpdateSettings = useCallback(async (settings: import('../../types/tournament').MatchCockpitSettings) => {
    // Merge with existing tournament settings
    const updatedTournament = {
      ...tournament,
      matchCockpitSettings: settings,
    };
    // Persist
    onTournamentUpdate(updatedTournament);
  }, [tournament, onTournamentUpdate]);

  return (
    <div className={styles.container}>
      {/* FIELD SELECTOR (if multiple fields) */}
      {tournament.numberOfFields > 1 && (
        <div className={styles.fieldSelector}>
          {Array.from({ length: tournament.numberOfFields }, (_, i) => i + 1).map((fieldNum) => (
            <button
              key={fieldNum}
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
          onChange={(e) => { void handleMatchSelectionChange(e.target.value || null); }}
        >
          <option value="">{t('management.autoNextMatch')}</option>
          {fieldMatches.map(match => (
            <option key={match.id} value={match.id}>
              #{match.matchNumber} - {match.homeTeam} vs {match.awayTeam} ({match.time})
              {match.scoreA !== undefined ? ` [${match.scoreA}:${match.scoreB}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* LIVE COCKPIT */}
      {currentMatch ? (
        <LiveCockpit
          fieldName={t('management.field', { number: selectedFieldNumber })}
          tournamentName={tournament.title}
          tournamentId={tournament.id}
          cockpitSettings={tournament.matchCockpitSettings}
          readOnly={!checkCanEditMatch([currentMatch.homeTeam.id, currentMatch.awayTeam.id])}
          currentMatch={currentMatch}
          lastFinishedMatch={lastFinishedMatch}
          upcomingMatches={upcomingMatches}
          highlightNextMatchMinutesBefore={5}
          onStart={(matchId) => { void handleStart(matchId); }}
          onPause={(matchId) => { void handlePause(matchId); }}
          onResume={(matchId) => { void handleResume(matchId); }}
          onFinish={(matchId) => { void handleFinishAndReset(matchId); }}
          onGoal={(matchId, teamId, delta, options) => { void handleGoal(matchId, teamId, delta, options); }}
          onUndoLastEvent={(matchId) => { void handleUndoLastEvent(matchId); }}
          onManualEditResult={(matchId, home, away) => { void handleManualEditResult(matchId, home, away); }}
          onAdjustTime={(matchId, time) => { void handleAdjustTime(matchId, time); }}
          onLoadNextMatch={handleLoadNextMatch}
          onReopenLastMatch={handleReopenLastMatch}
          // Event tracking callbacks
          onTimePenalty={(matchId, teamId, options) => { void handleTimePenalty(matchId, teamId, options); }}
          onCard={(matchId, teamId, type, options) => { void handleCard(matchId, teamId, type, options); }}
          onSubstitution={(matchId, teamId, options) => { void handleSubstitution(matchId, teamId, options); }}
          onFoul={(matchId, teamId) => { void handleFoul(matchId, teamId); }}
          // Tiebreaker callbacks
          onStartOvertime={(matchId) => { void handleStartOvertime(matchId); }}
          onStartGoldenGoal={(matchId) => { void handleStartGoldenGoal(matchId); }}
          onStartPenaltyShootout={(matchId) => { void handleStartPenaltyShootout(matchId); }}
          onRecordPenaltyResult={(matchId, home, away) => { void handleRecordPenaltyResult(matchId, home, away); }}
          onForceFinish={(matchId) => { void handleForceFinish(matchId); }}
          onCancelTiebreaker={(matchId) => { void handleCancelTiebreaker(matchId); }}
          onUpdateEvent={(matchId, eventId, updates) => { void handleUpdateEvent(matchId, eventId, updates); }}
          onUpdateSettings={(settings) => { void handleUpdateSettings(settings); }}
        />
      ) : isInitializingMatch ? (
        <div className={styles.noMatches}>
          {t('management.matchLoading')}
        </div>
      ) : (
        <div className={styles.noMatches}>
          {t('management.noMatchesOnField')}
        </div>
      )}

      {/* CONFIRM DIALOGS */}
      <ConfirmDialog {...startWithResultDialog.dialogProps} />
      <ConfirmDialog {...switchMatchDialog.dialogProps} />
    </div>
  );
};

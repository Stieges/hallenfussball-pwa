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
 *
 * Refactored:
 * - Uses useLiveMatchManagement hook for state management
 * - Uses ConfirmDialog instead of window.confirm
 * - Uses CSS Modules for responsive styles
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../core/generators';
import { LiveCockpitMockup } from '../../components/live-cockpit';
import { MatchSummary } from '../../components/match-cockpit/MatchCockpit';
import { ConfirmDialog, useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useMatchExecution } from '../../hooks/useMatchExecution';
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
  const [selectedFieldNumber, setSelectedFieldNumber] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

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

  // Confirm dialogs
  const startWithResultDialog = useConfirmDialog({
    title: 'Vorhandene Ergebnisse',
    message: '',
    variant: 'warning',
    confirmText: 'Trotzdem starten',
    cancelText: 'Abbrechen',
  });

  const switchMatchDialog = useConfirmDialog({
    title: 'Laufendes Spiel',
    message: '',
    variant: 'warning',
    confirmText: 'Wechseln',
    cancelText: 'Abbrechen',
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
      phaseLabel: sm.label || (sm.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
      scheduledKickoff: sm.time,
      fieldId: `field-${sm.field}`,
      homeTeam: { id: homeId, name: homeName },
      awayTeam: { id: awayId, name: awayName },
      tournamentPhase: sm.phase, // For detecting phase changes
    };
  }, [isPlaceholder, getTeamName]);

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

  // Ensure match is initialized in service
  useEffect(() => {
    if (currentMatchData) {
      void getLiveMatchData(currentMatchData);
    }
  }, [currentMatchData, getLiveMatchData]);

  // Current match as LiveMatch (derived from state)
  const currentMatch = useMemo(() =>
    currentMatchData ? liveMatches.get(currentMatchData.id) ?? null : null,
    [currentMatchData, liveMatches]
  );

  // Find last finished match
  const lastFinishedMatchData = useMemo(() => {
    const finishedMatches = fieldMatches.filter((m) =>
      m.scoreA !== undefined && m.scoreB !== undefined
    );
    return finishedMatches[finishedMatches.length - 1];
  }, [fieldMatches]);

  const lastFinishedMatch = useMemo(() =>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check: array indexing can return undefined
    lastFinishedMatchData ? {
      match: toMatchSummary(lastFinishedMatchData),
      homeScore: lastFinishedMatchData.scoreA ?? 0,
      awayScore: lastFinishedMatchData.scoreB ?? 0,
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
        message: `Für dieses Spiel liegen bereits Ergebnisse vor!\n\nAktueller Stand: ${match.homeScore}:${match.awayScore}\n\nWenn Sie das Spiel jetzt starten, werden die vorhandenen Ergebnisse gelöscht und durch die Live-Erfassung ersetzt (Start bei 0:0).`,
        details: `Spiel #${match.number}: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
      });

      if (!confirmed) { return; }
    }

    void hookHandleStart(matchId);
  }, [liveMatches, hookHandleStart, startWithResultDialog]);

  // Handler: Match selection change with warning for running match
  const handleMatchSelectionChange = useCallback(async (newMatchId: string | null) => {
    const runningMatch = hasRunningMatch();

    if (runningMatch && runningMatch.id !== newMatchId) {
      const confirmed = await switchMatchDialog.confirm({
        message: `Spiel #${runningMatch.number} läuft noch!\n\n${runningMatch.homeTeam.name} vs ${runningMatch.awayTeam.name}\nAktueller Stand: ${runningMatch.homeScore}:${runningMatch.awayScore}\n\nWenn Sie zu einem anderen Spiel wechseln, wird das laufende Spiel automatisch beendet.`,
        confirmText: 'Spiel beenden & wechseln',
      });

      if (!confirmed) { return; }

      void handleFinish(runningMatch.id);
    }

    setSelectedMatchId(newMatchId);
  }, [hasRunningMatch, handleFinish, switchMatchDialog]);

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check: array indexing can return undefined
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
              Feld {fieldNum}
            </button>
          ))}
        </div>
      )}

      {/* MATCH SELECTOR */}
      <div className={styles.matchSelector}>
        <label className={styles.matchSelectorLabel}>
          Spiel auswählen (optional - automatisch wird das nächste ausgewählt):
        </label>
        <select
          className={styles.matchSelect}
          value={selectedMatchId ?? ''}
          onChange={(e) => { void handleMatchSelectionChange(e.target.value || null); }}
        >
          <option value="">Automatisch (nächstes Spiel)</option>
          {fieldMatches.map(match => (
            <option key={match.id} value={match.id}>
              #{match.matchNumber} - {match.homeTeam} vs {match.awayTeam} ({match.time})
              {match.scoreA !== undefined ? ` [${match.scoreA}:${match.scoreB}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* LIVE COCKPIT - Based on HTML Mockups */}
      {currentMatch ? (
        <LiveCockpitMockup
          fieldName={`Feld ${selectedFieldNumber}`}
          tournamentName={tournament.title}
          tournamentId={tournament.id}
          cockpitSettings={tournament.matchCockpitSettings}
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
      ) : (
        <div className={styles.noMatches}>
          Keine Spiele auf diesem Feld vorhanden
        </div>
      )}

      {/* CONFIRM DIALOGS */}
      <ConfirmDialog {...startWithResultDialog.dialogProps} />
      <ConfirmDialog {...switchMatchDialog.dialogProps} />
    </div>
  );
};

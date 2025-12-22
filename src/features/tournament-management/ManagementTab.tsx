/**
 * ManagementTab - Turnierleitung (Kampfgericht)
 *
 * Live-Spielverwaltung mit MatchCockpit:
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

import { useState, useCallback, useMemo } from 'react';
import { Tournament } from '../../types/tournament';
import { GeneratedSchedule, ScheduledMatch } from '../../lib/scheduleGenerator';
import {
  MatchCockpit,
  MatchSummary,
} from '../../components/match-cockpit/MatchCockpit';
import { ConfirmDialog, useConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useLiveMatchManagement } from '../../hooks/useLiveMatchManagement';
import styles from './ManagementTab.module.css';

interface ManagementTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

export const ManagementTab: React.FC<ManagementTabProps> = ({
  tournament,
  schedule,
  onTournamentUpdate
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
  } = useLiveMatchManagement({ tournament, onTournamentUpdate });

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

  // Convert ScheduledMatch to MatchSummary
  const toMatchSummary = useCallback((sm: ScheduledMatch): MatchSummary => ({
    id: sm.id,
    number: sm.matchNumber,
    phaseLabel: sm.label || (sm.phase === 'groupStage' ? 'Vorrunde' : 'Finalrunde'),
    scheduledKickoff: sm.time,
    fieldId: `field-${sm.field}`,
    homeTeam: { id: sm.homeTeam, name: sm.homeTeam },
    awayTeam: { id: sm.awayTeam, name: sm.awayTeam },
  }), []);

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
    const runningMatch = fieldMatches.find((m) =>
      liveMatches.has(m.id) && liveMatches.get(m.id)!.status !== 'FINISHED'
    );
    return runningMatch || fieldMatches.find((m) =>
      m.scoreA === undefined || m.scoreB === undefined
    );
  }, [selectedMatchId, fieldMatches, liveMatches]);

  // Current match as LiveMatch
  const currentMatch = useMemo(() =>
    currentMatchData ? getLiveMatchData(currentMatchData) : null,
    [currentMatchData, getLiveMatchData]
  );

  // Find last finished match
  const lastFinishedMatchData = useMemo(() => {
    const finishedMatches = fieldMatches.filter((m) =>
      m.scoreA !== undefined && m.scoreB !== undefined
    );
    return finishedMatches[finishedMatches.length - 1];
  }, [fieldMatches]);

  const lastFinishedMatch = useMemo(() =>
    lastFinishedMatchData ? {
      match: toMatchSummary(lastFinishedMatchData),
      homeScore: lastFinishedMatchData.scoreA || 0,
      awayScore: lastFinishedMatchData.scoreB || 0,
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
    if (!match) {return;}

    const hasExistingResult = match.homeScore > 0 || match.awayScore > 0;

    if (hasExistingResult && match.status === 'NOT_STARTED') {
      const confirmed = await startWithResultDialog.confirm({
        message: `Für dieses Spiel liegen bereits Ergebnisse vor!\n\nAktueller Stand: ${match.homeScore}:${match.awayScore}\n\nWenn Sie das Spiel jetzt starten, werden die vorhandenen Ergebnisse gelöscht und durch die Live-Erfassung ersetzt (Start bei 0:0).`,
        details: `Spiel #${match.number}: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
      });

      if (!confirmed) {return;}
    }

    hookHandleStart(matchId);
  }, [liveMatches, hookHandleStart, startWithResultDialog]);

  // Handler: Match selection change with warning for running match
  const handleMatchSelectionChange = useCallback(async (newMatchId: string | null) => {
    const runningMatch = hasRunningMatch();

    if (runningMatch && runningMatch.id !== newMatchId) {
      const confirmed = await switchMatchDialog.confirm({
        message: `Spiel #${runningMatch.number} läuft noch!\n\n${runningMatch.homeTeam.name} vs ${runningMatch.awayTeam.name}\nAktueller Stand: ${runningMatch.homeScore}:${runningMatch.awayScore}\n\nWenn Sie zu einem anderen Spiel wechseln, wird das laufende Spiel automatisch beendet.`,
        confirmText: 'Spiel beenden & wechseln',
      });

      if (!confirmed) {return;}

      handleFinish(runningMatch.id);
    }

    setSelectedMatchId(newMatchId);
  }, [hasRunningMatch, handleFinish, switchMatchDialog]);

  // Handler: Load next match
  const handleLoadNextMatch = useCallback(() => {
    const currentIndex = fieldMatches.findIndex(m => m.id === currentMatchData?.id);
    const nextMatch = fieldMatches
      .slice(currentIndex + 1)
      .find(m => m.scoreA === undefined || m.scoreB === undefined);

    if (nextMatch) {
      setSelectedMatchId(nextMatch.id);
    }
  }, [fieldMatches, currentMatchData]);

  // Handler: Reopen last match
  const handleReopenLastMatch = useCallback(() => {
    if (!lastFinishedMatchData) {return;}
    setSelectedMatchId(lastFinishedMatchData.id);
    handleReopenMatch(lastFinishedMatchData);
  }, [lastFinishedMatchData, handleReopenMatch]);

  // Wrapped handleFinish to reset selection
  const handleFinishAndReset = useCallback((matchId: string) => {
    handleFinish(matchId);
    setTimeout(() => setSelectedMatchId(null), 0);
  }, [handleFinish]);

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
          value={selectedMatchId || ''}
          onChange={(e) => handleMatchSelectionChange(e.target.value || null)}
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

      {/* MATCH COCKPIT */}
      {currentMatch ? (
        <MatchCockpit
          fieldName={`Feld ${selectedFieldNumber}`}
          tournamentName={tournament.title}
          currentMatch={currentMatch}
          lastFinishedMatch={lastFinishedMatch}
          upcomingMatches={upcomingMatches}
          highlightNextMatchMinutesBefore={5}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onFinish={handleFinishAndReset}
          onGoal={handleGoal}
          onUndoLastEvent={handleUndoLastEvent}
          onManualEditResult={handleManualEditResult}
          onAdjustTime={handleAdjustTime}
          onLoadNextMatch={handleLoadNextMatch}
          onReopenLastMatch={handleReopenLastMatch}
          // Tiebreaker callbacks
          onStartOvertime={handleStartOvertime}
          onStartGoldenGoal={handleStartGoldenGoal}
          onStartPenaltyShootout={handleStartPenaltyShootout}
          onRecordPenaltyResult={handleRecordPenaltyResult}
          onForceFinish={handleForceFinish}
          onCancelTiebreaker={handleCancelTiebreaker}
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

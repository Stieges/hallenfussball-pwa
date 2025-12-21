/**
 * ScheduleTab - Spielplan-Ansicht mit Ergebniseingabe
 *
 * Features:
 * - Spielplan wie in der Vorschau (ohne grünen Header)
 * - Editable mode für Ergebniseingabe
 * - Schiedsrichter-Zuweisung änderbar
 * - Feld-Zuweisung änderbar
 * - Live-Tabellen-Berechnung
 */

import { useState, useEffect, CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { theme } from '../../styles/theme';
import { Tournament, Standing, CorrectionEntry, CorrectionReasonType } from '../../types/tournament';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { ScheduleActionButtons } from '../../components/ScheduleActionButtons';
import { CorrectionDialog } from '../../components/dialogs';
import { useAppSettings, useUserProfile } from '../../hooks/useUserProfile';
import { usePermissions } from '../../hooks/usePermissions';
import { CorrectionReason } from '../../types/userProfile';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../../utils/playoffResolver';
import { STORAGE_KEYS } from '../../constants/storage';

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

// Correction state interface
interface CorrectionState {
  matchId: string;
  originalScoreA: number;
  originalScoreB: number;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
}) => {
  // App settings for result lock behavior
  const appSettings = useAppSettings();
  // User profile for correction logging
  const { profile } = useUserProfile();
  // Permission check for corrections
  const { canCorrectResults } = usePermissions(tournament.id);
  // Toast notifications
  const { showWarning } = useToast();

  // Correction mode state
  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  // Helper: Check if match is finished
  const isMatchFinished = (matchId: string): boolean => {
    // 1. Check if scores exist
    const match = tournament.matches.find(m => m.id === matchId);
    if (match?.scoreA === undefined || match.scoreB === undefined) {
      return false;
    }

    // 2. Check liveMatches status if available
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournament.id));
      if (stored) {
        const liveMatches = JSON.parse(stored);
        if (liveMatches[matchId]?.status === 'FINISHED') {
          return true;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }

    // 3. Fallback: implicit detection
    return true;
  };

  // MON-LIVE-INDICATOR-01: Get running match IDs from localStorage
  const getRunningMatchIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournament.id));
      if (stored) {
        const liveMatches = JSON.parse(stored);
        const runningIds = Object.keys(liveMatches).filter(
          matchId => liveMatches[matchId]?.status === 'RUNNING'
        );
        return new Set(runningIds);
      }
    } catch (e) {
      // Ignore parse errors
    }
    return new Set();
  };

  // State for running match IDs with polling for live updates
  const [runningMatchIds, setRunningMatchIds] = useState<Set<string>>(() => getRunningMatchIds());

  // Poll localStorage every 2 seconds to detect changes from ManagementTab
  useEffect(() => {
    const updateRunningMatches = () => {
      const newIds = getRunningMatchIds();
      setRunningMatchIds(prev => {
        // Only update if the sets are different
        const prevArray = Array.from(prev).sort();
        const newArray = Array.from(newIds).sort();
        if (JSON.stringify(prevArray) !== JSON.stringify(newArray)) {
          return newIds;
        }
        return prev;
      });
    };

    // Initial update
    updateRunningMatches();

    // Poll every 2 seconds
    const interval = setInterval(updateRunningMatches, 2000);

    // Also listen for storage events (when changed in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.liveMatches(tournament.id)) {
        updateRunningMatches();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [tournament.id]);

  // Correction handlers
  const handleStartCorrection = (matchId: string) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (match?.scoreA === undefined || match.scoreB === undefined) {return;}

    setCorrectionState({
      matchId,
      originalScoreA: match.scoreA,
      originalScoreB: match.scoreB,
    });
    setShowCorrectionDialog(true);
  };

  const handleCancelCorrection = () => {
    setShowCorrectionDialog(false);
    setCorrectionState(null);
  };

  const handleConfirmCorrection = (
    newScoreA: number,
    newScoreB: number,
    reason: CorrectionReason,
    note?: string
  ) => {
    if (!correctionState) {return;}

    // Create correction entry for match history
    const correctionEntry: CorrectionEntry = {
      timestamp: new Date().toISOString(),
      previousScoreA: correctionState.originalScoreA,
      previousScoreB: correctionState.originalScoreB,
      newScoreA,
      newScoreB,
      reasonType: reason as CorrectionReasonType,
      note,
      userName: profile.name || 'Unbekannt',
    };

    // Log correction to console
    console.log('[Correction]', correctionEntry);

    // Update tournament matches with correction history
    const updatedMatches = tournament.matches.map(m => {
      if (m.id !== correctionState.matchId) {return m;}

      // Add correction to history
      const existingHistory = m.correctionHistory || [];
      return {
        ...m,
        scoreA: newScoreA,
        scoreB: newScoreB,
        correctionHistory: [...existingHistory, correctionEntry],
      };
    });

    onTournamentUpdate(
      { ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() },
      false // Triggers standings recalculation in parent
    );

    setShowCorrectionDialog(false);
    setCorrectionState(null);
  };

  const handleScoreChange = (matchId: string, scoreA: number, scoreB: number) => {
    // Block editing finished matches (if lock is enabled)
    // Corrections are handled via the CorrectionDialog, not inline editing
    if (appSettings.lockFinishedResults && isMatchFinished(matchId)) {
      showWarning('Dieses Spiel ist bereits beendet. Verwenden Sie "Ergebnis korrigieren".');
      return;
    }

    // Prüfe, ob das Spiel gerade live läuft
    const liveMatchesData = localStorage.getItem(STORAGE_KEYS.liveMatches(tournament.id));
    if (liveMatchesData) {
      try {
        const liveMatches = JSON.parse(liveMatchesData);
        const liveMatch = liveMatches[matchId];

        if (liveMatch && liveMatch.status === 'RUNNING') {
          const confirmEdit = window.confirm(
            '⚠️ WARNUNG: Dieses Spiel läuft gerade LIVE in der Turnierleitung!\n\n' +
            'Wenn Sie hier das Ergebnis ändern, wird es die Live-Verwaltung überschreiben.\n\n' +
            'Möchten Sie trotzdem fortfahren?'
          );

          if (!confirmEdit) {
            return; // Abbrechen
          }
        }
      } catch (e) {
        console.error('Error checking live matches:', e);
      }
    }

    // Update tournament matches
    const updatedMatches = tournament.matches.map((match) =>
      match.id === matchId ? { ...match, scoreA, scoreB } : match
    );

    const updatedTournament = {
      ...tournament,
      matches: updatedMatches,
      updatedAt: new Date().toISOString(),
    };

    // Score changes don't need schedule regeneration
    onTournamentUpdate(updatedTournament, false);

    // FIX: Auto-resolve playoff pairings after group match completion
    const playoffResolution = autoResolvePlayoffsIfReady(updatedTournament);
    if (playoffResolution?.wasResolved) {
      console.log('✅ Playoff-Paarungen automatisch aufgelöst:', playoffResolution);
      onTournamentUpdate(updatedTournament, false);
    }

    // FIX: Also resolve bracket placeholders after playoff matches (e.g., semi → final)
    const bracketResolution = resolveBracketAfterPlayoffMatch(updatedTournament);
    if (bracketResolution?.wasResolved) {
      console.log('✅ Bracket-Paarungen automatisch aufgelöst:', bracketResolution);
      onTournamentUpdate(updatedTournament, false);
    }
  };

  const handleRefereeAssignment = (matchId: string, refereeNumber: number | null) => {
    const updatedTournament = { ...tournament };

    // Update manual assignments
    if (!updatedTournament.refereeConfig) {
      console.warn('[ScheduleTab] No refereeConfig found');
      return;
    }

    const manualAssignments = { ...(updatedTournament.refereeConfig.manualAssignments || {}) };

    if (refereeNumber === null) {
      delete manualAssignments[matchId];
    } else {
      manualAssignments[matchId] = refereeNumber;
    }

    updatedTournament.refereeConfig = {
      ...updatedTournament.refereeConfig,
      manualAssignments,
    };

    // Update tournament.matches directly with the new referee assignment
    updatedTournament.matches = updatedTournament.matches.map(match =>
      match.id === matchId ? { ...match, referee: refereeNumber ?? undefined } : match
    );

    // Manual referee changes should NOT regenerate schedule (keeps match IDs stable)
    onTournamentUpdate(updatedTournament, false);
  };

  const handleResetRefereeAssignments = () => {
    const updatedTournament = { ...tournament };

    if (updatedTournament.refereeConfig) {
      updatedTournament.refereeConfig = {
        ...updatedTournament.refereeConfig,
        manualAssignments: {},
      };

      // Referee reset needs schedule regeneration
      onTournamentUpdate(updatedTournament, true);
    }
  };

  const handleFieldChange = (matchId: string, fieldNumber: number) => {
    const updatedTournament = { ...tournament };

    // Update field assignments
    if (!updatedTournament.fieldAssignments) {
      updatedTournament.fieldAssignments = {};
    }

    updatedTournament.fieldAssignments[matchId] = fieldNumber;

    // Field changes need schedule regeneration
    onTournamentUpdate(updatedTournament, true);
  };

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  };

  return (
    <>
      <div style={containerStyle} className="schedule-tab-container">
      {/* Spielplan-Anzeige - wie in TournamentPreview, aber ohne grünen Header */}
      <Card>
        {/* Action Buttons Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}>
          <ScheduleActionButtons
            tournament={tournament}
            schedule={schedule}
            standings={currentStandings}
            variant="organizer"
          />
        </div>

        <ScheduleDisplay
          schedule={schedule}
          currentStandings={currentStandings}
          currentMatches={tournament.matches}
          editable={true}
          onScoreChange={handleScoreChange}
          onRefereeChange={handleRefereeAssignment}
          onFieldChange={handleFieldChange}
          finishedMatches={appSettings.lockFinishedResults
            ? new Set(
                tournament.matches
                  .filter(m => isMatchFinished(m.id))
                  .map(m => m.id)
              )
            : new Set() // Lock disabled: all matches stay editable
          }
          correctionMatchId={correctionState?.matchId ?? null}
          onStartCorrection={handleStartCorrection}
          runningMatchIds={runningMatchIds}
          canCorrectResults={canCorrectResults}
        />

        {/* Manuelle SR-Zuweisung (wenn SR aktiv) */}
        {tournament.refereeConfig && tournament.refereeConfig.mode !== 'none' && (
          <RefereeAssignmentEditor
            matches={schedule.allMatches}
            refereeConfig={tournament.refereeConfig}
            onAssignmentChange={handleRefereeAssignment}
            onResetAssignments={handleResetRefereeAssignments}
          />
        )}
      </Card>
    </div>

    {/* Correction Dialog */}
    {correctionState && (() => {
      const match = tournament.matches.find(m => m.id === correctionState.matchId);
      if (!match) {return null;}

      return (
        <CorrectionDialog
          isOpen={showCorrectionDialog}
          onClose={handleCancelCorrection}
          onConfirm={handleConfirmCorrection}
          matchLabel={`Spiel #${match.round}`}
          teamA={match.teamA}
          teamB={match.teamB}
          originalScoreA={correctionState.originalScoreA}
          originalScoreB={correctionState.originalScoreB}
        />
      );
    })()}

    {/* Responsive Styles */}
    <style>{`
      /* Mobile adjustments */
      @media (max-width: 767px) {
        .schedule-tab-container {
          padding: 16px 12px !important;
        }
      }

      /* Tablet adjustments */
      @media (min-width: 768px) and (max-width: 1024px) {
        .schedule-tab-container {
          padding: 20px 16px !important;
        }
      }

      /* Ensure cards are responsive on mobile */
      @media (max-width: 767px) {
        .schedule-tab-container .card {
          border-radius: 8px;
          padding: 12px;
        }
      }
    `}</style>
    </>
  );
};

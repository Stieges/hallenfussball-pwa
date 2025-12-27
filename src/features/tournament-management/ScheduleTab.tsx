/**
 * ScheduleTab - Spielplan-Ansicht mit Ergebniseingabe
 *
 * Features:
 * - Spielplan wie in der Vorschau (ohne grünen Header)
 * - Bearbeiten-Modus für SR und Feld-Änderungen
 * - Ergebniseingabe immer aktiv
 * - Konfliktprüfung beim Speichern
 * - Live-Tabellen-Berechnung
 *
 * Refactored: Logic extracted to custom hooks for maintainability
 * - useScheduleHistory: Undo/Redo functionality
 * - useRunningMatches: Live match detection
 * - useCorrectionMode: Correction dialog flow
 * - usePendingChanges: Edit mode state
 * - useScheduleTabActions: Action handlers
 */

import { useCallback, CSSProperties, useState } from 'react';
import { Card } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { colors } from '../../design-tokens';
import { Tournament, Standing, Match } from '../../types/tournament';
import {
  useScheduleHistory,
  useRunningMatches,
  useCorrectionMode,
  usePendingChanges,
  useScheduleTabActions,
} from './hooks';
import { isMatchFinished, getTeamName } from './utils';
import { ScheduleToolbar, ScheduleViewMode, ScheduleConflictContent } from './components';
import { GeneratedSchedule } from '../../lib/scheduleGenerator';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { ScheduleEditor } from '../schedule-editor';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { CorrectionDialog } from '../../components/dialogs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useAppSettings } from '../../hooks/useUserProfile';
import { usePermissions } from '../../hooks/usePermissions';

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
}) => {
  // App settings for result lock behavior
  const appSettings = useAppSettings();
  // Permission check for corrections
  const { canCorrectResults } = usePermissions(tournament.id);
  // Toast notifications
  const { showWarning, showSuccess } = useToast();

  // View mode: 'table' (classic) or 'grid' (new schedule editor)
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('table');

  // ==========================================================================
  // CUSTOM HOOKS
  // ==========================================================================

  // Pending changes and edit mode state
  const {
    isEditing,
    pendingChanges,
    hasUnsavedChanges,
    setIsEditing,
    setPendingReferee,
    setPendingField,
    handleCancelEdit,
    handleSaveChanges,
    handleSaveWithConflicts,
    showConflictDialog,
    setShowConflictDialog,
    detectedConflicts,
  } = usePendingChanges({
    tournament,
    onTournamentUpdate,
    clearHistory: () => clearHistory(),
  });

  // Unified Undo/Redo History (shared across both views)
  const { saveToHistory, handleUndo, handleRedo, clearHistory, canUndo, canRedo } =
    useScheduleHistory({
      matches: tournament.matches,
      onMatchesUpdate: useCallback((matches: Match[]) => {
        onTournamentUpdate({
          ...tournament,
          matches,
          updatedAt: new Date().toISOString(),
        }, false);
      }, [tournament, onTournamentUpdate]),
      isEditing,
    });

  // Running matches (for live indicators)
  const { runningMatchIds } = useRunningMatches({
    tournamentId: tournament.id,
  });

  // Correction mode state and handlers
  const {
    correctionState,
    showCorrectionDialog,
    handleStartCorrection,
    handleCancelCorrection,
    handleConfirmCorrection,
  } = useCorrectionMode({
    tournament,
    onTournamentUpdate,
    canCorrectResults,
  });

  // Action handlers (extracted for maintainability)
  const {
    handleRedistributeSR,
    handleRedistributeFields,
    handleMatchSwap,
    handleScoreChange,
    handleRefereeAssignment,
    handleResetRefereeAssignments,
    handleFieldChange,
  } = useScheduleTabActions({
    tournament,
    onTournamentUpdate,
    isEditing,
    saveToHistory,
    showSuccess,
    showWarning,
    setPendingReferee,
    setPendingField,
    lockFinishedResults: appSettings.lockFinishedResults,
  });

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const containerStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  };

  const editModeCardStyle: CSSProperties = isEditing ? {
    border: `3px solid ${colors.primary}`,
    boxShadow: `0 0 0 4px ${colors.secondaryLight}`,
  } : {};

  // Build finished matches set for display
  const finishedMatchIds = appSettings.lockFinishedResults
    ? new Set(
        tournament.matches
          .filter(m => isMatchFinished(m.id, tournament.matches, tournament.id))
          .map(m => m.id)
      )
    : new Set<string>();

  // Count conflicts by severity
  const criticalConflicts = detectedConflicts.filter(c =>
    c.type === 'team_double_booking' ||
    c.type === 'referee_double_booking' ||
    c.type === 'field_overlap'
  );
  const warningConflicts = detectedConflicts.filter(c =>
    c.type === 'break_violation'
  );

  return (
    <>
      <div style={containerStyle} className="schedule-tab-container">
        <Card style={editModeCardStyle}>
          {/* Action Buttons Header */}
          <ScheduleToolbar
            isEditing={isEditing}
            onStartEditing={() => setIsEditing(true)}
            onSave={handleSaveChanges}
            onCancel={handleCancelEdit}
            hasUnsavedChanges={hasUnsavedChanges}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onRedistributeSR={handleRedistributeSR}
            onRedistributeFields={handleRedistributeFields}
            showSRButton={tournament.refereeConfig?.mode !== 'none'}
            showFieldsButton={tournament.numberOfFields > 1}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            tournament={tournament}
            schedule={schedule}
            standings={currentStandings}
          />

          {/* Conditional rendering based on view mode */}
          {viewMode === 'table' ? (
            <ScheduleDisplay
              schedule={schedule}
              currentStandings={currentStandings}
              currentMatches={tournament.matches}
              editable={true}
              editingSchedule={isEditing}
              pendingChanges={isEditing ? pendingChanges : undefined}
              onScoreChange={handleScoreChange}
              onRefereeChange={handleRefereeAssignment}
              onFieldChange={handleFieldChange}
              onMatchSwap={isEditing ? handleMatchSwap : undefined}
              finishedMatches={finishedMatchIds}
              correctionMatchId={correctionState?.matchId ?? null}
              onStartCorrection={handleStartCorrection}
              runningMatchIds={runningMatchIds}
            />
          ) : (
            <ScheduleEditor
              tournament={tournament}
              onTournamentUpdate={(updatedTournament) => onTournamentUpdate(updatedTournament, false)}
              externalEditMode={isEditing}
              onBeforeChange={saveToHistory}
              hideToolbar={true}
            />
          )}

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

      {/* Conflict Warning Dialog */}
      <ConfirmDialog
        isOpen={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        onConfirm={handleSaveWithConflicts}
        title="Konflikte im Spielplan"
        confirmText="Trotzdem speichern"
        cancelText="Zurück zur Bearbeitung"
        variant={criticalConflicts.length > 0 ? 'danger' : 'warning'}
        message={
          <ScheduleConflictContent
            criticalConflicts={criticalConflicts}
            warningConflicts={warningConflicts}
          />
        }
      />

      {/* Correction Dialog */}
      {correctionState && (() => {
        const match = tournament.matches.find(m => m.id === correctionState.matchId);
        if (!match) { return null; }

        return (
          <CorrectionDialog
            isOpen={showCorrectionDialog}
            onClose={handleCancelCorrection}
            onConfirm={handleConfirmCorrection}
            matchLabel={`Spiel #${match.round}`}
            teamA={getTeamName(match.teamA, tournament.teams)}
            teamB={getTeamName(match.teamB, tournament.teams)}
            originalScoreA={correctionState.originalScoreA}
            originalScoreB={correctionState.originalScoreB}
          />
        );
      })()}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 767px) {
          .schedule-tab-container {
            padding: 16px 12px !important;
          }
        }

        @media (min-width: 768px) and (max-width: 1024px) {
          .schedule-tab-container {
            padding: 20px 16px !important;
          }
        }

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

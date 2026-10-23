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
 * Logik in Hooks: useScheduleHistory (Undo/Redo), usePendingChanges (Bearbeiten), useScheduleTabActions (Aktionen);
 * Status aus einer Quelle, der gemeinsamen Ansicht (`buildTournamentView`, Leitung + Engine-Status, A-36c).
 * Rechte (A-11): nur über useCan -- Bearbeiten, Tauschen, Schiri nur mit manageSchedule (@ZP-040).
 */

import { useCallback, CSSProperties, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { cssVars, mediaQueries, layoutHeights } from '../../design-tokens'
import { Tournament, Standing, Match } from '../../types/tournament';
import { MatchUpdate } from '../../core/models/types';
import {
  useScheduleHistory,
  usePendingChanges,
  useScheduleTabActions,
  useScheduleFilters,
  getFilterOptions,
} from './hooks';
import { useScheduleView } from './hooks/useScheduleView';
import { ScheduleToolbar, ScheduleViewMode, ScheduleConflictContent } from './components';
import { ScheduleResultEntryPrompt } from './components/ScheduleResultEntryPrompt';
import { GeneratedSchedule } from '../../core/generators';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { ScheduleEditor } from '../schedule-editor';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useCan } from '../auth/hooks/useCan';
import { ScheduleFilterBar, EmptyFilterState } from './components/schedule-filter';

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  /**
   * A2 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-brief.md): local-only state
   * sync (no persistence) — used by result entry so the UI updates immediately without a full
   * tournament save.
   */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  /** A2: persists specific matches via a targeted update instead of a full tournament save. */
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
  /** Callback to navigate to management tab with selected match */
  onNavigateToCockpit?: (matchId: string) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
  onLocalTournamentUpdate,
  onMatchesUpdate,
  onNavigateToCockpit,
}) => {
  const { t } = useTranslation('tournament');
  // A-11: Cockpit-Hinweis bei laufendem Spiel = Spielbetrieb; Spielplan ändern = manageSchedule; Aushang (@ZM-019)
  const canControlTimer = useCan('writeMatchData', tournament.id);
  const canSchedule = useCan('manageSchedule', tournament.id);
  const canNotice = useCan('tournamentSettings', tournament.id);
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

  // Die gemeinsame Ansicht der Leitung (A-36c): eine Statusquelle für Karten, Filter und „läuft gerade“
  const { view, locale, liveMatchIds, elapsedSeconds } = useScheduleView(tournament);

  // US-VIEWER-FILTERS: Schedule filtering
  const filterOptions = useMemo(() => getFilterOptions(tournament), [tournament]);
  const {
    filters,
    draftFilters,
    isSheetOpen,
    openSheet,
    closeSheet,
    applyDraft,
    resetDraft,
    updateDraft,
    updateFilters,
    resetFilters,
    activeFilterCount,
    hasFilters,
    getFilteredMatches,
    getMatchCount,
  } = useScheduleFilters({ filterOptions });

  // Get filtered matches for display
  // FIX: Use schedule.allMatches as source ensuring we filter what is displayed (Preview/Generated),
  // rather than potentially stale tournament.matches (Persistence).
  // ScheduledMatch trägt slotA/slotB unverändert; der Filter liest nur Slots (A-03)
  const sourceMatchesForFiltering = useMemo(() => {
    return schedule.allMatches as unknown as Match[];
  }, [schedule.allMatches]);

  const filteredMatches = useMemo(
    () => getFilteredMatches(sourceMatchesForFiltering, tournament.teams),
    [getFilteredMatches, sourceMatchesForFiltering, tournament.teams]
  );

  // Build set of visible match IDs for ScheduleDisplay
  const visibleMatchIds = useMemo(
    () => new Set(filteredMatches.map(m => m.id)),
    [filteredMatches]
  );

  // Running match navigation dialog state
  const [pendingCockpitMatchId, setPendingCockpitMatchId] = useState<string | null>(null);
  const [showRunningMatchDialog, setShowRunningMatchDialog] = useState(false);

  // Handler for navigating to cockpit with running match check
  const handleNavigateToCockpit = useCallback((matchId: string) => {
    // Check if there's a running match (other than the target match)
    const runningMatchArray = Array.from(liveMatchIds).filter(id => id !== matchId);

    if (runningMatchArray.length > 0) {
      // There's a running match - need confirmation
      if (!canControlTimer) {
        // User doesn't have permission to interrupt running match
        showWarning(t('schedule.runningMatchNoPermission'));
        return;
      }
      // User has permission - show dialog
      setPendingCockpitMatchId(matchId);
      setShowRunningMatchDialog(true);
    } else {
      // No running match - navigate directly
      onNavigateToCockpit?.(matchId);
    }
  }, [liveMatchIds, canControlTimer, showWarning, onNavigateToCockpit, t]);

  // Handler to confirm navigation (ends running match)
  const handleConfirmCockpitNavigation = useCallback(() => {
    if (pendingCockpitMatchId) {
      onNavigateToCockpit?.(pendingCockpitMatchId);
    }
    setPendingCockpitMatchId(null);
    setShowRunningMatchDialog(false);
  }, [pendingCockpitMatchId, onNavigateToCockpit]);

  // Handler to cancel navigation
  const handleCancelCockpitNavigation = useCallback(() => {
    setPendingCockpitMatchId(null);
    setShowRunningMatchDialog(false);
  }, []);

  // Get info about the currently running match for dialog
  const runningMatchInfo = useMemo(() => {
    const runningMatchId = Array.from(liveMatchIds)[0];
    if (!runningMatchId) { return null; }
    const match = tournament.matches.find(m => m.id === runningMatchId);
    const shown = view.byId.get(runningMatchId);
    if (!match || !shown) { return null; }
    // Spielseiten aus der Ansicht (@TM-015): Teamname bzw. Herkunft, nie ein gespeicherter Name
    return {
      id: runningMatchId,
      homeName: shown.home.label,
      awayName: shown.away.label,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    };
  }, [liveMatchIds, tournament.matches, view]);

  // Action handlers (extracted for maintainability)
  const {
    handleRedistributeSR,
    handleRedistributeFields,
    handleMatchSwap,
    handleScoreChange,
    handleRefereeAssignment,
    handleResetRefereeAssignments,
    handleFieldChange,
    resultEntry,
  } = useScheduleTabActions({
    tournament,
    onTournamentUpdate,
    isEditing,
    saveToHistory,
    showSuccess,
    showWarning,
    setPendingReferee,
    setPendingField,
    // Korrektur beendeter Spiele im Spielplan: Grund-Auswahl statt Sperre (@EK-063, @EK-004), wie im Cockpit (useCockpitKorrektur).
    // Die Nutzer-Einstellung `lockFinishedResults` verwies auf einen Knopf „Ergebnis korrigieren“, den es hier nicht gibt.
    lockFinishedResults: false,
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
    border: `3px solid ${cssVars.colors.primary}`,
    boxShadow: `0 0 0 4px ${cssVars.colors.secondaryLight}`,
    // Fix: backdrop-filter creates a new containing block for position:fixed,
    // which breaks @dnd-kit DragOverlay positioning (ghost appears offset)
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  } : {};

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
        <Card style={editModeCardStyle} className="schedule-tab-card">
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
            canEditSchedule={canSchedule} canCreateNotice={canNotice}
          />

          {/* US-VIEWER-FILTERS: Filter Bar */}
          {viewMode === 'table' && (
            <ScheduleFilterBar
              filters={filters}
              draftFilters={draftFilters}
              activeFilterCount={activeFilterCount}
              onFilterChange={updateFilters}
              onReset={resetFilters}
              isSheetOpen={isSheetOpen}
              onOpenSheet={openSheet}
              onCloseSheet={closeSheet}
              onApplySheet={applyDraft}
              onResetDraft={resetDraft}
              onDraftChange={updateDraft}
              filterOptions={filterOptions}
              matches={tournament.matches}
              teams={tournament.teams}
              getMatchCount={getMatchCount}
              style={{ marginBottom: cssVars.spacing.md }}
              data-testid="schedule-filter-bar"
            />
          )}

          {/* Conditional rendering based on view mode */}
          {viewMode === 'table' ? (
            hasFilters && filteredMatches.length === 0 ? (
              <EmptyFilterState
                onReset={resetFilters}
                data-testid="empty-filter-state"
              />
            ) : (
              <ScheduleDisplay
                schedule={schedule}
                currentStandings={currentStandings}
                currentMatches={tournament.matches}
                tournamentTeams={tournament.teams}
                editable={true}
                editingSchedule={isEditing}
                pendingChanges={isEditing ? pendingChanges : undefined}
                onScoreChange={handleScoreChange}
                changeAuthorOf={resultEntry.changeAuthor}
                onRefereeChange={handleRefereeAssignment}
                onFieldChange={handleFieldChange}
                onMatchSwap={isEditing ? handleMatchSwap : undefined}
                view={view}
                locale={locale}
                elapsedSeconds={elapsedSeconds}
                onNavigateToCockpit={onNavigateToCockpit ? handleNavigateToCockpit : undefined}
                visibleMatchIds={hasFilters ? visibleMatchIds : undefined}
              />
            )
          ) : (
            <ScheduleEditor
              tournament={tournament}
              onTournamentUpdate={(updatedTournament) => onTournamentUpdate(updatedTournament, false)}
              onLocalTournamentUpdate={onLocalTournamentUpdate}
              onMatchesUpdate={onMatchesUpdate}
              externalEditMode={isEditing}
              onBeforeChange={saveToHistory}
              hideToolbar={true}
              onRejectStarted={() => showWarning(t('schedule.startedLocked'))}
            />
          )}

          {/* Manuelle SR-Zuweisung (wenn SR aktiv) */}
          {canSchedule && tournament.refereeConfig && tournament.refereeConfig.mode !== 'none' && (
            <RefereeAssignmentEditor
              matches={schedule.allMatches}
              refereeConfig={tournament.refereeConfig}
              onAssignmentChange={handleRefereeAssignment}
              onResetAssignments={handleResetRefereeAssignments}
            />
          )}
        </Card>
      </div>

      <ScheduleResultEntryPrompt prompt={resultEntry.prompt} answerPrompt={resultEntry.answerPrompt} />

      {/* Conflict Warning Dialog */}
      <ConfirmDialog
        isOpen={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        onConfirm={handleSaveWithConflicts}
        title={t('schedule.conflicts.title')}
        confirmText={t('schedule.conflicts.saveAnyway')}
        cancelText={t('schedule.conflicts.backToEdit')}
        variant={criticalConflicts.length > 0 ? 'danger' : 'warning'}
        message={
          <ScheduleConflictContent
            criticalConflicts={criticalConflicts}
            warningConflicts={warningConflicts}
          />
        }
      />

      {/* Running Match Navigation Dialog */}
      {showRunningMatchDialog && runningMatchInfo && (
        <ConfirmDialog
          isOpen={showRunningMatchDialog}
          onClose={handleCancelCockpitNavigation}
          onConfirm={handleConfirmCockpitNavigation}
          title={t('schedule.runningMatch.title')}
          message={t('schedule.runningMatch.message', { teamA: runningMatchInfo.homeName, teamB: runningMatchInfo.awayName, scoreA: runningMatchInfo.scoreA, scoreB: runningMatchInfo.scoreB })}
          confirmText={t('schedule.runningMatch.confirmSwitch')}
          cancelText={t('common.cancel')}
          variant="warning"
        />
      )}

      {/* Responsive Styles */}
      <style>{`
        ${mediaQueries.tabletDown} {
          .schedule-tab-container {
            padding: 16px 12px !important;
          }
        }

        @media (min-width: 768px) and (max-width: 1024px) {
          .schedule-tab-container {
            padding: 20px 16px !important;
          }
        }

        ${mediaQueries.tabletDown} {
          .schedule-tab-container .card {
            border-radius: 8px;
            padding: 12px;
          }

          /* Die schwebende Leiste sitzt im Karten-Container (backdrop-filter macht ihn zum Bezug von position: fixed):
             die Karte reserviert Leistenhöhe plus den Abstand der Leiste zum Kartenrand, damit die letzte Zeile darüber liegt */
          .schedule-tab-card {
            padding-bottom: calc(var(--schedule-action-bar-h, 0px) + ${layoutHeights.bottomNav} + ${cssVars.spacing.lg} + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
    </>
  );
};

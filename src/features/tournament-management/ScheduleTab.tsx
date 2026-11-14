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
 * Logik in Hooks: useScheduleDraft (Bearbeiten als Entwurf, @ZP-101–104), useScheduleEditActions (Tauschen, Schiri, Feld),
 * useScheduleTabActions (Ergebnis-Eingabe);
 * Status aus einer Quelle, der gemeinsamen Ansicht (`buildTournamentView`, Leitung + Engine-Status, A-36c).
 * Rechte (A-11): nur über useCan -- Bearbeiten, Tauschen, Schiri nur mit manageSchedule (@ZP-040).
 */

import { useCallback, CSSProperties, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { cssVars } from '../../design-tokens'
import { Tournament, Standing, Match } from '../../types/tournament';
import { MatchUpdate } from '../../core/models/types';
import { useScheduleDraft, useScheduleEditActions, useScheduleTabActions, useScheduleFilters, getFilterOptions } from './hooks';
import { useScheduleView } from './hooks/useScheduleView';
import { ScheduleToolbar, ScheduleViewMode } from './components';
import { ScheduleEditDialogs } from './components/ScheduleEditDialogs';
import { ScheduleSwapWith } from './components/ScheduleSwapWith';
import { ScheduleResultEntryPrompt } from './components/ScheduleResultEntryPrompt';
import { useScheduleTakeover } from './hooks/useScheduleTakeover';
import { ScheduleForfeitPrompt } from './components/ScheduleForfeitPrompt';
import { useScheduleForfeit } from './hooks/useScheduleForfeit';
import { useSpielplanKorrektur } from './hooks/useSpielplanKorrektur';
import { GeneratedSchedule } from '../../core/generators';
import { ScheduleDisplay } from '../../components/ScheduleDisplay';
import { ScheduleCurrentBlock } from './components/ScheduleCurrentBlock';
import { ScheduleTabStyles } from './components/ScheduleTabStyles';
import { ScheduleEditor } from '../schedule-editor';
import { RefereeAssignmentEditor } from '../../components/RefereeAssignmentEditor';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useCan } from '../auth/hooks/useCan';
import { ScheduleFilterBar, EmptyFilterState } from './components/schedule-filter';
import { GroupCompletionTop } from './group-completion/GroupCompletionTop';
import { ScheduleTimeShift } from './time-shift/ScheduleTimeShift';
import { useTournamentClosed } from '../../hooks/useTournamentClosed';

interface ScheduleTabProps {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  currentStandings: Standing[];
  /** Speichert das ganze Turnier. Kein „neu erzeugen“ mehr (Befund C-REGEN-FLAG): der Spielplan wird hier nie neu erzeugt. */
  onTournamentUpdate: (tournament: Tournament) => void;
  /** Speichern mit Rückmeldung (wirft bei Fehler): „Speichern“ im Bearbeiten-Modus schließt den Entwurf erst danach (@ZP-102) */
  onTournamentSave?: (tournament: Tournament) => Promise<void>;
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

/** Der Entwurf führt den Verlauf selbst (useScheduleDraft); das Raster legt keinen eigenen an. */
const noHistory = (): void => undefined;

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  tournament,
  schedule,
  currentStandings,
  onTournamentUpdate,
  onTournamentSave,
  onLocalTournamentUpdate,
  onMatchesUpdate,
  onNavigateToCockpit,
}) => {
  const { t } = useTranslation('tournament');
  // A-11: Cockpit-Hinweis bei laufendem Spiel = Spielbetrieb; Spielplan ändern = manageSchedule; Aushang (@ZM-019)
  const canControlTimer = useCan('writeMatchData', tournament.id);
  const canSchedule = useCan('manageSchedule', tournament.id);
  // Aushang druckt nur den Link der öffentlichen Ansicht: bleibt nach dem Abschluss (@LZ-037 Z. 5)
  const canNotice = useCan('tournamentSettings', tournament.id, { openAfterClose: true });
  // Endstand-PDF (@DR-048, Daniel 07.11.): Turnierleitung, Co-Admin und Helfer – wer im Turnier mitspielt (writeMatchData); es druckt nur
  // den gespeicherten Endstand und bleibt deshalb nach dem Abschluss offen
  const canFinal = useCan('writeMatchData', tournament.id, { openAfterClose: true });
  const closed = useTournamentClosed(tournament.id); // R3-3 (@LZ-036, @ZP-087): Ergebnis, Schiri, Feld im Spielplan nur vor dem Abschluss
  const canEndRunning = useCan('leadMatches', tournament.id); // @FU-112/@FU-113: Spiel beenden nur Turnierleitung
  // Toast notifications
  const { showWarning, showSuccess, showError } = useToast();

  // View mode: 'table' (classic) or 'grid' (new schedule editor)
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('table');

  // ==========================================================================
  // CUSTOM HOOKS
  // ==========================================================================

  // Bearbeiten als Entwurf (@ZP-101 bis @ZP-104): Anzeige im Bearbeiten-Modus = Entwurf, gespeichert erst mit „Speichern“
  const saveTournament = useCallback(async (t: Tournament) => {
    if (onTournamentSave) { await onTournamentSave(t); } else { onTournamentUpdate(t); }
  }, [onTournamentSave, onTournamentUpdate]);
  const draft = useScheduleDraft({ tournament, schedule, saveTournament, showSuccess, showWarning, showError });
  const { isEditing } = draft;
  const shownSchedule = draft.draftSchedule;
  const edit = useScheduleEditActions({ tournament, draft, onTournamentUpdate, showSuccess, showWarning });

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
    return shownSchedule.allMatches as unknown as Match[];
  }, [shownSchedule.allMatches]);

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

  // Handler to confirm navigation (das laufende Spiel läuft weiter, @SL-194)
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

  // Nummern für die Rückfrage beim Wechsel (@SL-194): das laufende Spiel, das weiterläuft, und das Ziel
  const runningMatchInfo = useMemo(() => {
    const running = tournament.matches.find(m => liveMatchIds.has(m.id) && m.id !== pendingCockpitMatchId);
    const target = tournament.matches.find(m => m.id === pendingCockpitMatchId);
    return running ? { running: running.matchNumber ?? '?', target: target?.matchNumber ?? '?' } : null;
  }, [liveMatchIds, tournament.matches, pendingCockpitMatchId]);

  // B-49 (@FU-081): fremd gesteuertes Feld – „Feld 2 wird gerade von Tom gesteuert“ mit „Spielleitung übernehmen“, danach ins Cockpit
  const takeover = useScheduleTakeover({ tournamentId: tournament.id, showWarning, onTaken: onNavigateToCockpit });

  // Ergebnis-Eingabe (Schnelleingabe); Tauschen/Schiri/Feld stehen in useScheduleEditActions
  const { handleScoreChange, resultEntry } = useScheduleTabActions({
    tournament,
    showWarning,
    // Korrektur beendeter Spiele: Grund-Auswahl statt Sperre (@EK-063, @EK-004); der Einstieg ist „Ergebnis korrigieren“ (useSpielplanKorrektur).
    lockFinishedResults: false,
    offerTakeover: takeover.offerTakeover,
  });

  // „Ergebnis korrigieren“ (@EK-063): derselbe Dialog und derselbe Weg wie im Cockpit
  const korrektur = useSpielplanKorrektur({ view, enterScore: handleScoreChange, istLeitung: canEndRunning });
  // Aktionsauswahl je Spiel (@SL-193): Rechte aus useCan; im Bearbeiten-Modus gelten die Auswahlfelder der Karten
  const actionRights = useMemo(() => (isEditing ? undefined : { lead: canEndRunning, play: canControlTimer, schedule: canSchedule }), [isEditing, canEndRunning, canControlTimer, canSchedule]);

  // B-12: „nicht angetreten“ und „Wertung zurücknehmen“ -- Bedienung nur für die Turnierleitung (@SL-118)
  const forfeit = useScheduleForfeit({ tournament, showWarning, showSuccess });
  const forfeitActions = useMemo(
    () => (forfeit.allowed ? { mark: (id: string) => { void forfeit.markForfeit(id); }, revoke: (id: string) => { void forfeit.revokeForfeit(id); } } : undefined),
    [forfeit],
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const containerStyle: CSSProperties = {
    maxWidth: cssVars.sizing.contentMax,
    margin: '0 auto',
    padding: cssVars.spacing.lg,
  };

  const editModeCardStyle: CSSProperties = isEditing ? {
    border: `${cssVars.borderWidth.strong} solid ${cssVars.colors.primary}`,
    boxShadow: `0 0 0 ${cssVars.spacing.xs} ${cssVars.colors.secondaryLight}`,
    // Fix: backdrop-filter creates a new containing block for position:fixed,
    // which breaks @dnd-kit DragOverlay positioning (ghost appears offset)
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  } : {};

  return (
    <>
      <div style={containerStyle} className="schedule-tab-container" data-actions-in-flow={isEditing ? undefined : ''}>
        <Card style={editModeCardStyle} className="schedule-tab-card">
          {/* GA4 A-13c: Zustand der Phasen und Vorschlag „Gruppe abschließen“ (nur Turnierleitung), nicht im Verwaltungskopf */}
          <GroupCompletionTop />
          {/* @ZP-109: das laufende bzw. nächste Spiel mit der Taste ins Cockpit; im Bearbeiten-Modus und in der Raster-Ansicht keine Karte */}
          {viewMode === 'table' && !isEditing && (
            <ScheduleCurrentBlock
              view={view}
              schedule={shownSchedule}
              tournament={tournament}
              currentMatches={draft.draftTournament.matches}
              elapsedSeconds={elapsedSeconds}
              locale={locale}
              rights={{ lead: canEndRunning, play: canControlTimer, schedule: canSchedule }}
              // Die Karte „Läuft“ führt ins Cockpit des Spiels, das sie selbst zeigt: dort fragt nichts nach (@SL-194 gilt beim Wechsel zu einem anderen Spiel)
              onNavigateToCockpit={onNavigateToCockpit ? (id) => (liveMatchIds.has(id) ? onNavigateToCockpit(id) : handleNavigateToCockpit(id)) : undefined}
            />
          )}
          {/* Action Buttons Header */}
          <ScheduleToolbar
            isEditing={isEditing}
            onStartEditing={draft.startEditing}
            onSave={draft.save} isSaving={draft.isSaving} conflictCount={draft.conflictCount}
            onCancel={draft.requestCancel}
            changeCount={draft.changeCount}
            onUndo={draft.undo}
            onRedo={draft.redo}
            canUndo={draft.canUndo}
            canRedo={draft.canRedo}
            onRedistributeSR={edit.handleRedistributeSR}
            onRedistributeFields={edit.handleRedistributeFields}
            showSRButton={tournament.refereeConfig?.mode !== 'none'}
            showFieldsButton={tournament.numberOfFields > 1}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            tournament={tournament}
            schedule={schedule}
            standings={currentStandings}
            canEditSchedule={canSchedule} canCreateNotice={canNotice} canCreateFinal={canFinal} hideViewToggle={closed}
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
          {viewMode === 'table' || closed ? (
            hasFilters && filteredMatches.length === 0 ? (
              <EmptyFilterState
                onReset={resetFilters}
                data-testid="empty-filter-state"
              />
            ) : (
              // B-26: Zeiten verschieben (@ZP-094, @ZP-098) – Taste, ⋮ je Spiel, „ursprünglich“, Dialog, Vorschau, Streifen
              <ScheduleTimeShift
                tournament={tournament} schedule={schedule} standings={currentStandings} view={view}
                onTournamentUpdate={onTournamentUpdate} showSuccess={showSuccess} canCreateNotice={canNotice} canCreateFinal={canFinal}
                enabled={canSchedule && !isEditing && !closed}
              >
              <ScheduleSwapWith enabled={isEditing} matches={shownSchedule.allMatches} lockedIds={edit.lockedMatchIds} onSwap={edit.handleMatchSwap}>
              <ScheduleDisplay
                schedule={shownSchedule}
                currentStandings={currentStandings}
                currentMatches={draft.draftTournament.matches}
                tournamentTeams={tournament.teams}
                editable={!closed}
                showTournamentHeader={false}
                participantsCollapsed
                showListHead
                editingSchedule={isEditing}
                pendingChanges={isEditing ? draft.changed : undefined}
                onScoreChange={closed ? undefined : handleScoreChange}
                changeAuthorOf={resultEntry.changeAuthor}
                onRefereeChange={closed ? undefined : edit.handleRefereeAssignment}
                onFieldChange={closed ? undefined : edit.handleFieldChange}
                onMatchSwap={isEditing ? edit.handleMatchSwap : undefined}
                view={view}
                locale={locale}
                elapsedSeconds={elapsedSeconds}
                onNavigateToCockpit={onNavigateToCockpit ? handleNavigateToCockpit : undefined}
                canEndRunning={canEndRunning}
                actionRights={actionRights}
                onCorrect={korrektur.onKorrigieren}
                forfeit={forfeitActions}
                visibleMatchIds={hasFilters ? visibleMatchIds : undefined}
              />
              </ScheduleSwapWith>
              </ScheduleTimeShift>
            )
          ) : (
            // Raster = zweite Darstellung desselben Entwurfs: Ablegen wird ein Schritt im Entwurf (@ZP-101)
            <ScheduleEditor
              tournament={draft.draftTournament}
              onTournamentUpdate={edit.handleGridChange}
              onLocalTournamentUpdate={onLocalTournamentUpdate}
              onMatchesUpdate={onMatchesUpdate}
              externalEditMode={isEditing}
              onBeforeChange={noHistory}
              hideToolbar={true}
              onRejectStarted={() => showWarning(t('schedule.startedLocked'))}
            />
          )}

          {/* Manuelle SR-Zuweisung (wenn SR aktiv) */}
          {canSchedule && tournament.refereeConfig && tournament.refereeConfig.mode !== 'none' && (
            <RefereeAssignmentEditor
              matches={shownSchedule.allMatches}
              refereeConfig={draft.draftTournament.refereeConfig ?? tournament.refereeConfig}
              teams={tournament.teams}
              lockedMatchIds={edit.lockedMatchIds}
              onAssignmentChange={edit.handleRefereeAssignment}
              onResetAssignments={edit.handleResetRefereeAssignments}
            />
          )}
        </Card>
      </div>

      {korrektur.dialog}
      <ScheduleResultEntryPrompt prompt={resultEntry.prompt} answerPrompt={resultEntry.answerPrompt} />
      {takeover.dialog}
      <ScheduleForfeitPrompt prompt={forfeit.prompt} answerPrompt={forfeit.answerPrompt} />

      <ScheduleEditDialogs draft={draft} edit={edit} />

      {/* Running Match Navigation Dialog */}
      {showRunningMatchDialog && runningMatchInfo && (
        <ConfirmDialog
          isOpen={showRunningMatchDialog}
          onClose={handleCancelCockpitNavigation}
          onConfirm={handleConfirmCockpitNavigation}
          title={t('schedule.runningMatch.title')}
          message={t('schedule.runningMatch.message', runningMatchInfo)}
          confirmText={t('schedule.runningMatch.confirmSwitch')}
          cancelText={t('common.cancel')}
          variant="warning"
        />
      )}

      <ScheduleTabStyles />
    </>
  );
};

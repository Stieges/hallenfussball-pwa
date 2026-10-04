import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Icons } from '../components/ui';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TournamentPreview } from '../features/tournament-creation/TournamentPreview';
import { ReplanPanel } from '../features/tournament-creation/components/ReplanPanel';
import { openReplan, type ReplanSession } from '../features/tournament-creation/utils/replan';
import { useTournamentStartState } from '../hooks/useTournamentStartState';
import { Step5_Overview as Step5_OverviewDirect } from '../features/tournament-creation/Step5_Overview';
import { getStepFromSearchParams, buildWizardStepPath, type WizardStep } from '../features/tournament-creation';
import { Tournament } from '../types/tournament';
import { useTournaments } from '../hooks/useTournaments';
import { useTournamentWizard } from '../hooks/useTournamentWizard';
import { useIsMobile } from '../hooks/useIsMobile';
import { generateFullSchedule } from '../core/generators';
import { cssVars, fontSizesMd3 } from '../design-tokens'
import { useToast } from '../components/ui/Toast';
import { AuthSection } from '../components/layout/AuthSection';

/** E2 + Controller-Ruling Fixrunde 2: Struktur = alles, was die Generatoren
 *  außer Metadaten lesen — Teams, Felder, Modus, Gruppen, Finalrunde,
 *  Startzeit und Datum. Übrige Metadaten (Name, Ort, Texte) zählen nicht. */
function hasStructuralChanges(current: Tournament, next: Tournament): boolean {
  const teamSignature = (t: Tournament): string =>
    [...t.teams]
      .map((team) => `${team.id}:${team.isRemoved ? 1 : 0}`)
      .sort()
      .join('|');
  return (
    teamSignature(current) !== teamSignature(next) ||
    current.numberOfFields !== next.numberOfFields ||
    current.mode !== next.mode ||
    current.tournamentType !== next.tournamentType ||
    current.groupSystem !== next.groupSystem ||
    current.groupPhaseGameDuration !== next.groupPhaseGameDuration ||
    current.groupPhaseBreakDuration !== next.groupPhaseBreakDuration ||
    current.finalRoundGameDuration !== next.finalRoundGameDuration ||
    current.finalRoundBreakDuration !== next.finalRoundBreakDuration ||
    current.breakBetweenPhases !== next.breakBetweenPhases ||
    current.numberOfGroups !== next.numberOfGroups ||
    current.date !== next.date ||
    current.timeSlot !== next.timeSlot ||
    current.startTime !== next.startTime ||
    current.gamePeriods !== next.gamePeriods ||
    current.halftimeBreak !== next.halftimeBreak ||
    current.minRestSlots !== next.minRestSlots ||
    current.useDFBKeys !== next.useDFBKeys ||
    current.dfbKeyPattern !== next.dfbKeyPattern ||
    JSON.stringify(current.groups) !== JSON.stringify(next.groups) ||
    JSON.stringify(current.finalsConfig) !== JSON.stringify(next.finalsConfig) ||
    JSON.stringify(current.finals) !== JSON.stringify(next.finals) ||
    JSON.stringify(current.refereeConfig) !== JSON.stringify(next.refereeConfig)
  );
}

// Lazy load step components for better performance
const Step1_SportAndType = lazy(() =>
  import('../features/tournament-creation').then(module => ({ default: module.Step1_SportAndType }))
);
const Step2_ModeAndSystem = lazy(() =>
  import('../features/tournament-creation').then(module => ({ default: module.Step2_ModeAndSystem }))
);
const Step3_Metadata = lazy(() =>
  import('../features/tournament-creation').then(module => ({ default: module.Step3_Metadata }))
);
const Step4_Teams = lazy(() =>
  import('../features/tournament-creation').then(module => ({ default: module.Step4_Teams }))
);
// Step5_Overview is imported directly above (not lazy-loaded) to avoid rendering issues
// US-GROUPS-AND-FIELDS: Neuer Step für Gruppen- und Feldkonfiguration
const Step_GroupsAndFields = lazy(() =>
  import('../features/tournament-creation').then(module => ({ default: module.Step_GroupsAndFields }))
);

// Loading fallback component
const StepLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
    color: cssVars.colors.textSecondary,
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: `3px solid ${cssVars.colors.border}`,
        borderTopColor: cssVars.colors.primary,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 12px',
      }} />
      <span>Lade...</span>
    </div>
  </div>
);

interface TournamentCreationScreenProps {
  onBack: () => void;
  onSave?: (tournament: Tournament) => void | Promise<void>;
  existingTournament?: Tournament;
  quickEditMode?: boolean; // Schnellbearbeitung: Zeigt prominenten Speichern-Button
  // Auth Navigation
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings?: () => void;
}

export const TournamentCreationScreen: React.FC<TournamentCreationScreenProps> = ({
  onBack,
  onSave,
  existingTournament,
  quickEditMode = false,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
  onNavigateToSettings,
}) => {
  const { showSuccess, showWarning } = useToast();
  const { t } = useTranslation('wizard');
  const { saveTournament: defaultSaveTournament } = useTournaments();
  // B-02: Anpfiff-Sperre für die Neuplanung (Live-Signal über den gemeinsamen Hook)
  const { state: matchStartState, recheck } = useTournamentStartState(
    existingTournament ?? { id: '', matches: [], status: 'draft', publishedAt: undefined },
    { enabled: Boolean(existingTournament) }
  );
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // ============================================================================
  // WIZARD HOOK - All wizard state and actions from useTournamentWizard
  // ============================================================================
  const {
    // State
    step,
    formData,
    visitedSteps,
    stepErrors,
    scheduleError,
    hasResults,
    lastSavedDataRef,
    // Actions
    setStep,
    setFormData,
    setScheduleError,
    updateForm,
    handleStepChange: wizardHandleStepChange,
    handleNavigateToStep: wizardHandleNavigateToStep,
    canGoNext,
    // Team Actions
    addTeam,
    removeTeam,
    updateTeam,
    // Placement Actions
    movePlacementLogic,
    togglePlacementLogic,
    reorderPlacementLogic,
    // Tournament Type Actions
    handleTournamentTypeChange,
    handleResetTournament,
    // Draft Creation
    createDraftTournament,
    // Persistence
    saveDraft,
    publishTournament,
  } = useTournamentWizard(existingTournament);

  // F-321: Sync step from URL whenever the search params change (for deep-linking).
  // Previously this effect ran only on mount with an empty dep array, which left the
  // URL and the rendered step inconsistent when the router re-parsed `location.search`
  // after the first render. We now react to location.search changes and also seed
  // `visitedSteps` so the renderer actually shows the requested step.
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlStep = getStepFromSearchParams(searchParams);

    if (existingTournament?.lastVisitedStep) {
      return;
    }

    if (urlStep !== step) {
      setStep(urlStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step is intentionally read-once per URL change
  }, [location.search, existingTournament?.lastVisitedStep]);

  // ============================================================================
  // SCREEN-SPECIFIC STATE (not in hook)
  // ============================================================================
  const [generatedSchedule, setGeneratedSchedule] = useState<ReturnType<typeof generateFullSchedule> | null>(null);
  const [replanSession, setReplanSession] = useState<ReplanSession | null>(null);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  // @W1-023: Festlegen mit Ladezustand; Sperre verhindert zweites Turnier bei Doppelklick.
  const [isPublishing, setIsPublishing] = useState(false);
  const publishLockRef = useRef(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Use provided onSave or fallback to default saveTournament
  const saveTournament = onSave ?? defaultSaveTournament;

  // Helper function to check if data has changed
  const hasUnsavedChanges = useCallback((): boolean => {
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if any field has data */
    const hasData =
      formData.title ||
      formData.location ||
      (formData.teams && formData.teams.length > 0);
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

    if (!hasData) { return false; }

    // Check if data is different from last save
    const currentData = JSON.stringify(formData);
    return currentData !== lastSavedDataRef.current;
  }, [formData, lastSavedDataRef]);

  // Show auto-save confirmation notification
  const showSaveConfirmation = useCallback(() => {
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 2000); // Hide after 2 seconds
  }, []);

  // ============================================================================
  // SCREEN-SPECIFIC FUNCTIONS (Autosave, Preview, Publish)
  // ============================================================================

  // Helper function to save as draft
  // IMPORTANT: Always use defaultSaveTournament for autosave, not saveTournament!
  // saveTournament might be mapped to onSave which triggers navigation back to dashboard
  const saveAsDraft = useCallback(async () => {
    if (!hasUnsavedChanges()) { return; }

    try {
      await saveDraft();

      // Show save confirmation notification
      showSaveConfirmation();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('[TournamentCreation] localStorage quota exceeded');
      } else {
        console.error('[TournamentCreation] Failed to save draft:', error);
      }
    }
  }, [hasUnsavedChanges, saveDraft, showSaveConfirmation]);

  // Helper function to change step with autosave, slide animation, and URL update
  const handleStepChange = useCallback((newStep: number) => {
    // Determine slide direction based on navigation
    const direction = newStep > step ? 'right' : 'left';
    setSlideDirection(direction);

    // Reset generated schedule when navigating TO step 6 (Overview)
    if (newStep === 6) {
      setGeneratedSchedule(null);
    }
    // Use wizard hook's handleStepChange with saveAsDraft callback
    wizardHandleStepChange(newStep, () => void saveAsDraft());

    // Update URL with new step (replace to avoid history clutter)
    const newPath = buildWizardStepPath(newStep as WizardStep, existingTournament?.id);
    void navigate(newPath, { replace: true });

    // Clear slide direction after animation completes
    setTimeout(() => setSlideDirection(null), 300);
  }, [wizardHandleStepChange, saveAsDraft, step, navigate, existingTournament?.id]);

  // Autosave 1: Periodic autosave every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges()) {
        void saveAsDraft();
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveAsDraft]);

  // Autosave 2: On tab close or page refresh
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        void saveAsDraft();

        // Show browser warning (optional)
        event.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for cross-browser compatibility
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, saveAsDraft]);

  const handlePreview = () => {
    // Reset error state
    setScheduleError(null);

    // Validate by attempting to generate schedule
    try {
      const tournament = createDraftTournament();
      // B-02 Paket A (@W5-005): Im Bearbeiten-Modus wird die Strukturänderung
      // als Neuplanung mit Vorschau angeboten – bis zur Bestätigung ändert sich
      // nichts (@W5-007), nach dem Anpfiff nicht (@W5-008).
      if (existingTournament) {
        setReplanSession(openReplan(existingTournament, tournament, matchStartState));
        return;
      }
      const schedule = generateFullSchedule(tournament);
      // Store generated schedule for preview
      // Note: We're already on step 6, just setting the schedule triggers re-render
      // which switches from Overview to Preview view
      setGeneratedSchedule(schedule);
    } catch (error) {
      // Capture error and display to user
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unbekannter Fehler beim Erstellen des Spielplans';
      setScheduleError(errorMessage);
      console.error('[TournamentCreationScreen] Schedule generation failed:', error);
    }
  };

  const handlePublish = async (override?: Partial<Tournament>) => {
    if (publishLockRef.current) { return; }
    publishLockRef.current = true;
    setIsPublishing(true);
    try {
      const published = await publishTournament(override);

      // Call external save callback if provided (e.g. for potential redirects or parent updates)
      // Though publishTournament already saves to repo.
      await saveTournament(published);
      // @W1-023: Toast statt Inline-Banner — überlebt den Seitenwechsel über den
      // ToastProvider in App.tsx.
      showSuccess(t('publish.success'));

      if (!onSave) {
        onBack();
      }
    } catch (error) {
      // Capture error and display to user
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unbekannter Fehler beim Veröffentlichen des Turniers';
      setScheduleError(errorMessage);
      console.error('[TournamentCreationScreen] Publish failed:', error);
      // Stay on preview screen to show error
    } finally {
      publishLockRef.current = false;
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft();
      showSuccess('Turnier als Entwurf gespeichert!');
    } catch (error) {
      console.error('[TournamentCreation] Failed to manual save draft:', error);
    }
  };

  // B-02 (@W5-005): Bestätigen ersetzt den Spielplan und veröffentlicht.
  // W1: Vor der Bestätigung wird der Anpfiff frisch geprüft (fail-closed).
  const handleReplanConfirm = async () => {
    if (!replanSession) {
      return;
    }
    if (replanSession.preview.status !== 'preview') {
      return;
    }
    const freshState = await recheck();
    if (freshState !== 'not-started') {
      setReplanSession({
        ...replanSession,
        preview: {
          status: 'refused',
          reasonKey:
            freshState === 'started'
              ? 'replan.reasonRefusedKickoff'
              : 'replan.reasonRefusedUnknown',
        },
      });
      return;
    }
    const updated = replanSession.confirm();
    setReplanSession(null);
    setFormData((prev) => ({ ...prev, matches: updated.matches }));
    await handlePublish({ matches: updated.matches });
  };

  // B-02 (@W5-007): Abbrechen stellt den Ist-Stand des Turniers wieder her.
  const handleReplanCancel = () => {
    setReplanSession(null);
    if (existingTournament) {
      setFormData(existingTournament);
    }
  };

  // E2: „Speichern & Zurück" – nur Metadaten geändert speichert direkt,
  // eine Strukturänderung führt über handlePreview ins Neuplanen-Panel.
  const handleSaveAndBack = () => {
    if (
      existingTournament &&
      hasStructuralChanges(existingTournament, createDraftTournament())
    ) {
      handlePreview();
      return;
    }
    void handlePublish();
  };

  const handleBackToDashboard = () => {
    // Check if there are any unsaved changes
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: true if any field has data */
    const hasChanges =
      formData.title ||
      (formData.location?.name && formData.location.name.trim() !== '') ||
      (formData.teams && formData.teams.length > 0);
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

    if (hasChanges && !existingTournament) {
      // Show styled dialog instead of window.confirm
      setShowSaveDialog(true);
      return;
    }

    // No changes, go directly back to dashboard
    onBack();
  };

  // Dialog handlers: Discard changes and go back
  const handleDiscardAndGoBack = () => {
    setShowSaveDialog(false);
    onBack();
  };

  // Dialog handlers: Save draft and go back
  const handleSaveAndGoBack = async () => {
    try {
      await saveDraft();
      setShowSaveDialog(false);
      onBack();
    } catch (error) {
      console.error('[TournamentCreation] Failed to save and go back:', error);
    }
  };

  const handleBackToEdit = () => {
    // Clear error and generated schedule
    setScheduleError(null);
    setGeneratedSchedule(null);
    // Zurück zu Step 5 (Overview)
    handleStepChange(5);
  };

  // Handle navigation to a specific step via ProgressBar
  // Wraps hook's handleNavigateToStep with screen-specific callbacks and URL update
  const handleNavigateToStep = useCallback((targetStep: number) => {
    const saveCallback = hasUnsavedChanges() ? saveAsDraft : undefined;
    wizardHandleNavigateToStep(targetStep, saveCallback, showWarning);

    // Update URL with new step (replace to avoid history clutter)
    const newPath = buildWizardStepPath(targetStep as WizardStep, existingTournament?.id);
    void navigate(newPath, { replace: true });
  }, [wizardHandleNavigateToStep, hasUnsavedChanges, saveAsDraft, showWarning, navigate, existingTournament?.id]);

  // Dynamic width: wider for preview, narrower for wizard steps
  const isShowingPreview = step === 6 && (generatedSchedule !== null || replanSession !== null);
  const containerMaxWidth = isShowingPreview ? '1600px' : '800px';

  return (
    <div style={{
      padding: isMobile ? '20px 12px' : '40px 20px',
      maxWidth: containerMaxWidth,
      margin: '0 auto',
    }}>
      {/* Header with Auth Section */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
      }}>
        {/* Left: Back Button */}
        <button
          onClick={handleBackToDashboard}
          style={{
            padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
            background: 'transparent',
            border: 'none',
            color: cssVars.colors.textSecondary,
            fontSize: cssVars.fontSizes.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: cssVars.spacing.sm,
          }}
        >
          <Icons.ChevronLeft />
          {quickEditMode ? 'Abbrechen' : 'Zurück'}
        </button>

        {/* Right: Auth Section */}
        <AuthSection
          onNavigateToLogin={onNavigateToLogin}
          onNavigateToRegister={onNavigateToRegister}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToSettings={onNavigateToSettings}
        />
      </header>

      {replanSession && (
        <ReplanPanel
          isOpen
          preview={replanSession.preview}
          previousMatches={existingTournament?.matches ?? []}
          teams={existingTournament?.teams ?? []}
          onConfirm={() => void handleReplanConfirm()}
          onCancel={handleReplanCancel}
        />
      )}

      {/* Quick Edit Banner */}
      {quickEditMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          marginBottom: '16px',
          background: 'rgba(76, 175, 80, 0.1)',
          border: '1px solid rgba(76, 175, 80, 0.3)',
          borderRadius: cssVars.borderRadius.md,
        }}>
          <div>
            <span style={{ fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              Schnellbearbeitung
            </span>
            <span style={{ marginLeft: '8px', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
              Änderungen vornehmen und speichern
            </span>
          </div>
          <Button
            variant="primary"
            onClick={() => handleSaveAndBack()}
            style={{ background: cssVars.colors.success }}
            data-testid="quickedit-save"
          >
            Speichern & Zurück
          </Button>
        </div>
      )}

      <h1
        style={{
          fontFamily: cssVars.fontFamilies.heading,
          fontSize: isMobile ? cssVars.fontSizes.xxl : cssVars.fontSizes.xxxl,
          marginBottom: isMobile ? '20px' : '32px',
          background: cssVars.gradients.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {existingTournament ? 'TURNIER BEARBEITEN' : 'NEUES TURNIER'}
      </h1>

      {/* Progress Bar - nur bei Steps 1-6 anzeigen */}
      {step <= 6 && (
        <ProgressBar
          currentStep={step}
          totalSteps={6}
          stepLabels={['Stammdaten', 'Sportart', 'Modus', 'Gruppen & Felder', 'Teams', 'Übersicht']}
          onStepClick={handleNavigateToStep}
          visitedSteps={visitedSteps}
          stepErrors={stepErrors}
          clickable={true}
        />
      )}

      {/* Steps with lazy loading and error boundary */}
      <ErrorBoundary>
        <Suspense fallback={<StepLoadingFallback />}>
          <div
            className="step-content"
            data-slide={slideDirection}
            style={{ willChange: slideDirection ? 'transform, opacity' : 'auto' }}
          >
            {step === 1 && <Step3_Metadata formData={formData} onUpdate={updateForm} />}

            {step === 2 && (
              <Step1_SportAndType
                formData={formData}
                onUpdate={updateForm}
                onTournamentTypeChange={handleTournamentTypeChange}
              />
            )}

            {step === 3 && (
              <Step2_ModeAndSystem
                formData={formData}
                onUpdate={updateForm}
                onMovePlacementLogic={movePlacementLogic}
                onTogglePlacementLogic={togglePlacementLogic}
                onReorderPlacementLogic={reorderPlacementLogic}
                hasResults={hasResults}
                onResetTournament={handleResetTournament}
              />
            )}

            {/* US-GROUPS-AND-FIELDS: Neuer Step 4 */}
            {step === 4 && (
              <Step_GroupsAndFields
                formData={formData}
                onUpdate={updateForm}
              />
            )}

            {step === 5 && (
              <Step4_Teams
                formData={formData}
                onUpdate={updateForm}
                onAddTeam={addTeam}
                onRemoveTeam={removeTeam}
                onUpdateTeam={updateTeam}
              />
            )}

            {step === 6 && !generatedSchedule && (
              <>
                {scheduleError && (
                  <div
                    style={{
                      marginBottom: '24px',
                      padding: '16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '2px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: cssVars.borderRadius.md,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ color: cssVars.colors.error, fontSize: fontSizesMd3.headlineMedium, flexShrink: 0 }}>
                        ⚠️
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3
                          style={{
                            margin: '0 0 8px 0',
                            fontSize: cssVars.fontSizes.lg,
                            fontWeight: cssVars.fontWeights.semibold,
                            color: cssVars.colors.error,
                          }}
                        >
                          Spielplan konnte nicht erstellt werden
                        </h3>
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: cssVars.fontSizes.md,
                            color: cssVars.colors.textPrimary,
                            lineHeight: '1.5',
                          }}
                        >
                          {scheduleError}
                        </p>
                        <button
                          onClick={() => setScheduleError(null)}
                          style={{
                            padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: cssVars.borderRadius.sm,
                            color: cssVars.colors.textPrimary,
                            fontSize: cssVars.fontSizes.sm,
                            fontWeight: cssVars.fontWeights.medium,
                            cursor: 'pointer',
                          }}
                        >
                          Zurück zur Bearbeitung
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <Step5_OverviewDirect formData={formData} onSave={handlePreview} />
              </>
            )}
            {step === 6 && generatedSchedule && (
              <>
                {scheduleError && (
                  <div
                    style={{
                      marginBottom: '24px',
                      padding: '16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '2px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: cssVars.borderRadius.md,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ color: cssVars.colors.error, fontSize: fontSizesMd3.headlineMedium, flexShrink: 0 }}>
                        ⚠️
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3
                          style={{
                            margin: '0 0 8px 0',
                            fontSize: cssVars.fontSizes.lg,
                            fontWeight: cssVars.fontWeights.semibold,
                            color: cssVars.colors.error,
                          }}
                        >
                          Turnier konnte nicht veröffentlicht werden
                        </h3>
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: cssVars.fontSizes.md,
                            color: cssVars.colors.textPrimary,
                            lineHeight: '1.5',
                          }}
                        >
                          {scheduleError}
                        </p>
                        <button
                          onClick={() => setScheduleError(null)}
                          style={{
                            padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: cssVars.borderRadius.sm,
                            color: cssVars.colors.textPrimary,
                            fontSize: cssVars.fontSizes.sm,
                            fontWeight: cssVars.fontWeights.medium,
                            cursor: 'pointer',
                          }}
                        >
                          Schließen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <TournamentPreview
                  tournament={createDraftTournament()}
                  schedule={generatedSchedule}
                  onEdit={handleBackToEdit}
                  onPublish={() => void handlePublish()}
                  isPublishing={isPublishing}
                  onTournamentChange={(updatedTournament) => {
                    // Update formData with the modified playoff config and referee config
                    setFormData((prev) => ({
                      ...prev,
                      playoffConfig: updatedTournament.playoffConfig,
                      refereeConfig: updatedTournament.refereeConfig,
                    }));
                  }}
                />
              </>
            )}
          </div>
        </Suspense>
      </ErrorBoundary>

      {/* Navigation - ausblenden wenn Step 6 (Preview hat eigene Navigation) */}
      {step !== 6 && (
        <div style={{ marginTop: isMobile ? '16px' : '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            gap: isMobile ? cssVars.spacing.sm : 0,
          }}>
            <Button
              variant="ghost"
              onClick={() => handleStepChange(Math.max(1, step - 1))}
              disabled={step === 1}
              icon={<Icons.ChevronLeft />}
              size={isMobile ? 'sm' : 'md'}
            >
              Zurück
            </Button>

            <div className="wizard-footer-actions">
              {/* Speichern-Button - nur ab Step 2 anzeigen wenn grundlegende Daten vorhanden */}
              {step >= 2 && formData.title && formData.date && formData.location && (
                <Button
                  variant="secondary"
                  onClick={() => void handleSaveDraft()}
                  icon={<Icons.Check />}
                  size={isMobile ? 'sm' : 'md'}
                >
                  {isMobile ? 'Speichern' : 'Als Entwurf speichern'}
                </Button>
              )}

              {step < 6 && (
                <Button
                  onClick={() => handleStepChange(Math.min(6, step + 1))}
                  disabled={!canGoNext()}
                  icon={<Icons.ChevronRight />}
                  iconPosition="right"
                  size={isMobile ? 'sm' : 'md'}
                >
                  Weiter
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Save Notification Toast */}
      {showSaveNotification && (
        <div
          className="save-notification"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 16px',
            background: 'rgba(0, 230, 118, 0.9)',
            borderRadius: cssVars.borderRadius.sm,
            color: cssVars.colors.background,
            fontSize: cssVars.fontSizes.sm,
            fontWeight: cssVars.fontWeights.medium,
            boxShadow: cssVars.shadows.lg,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center' }}>
            <Icons.Check />
          </span>
          Gespeichert
        </div>
      )}

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onConfirm={() => void handleSaveAndGoBack()}
        title="Änderungen speichern?"
        message="Du hast Änderungen vorgenommen, die noch nicht gespeichert wurden. Was möchtest du tun?"
        confirmText="Speichern"
        cancelText="Abbrechen"
        secondaryAction={{
          text: 'Verwerfen',
          onClick: handleDiscardAndGoBack,
          variant: 'danger',
        }}
      />

      {/* Slide Animation Styles */}
      <style>{`
        .step-content[data-slide="right"] {
          animation: slideFromRight 250ms ease-out;
        }

        .step-content[data-slide="left"] {
          animation: slideFromLeft 250ms ease-out;
        }

        @keyframes slideFromRight {
          from {
            transform: translateX(30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideFromLeft {
          from {
            transform: translateX(-30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .wizard-footer-actions {
          display: flex;
          gap: ${cssVars.spacing.md};
          justify-content: flex-start;
          flex-wrap: nowrap;
        }

        @media (max-width: 600px) {
          .wizard-footer-actions {
            gap: ${cssVars.spacing.sm};
            justify-content: flex-end;
            flex-wrap: wrap;
          }
        }

        @media (max-width: 400px) {
          .wizard-footer-actions {
            flex-direction: column;
            width: 100%;
          }
          
          .wizard-footer-actions > button {
             width: 100% !important;
             margin-left: 0 !important;
             margin-right: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

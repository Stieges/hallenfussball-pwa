import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Button, Icons } from '../components/ui';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TournamentPreview } from '../features/tournament-creation/TournamentPreview';
import { Step5_Overview as Step5_OverviewDirect } from '../features/tournament-creation/Step5_Overview';
import { Tournament } from '../types/tournament';
import { useTournaments } from '../hooks/useTournaments';
import { useTournamentWizard } from '../hooks/useTournamentWizard';
import { generateFullSchedule } from '../lib/scheduleGenerator';
import { borderRadius, colors, fontFamilies, fontSizes, fontSizesMd3, fontWeights, gradients, shadows, spacing } from '../design-tokens';
import { useToast } from '../components/ui/Toast';
import { AuthSection } from '../components/layout/AuthSection';

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
    color: colors.textSecondary,
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: `3px solid ${colors.border}`,
        borderTopColor: colors.primary,
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
}

export const TournamentCreationScreen: React.FC<TournamentCreationScreenProps> = ({
  onBack,
  onSave,
  existingTournament,
  quickEditMode = false,
  onNavigateToLogin,
  onNavigateToRegister,
  onNavigateToProfile,
}) => {
  const { showSuccess, showWarning } = useToast();
  const { saveTournament: defaultSaveTournament } = useTournaments();

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
  } = useTournamentWizard(existingTournament);

  // ============================================================================
  // SCREEN-SPECIFIC STATE (not in hook)
  // ============================================================================
  const [generatedSchedule, setGeneratedSchedule] = useState<ReturnType<typeof generateFullSchedule> | null>(null);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  // Use provided onSave or fallback to default saveTournament
  const saveTournament = onSave ?? defaultSaveTournament;

  // Helper function to check if data has changed
  const hasUnsavedChanges = useCallback((): boolean => {
    const hasData =
      formData.title ||
      formData.location ||
      (formData.teams && formData.teams.length > 0);

    if (!hasData) {return false;}

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
  const saveAsDraft = useCallback(() => {
    if (!hasUnsavedChanges()) {return;}

    const tournament = createDraftTournament();

    try {
      void defaultSaveTournament(tournament);

      // Update formData with the generated ID to prevent creating multiple drafts
      if (!formData.id && tournament.id) {
        setFormData((prev) => ({ ...prev, id: tournament.id }));
      }

      lastSavedDataRef.current = JSON.stringify(formData);

      // Show save confirmation notification
      showSaveConfirmation();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('[TournamentCreation] localStorage quota exceeded');
      } else {
        console.error('[TournamentCreation] Failed to save draft:', error);
      }
    }
  }, [hasUnsavedChanges, formData, defaultSaveTournament, showSaveConfirmation, createDraftTournament, lastSavedDataRef, setFormData]);

  // Helper function to change step with autosave and slide animation
  const handleStepChange = useCallback((newStep: number) => {
    // Determine slide direction based on navigation
    const direction = newStep > step ? 'right' : 'left';
    setSlideDirection(direction);

    // Reset generated schedule when navigating TO step 6 (Overview)
    if (newStep === 6) {
      setGeneratedSchedule(null);
    }
    // Use wizard hook's handleStepChange with saveAsDraft callback
    wizardHandleStepChange(newStep, saveAsDraft);

    // Clear slide direction after animation completes
    setTimeout(() => setSlideDirection(null), 300);
  }, [wizardHandleStepChange, saveAsDraft, step]);

  // Autosave 1: Periodic autosave every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges()) {
        saveAsDraft();
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveAsDraft]);

  // Autosave 2: On tab close or page refresh
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        saveAsDraft();

        // Show browser warning (optional)
        event.preventDefault();
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

  const handlePublish = () => {
    try {
      const tournament = createDraftTournament();
      tournament.status = 'published';

      // Generate matches before publishing
      const schedule = generateFullSchedule(tournament);

      // Convert ScheduledMatch[] to Match[]
      // WICHTIG: Verwende originalTeamA/B (technische IDs/Platzhalter) statt homeTeam/awayTeam (Display-Text)
      // damit der playoffResolver die Platzhalter wie "group-a-1st" erkennen kann
      tournament.matches = schedule.allMatches.map((scheduledMatch, index) => ({
        id: scheduledMatch.id,
        round: Math.floor(index / tournament.numberOfFields) + 1, // Calculate round from index and fields
        field: scheduledMatch.field,
        slot: scheduledMatch.slot,
        teamA: scheduledMatch.originalTeamA, // Original ID/Placeholder für playoffResolver
        teamB: scheduledMatch.originalTeamB, // Original ID/Placeholder für playoffResolver
        scoreA: scheduledMatch.scoreA,
        scoreB: scheduledMatch.scoreB,
        group: scheduledMatch.group,
        isFinal: scheduledMatch.phase !== 'groupStage',
        finalType: scheduledMatch.finalType,
        label: scheduledMatch.label,
        scheduledTime: scheduledMatch.startTime,
        referee: scheduledMatch.referee,
      }));

      void saveTournament(tournament);
      onBack();
    } catch (error) {
      // Capture error and display to user
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unbekannter Fehler beim Veröffentlichen des Turniers';
      setScheduleError(errorMessage);
      console.error('[TournamentCreationScreen] Publish failed:', error);
      // Stay on preview screen to show error
    }
  };

  const handleSaveDraft = () => {
    const tournament = createDraftTournament();
    void defaultSaveTournament(tournament);
    lastSavedDataRef.current = JSON.stringify(formData);
    showSuccess('Turnier als Entwurf gespeichert!');
  };

  const handleBackToDashboard = () => {
    // Check if there are any unsaved changes
    const hasChanges =
      formData.title ||
      (formData.location?.name && formData.location.name.trim() !== '') ||
      (formData.teams && formData.teams.length > 0);

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
  const handleSaveAndGoBack = () => {
    const tournament = createDraftTournament();
    void saveTournament(tournament);
    setShowSaveDialog(false);
    onBack();
  };

  const handleBackToEdit = () => {
    // Clear error and generated schedule
    setScheduleError(null);
    setGeneratedSchedule(null);
    // Zurück zu Step 5 (Overview)
    handleStepChange(5);
  };

  // Handle navigation to a specific step via ProgressBar
  // Wraps hook's handleNavigateToStep with screen-specific callbacks
  const handleNavigateToStep = useCallback((targetStep: number) => {
    const saveCallback = hasUnsavedChanges() ? saveAsDraft : undefined;
    wizardHandleNavigateToStep(targetStep, saveCallback, showWarning);
  }, [wizardHandleNavigateToStep, hasUnsavedChanges, saveAsDraft, showWarning]);

  // Dynamic width: wider for preview, narrower for wizard steps
  const isShowingPreview = step === 6 && generatedSchedule;
  const containerMaxWidth = isShowingPreview ? '1600px' : '800px';

  return (
    <div style={{ padding: '40px 20px', maxWidth: containerMaxWidth, margin: '0 auto' }}>
      {/* Header with Auth Section */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
      }}>
        {/* Left: Back Button */}
        <button
          onClick={handleBackToDashboard}
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            background: 'transparent',
            border: 'none',
            color: colors.textSecondary,
            fontSize: fontSizes.md,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
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
        />
      </header>

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
          borderRadius: borderRadius.md,
        }}>
          <div>
            <span style={{ fontWeight: fontWeights.semibold, color: colors.textPrimary }}>
              Schnellbearbeitung
            </span>
            <span style={{ marginLeft: '8px', color: colors.textSecondary, fontSize: fontSizes.sm }}>
              Änderungen vornehmen und speichern
            </span>
          </div>
          <Button
            variant="primary"
            onClick={handlePublish}
            style={{ background: colors.success }}
          >
            Speichern & Zurück
          </Button>
        </div>
      )}

      <h1
        style={{
          fontFamily: fontFamilies.heading,
          fontSize: fontSizes.xxxl,
          marginBottom: '32px',
          background: gradients.primary,
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
                borderRadius: borderRadius.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ color: colors.error, fontSize: fontSizesMd3.headlineMedium, flexShrink: 0 }}>
                  ⚠️
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: fontSizes.lg,
                      fontWeight: fontWeights.semibold,
                      color: colors.error,
                    }}
                  >
                    Spielplan konnte nicht erstellt werden
                  </h3>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: fontSizes.md,
                      color: colors.textPrimary,
                      lineHeight: '1.5',
                    }}
                  >
                    {scheduleError}
                  </p>
                  <button
                    onClick={() => setScheduleError(null)}
                    style={{
                      padding: `${spacing.xs} ${spacing.sm}`,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: borderRadius.sm,
                      color: colors.textPrimary,
                      fontSize: fontSizes.sm,
                      fontWeight: fontWeights.medium,
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
                borderRadius: borderRadius.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ color: colors.error, fontSize: fontSizesMd3.headlineMedium, flexShrink: 0 }}>
                  ⚠️
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: fontSizes.lg,
                      fontWeight: fontWeights.semibold,
                      color: colors.error,
                    }}
                  >
                    Turnier konnte nicht veröffentlicht werden
                  </h3>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: fontSizes.md,
                      color: colors.textPrimary,
                      lineHeight: '1.5',
                    }}
                  >
                    {scheduleError}
                  </p>
                  <button
                    onClick={() => setScheduleError(null)}
                    style={{
                      padding: `${spacing.xs} ${spacing.sm}`,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: borderRadius.sm,
                      color: colors.textPrimary,
                      fontSize: fontSizes.sm,
                      fontWeight: fontWeights.medium,
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
            onPublish={handlePublish}
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
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              variant="ghost"
              onClick={() => handleStepChange(Math.max(1, step - 1))}
              disabled={step === 1}
              icon={<Icons.ChevronLeft />}
            >
              Zurück
            </Button>

            <div style={{ display: 'flex', gap: spacing.md }}>
              {/* Speichern-Button - nur ab Step 2 anzeigen wenn grundlegende Daten vorhanden */}
              {step >= 2 && formData.title && formData.date && formData.location && (
                <Button
                  variant="secondary"
                  onClick={handleSaveDraft}
                  icon={<Icons.Check />}
                >
                  Als Entwurf speichern
                </Button>
              )}

              {step < 6 && (
                <Button
                  onClick={() => handleStepChange(Math.min(6, step + 1))}
                  disabled={!canGoNext()}
                  icon={<Icons.ChevronRight />}
                  iconPosition="right"
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
            borderRadius: borderRadius.sm,
            color: colors.background,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            boxShadow: shadows.lg,
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
        onConfirm={handleSaveAndGoBack}
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
      `}</style>
    </div>
  );
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Icons } from '../components/ui';
import { ProgressBar } from '../components/ProgressBar';
import {
  Step1_SportAndType,
  Step2_ModeAndSystem,
  Step3_Metadata,
  Step4_Teams,
  Step5_Overview,
} from '../features/tournament-creation';
import { TournamentPreview } from '../features/tournament-creation/TournamentPreview';
import { Tournament, TournamentType } from '../types/tournament';
import { useTournaments } from '../hooks/useTournaments';
import { generateFullSchedule } from '../lib/scheduleGenerator';
import { generateTournamentId } from '../utils/idGenerator';
import { theme } from '../styles/theme';

interface TournamentCreationScreenProps {
  onBack: () => void;
  onSave?: (tournament: Tournament) => void | Promise<void>;
  existingTournament?: Tournament;
}

const getDefaultFormData = (): Partial<Tournament> => ({
  sport: 'football',
  tournamentType: 'classic',
  mode: 'classic',
  numberOfFields: 1,
  numberOfTeams: 4,
  groupSystem: 'roundRobin',
  numberOfGroups: 2,
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  finalRoundGameDuration: 10,
  finalRoundBreakDuration: 2,
  breakBetweenPhases: 5,
  gamePeriods: 1,
  halftimeBreak: 1,
  placementLogic: [
    { id: 'points', label: 'Punkte', enabled: true },
    { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
    { id: 'goalsFor', label: 'Erzielte Tore', enabled: true },
    { id: 'directComparison', label: 'Direkter Vergleich', enabled: false },
  ],
  finals: {
    final: false,
    thirdPlace: false,
    fifthSixth: false,
    seventhEighth: false,
  },
  finalsConfig: {
    preset: 'none',
  },
  refereeConfig: {
    mode: 'none',
  },
  isKidsTournament: false,
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  resultMode: 'goals',
  pointSystem: {
    win: 3,
    draw: 1,
    loss: 0,
  },
  title: '',
  ageClass: 'U11',
  date: new Date().toISOString().split('T')[0],
  timeSlot: '09:00 - 16:00',
  location: { name: '' },
  teams: [],
});

export const TournamentCreationScreen: React.FC<TournamentCreationScreenProps> = ({
  onBack,
  onSave,
  existingTournament,
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Tournament>>(
    existingTournament || getDefaultFormData()
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [generatedSchedule, setGeneratedSchedule] = useState<ReturnType<typeof generateFullSchedule> | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const { saveTournament: defaultSaveTournament } = useTournaments();

  // Use provided onSave or fallback to default saveTournament
  const saveTournament = onSave || defaultSaveTournament;

  const updateForm = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Helper function to check if data has changed
  const hasUnsavedChanges = useCallback((): boolean => {
    const hasData =
      formData.title ||
      formData.location ||
      (formData.teams && formData.teams.length > 0);

    if (!hasData) return false;

    // Check if data is different from last save
    const currentData = JSON.stringify(formData);
    return currentData !== lastSavedDataRef.current;
  }, [formData]);

  // Helper function to save as draft
  // IMPORTANT: Always use defaultSaveTournament for autosave, not saveTournament!
  // saveTournament might be mapped to onSave which triggers navigation back to dashboard
  const saveAsDraft = useCallback(() => {
    if (!hasUnsavedChanges()) return;

    const tournament = createDraftTournament();

    try {
      defaultSaveTournament(tournament);

      // Update formData with the generated ID to prevent creating multiple drafts
      if (!formData.id && tournament.id) {
        setFormData((prev) => ({ ...prev, id: tournament.id }));
      }

      lastSavedDataRef.current = JSON.stringify(formData);
      console.log('[TournamentCreation] Autosave:', tournament.id);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('[TournamentCreation] localStorage quota exceeded');
      } else {
        console.error('[TournamentCreation] Failed to save draft:', error);
      }
    }
  }, [hasUnsavedChanges, formData, defaultSaveTournament]);

  // Helper function to change step with autosave
  const handleStepChange = useCallback((newStep: number) => {
    // Autosave before changing step
    if (hasUnsavedChanges()) {
      saveAsDraft();
      console.log('[TournamentCreation] Autosave on step change');
    }
    setStep(newStep);
  }, [hasUnsavedChanges, saveAsDraft]);

  // Autosave 1: Periodic autosave every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges()) {
        saveAsDraft();
        console.log('[TournamentCreation] Periodic autosave triggered');
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveAsDraft]);

  // Autosave 2: On tab close or page refresh
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        saveAsDraft();
        console.log('[TournamentCreation] Autosave on tab close');

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

  const handleTournamentTypeChange = (newType: TournamentType) => {
    const currentType = formData.tournamentType;

    if (currentType && currentType !== newType) {
      const confirmed = window.confirm(
        `Möchtest du wirklich zu "${newType === 'classic' ? 'Klassisches Turnier' : 'Bambini-Turnier'}" wechseln?\n\nDie Einstellungen werden angepasst.`
      );
      if (!confirmed) return;
    }

    if (newType === 'bambini') {
      setFormData((prev) => ({
        ...prev,
        tournamentType: newType,
        isKidsTournament: true,
        hideScoresForPublic: true,
        hideRankingsForPublic: true,
        resultMode: 'winLossOnly',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        tournamentType: newType,
        isKidsTournament: false,
        hideScoresForPublic: false,
        hideRankingsForPublic: false,
        resultMode: 'goals',
      }));
    }
  };

  const movePlacementLogic = (index: number, direction: number) => {
    if (!formData.placementLogic) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.placementLogic.length) return;

    const newLogic = [...formData.placementLogic];
    [newLogic[index], newLogic[newIndex]] = [newLogic[newIndex], newLogic[index]];
    updateForm('placementLogic', newLogic);
  };

  const togglePlacementLogic = (index: number) => {
    if (!formData.placementLogic) return;

    const newLogic = [...formData.placementLogic];
    newLogic[index] = { ...newLogic[index], enabled: !newLogic[index].enabled };
    updateForm('placementLogic', newLogic);
  };

  const addTeam = () => {
    const newTeam = {
      id: `team-${Date.now()}`,
      name: `Team ${(formData.teams?.length || 0) + 1}`,
    };
    updateForm('teams', [...(formData.teams || []), newTeam]);
  };

  const removeTeam = (id: string) => {
    updateForm('teams', formData.teams?.filter((t) => t.id !== id) || []);
  };

  const updateTeam = (id: string, updates: Partial<Tournament['teams'][0]>) => {
    updateForm(
      'teams',
      formData.teams?.map((t) => (t.id === id ? { ...t, ...updates } : t)) || []
    );
  };

  const createDraftTournament = (): Tournament => {
    return {
      id: formData.id || existingTournament?.id || generateTournamentId(),
      status: 'draft',
      sport: formData.sport || 'football',
      tournamentType: formData.tournamentType || 'classic',
      mode: formData.mode || 'classic',
      numberOfFields: formData.numberOfFields || 1,
      numberOfTeams: formData.numberOfTeams || 4,
      groupSystem: formData.groupSystem,
      numberOfGroups: formData.numberOfGroups,
      groupPhaseGameDuration: formData.groupPhaseGameDuration || 10,
      groupPhaseBreakDuration: formData.groupPhaseBreakDuration,
      finalRoundGameDuration: formData.finalRoundGameDuration,
      finalRoundBreakDuration: formData.finalRoundBreakDuration,
      breakBetweenPhases: formData.breakBetweenPhases,
      gamePeriods: formData.gamePeriods,
      halftimeBreak: formData.halftimeBreak,
      // Legacy support
      gameDuration: formData.gameDuration || formData.groupPhaseGameDuration || 10,
      breakDuration: formData.breakDuration || formData.groupPhaseBreakDuration,
      roundLogic: formData.roundLogic,
      numberOfRounds: formData.numberOfRounds,
      placementLogic: formData.placementLogic || [],
      finals: formData.finals || { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
      finalsConfig: formData.finalsConfig,
      refereeConfig: formData.refereeConfig || { mode: 'none' },
      isKidsTournament: formData.isKidsTournament || false,
      hideScoresForPublic: formData.hideScoresForPublic || false,
      hideRankingsForPublic: formData.hideRankingsForPublic || false,
      resultMode: formData.resultMode || 'goals',
      pointSystem: formData.pointSystem || { win: 3, draw: 1, loss: 0 },
      title: formData.title || 'Unbenanntes Turnier',
      ageClass: formData.ageClass || 'U11',
      date: formData.date || new Date().toISOString().split('T')[0],
      timeSlot: formData.timeSlot || '',
      startDate: formData.startDate, // New field for date picker
      startTime: formData.startTime, // New field for time picker
      location: formData.location || { name: '' },
      teams: formData.teams || [],
      matches: [], // Wird später vom Fair Scheduler generiert
      createdAt: existingTournament?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const handlePreview = () => {
    // Reset error state
    setScheduleError(null);

    // Validate by attempting to generate schedule
    try {
      const tournament = createDraftTournament();
      const schedule = generateFullSchedule(tournament);
      // Store generated schedule for preview
      setGeneratedSchedule(schedule);
      // If successful, go to preview step
      handleStepChange(6);
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
      tournament.matches = schedule.allMatches.map((scheduledMatch, index) => ({
        id: scheduledMatch.id,
        round: Math.floor(index / tournament.numberOfFields) + 1, // Calculate round from index and fields
        field: scheduledMatch.field,
        slot: scheduledMatch.slot,
        teamA: scheduledMatch.homeTeam,
        teamB: scheduledMatch.awayTeam,
        scoreA: scheduledMatch.scoreA,
        scoreB: scheduledMatch.scoreB,
        group: scheduledMatch.group,
        isFinal: scheduledMatch.phase !== 'groupStage',
        finalType: scheduledMatch.finalType,
        label: scheduledMatch.label,
        scheduledTime: scheduledMatch.startTime,
        referee: scheduledMatch.referee,
      }));

      saveTournament(tournament);
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
    defaultSaveTournament(tournament);
    lastSavedDataRef.current = JSON.stringify(formData);
    // Show success feedback (optional: add toast notification later)
    alert('Turnier als Entwurf gespeichert!');
  };

  const handleBackToDashboard = () => {
    // Check if there are any unsaved changes
    const hasChanges =
      formData.title ||
      formData.location ||
      (formData.teams && formData.teams.length > 0);

    if (hasChanges && !existingTournament) {
      // Ask user if they want to save as draft
      const shouldSave = window.confirm(
        'Möchtest du diesen Turnier-Entwurf speichern?\n\n' +
        'JA → Als Entwurf speichern\n' +
        'NEIN → Verwerfen und zurück zum Dashboard'
      );

      if (shouldSave) {
        // Save as draft
        const tournament = createDraftTournament();
        saveTournament(tournament);
        console.log('[TournamentCreation] Draft saved on back:', tournament.id);
      }
    }

    // Go back to dashboard (whether saved or not)
    onBack();
  };

  const handleBackToEdit = () => {
    // Clear error and generated schedule
    setScheduleError(null);
    setGeneratedSchedule(null);
    // Zurück zu Step 5 (Overview)
    handleStepChange(5);
  };

  const canGoNext = () => {
    switch (step) {
      case 1:
        return formData.title && formData.date && formData.location;
      case 2:
        return formData.sport && formData.tournamentType;
      case 3:
        return formData.mode;
      case 4:
        return (formData.teams?.length || 0) >= 2;
      default:
        return true;
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <button
        onClick={handleBackToDashboard}
        style={{
          marginBottom: '24px',
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          background: 'transparent',
          border: 'none',
          color: theme.colors.text.secondary,
          fontSize: theme.fontSizes.md,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Icons.ChevronLeft />
        Zurück zum Dashboard
      </button>

      <h1
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: theme.fontSizes.xxxl,
          marginBottom: '32px',
          background: theme.gradients.primary,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {existingTournament ? 'TURNIER BEARBEITEN' : 'NEUES TURNIER'}
      </h1>

      {/* Progress Bar - nur bei Steps 1-5 anzeigen */}
      {step <= 5 && (
        <ProgressBar
          currentStep={step}
          totalSteps={5}
          stepLabels={['Stammdaten', 'Sportart', 'Modus', 'Teams', 'Übersicht']}
        />
      )}

      {/* Steps */}
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
        />
      )}

      {step === 4 && (
        <Step4_Teams
          formData={formData}
          onUpdate={updateForm}
          onAddTeam={addTeam}
          onRemoveTeam={removeTeam}
          onUpdateTeam={updateTeam}
        />
      )}

      {step === 5 && (
        <>
          {scheduleError && (
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: theme.borderRadius.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ color: 'rgb(239, 68, 68)', fontSize: '20px', flexShrink: 0 }}>
                  ⚠️
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: theme.fontSizes.lg,
                      fontWeight: theme.fontWeights.semibold,
                      color: 'rgb(239, 68, 68)',
                    }}
                  >
                    Spielplan konnte nicht erstellt werden
                  </h3>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: theme.fontSizes.md,
                      color: theme.colors.text.primary,
                      lineHeight: '1.5',
                    }}
                  >
                    {scheduleError}
                  </p>
                  <button
                    onClick={() => setScheduleError(null)}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: theme.borderRadius.sm,
                      color: theme.colors.text.primary,
                      fontSize: theme.fontSizes.sm,
                      fontWeight: theme.fontWeights.medium,
                      cursor: 'pointer',
                    }}
                  >
                    Zurück zur Bearbeitung
                  </button>
                </div>
              </div>
            </div>
          )}
          <Step5_Overview formData={formData} onSave={handlePreview} />
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
                borderRadius: theme.borderRadius.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ color: 'rgb(239, 68, 68)', fontSize: '20px', flexShrink: 0 }}>
                  ⚠️
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: theme.fontSizes.lg,
                      fontWeight: theme.fontWeights.semibold,
                      color: 'rgb(239, 68, 68)',
                    }}
                  >
                    Turnier konnte nicht veröffentlicht werden
                  </h3>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: theme.fontSizes.md,
                      color: theme.colors.text.primary,
                      lineHeight: '1.5',
                    }}
                  >
                    {scheduleError}
                  </p>
                  <button
                    onClick={() => setScheduleError(null)}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: theme.borderRadius.sm,
                      color: theme.colors.text.primary,
                      fontSize: theme.fontSizes.sm,
                      fontWeight: theme.fontWeights.medium,
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
              // Update formData with the modified playoff config
              setFormData((prev) => ({
                ...prev,
                playoffConfig: updatedTournament.playoffConfig,
              }));
            }}
          />
        </>
      )}

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

            <div style={{ display: 'flex', gap: theme.spacing.md }}>
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

              {step < 5 && (
                <Button
                  onClick={() => handleStepChange(Math.min(5, step + 1))}
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
    </div>
  );
};

import { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { Button, Icons } from '../components/ui';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TournamentPreview } from '../features/tournament-creation/TournamentPreview';
import { Tournament, TournamentType, PlacementCriterion } from '../types/tournament';
import { useTournaments } from '../hooks/useTournaments';
import { generateFullSchedule } from '../lib/scheduleGenerator';
import { generateTournamentId } from '../utils/idGenerator';
import { countMatchesWithResults } from '../utils/teamHelpers';
import { theme } from '../styles/theme';
import { useToast } from '../components/ui/Toast';
import { getSportConfig, DEFAULT_SPORT_ID } from '../config/sports';

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
const Step5_Overview = lazy(() =>
  import('../features/tournament-creation').then(module => ({ default: module.Step5_Overview }))
);

// Loading fallback component
const StepLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
    color: theme.colors.text.secondary,
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: `3px solid ${theme.colors.border}`,
        borderTopColor: theme.colors.primary,
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
}

const getDefaultFormData = (): Partial<Tournament> => {
  const defaultConfig = getSportConfig(DEFAULT_SPORT_ID);

  return {
    sport: 'football',
    sportId: DEFAULT_SPORT_ID,
    tournamentType: 'classic',
    mode: 'classic',
    numberOfFields: defaultConfig.defaults.typicalFieldCount,
    numberOfTeams: 4,
    groupSystem: 'roundRobin',
    numberOfGroups: 2,
    groupPhaseGameDuration: defaultConfig.defaults.gameDuration,
    groupPhaseBreakDuration: defaultConfig.defaults.breakDuration,
    finalRoundGameDuration: defaultConfig.defaults.gameDuration,
    finalRoundBreakDuration: defaultConfig.defaults.breakDuration,
    breakBetweenPhases: 5,
    gamePeriods: defaultConfig.defaults.periods,
    halftimeBreak: defaultConfig.defaults.periodBreak,
    placementLogic: [
      { id: 'points', label: 'Punkte', enabled: true },
      { id: 'goalDifference', label: `${defaultConfig.terminology.goal}differenz`, enabled: true },
      { id: 'goalsFor', label: `Erzielte ${defaultConfig.terminology.goalPlural}`, enabled: true },
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
    pointSystem: defaultConfig.defaults.pointSystem,
    title: '',
    ageClass: 'U11',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '09:00 - 16:00',
    location: { name: '' },
    teams: [],
  };
};

export const TournamentCreationScreen: React.FC<TournamentCreationScreenProps> = ({
  onBack,
  onSave,
  existingTournament,
  quickEditMode = false,
}) => {
  const { showSuccess, showWarning } = useToast();

  // Restore last visited step from existing tournament (draft restoration)
  const initialStep = existingTournament?.lastVisitedStep || 1;
  const initialVisitedSteps = new Set<number>();

  // Bei bestehendem Turnier (das Daten hat) alle Schritte als besucht markieren
  // damit der Benutzer frei navigieren kann
  const hasExistingData = existingTournament && (
    existingTournament.teams.length > 0 ||
    existingTournament.matches.length > 0 ||
    existingTournament.title
  );

  if (hasExistingData) {
    // Alle 5 Schritte als besucht markieren
    for (let i = 1; i <= 5; i++) {
      initialVisitedSteps.add(i);
    }
  } else {
    // Nur Schritte bis zum aktuellen als besucht markieren
    for (let i = 1; i <= initialStep; i++) {
      initialVisitedSteps.add(i);
    }
  }

  const [step, setStep] = useState(initialStep);
  const [formData, setFormData] = useState<Partial<Tournament>>(
    existingTournament || getDefaultFormData()
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [generatedSchedule, setGeneratedSchedule] = useState<ReturnType<typeof generateFullSchedule> | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const { saveTournament: defaultSaveTournament } = useTournaments();

  // Navigation state for clickable ProgressBar
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(initialVisitedSteps);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});

  // Auto-save notification state
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Use provided onSave or fallback to default saveTournament
  const saveTournament = onSave || defaultSaveTournament;

  // TOUR-EDIT-STRUCTURE: Check if tournament has results (blocks structure changes)
  const hasResults = useMemo(() => {
    if (!formData.matches || formData.matches.length === 0) {return false;}
    return countMatchesWithResults(formData.matches) > 0;
  }, [formData.matches]);

  // TOUR-EDIT-STRUCTURE: Reset tournament (clears all results)
  const handleResetTournament = useCallback(() => {
    if (!formData.matches || formData.matches.length === 0) {return;}

    const resultCount = countMatchesWithResults(formData.matches);

    const confirmed = window.confirm(
      `⚠️ TURNIER ZURÜCKSETZEN\n\n` +
      `Es werden ${resultCount} Ergebnis${resultCount === 1 ? '' : 'se'} gelöscht!\n\n` +
      `Diese Aktion kann nicht rückgängig gemacht werden.\n\n` +
      `Möchtest du wirklich fortfahren?`
    );

    if (!confirmed) {return;}

    // Clear all scores and reset match status
    const resetMatches = formData.matches.map(match => ({
      ...match,
      scoreA: undefined,
      scoreB: undefined,
      matchStatus: 'scheduled' as const,
      finishedAt: undefined,
      correctionHistory: undefined,
    }));

    setFormData(prev => ({
      ...prev,
      matches: resetMatches,
      updatedAt: new Date().toISOString(),
    }));

    // Trigger save
    setTimeout(() => {
      console.log('[TournamentCreation] Tournament reset - results cleared');
    }, 100);
  }, [formData.matches]);

  const updateForm = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // When switching to roundRobin, remove group assignments from teams
      // This fixes the bug where group tables were shown for "Jeder gegen Jeden" mode
      if (field === 'groupSystem' && value === 'roundRobin' && prev.teams) {
        updated.teams = prev.teams.map((team) => {
          const { group: _group, ...teamWithoutGroup } = team;
          return teamWithoutGroup;
        });
      }

      // When switching to groupsAndFinals, apply sport-specific default finals preset and tiebreaker
      if (field === 'groupSystem' && value === 'groupsAndFinals') {
        const sportConfig = getSportConfig(prev.sportId || DEFAULT_SPORT_ID);
        updated.finalsConfig = {
          ...prev.finalsConfig,
          preset: sportConfig.defaults.defaultFinalsPreset,
          tiebreaker: sportConfig.rules.defaultTiebreaker,
          tiebreakerDuration: sportConfig.rules.defaultTiebreakerDuration,
        };
      }

      return updated;
    });
  };

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
  }, [formData]);

  // Show auto-save confirmation notification
  const showSaveConfirmation = useCallback(() => {
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 2000); // Hide after 2 seconds
  }, []);

  // Helper function to save as draft
  // IMPORTANT: Always use defaultSaveTournament for autosave, not saveTournament!
  // saveTournament might be mapped to onSave which triggers navigation back to dashboard
  const saveAsDraft = useCallback(() => {
    if (!hasUnsavedChanges()) {return;}

    const tournament = createDraftTournament();

    try {
      defaultSaveTournament(tournament);

      // Update formData with the generated ID to prevent creating multiple drafts
      if (!formData.id && tournament.id) {
        setFormData((prev) => ({ ...prev, id: tournament.id }));
      }

      lastSavedDataRef.current = JSON.stringify(formData);
      console.log('[TournamentCreation] Autosave:', tournament.id);

      // Show save confirmation notification
      showSaveConfirmation();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('[TournamentCreation] localStorage quota exceeded');
      } else {
        console.error('[TournamentCreation] Failed to save draft:', error);
      }
    }
  }, [hasUnsavedChanges, formData, defaultSaveTournament, showSaveConfirmation]);

  // Helper function to change step with autosave
  const handleStepChange = useCallback((newStep: number) => {
    // Autosave before changing step
    if (hasUnsavedChanges()) {
      saveAsDraft();
      console.log('[TournamentCreation] Autosave on step change');
    }

    // Mark new step as visited
    setVisitedSteps(prev => new Set([...prev, newStep]));

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
      if (!confirmed) {return;}
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
    if (!formData.placementLogic) {return;}

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.placementLogic.length) {return;}

    const newLogic = [...formData.placementLogic];
    [newLogic[index], newLogic[newIndex]] = [newLogic[newIndex], newLogic[index]];
    updateForm('placementLogic', newLogic);
  };

  const togglePlacementLogic = (index: number) => {
    if (!formData.placementLogic) {return;}

    const newLogic = [...formData.placementLogic];
    newLogic[index] = { ...newLogic[index], enabled: !newLogic[index].enabled };
    updateForm('placementLogic', newLogic);
  };

  const reorderPlacementLogic = (newOrder: PlacementCriterion[]) => {
    updateForm('placementLogic', newOrder);
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
      sportId: formData.sportId || DEFAULT_SPORT_ID,
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
      organizer: formData.organizer, // Veranstalter-Name
      contactInfo: formData.contactInfo, // Kontaktinformationen
      teams: formData.teams || [],
      matches: [], // Wird später vom Fair Scheduler generiert
      createdAt: existingTournament?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastVisitedStep: step, // Save current step for wizard restoration
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
    showSuccess('Turnier als Entwurf gespeichert!');
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

  // Validate a specific step and return errors
  const validateStep = useCallback((stepNumber: number): string[] => {
    const errors: string[] = [];

    switch (stepNumber) {
      case 1: // Stammdaten
        if (!formData.title) {errors.push('Turniername erforderlich');}
        if (!formData.date) {errors.push('Startdatum erforderlich');}
        if (!formData.location?.name) {errors.push('Ort erforderlich');}
        break;
      case 2: // Sportart
        if (!formData.sport) {errors.push('Sportart erforderlich');}
        if (!formData.tournamentType) {errors.push('Turniertyp erforderlich');}
        break;
      case 3: // Modus
        if (!formData.mode) {errors.push('Turniermodus erforderlich');}
        break;
      case 4: // Teams
        if ((formData.teams?.length || 0) < 2) {
          errors.push('Mindestens 2 Teams erforderlich');
        }
        break;
      case 5: // Übersicht
        // No validation - overview is always accessible
        break;
    }

    return errors;
  }, [formData]);

  // Check if navigation to target step is allowed
  const canNavigateToStep = useCallback((targetStep: number): boolean => {
    // Always allow backward navigation
    if (targetStep <= step) {return true;}

    // Allow navigation to already visited steps (forward or backward)
    if (visitedSteps.has(targetStep)) {return true;}

    // For forward navigation to unvisited steps, validate all steps between current and target
    for (let i = step; i < targetStep; i++) {
      const errors = validateStep(i);
      if (errors.length > 0) {
        setStepErrors(prev => ({ ...prev, [i]: errors }));
        return false;
      }
    }

    return true;
  }, [step, validateStep, visitedSteps]);

  // Handle navigation to a specific step via ProgressBar
  const handleNavigateToStep = useCallback((targetStep: number) => {
    // Check if navigation is allowed
    if (!canNavigateToStep(targetStep)) {
      // Show error message for first blocking step
      for (let i = step; i < targetStep; i++) {
        const errors = validateStep(i);
        if (errors.length > 0) {
          showWarning(`Bitte fülle alle erforderlichen Felder aus: ${errors.join(', ')}`);
          break;
        }
      }
      return;
    }

    // Auto-save before navigation
    if (hasUnsavedChanges()) {
      saveAsDraft();
      console.log('[TournamentCreation] Autosave on ProgressBar navigation');
    }

    // Update visited steps
    setVisitedSteps(prev => new Set([...prev, targetStep]));

    // Clear errors for target step
    setStepErrors(prev => {
      const updated = { ...prev };
      delete updated[targetStep];
      return updated;
    });

    // Navigate
    setStep(targetStep);
  }, [canNavigateToStep, step, validateStep, hasUnsavedChanges, saveAsDraft]);

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
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
          borderRadius: theme.borderRadius.md,
        }}>
          <div>
            <span style={{ fontWeight: theme.fontWeights.semibold, color: theme.colors.text.primary }}>
              Schnellbearbeitung
            </span>
            <span style={{ marginLeft: '8px', color: theme.colors.text.secondary, fontSize: theme.fontSizes.sm }}>
              Änderungen vornehmen und speichern
            </span>
          </div>
          <Button
            variant="primary"
            onClick={handlePublish}
            style={{ background: '#4CAF50' }}
          >
            Speichern & Zurück
          </Button>
        </div>
      )}

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
        {quickEditMode ? 'Abbrechen' : 'Zurück zum Dashboard'}
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
          onStepClick={handleNavigateToStep}
          visitedSteps={visitedSteps}
          stepErrors={stepErrors}
          clickable={true}
        />
      )}

      {/* Steps with lazy loading and error boundary */}
      <ErrorBoundary>
        <Suspense fallback={<StepLoadingFallback />}>
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
        </Suspense>
      </ErrorBoundary>

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
            borderRadius: theme.borderRadius.sm,
            color: theme.colors.background,
            fontSize: theme.fontSizes.sm,
            fontWeight: theme.fontWeights.medium,
            boxShadow: theme.shadows.lg,
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
    </div>
  );
};

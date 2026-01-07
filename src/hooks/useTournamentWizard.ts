/**
 * useTournamentWizard Hook
 *
 * Manages wizard state and navigation for tournament creation.
 * Extracted from TournamentCreationScreen to reduce component complexity.
 * Refactored to use TournamentCreationService for business logic.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Tournament, TournamentType, PlacementCriterion } from '../types/tournament';
import { countMatchesWithResults } from '../utils/teamHelpers';
import { getSportConfig, DEFAULT_SPORT_ID } from '../config/sports';
import { TournamentCreationService } from '../core/services/TournamentCreationService';
import { LocalStorageRepository } from '../core/repositories/LocalStorageRepository';

// Singleton instance of the service (could be moved to context/DI container)
const repository = new LocalStorageRepository();
const creationService = new TournamentCreationService(repository);

export interface WizardState {
  step: number;
  formData: Partial<Tournament>;
  visitedSteps: Set<number>;
  stepErrors: Record<number, string[]>;
  scheduleError: string | null;
}

export interface WizardActions {
  setStep: (step: number) => void;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Tournament>>>;
  setVisitedSteps: React.Dispatch<React.SetStateAction<Set<number>>>;
  setStepErrors: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  setScheduleError: (error: string | null) => void;
  updateForm: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  handleStepChange: (newStep: number) => void;
  handleNavigateToStep: (targetStep: number) => void;
  canGoNext: () => boolean;
  canNavigateToStep: (targetStep: number) => boolean;
  validateStep: (stepNumber: number) => string[];
}

export interface TeamActions {
  addTeam: () => void;
  removeTeam: (id: string) => void;
  updateTeam: (id: string, updates: Partial<Tournament['teams'][0]>) => void;
}

export interface PlacementActions {
  movePlacementLogic: (index: number, direction: number) => void;
  togglePlacementLogic: (index: number) => void;
  reorderPlacementLogic: (newOrder: PlacementCriterion[]) => void;
}

export interface TournamentTypeActions {
  handleTournamentTypeChange: (newType: TournamentType) => void;
  handleResetTournament: () => void;
}

export interface UseTournamentWizardReturn {
  // State
  step: number;
  formData: Partial<Tournament>;
  visitedSteps: Set<number>;
  stepErrors: Record<number, string[]>;
  scheduleError: string | null;
  hasResults: boolean;
  lastSavedDataRef: React.MutableRefObject<string>;

  // Actions
  setStep: (step: number) => void;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Tournament>>>;
  setScheduleError: (error: string | null) => void;
  updateForm: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  handleStepChange: (newStep: number, saveCallback?: () => void) => void;
  handleNavigateToStep: (targetStep: number, saveCallback?: () => void, warningCallback?: (msg: string) => void) => void;
  canGoNext: () => boolean;
  canNavigateToStep: (targetStep: number) => boolean;
  validateStep: (stepNumber: number) => string[];

  // Team Actions
  addTeam: () => void;
  removeTeam: (id: string) => void;
  updateTeam: (id: string, updates: Partial<Tournament['teams'][0]>) => void;

  // Placement Actions
  movePlacementLogic: (index: number, direction: number) => void;
  togglePlacementLogic: (index: number) => void;
  reorderPlacementLogic: (newOrder: PlacementCriterion[]) => void;

  // Tournament Type Actions
  handleTournamentTypeChange: (newType: TournamentType) => void;
  handleResetTournament: () => void;

  // Draft Creation
  createDraftTournament: () => Tournament;

  // Persistence
  saveDraft: () => Promise<Tournament>;
  publishTournament: () => Promise<Tournament>;
}

export function useTournamentWizard(
  existingTournament?: Tournament
): UseTournamentWizardReturn {
  // Initial step from existing tournament (draft restoration)
  const initialStep = existingTournament?.lastVisitedStep ?? 1;

  // Initialize visited steps
  const initialVisitedSteps = useMemo(() => {
    const steps = new Set<number>();
    const hasExistingData = existingTournament && (
      existingTournament.teams.length > 0 ||
      existingTournament.matches.length > 0 ||
      existingTournament.title
    );

    if (hasExistingData) {
      for (let i = 1; i <= 6; i++) {
        steps.add(i);
      }
    } else {
      for (let i = 1; i <= initialStep; i++) {
        steps.add(i);
      }
    }
    return steps;
  }, [existingTournament, initialStep]);

  // State
  const [step, setStep] = useState(initialStep);
  // Use Service to create default draft if no existing tournament
  const [formData, setFormData] = useState<Partial<Tournament>>(
    existingTournament ?? creationService.createDraft()
  );
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(initialVisitedSteps);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Check if tournament has results
  const hasResults = useMemo(() => {
    if (!formData.matches || formData.matches.length === 0) { return false; }
    return countMatchesWithResults(formData.matches) > 0;
  }, [formData.matches]);

  // Update form data
  const updateForm = useCallback(<K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // When switching to roundRobin, remove group assignments from teams
      if (field === 'groupSystem' && value === 'roundRobin' && prev.teams) {
        updated.teams = prev.teams.map((team) => {
          const { group: _group, ...teamWithoutGroup } = team;
          return teamWithoutGroup;
        });
      }

      // When switching to groupsAndFinals, apply sport-specific default finals preset
      if (field === 'groupSystem' && value === 'groupsAndFinals') {
        const sportConfig = getSportConfig(prev.sportId ?? DEFAULT_SPORT_ID);
        updated.finalsConfig = {
          ...prev.finalsConfig,
          preset: sportConfig.defaults.defaultFinalsPreset,
          tiebreaker: sportConfig.rules.defaultTiebreaker,
          tiebreakerDuration: sportConfig.rules.defaultTiebreakerDuration,
        };
      }

      return updated;
    });
  }, []);

  // Validate step using Service
  const validateStep = useCallback((stepNumber: number): string[] => {
    return creationService.validateStep(stepNumber, formData);
  }, [formData]);

  // Can go to next step
  const canGoNext = useCallback((): boolean => {
    // If current step is valid, we can go next
    // Service validation returns array of strings. Empty = valid.
    const errors = creationService.validateStep(step, formData);
    return errors.length === 0;
  }, [step, formData]);

  // Can navigate to step
  const canNavigateToStep = useCallback((targetStep: number): boolean => {
    if (targetStep <= step) { return true; }
    if (visitedSteps.has(targetStep)) { return true; }

    for (let i = step; i < targetStep; i++) {
      const errors = validateStep(i);
      if (errors.length > 0) {
        setStepErrors(prev => ({ ...prev, [i]: errors }));
        return false;
      }
    }

    return true;
  }, [step, validateStep, visitedSteps]);

  // Handle step change
  const handleStepChange = useCallback((newStep: number, saveCallback?: () => void) => {
    saveCallback?.();

    if (newStep === 6) {
      setScheduleError(null);
    }

    setVisitedSteps(prev => new Set([...prev, newStep]));
    setStep(newStep);
  }, []);

  // Handle navigate to step
  const handleNavigateToStep = useCallback((
    targetStep: number,
    saveCallback?: () => void,
    warningCallback?: (msg: string) => void
  ) => {
    if (!canNavigateToStep(targetStep)) {
      for (let i = step; i < targetStep; i++) {
        const errors = validateStep(i);
        if (errors.length > 0) {
          warningCallback?.(`Bitte fülle alle erforderlichen Felder aus: ${errors.join(', ')}`);
          break;
        }
      }
      return;
    }

    saveCallback?.();
    setVisitedSteps(prev => new Set([...prev, targetStep]));
    setStepErrors(prev => {
      const { [targetStep]: _removed, ...rest } = prev;
      void _removed; // Consume unused variable
      return rest;
    });
    setStep(targetStep);
  }, [canNavigateToStep, step, validateStep]);

  // Team actions
  const addTeam = useCallback(() => {
    const newTeam = {
      id: `team-${Date.now()}`,
      name: `Team ${(formData.teams?.length ?? 0) + 1}`,
    };
    updateForm('teams', [...(formData.teams ?? []), newTeam]);
  }, [formData.teams, updateForm]);

  const removeTeam = useCallback((id: string) => {
    updateForm('teams', formData.teams?.filter((t) => t.id !== id) ?? []);
  }, [formData.teams, updateForm]);

  const updateTeam = useCallback((id: string, updates: Partial<Tournament['teams'][0]>) => {
    updateForm(
      'teams',
      formData.teams?.map((t) => (t.id === id ? { ...t, ...updates } : t)) ?? []
    );
  }, [formData.teams, updateForm]);

  // Placement logic actions
  const movePlacementLogic = useCallback((index: number, direction: number) => {
    if (!formData.placementLogic) { return; }

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.placementLogic.length) { return; }

    const newLogic = [...formData.placementLogic];
    [newLogic[index], newLogic[newIndex]] = [newLogic[newIndex], newLogic[index]];
    updateForm('placementLogic', newLogic);
  }, [formData.placementLogic, updateForm]);

  const togglePlacementLogic = useCallback((index: number) => {
    if (!formData.placementLogic) { return; }

    const newLogic = [...formData.placementLogic];
    newLogic[index] = { ...newLogic[index], enabled: !newLogic[index].enabled };
    updateForm('placementLogic', newLogic);
  }, [formData.placementLogic, updateForm]);

  const reorderPlacementLogic = useCallback((newOrder: PlacementCriterion[]) => {
    updateForm('placementLogic', newOrder);
  }, [updateForm]);

  // Tournament type change
  const handleTournamentTypeChange = useCallback((newType: TournamentType) => {
    const currentType = formData.tournamentType;

    if (currentType && currentType !== newType) {
      const confirmed = window.confirm(
        `Möchtest du wirklich zu "${newType === 'classic' ? 'Klassisches Turnier' : 'Bambini-Turnier'}" wechseln?\n\nDie Einstellungen werden angepasst.`
      );
      if (!confirmed) { return; }
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
  }, [formData.tournamentType]);

  // Reset tournament
  const handleResetTournament = useCallback(() => {
    if (!formData.matches || formData.matches.length === 0) { return; }

    const resultCount = countMatchesWithResults(formData.matches);

    const confirmed = window.confirm(
      `⚠️ TURNIER ZURÜCKSETZEN\n\n` +
      `Es werden ${resultCount} Ergebnis${resultCount === 1 ? '' : 'se'} gelöscht!\n\n` +
      `Diese Aktion kann nicht rückgängig gemacht werden.\n\n` +
      `Möchtest du wirklich fortfahren?`
    );

    if (!confirmed) { return; }

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
  }, [formData.matches]);

  // Create draft tournament
  const createDraftTournament = useCallback((): Tournament => {
    // Delegate to Service
    return creationService.createDraft({
      ...formData,
      lastVisitedStep: step,
    }, existingTournament?.id);
  }, [formData, existingTournament, step]);

  // Save draft
  const saveDraft = useCallback(async (): Promise<Tournament> => {
    const saved = await creationService.saveDraft({
      ...formData,
      lastVisitedStep: step,
    });
    setFormData(saved);
    lastSavedDataRef.current = JSON.stringify(saved);
    return saved;
  }, [formData, step]);

  // Publish tournament
  const publishTournament = useCallback(async (): Promise<Tournament> => {
    const published = await creationService.publish({
      ...formData,
      lastVisitedStep: step,
    });
    setFormData(published);
    lastSavedDataRef.current = JSON.stringify(published);
    return published;
  }, [formData, step]);

  return {
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
    handleStepChange,
    handleNavigateToStep,
    canGoNext,
    canNavigateToStep,
    validateStep,

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
  };
}

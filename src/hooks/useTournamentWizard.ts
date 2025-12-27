/**
 * useTournamentWizard Hook
 *
 * Manages wizard state and navigation for tournament creation.
 * Extracted from TournamentCreationScreen to reduce component complexity.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Tournament, TournamentType, PlacementCriterion } from '../types/tournament';
import { generateTournamentId } from '../utils/idGenerator';
import { countMatchesWithResults } from '../utils/teamHelpers';
import { getSportConfig, DEFAULT_SPORT_ID } from '../config/sports';

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
  const [formData, setFormData] = useState<Partial<Tournament>>(
    existingTournament ?? getDefaultFormData()
  );
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(initialVisitedSteps);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Check if tournament has results
  const hasResults = useMemo(() => {
    if (!formData.matches || formData.matches.length === 0) {return false;}
    return countMatchesWithResults(formData.matches) > 0;
  }, [formData.matches]);

  // Helper: Check for duplicates
  const hasDuplicates = useCallback((items: (string | undefined)[]): boolean => {
    const names = items
      .map(name => name?.trim().toLowerCase())
      .filter((name): name is string => !!name && name.length > 0);
    return new Set(names).size !== names.length;
  }, []);

  const findDuplicates = useCallback((items: (string | undefined)[]): Set<string> => {
    const names = items
      .map(name => name?.trim().toLowerCase())
      .filter((name): name is string => !!name && name.length > 0);
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    names.forEach(name => {
      if (seen.has(name)) {duplicates.add(name);}
      seen.add(name);
    });
    return duplicates;
  }, []);

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

  // Validate step
  const validateStep = useCallback((stepNumber: number): string[] => {
    const errors: string[] = [];

    switch (stepNumber) {
      case 1:
        if (!formData.title) {errors.push('Turniername erforderlich');}
        if (!formData.date) {errors.push('Startdatum erforderlich');}
        if (!formData.location?.name) {errors.push('Ort erforderlich');}
        break;
      case 2:
        if (!formData.sport) {errors.push('Sportart erforderlich');}
        if (!formData.tournamentType) {errors.push('Turniertyp erforderlich');}
        break;
      case 3:
        if (!formData.mode) {errors.push('Turniermodus erforderlich');}
        if (formData.refereeConfig?.refereeNames) {
          const refNames = Object.values(formData.refereeConfig.refereeNames);
          if (findDuplicates(refNames).size > 0) {
            errors.push('Schiedsrichter-Namen müssen eindeutig sein');
          }
        }
        break;
      case 4:
        if (formData.fields) {
          const fieldNames = formData.fields.map(f => f.customName);
          if (findDuplicates(fieldNames).size > 0) {
            errors.push('Feldnamen müssen eindeutig sein');
          }
        }
        if (formData.groups) {
          const groupNames = formData.groups.map(g => g.customName);
          if (findDuplicates(groupNames).size > 0) {
            errors.push('Gruppennamen müssen eindeutig sein');
          }
        }
        break;
      case 5:
        if ((formData.teams?.length ?? 0) < 2) {
          errors.push('Mindestens 2 Teams erforderlich');
        }
        if (formData.teams) {
          const teamNames = formData.teams.map(t => t.name);
          if (findDuplicates(teamNames).size > 0) {
            errors.push('Teamnamen müssen eindeutig sein');
          }
        }
        break;
    }

    return errors;
  }, [formData, findDuplicates]);

  // Can go to next step
  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 1:
        return !!(formData.title && formData.date && formData.location);
      case 2:
        return !!(formData.sport && formData.tournamentType);
      case 3:
        if (!formData.mode) {return false;}
        if (formData.refereeConfig?.refereeNames) {
          if (hasDuplicates(Object.values(formData.refereeConfig.refereeNames))) {return false;}
        }
        return true;
      case 4:
        if (formData.fields && hasDuplicates(formData.fields.map(f => f.customName))) {return false;}
        if (formData.groups && hasDuplicates(formData.groups.map(g => g.customName))) {return false;}
        return true;
      case 5:
        if ((formData.teams?.length ?? 0) < 2) {return false;}
        if (formData.teams && hasDuplicates(formData.teams.map(t => t.name))) {return false;}
        return true;
      default:
        return true;
    }
  }, [step, formData, hasDuplicates]);

  // Can navigate to step
  const canNavigateToStep = useCallback((targetStep: number): boolean => {
    if (targetStep <= step) {return true;}
    if (visitedSteps.has(targetStep)) {return true;}

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [targetStep]: _, ...rest } = prev;
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
    if (!formData.placementLogic) {return;}

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.placementLogic.length) {return;}

    const newLogic = [...formData.placementLogic];
    [newLogic[index], newLogic[newIndex]] = [newLogic[newIndex], newLogic[index]];
    updateForm('placementLogic', newLogic);
  }, [formData.placementLogic, updateForm]);

  const togglePlacementLogic = useCallback((index: number) => {
    if (!formData.placementLogic) {return;}

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
  }, [formData.tournamentType]);

  // Reset tournament
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
    return {
      id: formData.id || existingTournament?.id || generateTournamentId(),
      status: 'draft',
      sport: formData.sport ?? 'football',
      sportId: formData.sportId ?? DEFAULT_SPORT_ID,
      tournamentType: formData.tournamentType ?? 'classic',
      mode: formData.mode ?? 'classic',
      numberOfFields: formData.numberOfFields ?? 1,
      numberOfTeams: formData.numberOfTeams ?? 4,
      groupSystem: formData.groupSystem,
      numberOfGroups: formData.numberOfGroups,
      groupPhaseGameDuration: formData.groupPhaseGameDuration ?? 10,
      groupPhaseBreakDuration: formData.groupPhaseBreakDuration,
      finalRoundGameDuration: formData.finalRoundGameDuration,
      finalRoundBreakDuration: formData.finalRoundBreakDuration,
      breakBetweenPhases: formData.breakBetweenPhases,
      gamePeriods: formData.gamePeriods,
      halftimeBreak: formData.halftimeBreak,
      gameDuration: formData.gameDuration ?? formData.groupPhaseGameDuration ?? 10,
      breakDuration: formData.breakDuration ?? formData.groupPhaseBreakDuration,
      roundLogic: formData.roundLogic,
      numberOfRounds: formData.numberOfRounds,
      placementLogic: formData.placementLogic ?? [],
      finals: formData.finals ?? { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
      finalsConfig: formData.finalsConfig,
      refereeConfig: formData.refereeConfig ?? { mode: 'none' },
      isKidsTournament: formData.isKidsTournament ?? false,
      hideScoresForPublic: formData.hideScoresForPublic ?? false,
      hideRankingsForPublic: formData.hideRankingsForPublic ?? false,
      resultMode: formData.resultMode ?? 'goals',
      pointSystem: formData.pointSystem ?? { win: 3, draw: 1, loss: 0 },
      title: formData.title ?? 'Unbenanntes Turnier',
      ageClass: formData.ageClass ?? 'U11',
      date: formData.date || new Date().toISOString().split('T')[0],
      timeSlot: formData.timeSlot ?? '',
      startDate: formData.startDate,
      startTime: formData.startTime,
      location: formData.location ?? { name: '' },
      organizer: formData.organizer,
      contactInfo: formData.contactInfo,
      groups: formData.groups,
      fields: formData.fields,
      teams: formData.teams ?? [],
      matches: [],
      createdAt: existingTournament?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastVisitedStep: step,
    };
  }, [formData, existingTournament, step]);

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
  };
}

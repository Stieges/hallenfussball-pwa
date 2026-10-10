import { useState, useEffect, useCallback } from 'react';
import { Tournament } from '../../../types/tournament';
import { useToast } from '../../../components/ui/Toast/ToastContext';
import {
  LockedConstraints,
  MatchStructure,
  Recommendation,
  SmartConfigResult,
  StoredConfig,
  loadStoredConfig,
  saveStoredConfig,
  calculateRecommendation,
  buildConstraintsList,
} from '../utils/smartConfigCalculator';

interface UseSmartConfigProps {
  formData: Partial<Tournament>;
  onApply: (config: SmartConfigResult) => void;
}

interface UseSmartConfigReturn {
  // Panel state
  isOpen: boolean;
  togglePanel: () => void;

  // Time input (two fields)
  hours: number;
  setHours: (hours: number) => void;
  minutes: number;
  setMinutes: (minutes: number) => void;
  availableHours: number; // Computed: hours + minutes/60

  // Recommendation
  recommendation: Recommendation | null;
  /** Festgehaltene Teamzahl passt mit keiner Konfiguration in die Zeit (@W4-022) */
  teamsKeptTimeShort: boolean;
  lastApplied: StoredConfig['lastApplied'];

  // Constraint locks
  lockTeams: boolean;
  setLockTeams: (locked: boolean) => void;
  lockFields: boolean;
  setLockFields: (locked: boolean) => void;
  lockGameDuration: boolean;
  setLockGameDuration: (locked: boolean) => void;
  lockBreakDuration: boolean;
  setLockBreakDuration: (locked: boolean) => void;

  // Constraint values
  constraintTeams: number;
  setConstraintTeams: (value: number) => void;
  constraintFields: number;
  setConstraintFields: (value: number) => void;
  constraintGameDuration: number;
  setConstraintGameDuration: (value: number) => void;
  constraintBreakDuration: number;
  setConstraintBreakDuration: (value: number) => void;

  // Actions
  handleCalculate: () => void;
  handleApply: () => void;
  handleQuickApply: () => void;

  // Derived state
  showTeamsWarning: boolean;
}

/**
 * Hook for Smart Config state and logic
 * Extracted from SmartConfig.tsx for better separation of concerns
 */
export function useSmartConfig({
  formData,
  onApply,
}: UseSmartConfigProps): UseSmartConfigReturn {
  // Panel state
  const [isOpen, setIsOpen] = useState(false);

  // Time input: hours and minutes separately
  const storedHours = loadStoredConfig().lastHours;
  const [hours, setHoursState] = useState(() => Math.floor(storedHours));
  const [minutes, setMinutesState] = useState(() => Math.round((storedHours % 1) * 60));

  // Computed available hours for calculations
  const availableHours = hours + minutes / 60;

  // Setters with validation
  const setHours = (value: number) => setHoursState(Math.max(0, Math.min(12, value)));
  const setMinutes = (value: number) => setMinutesState(Math.max(0, Math.min(59, value)));

  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [teamsKeptTimeShort, setTeamsKeptTimeShort] = useState(false);
  const [lastApplied, setLastApplied] = useState<StoredConfig['lastApplied']>(
    () => loadStoredConfig().lastApplied
  );

  // Constraint locks
  const [lockTeams, setLockTeams] = useState(true); // Teams locked by default
  const [lockFields, setLockFields] = useState(false);
  const [lockGameDuration, setLockGameDuration] = useState(false);
  const [lockBreakDuration, setLockBreakDuration] = useState(false);

  // Constraint values (use current form values as defaults)
  const [constraintTeams, setConstraintTeams] = useState(formData.numberOfTeams ?? 6);
  const [constraintFields, setConstraintFields] = useState(formData.numberOfFields ?? 1);
  const [constraintGameDuration, setConstraintGameDuration] = useState(
    formData.groupPhaseGameDuration ?? 10
  );
  const [constraintBreakDuration, setConstraintBreakDuration] = useState(
    formData.groupPhaseBreakDuration ?? 2
  );

  // Derived state
  const usesGroups = formData.groupSystem === 'groupsAndFinals';

  // Toast for warnings
  const { showWarning } = useToast();

  // Sync constraint values with formData when it changes
  useEffect(() => {
    setConstraintTeams(formData.numberOfTeams ?? 6);
    setConstraintFields(formData.numberOfFields ?? 1);
    setConstraintGameDuration(formData.groupPhaseGameDuration ?? 10);
    setConstraintBreakDuration(formData.groupPhaseBreakDuration ?? 2);
  }, [
    formData.numberOfTeams,
    formData.numberOfFields,
    formData.groupPhaseGameDuration,
    formData.groupPhaseBreakDuration,
  ]);

  // Save hours and constraints to localStorage when changed
  useEffect(() => {
    const stored = loadStoredConfig();
    const constraints: LockedConstraints = {};
    if (lockTeams) {constraints.teams = constraintTeams;}
    if (lockFields) {constraints.fields = constraintFields;}
    if (lockGameDuration) {constraints.gameDuration = constraintGameDuration;}
    if (lockBreakDuration) {constraints.breakDuration = constraintBreakDuration;}

    saveStoredConfig({ ...stored, lastHours: availableHours, lastConstraints: constraints });
  }, [
    availableHours,
    lockTeams,
    lockFields,
    lockGameDuration,
    lockBreakDuration,
    constraintTeams,
    constraintFields,
    constraintGameDuration,
    constraintBreakDuration,
  ]);

  // Build constraints object
  const getConstraints = useCallback((): LockedConstraints => {
    const constraints: LockedConstraints = {};
    if (lockTeams) {constraints.teams = constraintTeams;}
    if (lockFields) {constraints.fields = constraintFields;}
    if (lockGameDuration) {constraints.gameDuration = constraintGameDuration;}
    if (lockBreakDuration) {constraints.breakDuration = constraintBreakDuration;}
    return constraints;
  }, [
    lockTeams,
    lockFields,
    lockGameDuration,
    lockBreakDuration,
    constraintTeams,
    constraintFields,
    constraintGameDuration,
    constraintBreakDuration,
  ]);

  const handleCalculate = useCallback(() => {
    const constraints = getConstraints();
    const teamsToUse = lockTeams ? constraintTeams : (formData.numberOfTeams ?? 6);
    // @W4-020: Gruppenzahl und Finalrunden-Wahl aus dem Wizard-Zustand (formData), nicht aus dem Panel-Lock
    const structure: MatchStructure = usesGroups
      ? {
          groupCount: formData.numberOfGroups ?? 2,
          finalsPlan: formData.finalsConfig?.preset ?? 'none',
        }
      : {};
    const result = calculateRecommendation(availableHours, teamsToUse, constraints, structure);

    if (result.constraintsImpossible) {
      const constraintsList = buildConstraintsList(constraints);
      showWarning(
        `Mit den Einschränkungen (${constraintsList.join(', ')}) werden mindestens ${result.minRequiredHours}h benötigt. Aktuell verfügbar: ${availableHours}h.`
      );
      setRecommendation(null);
      setTeamsKeptTimeShort(false);
    } else {
      setRecommendation(result.recommendation);
      setTeamsKeptTimeShort(result.teamsKeptTimeShort === true);
    }
  }, [
    getConstraints,
    lockTeams,
    constraintTeams,
    formData.numberOfTeams,
    formData.numberOfGroups,
    formData.finalsConfig?.preset,
    availableHours,
    usesGroups,
    showWarning,
  ]);

  const handleApply = useCallback(() => {
    if (!recommendation) {return;}

    const config: SmartConfigResult = {
      numberOfTeams: recommendation.teams,
      numberOfFields: recommendation.fields,
      groupPhaseGameDuration: recommendation.gameDuration,
      groupPhaseBreakDuration: recommendation.breakDuration,
    };

    onApply(config);

    // Save applied config to localStorage
    const appliedConfig = {
      teams: recommendation.teams,
      fields: recommendation.fields,
      gameDuration: recommendation.gameDuration,
      breakDuration: recommendation.breakDuration,
    };
    saveStoredConfig({ lastHours: availableHours, lastApplied: appliedConfig });
    setLastApplied(appliedConfig);

    // Solange die Zeit mit der festen Teamzahl nicht reicht, bleibt die Empfehlung mit Hinweis sichtbar (@W4-022)
    if (teamsKeptTimeShort) {
      return;
    }
    setIsOpen(false);
    setRecommendation(null);
  }, [recommendation, onApply, availableHours, teamsKeptTimeShort]);

  const handleQuickApply = useCallback(() => {
    if (!lastApplied) {return;}

    onApply({
      numberOfTeams: lastApplied.teams,
      numberOfFields: lastApplied.fields,
      groupPhaseGameDuration: lastApplied.gameDuration,
      groupPhaseBreakDuration: lastApplied.breakDuration,
    });
  }, [lastApplied, onApply]);

  const togglePanel = useCallback(() => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (newIsOpen) {
      handleCalculate();
    }
  }, [isOpen, handleCalculate]);

  // Derived: show warning if recommended teams is less than current
  const showTeamsWarning =
    recommendation !== null && recommendation.teams < (formData.numberOfTeams ?? 6);

  return {
    isOpen,
    togglePanel,
    hours,
    setHours,
    minutes,
    setMinutes,
    availableHours,
    recommendation,
    teamsKeptTimeShort,
    lastApplied,
    lockTeams,
    setLockTeams,
    lockFields,
    setLockFields,
    lockGameDuration,
    setLockGameDuration,
    lockBreakDuration,
    setLockBreakDuration,
    constraintTeams,
    setConstraintTeams,
    constraintFields,
    setConstraintFields,
    constraintGameDuration,
    setConstraintGameDuration,
    constraintBreakDuration,
    setConstraintBreakDuration,
    handleCalculate,
    handleApply,
    handleQuickApply,
    showTeamsWarning,
  };
}

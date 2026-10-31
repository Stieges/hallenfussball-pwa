import { useState, useEffect, useCallback } from 'react';
import { Tournament } from '../../../types/tournament';
import { useToast } from '../../../components/ui/Toast/ToastContext';
import { effectiveRoundCount } from '../../../core/generators/repeatRounds';
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
  /** Rückmeldung „Übernommen“ nach Übernehmen, bis Eingaben oder Berechnung sich ändern (@W4-022) */
  applied: boolean;
}

/** Setter, der vor jeder Änderung `onChange` aufruft (Rückmeldung „Übernommen“ zurücksetzen). */
function withApplyReset<T>(set: (value: T) => void, onChange: () => void): (value: T) => void {
  return (value: T) => {
    onChange();
    set(value);
  };
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
  // Eingaben des Nutzers setzen die Rückmeldung „Übernommen“ zurück (@W4-022).
  // Der Sync aus formData darf das nicht (Wizard schreibt nach Übernehmen zurück).
  const setHours = (value: number) => {
    setApplied(false);
    setHoursState(Math.max(0, Math.min(12, value)));
  };
  const setMinutes = (value: number) => {
    setApplied(false);
    setMinutesState(Math.max(0, Math.min(59, value)));
  };

  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [teamsKeptTimeShort, setTeamsKeptTimeShort] = useState(false);
  const [applied, setApplied] = useState(false);
  const [lastApplied, setLastApplied] = useState<StoredConfig['lastApplied']>(
    () => loadStoredConfig().lastApplied
  );

  // Constraint locks
  const [lockTeams, setLockTeamsState] = useState(true); // Teams locked by default
  const [lockFields, setLockFieldsState] = useState(false);
  const [lockGameDuration, setLockGameDurationState] = useState(false);
  const [lockBreakDuration, setLockBreakDurationState] = useState(false);

  // Constraint values (use current form values as defaults)
  const [constraintTeams, setConstraintTeamsState] = useState(formData.numberOfTeams ?? 6);
  const [constraintFields, setConstraintFieldsState] = useState(formData.numberOfFields ?? 1);
  const [constraintGameDuration, setConstraintGameDurationState] = useState(
    formData.groupPhaseGameDuration ?? 10
  );
  const [constraintBreakDuration, setConstraintBreakDurationState] = useState(
    formData.groupPhaseBreakDuration ?? 2
  );

  // Nutzer-Setter für Sperren und Festwerte: setzen die Rückmeldung zurück
  const resetApplied = () => setApplied(false);
  const setLockTeams = withApplyReset(setLockTeamsState, resetApplied);
  const setLockFields = withApplyReset(setLockFieldsState, resetApplied);
  const setLockGameDuration = withApplyReset(setLockGameDurationState, resetApplied);
  const setLockBreakDuration = withApplyReset(setLockBreakDurationState, resetApplied);
  const setConstraintTeams = withApplyReset(setConstraintTeamsState, resetApplied);
  const setConstraintFields = withApplyReset(setConstraintFieldsState, resetApplied);
  const setConstraintGameDuration = withApplyReset(setConstraintGameDurationState, resetApplied);
  const setConstraintBreakDuration = withApplyReset(setConstraintBreakDurationState, resetApplied);

  // Derived state
  const usesGroups = formData.groupSystem === 'groupsAndFinals';

  // Toast for warnings
  const { showWarning } = useToast();

  // Sync constraint values with formData when it changes
  // (Rohe Setter, damit der Sync die Rückmeldung „Übernommen“ nicht zurücksetzt)
  useEffect(() => {
    setConstraintTeamsState(formData.numberOfTeams ?? 6);
    setConstraintFieldsState(formData.numberOfFields ?? 1);
    setConstraintGameDurationState(formData.groupPhaseGameDuration ?? 10);
    setConstraintBreakDurationState(formData.groupPhaseBreakDuration ?? 2);
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
    setApplied(false);
    const constraints = getConstraints();
    const teamsToUse = lockTeams ? constraintTeams : (formData.numberOfTeams ?? 6);
    // @W4-020: Gruppenzahl und Finalrunden-Wahl aus dem Wizard-Zustand (formData), nicht aus dem Panel-Lock
    const structure: MatchStructure = usesGroups
      ? {
          groupCount: formData.numberOfGroups ?? 2,
          finalsPlan: formData.finalsConfig?.preset ?? 'none',
        }
      : { rounds: effectiveRoundCount({ groupSystem: formData.groupSystem, numberOfRounds: formData.numberOfRounds }) }; // @TM-152
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
    formData.groupSystem,
    formData.numberOfRounds,
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
    setApplied(true);

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

  // Derived: Alternative zur Wizard-Teamzahl nur, wenn die Teamzahl frei ist (@W4-022).
  // Bei festgehaltener Teamzahl wurde nicht mit der Wizard-Zahl gerechnet.
  const showTeamsWarning =
    recommendation !== null &&
    !lockTeams &&
    recommendation.teams < (formData.numberOfTeams ?? 6);

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
    applied,
  };
}

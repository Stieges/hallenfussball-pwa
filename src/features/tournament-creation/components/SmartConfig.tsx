import { useState, useEffect } from 'react';
import { Tournament } from '../../../types/tournament';
import { useToast } from '../../../components/ui/Toast/ToastContext';
import styles from './SmartConfig.module.css';

const STORAGE_KEY = 'smartConfig';

interface StoredConfig {
  lastHours: number;
  lastApplied?: {
    teams: number;
    fields: number;
    gameDuration: number;
    breakDuration: number;
  };
  /** Gespeicherte Einschränkungen vom letzten Mal */
  lastConstraints?: LockedConstraints;
}

/** Fixe Einschränkungen die nicht vom Algorithmus geändert werden */
export interface LockedConstraints {
  teams?: number;         // z.B. "genau 8 Teams"
  groups?: number;        // z.B. "genau 2 Gruppen" (nur bei groupsAndFinals)
  fields?: number;        // z.B. "nur 1 Feld verfügbar"
  gameDuration?: number;  // z.B. "genau 10 Min Spieldauer"
  breakDuration?: number; // z.B. "genau 3 Min Pause"
}

function loadStoredConfig(): StoredConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { lastHours: 4 };
}

function saveStoredConfig(config: StoredConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

interface SmartConfigProps {
  formData: Partial<Tournament>;
  onApply: (config: SmartConfigResult) => void;
}

interface SmartConfigResult {
  numberOfTeams: number;
  numberOfFields: number;
  groupPhaseGameDuration: number;
  groupPhaseBreakDuration: number;
}

interface Recommendation {
  teams: number;
  fields: number;
  gameDuration: number;
  breakDuration: number;
  totalMatches: number;
  estimatedHours: number;
}

interface CalculationResult {
  recommendation: Recommendation | null;
  constraintsImpossible: boolean;
  minRequiredHours?: number;
}

/**
 * Calculate optimal tournament configuration based on available time and constraints
 */
function calculateRecommendation(
  availableHours: number,
  currentTeams: number,
  constraints: LockedConstraints = {}
): CalculationResult {
  // Start with current team count and find optimal fields
  const teams = currentTeams;
  const totalMatches = (teams * (teams - 1)) / 2;

  // Try different configurations
  const configurations: Recommendation[] = [];

  // Values to try - use constraint if locked, otherwise try all options
  const gameDurations = constraints.gameDuration
    ? [constraints.gameDuration]
    : [5, 6, 7, 8, 10, 12, 15];  // Erweitert um 5, 6, 7 Minuten
  const breakDurations = constraints.breakDuration
    ? [constraints.breakDuration]
    : [0, 1, 2, 3, 5];  // Erweitert um 0, 1 Minute
  const fieldOptions = constraints.fields
    ? [constraints.fields]
    : [1, 2, 3, 4];

  // Track minimum hours needed with constraints
  let minHoursWithConstraints = Infinity;

  for (const gameDuration of gameDurations) {
    for (const breakDuration of breakDurations) {
      for (const fields of fieldOptions) {
        const slotDuration = gameDuration + breakDuration;
        const slotsNeeded = Math.ceil(totalMatches / fields);
        const totalMinutes = slotsNeeded * slotDuration;
        const estimatedHours = totalMinutes / 60;

        // Track minimum hours needed
        if (estimatedHours < minHoursWithConstraints) {
          minHoursWithConstraints = estimatedHours;
        }

        if (estimatedHours <= availableHours) {
          configurations.push({
            teams,
            fields,
            gameDuration,
            breakDuration,
            totalMatches,
            estimatedHours,
          });
        }
      }
    }
  }

  // Sort by: fewer fields (simpler), then longer game duration (better quality)
  configurations.sort((a, b) => {
    if (a.fields !== b.fields) {return a.fields - b.fields;}
    return b.gameDuration - a.gameDuration;
  });

  // Return best match if found
  if (configurations.length > 0) {
    return {
      recommendation: configurations[0],
      constraintsImpossible: false,
    };
  }

  // Check if constraints make it impossible
  const hasConstraints = constraints.fields || constraints.gameDuration || constraints.breakDuration;
  if (hasConstraints) {
    return {
      recommendation: null,
      constraintsImpossible: true,
      minRequiredHours: Math.ceil(minHoursWithConstraints * 10) / 10, // Round to 1 decimal
    };
  }

  // Fallback without constraints: reduce teams
  const reducedTeams = Math.max(4, Math.floor(teams * 0.7));
  const reducedMatches = (reducedTeams * (reducedTeams - 1)) / 2;
  const fields = Math.ceil(reducedMatches / (availableHours * 60 / 12)); // 12min slots

  return {
    recommendation: {
      teams: reducedTeams,
      fields: Math.max(1, Math.min(4, fields)),
      gameDuration: 10,
      breakDuration: 2,
      totalMatches: reducedMatches,
      estimatedHours: (reducedMatches / Math.max(1, fields)) * 12 / 60,
    },
    constraintsImpossible: false,
  };
}

export const SmartConfig: React.FC<SmartConfigProps> = ({ formData, onApply }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableHours, setAvailableHours] = useState(() => loadStoredConfig().lastHours);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [lastApplied, setLastApplied] = useState<StoredConfig['lastApplied']>(() => loadStoredConfig().lastApplied);

  // Constraint states - which values are locked
  const [lockTeams, setLockTeams] = useState(true);  // Teams standardmäßig fixiert
  const [lockGroups, setLockGroups] = useState(false);
  const [lockFields, setLockFields] = useState(false);
  const [lockGameDuration, setLockGameDuration] = useState(false);
  const [lockBreakDuration, setLockBreakDuration] = useState(false);

  // Constraint values (use current form values as defaults)
  const [constraintTeams, setConstraintTeams] = useState(formData.numberOfTeams || 6);
  const [constraintGroups, setConstraintGroups] = useState(formData.numberOfGroups || 2);
  const [constraintFields, setConstraintFields] = useState(formData.numberOfFields || 1);
  const [constraintGameDuration, setConstraintGameDuration] = useState(formData.groupPhaseGameDuration || 10);
  const [constraintBreakDuration, setConstraintBreakDuration] = useState(formData.groupPhaseBreakDuration || 2);

  // Check if using groups mode
  const usesGroups = formData.groupSystem === 'groupsAndFinals';

  // Toast for warnings
  const { showWarning } = useToast();

  // Sync constraint values with formData when it changes (falls noch nicht manuell geändert)
  useEffect(() => {
    setConstraintTeams(formData.numberOfTeams || 6);
    setConstraintGroups(formData.numberOfGroups || 2);
    setConstraintFields(formData.numberOfFields || 1);
    setConstraintGameDuration(formData.groupPhaseGameDuration || 10);
    setConstraintBreakDuration(formData.groupPhaseBreakDuration || 2);
  }, [formData.numberOfTeams, formData.numberOfGroups, formData.numberOfFields, formData.groupPhaseGameDuration, formData.groupPhaseBreakDuration]);

  // Save hours and constraints to localStorage when changed
  useEffect(() => {
    const stored = loadStoredConfig();
    const constraints: LockedConstraints = {};
    if (lockTeams) {constraints.teams = constraintTeams;}
    if (lockGroups && usesGroups) {constraints.groups = constraintGroups;}
    if (lockFields) {constraints.fields = constraintFields;}
    if (lockGameDuration) {constraints.gameDuration = constraintGameDuration;}
    if (lockBreakDuration) {constraints.breakDuration = constraintBreakDuration;}

    saveStoredConfig({ ...stored, lastHours: availableHours, lastConstraints: constraints });
  }, [availableHours, lockTeams, lockGroups, lockFields, lockGameDuration, lockBreakDuration, constraintTeams, constraintGroups, constraintFields, constraintGameDuration, constraintBreakDuration, usesGroups]);

  // Build constraints object
  const getConstraints = (): LockedConstraints => {
    const constraints: LockedConstraints = {};
    if (lockTeams) {constraints.teams = constraintTeams;}
    if (lockGroups && usesGroups) {constraints.groups = constraintGroups;}
    if (lockFields) {constraints.fields = constraintFields;}
    if (lockGameDuration) {constraints.gameDuration = constraintGameDuration;}
    if (lockBreakDuration) {constraints.breakDuration = constraintBreakDuration;}
    return constraints;
  };

  const handleCalculate = () => {
    const constraints = getConstraints();
    // Verwende fixierte Teams wenn gesetzt, sonst aktuelle formData
    const teamsToUse = lockTeams ? constraintTeams : (formData.numberOfTeams || 6);
    const result = calculateRecommendation(availableHours, teamsToUse, constraints);

    if (result.constraintsImpossible) {
      // Show toast warning
      const constraintsList: string[] = [];
      if (lockTeams) {constraintsList.push(`${constraintTeams} Teams`);}
      if (lockGroups && usesGroups) {constraintsList.push(`${constraintGroups} Gruppen`);}
      if (lockFields) {constraintsList.push(`${constraintFields} ${constraintFields === 1 ? 'Feld' : 'Felder'}`);}
      if (lockGameDuration) {constraintsList.push(`${constraintGameDuration} Min Spieldauer`);}
      if (lockBreakDuration) {constraintsList.push(`${constraintBreakDuration} Min Pause`);}

      showWarning(
        `Mit den Einschränkungen (${constraintsList.join(', ')}) werden mindestens ${result.minRequiredHours}h benötigt. Aktuell verfügbar: ${availableHours}h.`
      );
      setRecommendation(null);
    } else {
      setRecommendation(result.recommendation);
    }
  };

  const handleApply = () => {
    if (!recommendation) {return;}

    const config = {
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

    setIsOpen(false);
    setRecommendation(null);
  };

  const handleQuickApply = () => {
    if (!lastApplied) {return;}

    onApply({
      numberOfTeams: lastApplied.teams,
      numberOfFields: lastApplied.fields,
      groupPhaseGameDuration: lastApplied.gameDuration,
      groupPhaseBreakDuration: lastApplied.breakDuration,
    });
  };

  return (
    <div className={styles.container}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {handleCalculate();}
        }}
        className={styles.toggleButton}
        aria-expanded={isOpen}
        aria-controls="smart-config-panel"
      >
        <span aria-hidden="true">🧙</span>
        <span>Smart-Konfiguration</span>
        <span className={styles.toggleIcon} aria-hidden="true">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>

      {isOpen && (
        <div id="smart-config-panel" className={styles.panel} role="region" aria-label="Smart-Konfiguration">
          {/* Quick Apply from last session */}
          {lastApplied && !recommendation && (
            <div className={styles.quickApply}>
              <span className={styles.quickApplyLabel}>
                Letzte Konfiguration: {lastApplied.teams} Teams, {lastApplied.fields} {lastApplied.fields === 1 ? 'Feld' : 'Felder'}, {lastApplied.gameDuration}min
              </span>
              <button
                onClick={handleQuickApply}
                className={styles.quickApplyButton}
                aria-label="Letzte Konfiguration wiederherstellen"
              >
                Wiederherstellen
              </button>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="available-hours" className={styles.inputLabel}>
              Wie viel Zeit hast du für das Turnier?
            </label>
            <div className={styles.inputRow}>
              <input
                id="available-hours"
                type="number"
                value={availableHours}
                onChange={(e) => setAvailableHours(Math.max(1, Math.min(12, Number(e.target.value))))}
                min={1}
                max={12}
                step={0.5}
                className={styles.hoursInput}
                aria-describedby="hours-unit"
              />
              <span id="hours-unit" className={styles.hoursLabel}>Stunden</span>
              <button
                onClick={handleCalculate}
                className={styles.calculateButton}
                aria-label="Optimale Konfiguration berechnen"
              >
                Berechnen
              </button>
            </div>
          </div>

          {/* Fixe Einschränkungen */}
          <div className={styles.constraintsSection}>
            <div className={styles.constraintsHeader}>
              <span aria-hidden="true">🔒</span>
              <span>Fixe Einschränkungen</span>
            </div>
            <p className={styles.constraintsHint}>
              Aktiviere Werte, die nicht geändert werden dürfen
            </p>

            <div className={styles.constraintsList}>
              {/* Teams-Constraint */}
              <label className={styles.constraintRow}>
                <input
                  type="checkbox"
                  checked={lockTeams}
                  onChange={(e) => setLockTeams(e.target.checked)}
                  className={styles.constraintCheckbox}
                />
                <span className={styles.constraintLabel}>Anzahl Teams:</span>
                <select
                  value={constraintTeams}
                  onChange={(e) => setConstraintTeams(Number(e.target.value))}
                  disabled={!lockTeams}
                  className={styles.constraintSelect}
                >
                  {[4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              {/* Gruppen-Constraint - nur bei groupsAndFinals */}
              {usesGroups && (
                <label className={styles.constraintRow}>
                  <input
                    type="checkbox"
                    checked={lockGroups}
                    onChange={(e) => setLockGroups(e.target.checked)}
                    className={styles.constraintCheckbox}
                  />
                  <span className={styles.constraintLabel}>Anzahl Gruppen:</span>
                  <select
                    value={constraintGroups}
                    onChange={(e) => setConstraintGroups(Number(e.target.value))}
                    disabled={!lockGroups}
                    className={styles.constraintSelect}
                  >
                    {[2, 3, 4, 5, 6, 8].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Felder-Constraint */}
              <label className={styles.constraintRow}>
                <input
                  type="checkbox"
                  checked={lockFields}
                  onChange={(e) => setLockFields(e.target.checked)}
                  className={styles.constraintCheckbox}
                />
                <span className={styles.constraintLabel}>Anzahl Felder:</span>
                <select
                  value={constraintFields}
                  onChange={(e) => setConstraintFields(Number(e.target.value))}
                  disabled={!lockFields}
                  className={styles.constraintSelect}
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              {/* Spieldauer-Constraint */}
              <label className={styles.constraintRow}>
                <input
                  type="checkbox"
                  checked={lockGameDuration}
                  onChange={(e) => setLockGameDuration(e.target.checked)}
                  className={styles.constraintCheckbox}
                />
                <span className={styles.constraintLabel}>Spieldauer:</span>
                <select
                  value={constraintGameDuration}
                  onChange={(e) => setConstraintGameDuration(Number(e.target.value))}
                  disabled={!lockGameDuration}
                  className={styles.constraintSelect}
                >
                  {[5, 6, 7, 8, 10, 12, 15].map(n => (
                    <option key={n} value={n}>{n} Min</option>
                  ))}
                </select>
              </label>

              {/* Pause-Constraint */}
              <label className={styles.constraintRow}>
                <input
                  type="checkbox"
                  checked={lockBreakDuration}
                  onChange={(e) => setLockBreakDuration(e.target.checked)}
                  className={styles.constraintCheckbox}
                />
                <span className={styles.constraintLabel}>Pausendauer:</span>
                <select
                  value={constraintBreakDuration}
                  onChange={(e) => setConstraintBreakDuration(Number(e.target.value))}
                  disabled={!lockBreakDuration}
                  className={styles.constraintSelect}
                >
                  {[0, 1, 2, 3, 5].map(n => (
                    <option key={n} value={n}>{n} Min</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {recommendation && (
            <>
              <div className={styles.resultCard} role="region" aria-label="Empfohlene Konfiguration">
                <div className={styles.resultTitle}>
                  Empfohlene Konfiguration
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Teams</div>
                    <div className={styles.statValue}>
                      {recommendation.teams}
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Felder</div>
                    <div className={styles.statValue}>
                      {recommendation.fields}
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Spieldauer</div>
                    <div className={styles.statValue}>
                      {recommendation.gameDuration} Min
                    </div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statLabel}>Pause</div>
                    <div className={styles.statValue}>
                      {recommendation.breakDuration} Min
                    </div>
                  </div>
                </div>

                <div className={styles.resultFooter}>
                  <span>{recommendation.totalMatches} Spiele</span>
                  <span>~{recommendation.estimatedHours.toFixed(1)}h Turnierdauer</span>
                </div>
              </div>

              <button
                onClick={handleApply}
                className={styles.applyButton}
                aria-label="Empfohlene Konfiguration übernehmen"
              >
                Konfiguration übernehmen
              </button>
            </>
          )}

          {recommendation && recommendation.teams < (formData.numberOfTeams || 6) && (
            <p className={styles.warningText} role="alert">
              <span aria-hidden="true">⚠️</span> {formData.numberOfTeams} Teams passen nicht in {availableHours}h.
              Alternative: {recommendation.teams} Teams oder mehr Zeit/Felder einplanen.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

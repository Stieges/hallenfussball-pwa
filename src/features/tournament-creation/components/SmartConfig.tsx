import { useState, useEffect } from 'react';
import { Tournament } from '../../../types/tournament';
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

/**
 * Calculate optimal tournament configuration based on available time
 */
function calculateRecommendation(
  availableHours: number,
  currentTeams: number
): Recommendation {
  // Start with current team count and find optimal fields
  const teams = currentTeams;
  const totalMatches = (teams * (teams - 1)) / 2;

  // Try different configurations
  const configurations: Recommendation[] = [];

  // Game durations to try (in minutes)
  const gameDurations = [8, 10, 12, 15];
  // Break durations to try (in minutes)
  const breakDurations = [2, 3, 5];
  // Field counts to try
  const fieldOptions = [1, 2, 3, 4];

  for (const gameDuration of gameDurations) {
    for (const breakDuration of breakDurations) {
      for (const fields of fieldOptions) {
        const slotDuration = gameDuration + breakDuration;
        const slotsNeeded = Math.ceil(totalMatches / fields);
        const totalMinutes = slotsNeeded * slotDuration;
        const estimatedHours = totalMinutes / 60;

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

  // Return best match or a fallback
  if (configurations.length > 0) {
    return configurations[0];
  }

  // Fallback: reduce teams if nothing fits
  const reducedTeams = Math.max(4, Math.floor(teams * 0.7));
  const reducedMatches = (reducedTeams * (reducedTeams - 1)) / 2;
  const fields = Math.ceil(reducedMatches / (availableHours * 60 / 12)); // 12min slots

  return {
    teams: reducedTeams,
    fields: Math.max(1, Math.min(4, fields)),
    gameDuration: 10,
    breakDuration: 2,
    totalMatches: reducedMatches,
    estimatedHours: (reducedMatches / Math.max(1, fields)) * 12 / 60,
  };
}

export const SmartConfig: React.FC<SmartConfigProps> = ({ formData, onApply }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableHours, setAvailableHours] = useState(() => loadStoredConfig().lastHours);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [lastApplied, setLastApplied] = useState<StoredConfig['lastApplied']>(() => loadStoredConfig().lastApplied);

  // Save hours to localStorage when changed
  useEffect(() => {
    const stored = loadStoredConfig();
    saveStoredConfig({ ...stored, lastHours: availableHours });
  }, [availableHours]);

  const handleCalculate = () => {
    const currentTeams = formData.numberOfTeams || 6;
    const rec = calculateRecommendation(availableHours, currentTeams);
    setRecommendation(rec);
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

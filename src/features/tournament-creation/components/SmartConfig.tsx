import { Tournament } from '../../../types/tournament';
import { SmartConfigResult } from '../utils/smartConfigCalculator';
import { useSmartConfig } from '../hooks/useSmartConfig';
import styles from './SmartConfig.module.css';

interface SmartConfigProps {
  formData: Partial<Tournament>;
  onApply: (config: SmartConfigResult) => void;
}

export const SmartConfig: React.FC<SmartConfigProps> = ({ formData, onApply }) => {
  const {
    isOpen,
    togglePanel,
    hours,
    setHours,
    minutes,
    setMinutes,
    availableHours,
    recommendation,
    lastApplied,
    lockTeams,
    setLockTeams,
    lockGroups,
    setLockGroups,
    lockFields,
    setLockFields,
    lockGameDuration,
    setLockGameDuration,
    lockBreakDuration,
    setLockBreakDuration,
    constraintTeams,
    setConstraintTeams,
    constraintGroups,
    setConstraintGroups,
    constraintFields,
    setConstraintFields,
    constraintGameDuration,
    setConstraintGameDuration,
    constraintBreakDuration,
    setConstraintBreakDuration,
    handleCalculate,
    handleApply,
    handleQuickApply,
    usesGroups,
    showTeamsWarning,
  } = useSmartConfig({ formData, onApply });

  return (
    <div className={styles.container}>
      <button
        onClick={togglePanel}
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
            <label className={styles.inputLabel}>
              Wie viel Zeit hast du für das Turnier?
            </label>
            <div className={styles.inputRow}>
              <div className={styles.timeInputWrapper}>
                <input
                  id="available-hours"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setHours(0);
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        setHours(num);
                      }
                    }
                  }}
                  className={styles.hoursInput}
                  aria-label="Stunden"
                />
                <span className={styles.timeUnit}>h</span>
              </div>
              <div className={styles.timeInputWrapper}>
                <input
                  id="available-minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={15}
                  value={minutes}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setMinutes(0);
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        setMinutes(num);
                      }
                    }
                  }}
                  className={styles.minutesInput}
                  aria-label="Minuten"
                />
                <span className={styles.timeUnit}>min</span>
              </div>
              <button
                onClick={handleCalculate}
                className={styles.calculateButton}
                aria-label="Optimale Konfiguration berechnen"
              >
                Berechnen
              </button>
            </div>
          </div>

          {/* Fixed Constraints */}
          <div className={styles.constraintsSection}>
            <div className={styles.constraintsHeader}>
              <span aria-hidden="true">🔒</span>
              <span>Fixe Einschränkungen</span>
            </div>
            <p className={styles.constraintsHint}>
              Aktiviere Werte, die nicht geändert werden dürfen
            </p>

            <div className={styles.constraintsList}>
              {/* Teams Constraint */}
              <ConstraintRow
                label="Anzahl Teams:"
                checked={lockTeams}
                onCheckedChange={setLockTeams}
                value={constraintTeams}
                onValueChange={setConstraintTeams}
                options={[4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24]}
              />

              {/* Groups Constraint - only for groupsAndFinals */}
              {usesGroups && (
                <ConstraintRow
                  label="Anzahl Gruppen:"
                  checked={lockGroups}
                  onCheckedChange={setLockGroups}
                  value={constraintGroups}
                  onValueChange={setConstraintGroups}
                  options={[2, 3, 4, 5, 6, 8]}
                />
              )}

              {/* Fields Constraint */}
              <ConstraintRow
                label="Anzahl Felder:"
                checked={lockFields}
                onCheckedChange={setLockFields}
                value={constraintFields}
                onValueChange={setConstraintFields}
                options={[1, 2, 3, 4]}
              />

              {/* Game Duration Constraint */}
              <ConstraintRow
                label="Spieldauer:"
                checked={lockGameDuration}
                onCheckedChange={setLockGameDuration}
                value={constraintGameDuration}
                onValueChange={setConstraintGameDuration}
                options={[5, 6, 7, 8, 10, 12, 15]}
                suffix=" Min"
              />

              {/* Break Duration Constraint */}
              <ConstraintRow
                label="Pausendauer:"
                checked={lockBreakDuration}
                onCheckedChange={setLockBreakDuration}
                value={constraintBreakDuration}
                onValueChange={setConstraintBreakDuration}
                options={[0, 1, 2, 3, 5]}
                suffix=" Min"
              />
            </div>
          </div>

          {recommendation && (
            <>
              <div className={styles.resultCard} role="region" aria-label="Empfohlene Konfiguration">
                <div className={styles.resultTitle}>
                  Empfohlene Konfiguration
                </div>

                <div className={styles.statsGrid}>
                  <StatItem label="Teams" value={recommendation.teams} />
                  <StatItem label="Felder" value={recommendation.fields} />
                  <StatItem label="Spieldauer" value={`${recommendation.gameDuration} Min`} />
                  <StatItem label="Pause" value={`${recommendation.breakDuration} Min`} />
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

          {showTeamsWarning && (
            <p className={styles.warningText} role="alert">
              <span aria-hidden="true">⚠️</span> {formData.numberOfTeams} Teams passen nicht in {availableHours}h.
              Alternative: {recommendation?.teams} Teams oder mehr Zeit/Felder einplanen.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Sub-components for cleaner code
interface ConstraintRowProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  value: number;
  onValueChange: (value: number) => void;
  options: number[];
  suffix?: string;
}

const ConstraintRow: React.FC<ConstraintRowProps> = ({
  label,
  checked,
  onCheckedChange,
  value,
  onValueChange,
  options,
  suffix = '',
}) => (
  <label className={styles.constraintRow}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={styles.constraintCheckbox}
    />
    <span className={styles.constraintLabel}>{label}</span>
    <select
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      disabled={!checked}
      className={styles.constraintSelect}
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n}{suffix}
        </option>
      ))}
    </select>
  </label>
);

interface StatItemProps {
  label: string;
  value: string | number;
}

const StatItem: React.FC<StatItemProps> = ({ label, value }) => (
  <div className={styles.statItem}>
    <div className={styles.statLabel}>{label}</div>
    <div className={styles.statValue}>{value}</div>
  </div>
);

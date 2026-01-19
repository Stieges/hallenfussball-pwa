import { Tournament } from '../../../types/tournament';
import { DEFAULT_VALUES } from '../../../constants/tournamentOptions';
import { cssVars } from '../../../design-tokens';
import styles from './ValidationWarnings.module.css';

interface ValidationWarningsProps {
  formData: Partial<Tournament>;
}

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

/**
 * Validates tournament configuration and returns issues
 */
function validateConfiguration(formData: Partial<Tournament>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const teams = formData.numberOfTeams ?? 4;
  const fields = formData.numberOfFields ?? 1;
  const groups = formData.numberOfGroups ?? 2;
  const groupSystem = formData.groupSystem ?? 'roundRobin';
  const gameDuration = formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration;
  const breakDuration = formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration;

  // Calculate match count
  let totalMatches: number;
  if (groupSystem === 'roundRobin') {
    totalMatches = (teams * (teams - 1)) / 2;
  } else {
    const teamsPerGroup = Math.ceil(teams / groups);
    totalMatches = ((teamsPerGroup * (teamsPerGroup - 1)) / 2) * groups;
  }

  // Calculate duration
  const slotDuration = gameDuration + breakDuration;
  const slotsNeeded = Math.ceil(totalMatches / fields);
  const totalMinutes = slotsNeeded * slotDuration;
  const hours = totalMinutes / 60;

  // 1. Too many teams for one field
  if (teams > 8 && fields === 1) {
    issues.push({
      type: 'warning',
      message: `${teams} Teams auf nur 1 Feld führt zu sehr langer Turnierdauer`,
      suggestion: `Empfohlen: mindestens ${Math.ceil(teams / 8)} Felder`,
    });
  }

  // 2. Unrealistic duration (> 10 hours)
  if (hours > 10) {
    issues.push({
      type: 'error',
      message: `Geschätzte Dauer von ${Math.round(hours)}h ist unrealistisch für einen Tag`,
      suggestion: 'Erhöhe die Feldanzahl oder reduziere die Teamanzahl',
    });
  }

  // 3. Very long duration (> 6 hours) - warning
  else if (hours > 6 && hours <= 10) {
    const recommendedFields = Math.ceil(fields * (hours / 6));
    issues.push({
      type: 'warning',
      message: `Lange Turnierdauer von ca. ${Math.round(hours)}h`,
      suggestion: `Mit ${recommendedFields} Feldern oder kürzerer Spieldauer (z.B. ${Math.max(5, gameDuration - 2)} Min) verkürzt sich die Dauer`,
    });
  }

  // 4. Groups don't divide evenly
  if (groupSystem === 'groupsAndFinals' && teams % groups !== 0) {
    const teamsPerGroup = Math.ceil(teams / groups);
    const lastGroupSize = teams - (teamsPerGroup * (groups - 1));
    // Find nearest team count that divides evenly
    const nearestEven = Math.round(teams / groups) * groups;
    issues.push({
      type: 'info',
      message: `Ungleiche Gruppengrößen: ${groups - 1}x ${teamsPerGroup} Teams, 1x ${lastGroupSize} Teams`,
      suggestion: nearestEven !== teams ? `Für gleichmäßige Gruppen: ${nearestEven} Teams wählen` : undefined,
    });
  }

  // 5. Too few teams for groups system
  if (groupSystem === 'groupsAndFinals' && teams < groups * 2) {
    issues.push({
      type: 'error',
      message: `Zu wenig Teams für ${groups} Gruppen (min. ${groups * 2} benötigt)`,
      suggestion: 'Reduziere die Gruppenanzahl oder erhöhe die Teamanzahl',
    });
  }

  // 6. DFB mode but team count doesn't match pattern
  if (formData.useDFBKeys && formData.dfbKeyPattern) {
    const patternTeams = parseInt(formData.dfbKeyPattern.match(/(\d+)M/)?.[1] ?? '0');
    if (patternTeams > 0 && patternTeams !== teams) {
      issues.push({
        type: 'info',
        message: `DFB-Muster passt zu ${patternTeams} Teams (aktuell: ${teams})`,
        suggestion: `Teamanzahl auf ${patternTeams} ändern oder anderes DFB-Muster wählen`,
      });
    }
  }

  // 7. Very short game duration
  if (gameDuration < 5) {
    issues.push({
      type: 'info',
      message: `Sehr kurze Spieldauer von ${gameDuration} Minuten`,
      suggestion: 'Empfohlen: mindestens 8-10 Minuten pro Spiel',
    });
  }

  // 8. No break between matches
  if (breakDuration === 0 && totalMatches > 10) {
    issues.push({
      type: 'warning',
      message: 'Keine Pause zwischen Spielen - Teams haben keine Erholungszeit',
      suggestion: 'Empfohlen: 2-3 Minuten Pause für Teamwechsel',
    });
  }

  // 9. Point system has all zeros
  const points = formData.pointSystem;
  if (points?.win === 0 && points.draw === 0 && points.loss === 0) {
    issues.push({
      type: 'warning',
      message: 'Punktesystem hat überall 0 Punkte - Tabelle wird nicht aussagekräftig',
      suggestion: 'Standard-Punktesystem: 3 Punkte Sieg, 1 Punkt Unentschieden, 0 Punkte Niederlage',
    });
  }

  return issues;
}

const ICONS = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

export const ValidationWarnings: React.FC<ValidationWarningsProps> = ({ formData }) => {
  const issues = validateConfiguration(formData);

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} role="region" aria-label="Konfigurationswarnungen">
      <span className={styles.srOnly}>
        {issues.length} {issues.length === 1 ? 'Hinweis' : 'Hinweise'} zur Konfiguration
      </span>
      {issues.map((issue, index) => (
        <div
          key={index}
          className={`${styles.warningItem} ${styles[issue.type]}`}
          role={issue.type === 'error' ? 'alert' : 'status'}
          aria-live={issue.type === 'error' ? 'assertive' : 'polite'}
        >
          <span className={styles.icon} aria-hidden="true">
            {ICONS[issue.type]}
          </span>
          <div className={styles.message}>
            <div>{issue.message}</div>
            {issue.suggestion && (
              <div style={{ marginTop: '4px', opacity: 0.8, fontSize: cssVars.fontSizes.sm }}>
                {issue.suggestion}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

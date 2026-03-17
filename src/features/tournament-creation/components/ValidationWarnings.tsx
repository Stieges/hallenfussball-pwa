import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
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
      message: i18n.t('wizard:validation.tooManyTeamsOneField', { teams, defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.tooManyTeamsOneFieldSuggestion', { fields: Math.ceil(teams / 8), defaultValue: '' }),
    });
  }

  // 2. Unrealistic duration (> 10 hours)
  if (hours > 10) {
    issues.push({
      type: 'error',
      message: i18n.t('wizard:validation.unrealisticDuration', { hours: Math.round(hours), defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.unrealisticDurationSuggestion', { defaultValue: '' }),
    });
  }

  // 3. Very long duration (> 6 hours) - warning
  else if (hours > 6 && hours <= 10) {
    const recommendedFields = Math.ceil(fields * (hours / 6));
    issues.push({
      type: 'warning',
      message: i18n.t('wizard:validation.longDuration', { hours: Math.round(hours), defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.longDurationSuggestion', { fields: recommendedFields, duration: Math.max(5, gameDuration - 2), defaultValue: '' }),
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
      message: i18n.t('wizard:validation.unevenGroups', { majorCount: groups - 1, teamsPerGroup, lastGroupSize, defaultValue: '' }),
      suggestion: nearestEven !== teams ? i18n.t('wizard:validation.unevenGroupsSuggestion', { count: nearestEven, defaultValue: '' }) : undefined,
    });
  }

  // 5. Too few teams for groups system
  if (groupSystem === 'groupsAndFinals' && teams < groups * 2) {
    issues.push({
      type: 'error',
      message: i18n.t('wizard:validation.tooFewTeams', { groups, min: groups * 2, defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.tooFewTeamsSuggestion', { defaultValue: '' }),
    });
  }

  // 6. DFB mode but team count doesn't match pattern
  if (formData.useDFBKeys && formData.dfbKeyPattern) {
    const patternTeams = parseInt(formData.dfbKeyPattern.match(/(\d+)M/)?.[1] ?? '0');
    if (patternTeams > 0 && patternTeams !== teams) {
      issues.push({
        type: 'info',
        message: i18n.t('wizard:validation.dfbMismatch', { patternTeams, currentTeams: teams, defaultValue: '' }),
        suggestion: i18n.t('wizard:validation.dfbMismatchSuggestion', { count: patternTeams, defaultValue: '' }),
      });
    }
  }

  // 7. Very short game duration
  if (gameDuration < 5) {
    issues.push({
      type: 'info',
      message: i18n.t('wizard:validation.shortGameDuration', { duration: gameDuration, defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.shortGameDurationSuggestion', { defaultValue: '' }),
    });
  }

  // 8. No break between matches
  if (breakDuration === 0 && totalMatches > 10) {
    issues.push({
      type: 'warning',
      message: i18n.t('wizard:validation.noBreak', { defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.noBreakSuggestion', { defaultValue: '' }),
    });
  }

  // 9. Point system has all zeros
  const points = formData.pointSystem;
  if (points?.win === 0 && points.draw === 0 && points.loss === 0) {
    issues.push({
      type: 'warning',
      message: i18n.t('wizard:validation.zeroPoints', { defaultValue: '' }),
      suggestion: i18n.t('wizard:validation.zeroPointsSuggestion', { defaultValue: '' }),
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
  const { t } = useTranslation('wizard');
  const issues = validateConfiguration(formData);

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} role="region" aria-label={t('validation.ariaLabel')}>
      <span className={styles.srOnly}>
        {t('validation.issueCount', { count: issues.length })}
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

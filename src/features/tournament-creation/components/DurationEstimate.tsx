import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import { Tournament, FinalsPreset } from '../../../types/tournament';
import { DEFAULT_VALUES } from '../../../constants/tournamentOptions';

// Duration thresholds in minutes
const DURATION_WARNING_THRESHOLD = 480; // 8 hours
const DURATION_CRITICAL_THRESHOLD = 600; // 10 hours

interface DurationEstimateProps {
  formData: Partial<Tournament>;
}

/**
 * Calculate estimated number of finals matches based on preset and groups
 */
const calculateFinalsMatches = (preset: FinalsPreset, numberOfGroups: number): number => {
  switch (preset) {
    case 'none':
      return 0;
    case 'final-only':
      return 1; // Just the final
    case 'top-4':
      return 4; // 2 semifinals + final + 3rd place
    case 'top-8':
      if (numberOfGroups >= 4) {
        return 8; // 4 quarterfinals + 2 semifinals + final + 3rd place
      }
      return 4; // Falls back to top-4
    case 'top-16':
      if (numberOfGroups >= 8) {
        return 15; // 8 round-of-16 + 4 QF + 2 SF + final
      }
      return 8;
    case 'all-places':
      // Approximate: depends on group count
      if (numberOfGroups >= 4) {
        return 12; // All placement matches for 4+ groups
      }
      return 6; // All placement matches for 2 groups
    default:
      return 0;
  }
};

export const DurationEstimate: React.FC<DurationEstimateProps> = ({ formData }) => {
  const { t } = useTranslation('wizard');

  const teams = formData.numberOfTeams ?? 4;
  const fields = formData.numberOfFields ?? 1;
  const numberOfGroups = formData.numberOfGroups ?? 2;
  const groupSystem = formData.groupSystem ?? 'roundRobin';

  // Group phase timing
  const groupGameDuration = formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration;
  const groupBreakDuration = formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration;
  const groupSlotDuration = groupGameDuration + groupBreakDuration;

  // Finals timing
  const finalsGameDuration = formData.finalRoundGameDuration ?? DEFAULT_VALUES.finalRoundGameDuration;
  const finalsBreakDuration = formData.finalRoundBreakDuration ?? DEFAULT_VALUES.finalRoundBreakDuration;
  const finalsSlotDuration = finalsGameDuration + finalsBreakDuration;
  const breakBetweenPhases = formData.breakBetweenPhases ?? DEFAULT_VALUES.breakBetweenPhases;

  // Calculate group phase matches (Round Robin: n*(n-1)/2)
  let groupPhaseMatches: number;
  if (groupSystem === 'roundRobin') {
    groupPhaseMatches = (teams * (teams - 1)) / 2;
  } else {
    // Groups and Finals: each group plays round robin
    const teamsPerGroup = Math.ceil(teams / numberOfGroups);
    const matchesPerGroup = (teamsPerGroup * (teamsPerGroup - 1)) / 2;
    groupPhaseMatches = matchesPerGroup * numberOfGroups;
  }

  // Calculate finals matches
  const finalsPreset = formData.finalsConfig?.preset ?? 'none';
  const finalsMatches = groupSystem === 'groupsAndFinals'
    ? calculateFinalsMatches(finalsPreset, numberOfGroups)
    : 0;

  // Calculate durations
  const groupPhaseSlotsNeeded = Math.ceil(groupPhaseMatches / fields);
  const groupPhaseMinutes = groupPhaseSlotsNeeded * groupSlotDuration;

  const finalsSlotsNeeded = Math.ceil(finalsMatches / Math.min(fields, 2)); // Finals usually max 2 parallel
  const finalsMinutes = finalsSlotsNeeded * finalsSlotDuration;

  const totalMinutes = groupPhaseMinutes +
    (finalsMatches > 0 ? breakBetweenPhases : 0) +
    finalsMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const isWarning = totalMinutes > DURATION_WARNING_THRESHOLD;
  const isCritical = totalMinutes > DURATION_CRITICAL_THRESHOLD;

  const containerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '12px 16px',
    background: isCritical
      ? cssVars.colors.errorSubtle
      : isWarning
        ? cssVars.colors.warningMedium
        : cssVars.colors.secondaryBadge,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${
      isCritical
        ? cssVars.colors.errorBorder
        : isWarning
          ? cssVars.colors.warningBorder
          : cssVars.colors.secondaryBorder
    }`,
  };

  const titleColor = isCritical
    ? cssVars.colors.error
    : isWarning
      ? cssVars.colors.warning
      : cssVars.colors.textPrimary;

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: cssVars.fontSizes.md }}>
          {isCritical ? '⚠️' : isWarning ? '⏰' : '📊'}
        </span>
        <div>
          <span style={{
            color: titleColor,
            fontSize: cssVars.fontSizes.md,
            fontWeight: cssVars.fontWeights.semibold,
          }}>
            {t('durationEstimate.estimatedDuration')}{hours > 0 ? t('durationEstimate.hoursAndMinutes', { hours, minutes }) : t('durationEstimate.minutesOnly', { minutes })}
          </span>
          <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, marginLeft: '8px' }}>
            {t('durationEstimate.matchInfo', { matches: groupPhaseMatches + finalsMatches, fields, fieldLabel: fields === 1 ? t('durationEstimate.fieldSingular') : t('durationEstimate.fieldPlural') })}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      {finalsMatches > 0 && (
        <div style={{
          display: 'flex',
          gap: '16px',
          marginTop: '8px',
          fontSize: cssVars.fontSizes.sm,
          color: cssVars.colors.textSecondary
        }}>
          <span>{t('durationEstimate.groupPhaseBreakdown', { matches: groupPhaseMatches, hours: Math.floor(groupPhaseMinutes / 60), minutes: groupPhaseMinutes % 60 })}</span>
          <span>{t('durationEstimate.finalsBreakdown', { matches: finalsMatches, hours: Math.floor(finalsMinutes / 60), minutes: finalsMinutes % 60 })}</span>
        </div>
      )}

      {isCritical && (
        <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.error, margin: '8px 0 0 0', lineHeight: '1.4' }}>
          {t('durationEstimate.criticalWarning', { fields: Math.ceil(fields * (totalMinutes / 360)), duration: Math.max(5, groupGameDuration - 3) })}
        </p>
      )}
      {isWarning && !isCritical && (
        <p style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.warning, margin: '8px 0 0 0', lineHeight: '1.4' }}>
          {t('durationEstimate.durationWarning', { fields: fields + 1, hours: Math.round((totalMinutes / (fields + 1)) / 60 * 10) / 10, duration: Math.max(5, groupGameDuration - 2) })}
        </p>
      )}
    </div>
  );
};

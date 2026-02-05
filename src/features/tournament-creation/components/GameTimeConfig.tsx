import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberStepper, Select } from '../../../components/ui';
import { cssVars } from '../../../design-tokens'
import { Tournament } from '../../../types/tournament';
import { getGamePeriodsOptions, DEFAULT_VALUES } from '../../../constants/tournamentOptions';
import styles from './GameTimeConfig.module.css';

interface GameTimeConfigProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  phase: 'group' | 'finals';
}

export const GameTimeConfig: React.FC<GameTimeConfigProps> = ({
  formData,
  onUpdate,
  phase,
}) => {
  const { t } = useTranslation('wizard');
  const isGroupPhase = phase === 'group';

  const containerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: isGroupPhase ? cssVars.colors.primarySubtle : cssVars.colors.accentBadge,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${isGroupPhase ? cssVars.colors.primaryLight : cssVars.colors.accentBorder}`,
  };

  const headerStyle: CSSProperties = {
    color: isGroupPhase ? cssVars.colors.primary : cssVars.colors.accent,
    fontSize: cssVars.fontSizes.sm,
    margin: '0 0 12px 0',
    fontWeight: cssVars.fontWeights.semibold,
  };

  if (isGroupPhase) {
    return (
      <div style={containerStyle}>
        <h4 style={headerStyle}>
          {t('gameTimeConfig.groupPhaseTitle')}
        </h4>
        <div className={styles.timeGrid}>
          <NumberStepper
            label={t('gameTimeConfig.gameDuration')}
            value={formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration}
            onChange={(v) => onUpdate('groupPhaseGameDuration', v)}
            min={3}
            max={30}
            suffix={t('gameTimeConfig.minuteSuffix')}
            mode="stepper"
          />
          <NumberStepper
            label={t('gameTimeConfig.breakBetweenGames')}
            value={formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration}
            onChange={(v) => onUpdate('groupPhaseBreakDuration', v)}
            min={0}
            max={15}
            suffix={t('gameTimeConfig.minuteSuffix')}
            mode="stepper"
          />
          <Select
            label={t('gameTimeConfig.gamePeriods')}
            value={formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods}
            onChange={(v) => onUpdate('gamePeriods', parseInt(v))}
            options={getGamePeriodsOptions()}
          />
        </div>
        {(formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods) > 1 && (
          <div className={styles.halftimeSection}>
            <NumberStepper
              label={t('gameTimeConfig.halftimeBreak')}
              value={formData.halftimeBreak ?? DEFAULT_VALUES.halftimeBreak}
              onChange={(v) => onUpdate('halftimeBreak', v)}
              min={0}
              max={10}
              suffix={t('gameTimeConfig.minuteSuffix')}
              mode="stepper"
            />
            <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '8px', lineHeight: '1.4' }}>
              {t('gameTimeConfig.periodBreakdown', { periods: formData.gamePeriods, duration: Math.floor((formData.groupPhaseGameDuration ?? 10) / (formData.gamePeriods ?? 1)) })}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Finals phase
  return (
    <div style={containerStyle}>
      <h4 style={headerStyle}>
        {t('gameTimeConfig.finalsTitle')}
      </h4>
      <div className={styles.timeGrid}>
        <NumberStepper
          label={t('gameTimeConfig.gameDuration')}
          value={formData.finalRoundGameDuration ?? DEFAULT_VALUES.finalRoundGameDuration}
          onChange={(v) => onUpdate('finalRoundGameDuration', v)}
          min={3}
          max={30}
          suffix={t('gameTimeConfig.minuteSuffix')}
          mode="stepper"
        />
        <NumberStepper
          label={t('gameTimeConfig.breakBetweenGames')}
          value={formData.finalRoundBreakDuration ?? DEFAULT_VALUES.finalRoundBreakDuration}
          onChange={(v) => onUpdate('finalRoundBreakDuration', v)}
          min={0}
          max={15}
          suffix={t('gameTimeConfig.minuteSuffix')}
          mode="stepper"
        />
        <NumberStepper
          label={t('gameTimeConfig.phaseBreak')}
          value={formData.breakBetweenPhases ?? DEFAULT_VALUES.breakBetweenPhases}
          onChange={(v) => onUpdate('breakBetweenPhases', v)}
          min={0}
          max={60}
          suffix={t('gameTimeConfig.minuteSuffix')}
          mode="stepper"
        />
      </div>
      <p style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '8px', lineHeight: '1.4' }}>
        {t('gameTimeConfig.finalsHint')}
      </p>
    </div>
  );
};

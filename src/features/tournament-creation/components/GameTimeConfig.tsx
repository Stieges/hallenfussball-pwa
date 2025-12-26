import { CSSProperties } from 'react';
import { NumberStepper, Select } from '../../../components/ui';
import { borderRadius, colors, fontWeights } from '../../../design-tokens';
import { Tournament } from '../../../types/tournament';
import { GAME_PERIODS_OPTIONS, DEFAULT_VALUES } from '../../../constants/tournamentOptions';
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
  const isGroupPhase = phase === 'group';

  const containerStyle: CSSProperties = {
    marginTop: '16px',
    padding: '16px',
    background: isGroupPhase ? 'rgba(0,230,118,0.05)' : 'rgba(255,215,0,0.08)',
    borderRadius: borderRadius.md,
    border: `1px solid ${isGroupPhase ? 'rgba(0,230,118,0.15)' : 'rgba(255,215,0,0.3)'}`,
  };

  const headerStyle: CSSProperties = {
    color: isGroupPhase ? colors.primary : colors.accent,
    fontSize: '13px',
    margin: '0 0 12px 0',
    fontWeight: fontWeights.semibold,
  };

  if (isGroupPhase) {
    return (
      <div style={containerStyle}>
        <h4 style={headerStyle}>
          Gruppenphase - Spielzeit-Einstellungen
        </h4>
        <div className={styles.timeGrid}>
          <NumberStepper
            label="Spieldauer"
            value={formData.groupPhaseGameDuration ?? DEFAULT_VALUES.groupPhaseGameDuration}
            onChange={(v) => onUpdate('groupPhaseGameDuration', v)}
            min={3}
            max={30}
            suffix="Min"
            mode="stepper"
          />
          <NumberStepper
            label="Pause zwischen Spielen"
            value={formData.groupPhaseBreakDuration ?? DEFAULT_VALUES.groupPhaseBreakDuration}
            onChange={(v) => onUpdate('groupPhaseBreakDuration', v)}
            min={0}
            max={15}
            suffix="Min"
            mode="stepper"
          />
          <Select
            label="Spielabschnitte"
            value={formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods}
            onChange={(v) => onUpdate('gamePeriods', parseInt(v))}
            options={GAME_PERIODS_OPTIONS}
          />
        </div>
        {(formData.gamePeriods ?? DEFAULT_VALUES.gamePeriods) > 1 && (
          <div className={styles.halftimeSection}>
            <NumberStepper
              label="Halbzeitpause"
              value={formData.halftimeBreak ?? DEFAULT_VALUES.halftimeBreak}
              onChange={(v) => onUpdate('halftimeBreak', v)}
              min={0}
              max={10}
              suffix="Min"
              mode="stepper"
            />
            <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '8px', lineHeight: '1.4' }}>
              Das Spiel wird in {formData.gamePeriods} Abschnitte à {Math.floor((formData.groupPhaseGameDuration ?? 10) / (formData.gamePeriods || 1))} Min. unterteilt
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
        Finalrunde - Spielzeit-Einstellungen
      </h4>
      <div className={styles.timeGrid}>
        <NumberStepper
          label="Spieldauer"
          value={formData.finalRoundGameDuration ?? DEFAULT_VALUES.finalRoundGameDuration}
          onChange={(v) => onUpdate('finalRoundGameDuration', v)}
          min={3}
          max={30}
          suffix="Min"
          mode="stepper"
        />
        <NumberStepper
          label="Pause zwischen Spielen"
          value={formData.finalRoundBreakDuration ?? DEFAULT_VALUES.finalRoundBreakDuration}
          onChange={(v) => onUpdate('finalRoundBreakDuration', v)}
          min={0}
          max={15}
          suffix="Min"
          mode="stepper"
        />
        <NumberStepper
          label="Pause bis Finalrunde"
          value={formData.breakBetweenPhases ?? DEFAULT_VALUES.breakBetweenPhases}
          onChange={(v) => onUpdate('breakBetweenPhases', v)}
          min={0}
          max={60}
          suffix="Min"
          mode="stepper"
        />
      </div>
      <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '8px', lineHeight: '1.4' }}>
        Die Spielabschnitt-Einstellungen gelten auch für die Finalrunde
      </p>
    </div>
  );
};

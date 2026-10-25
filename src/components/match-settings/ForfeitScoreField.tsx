/**
 * Einstellung „Wertung bei Nichtantritt“ (R2 PR 3; @W2A-025, @W2A-078, Befund C-WERTUNG-EINSTELLUNG-OHNE-SPERRE).
 *
 * - Eingestellt werden die Tore des angetretenen Teams (das fehlende bekommt 0), vorbelegt 2:0 (@W2A-022). Gültig 1 bis 20; ein
 *   ungültiger Wert wird beim Verlassen des Feldes abgelehnt, am Feld steht der gültige Bereich (wie die Schützenzahl, @W2A-034).
 * - Gesperrt, sobald ein Spiel als Nichtantritt gewertet ist (`locked`, aus `forfeitScoreLocked`), mit Grund am Feld (@W2A-078);
 *   nach der Rücknahme der Wertung wieder frei. Ohne Recht auf Spielregeln (`disabled`) ebenfalls nur lesend.
 * - Die Regel selbst entscheidet der Aufrufer über `changeForfeitScore`; das Feld meldet nur den gewünschten Wert.
 */
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Input } from '../ui/Input';
import { InlineNotice } from '../ui/molecules/InlineNotice';
import type { ForfeitScore } from '../../types/tournament';

export const FORFEIT_GOALS_MAX = 20;

export interface ForfeitScoreFieldProps {
  value: ForfeitScore;
  /** Ein Spiel ist schon als Nichtantritt gewertet (@W2A-078). */
  locked: boolean;
  /** Ohne Recht auf Spielregeln nur lesend. */
  disabled?: boolean;
  onChange: (score: ForfeitScore) => void;
}

const row: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.md,
  padding: `${cssVars.spacing.sm} 0`,
};
const content: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs, flex: '1 1 50%', minWidth: 0 };
const label: CSSProperties = { fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.medium, color: cssVars.colors.textPrimary };
const description: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const control: CSSProperties = { flexShrink: 0, maxWidth: '100%' };

export const ForfeitScoreField = ({ value, locked, disabled = false, onChange }: ForfeitScoreFieldProps) => {
  const { t } = useTranslation('cockpit');
  const hintId = useId();
  const [draft, setDraft] = useState(String(value.winner));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => { setDraft(String(value.winner)); }, [value.winner]);

  const commit = (): void => {
    const goals = Number(draft);
    if (!Number.isInteger(goals) || goals < 1 || goals > FORFEIT_GOALS_MAX) {
      setInvalid(true);
      setDraft(String(value.winner));
      return;
    }
    setInvalid(false);
    if (goals !== value.winner || value.loser !== 0) {
      onChange({ winner: goals, loser: 0 });
    }
  };

  return (
    <div data-testid="settings-forfeit-score-field">
      <div style={row}>
        <div style={content}>
          <span style={label}>{t('settings.forfeitScore')}</span>
          <span style={description}>{t('settings.forfeitScoreDesc', { winner: value.winner, loser: value.loser })}</span>
        </div>
        <div style={control}>
          <Input
            type="number"
            value={draft}
            min={1}
            max={FORFEIT_GOALS_MAX}
            onChange={(v) => { setDraft(v); setInvalid(false); }}
            onBlur={commit}
            disabled={locked || disabled}
            aria-label={t('settings.forfeitScore')}
            {...(locked ? { describedBy: hintId } : {})}
            errorMessage={invalid ? t('settings.forfeitScoreRangeError', { max: FORFEIT_GOALS_MAX }) : undefined}
            data-testid="settings-forfeit-score"
          />
        </div>
      </div>
      {locked ? (
        <div id={hintId}>
          <InlineNotice tone="info" data-testid="settings-forfeit-score-locked">{t('settings.forfeitScoreLocked')}</InlineNotice>
        </div>
      ) : null}
    </div>
  );
};

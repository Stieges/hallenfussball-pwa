/**
 * ScoreChangedHint – Hinweis unter der Schnelleingabe, wenn ein anderes Gerät genau dieses Spiel geändert hat, während
 * ein Eintrag angefangen war (@FU-104): „Ergebnis wurde inzwischen von Tom geändert (jetzt 3:1)“, ohne bekannten Namen
 * „von einem anderen Gerät“. Solange das Spiel eintragbar ist, bleibt Olli mit „Meine Eingabe behalten“ bewusst bei seinem
 * Eintrag (danach senden Enter und Verlassen wieder); Escape im Feld zeigt den neuen Stand.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { ScoreChangedElsewhere } from './useScoreDraft';

interface ScoreChangedHintProps {
  changed: ScoreChangedElsewhere;
  testId: string;
  keepTestId: string;
  /** Nur solange das Spiel eintragbar ist */
  onKeepDraft?: () => void;
}

const asText = (score: number | undefined): string => (score === undefined ? '–' : String(score));

export const ScoreChangedHint: React.FC<ScoreChangedHintProps> = ({ changed, testId, keepTestId, onKeepDraft }) => {
  const { t } = useTranslation('tournament');
  const score = `${asText(changed.goalsA)}:${asText(changed.goalsB)}`;
  const text = changed.by === null
    ? t('scoreCell.changedElsewhereNoName', { score })
    : t('scoreCell.changedElsewhere', { name: changed.by, score });
  return (
    <div
      role="status"
      data-testid={testId}
      style={{
        flexBasis: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: cssVars.spacing.xs,
        marginTop: cssVars.spacing.xs,
        padding: cssVars.spacing.xs,
        border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warning}`,
        borderRadius: cssVars.borderRadius.sm,
        backgroundColor: cssVars.colors.statusWarningBg,
        color: cssVars.colors.textPrimary,
        fontSize: cssVars.fontSizes.sm,
        fontWeight: cssVars.fontWeights.normal,
        textAlign: 'center',
      }}
    >
      <span>{text}</span>
      {onKeepDraft && (
        <button
          type="button"
          data-testid={keepTestId}
          onClick={onKeepDraft}
          style={{
            minHeight: cssVars.touchTargets.minimum,
            padding: `0 ${cssVars.spacing.sm}`,
            border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
            borderRadius: cssVars.borderRadius.sm,
            backgroundColor: cssVars.colors.background,
            color: cssVars.colors.textPrimary,
            fontSize: cssVars.fontSizes.md,
            cursor: 'pointer',
          }}
        >
          {t('scoreCell.keepDraft')}
        </button>
      )}
    </div>
  );
};

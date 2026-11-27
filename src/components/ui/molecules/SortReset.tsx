/**
 * Taste „Nach Platzierung“ (@TS-005): nimmt die Sortierung einer Tabelle zurück; nur sichtbar, solange sortiert ist.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';

export interface SortResetProps {
  visible: boolean;
  onReset: () => void;
  testId?: string;
}

export function SortReset({ visible, onReset, testId = 'sort-reset' }: SortResetProps) {
  const { t } = useTranslation('tournament');
  if (!visible) {return null;}
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onReset}
      style={{
        minHeight: cssVars.touchTargets.minimum,
        padding: `0 ${cssVars.spacing.md}`,
        background: cssVars.colors.surface,
        color: cssVars.colors.textPrimary,
        border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
        borderRadius: cssVars.borderRadius.md,
        fontSize: cssVars.fontSizes.lg,
        fontWeight: cssVars.fontWeights.semibold,
        cursor: 'pointer',
      }}
    >
      {t('tableSort.reset')}
    </button>
  );
}

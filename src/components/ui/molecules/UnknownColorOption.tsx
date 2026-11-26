/**
 * Erstes Feld der Farbauswahl „Unbekannt“ (@W3-042): stellt ein Team wieder auf „keine Trikotfarbe“. Der Farbpunkt zeigt das Fallback-Muster
 * (@ZM-203), vorgelesen wird „Trikotfarbe unbekannt“. Nur dort, wo eine Farbe fehlen darf (Teams), nie bei den Standardfarben (@W3-043).
 */
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { ColorDot } from '../atoms/ColorDot';

export interface UnknownColorOptionProps {
  selected: boolean;
  onSelect: () => void;
}

export function UnknownColorOption({ selected, onSelect }: UnknownColorOptionProps): ReactElement {
  const { t } = useTranslation('tournament');
  const style: CSSProperties = {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    minHeight: cssVars.touchTargets.minimum,
    padding: cssVars.spacing.sm,
    background: cssVars.colors.inputBg,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    border: selected ? `2px solid ${cssVars.colors.primary}` : `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.sm,
    cursor: 'pointer',
  };
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={t('matchCard.shirtUnknown')}
      onClick={onSelect}
      style={style}
      data-testid="color-unknown-option"
    >
      <span aria-hidden="true" style={{ display: 'inline-flex' }}><ColorDot label="" size="md" /></span>
      <span>{t('teams.colorUnknown')}</span>
    </button>
  );
}

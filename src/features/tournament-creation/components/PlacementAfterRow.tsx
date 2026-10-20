/**
 * Feste letzte Zeile unter der Reihenfolge bei Punktgleichheit (Paket TB-B, TB-6d; @W2A-056, Daniel F8): „danach:
 * Strafstoßschießen (Entscheidung der Turnierleitung)“. Steht außerhalb der sortierbaren Liste, ohne Schalter und ohne
 * Griff – sie lässt sich weder verschieben noch abschalten, auch nicht nach einer Umstellung der Reihenfolge.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';

const LockSymbol = () => (
  <svg width={iconSizeValues.sm} height={iconSizeValues.sm} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const PlacementAfterRow = () => {
  const { t } = useTranslation('wizard');
  const row: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${cssVars.iconSizes.sm} minmax(0, 1fr)`,
    gap: cssVars.spacing.sm,
    alignItems: 'start',
    marginTop: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    border: `${cssVars.borderWidth.thin} dashed ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
  };
  return (
    <div style={row} data-testid="placement-after-row">
      <span style={{ display: 'flex', color: cssVars.colors.textSecondary, marginTop: cssVars.spacing.xs }}><LockSymbol /></span>
      <span>
        <b style={{ display: 'block', fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>{t('placementLogic.afterRow')}</b>
        <small style={{ display: 'block', color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm }}>{t('placementLogic.afterRowHint')}</small>
      </span>
    </div>
  );
};

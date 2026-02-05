/**
 * EmptyFilterState - Shown when no matches match the current filters
 *
 * Provides clear feedback and action to reset filters.
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';

interface EmptyFilterStateProps {
  /** Called when user clicks reset button */
  onReset: () => void;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const EmptyFilterState: React.FC<EmptyFilterStateProps> = ({
  onReset,
  'data-testid': testId,
}) => {
  const { t } = useTranslation('tournament');
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.xl,
    textAlign: 'center',
    minHeight: '200px',
  };

  const iconContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.full,
    marginBottom: cssVars.spacing.lg,
    color: cssVars.colors.textDisabled,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  };

  const descriptionStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
    maxWidth: '300px',
  };

  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    background: cssVars.colors.primary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: 'white',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'background 0.2s ease',
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      <div style={iconContainerStyle}>
        <Icons.Search size={32} />
      </div>
      <h3 style={titleStyle}>{t('filter.noResults')}</h3>
      <p style={descriptionStyle}>
        {t('filter.noResultsDescription')}
      </p>
      <button
        style={buttonStyle}
        onClick={onReset}
        type="button"
        data-testid={testId ? `${testId}-reset` : 'empty-filter-reset'}
      >
        <Icons.X size={18} />
        {t('filter.resetAll')}
      </button>
    </div>
  );
};

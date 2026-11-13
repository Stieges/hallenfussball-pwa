/**
 * Warnungen-Widget der Admin-Seitenleiste (aus AdminSidebar.tsx herausgelöst, H4-8, Verhalten gleich).
 * Die Liste ist heute leer (G9: die Statuszeile trägt den Hallenton); das Widget bleibt für künftige Warnungen.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { AdminWarning } from '../types/admin.types';

const warnStyles = {
  warningsWidget: {
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.md,
    margin: cssVars.spacing.md,
    marginTop: 'auto',
    position: 'sticky',
    bottom: cssVars.spacing.md,
  } as CSSProperties,

  warningsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.bodySm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  warningItem: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    padding: `${cssVars.spacing.xs} 0`,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  } as CSSProperties,

  warningsLink: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.primary,
    cursor: 'pointer',
    marginTop: cssVars.spacing.xs,
    display: 'block',
  } as CSSProperties,
} as const;

interface AdminSidebarWarningsProps {
  warnings: AdminWarning[];
  onWarningClick?: (warning: AdminWarning) => void;
}

export function AdminSidebarWarnings({ warnings, onWarningClick }: AdminSidebarWarningsProps) {
  const { t } = useTranslation('admin');
  if (warnings.length === 0) {
    return null;
  }
  return (
        <div style={warnStyles.warningsWidget}>
          <div style={warnStyles.warningsHeader}>
            <span>⚠️</span>
            <span>{t('sidebar.warnings', { count: warnings.length })}</span>
          </div>
          {warnings.slice(0, 2).map((warning) => (
            <button
              key={warning.id}
              style={{
                ...warnStyles.warningItem,
                background: 'transparent',
                border: 'none',
                cursor: onWarningClick ? 'pointer' : 'default',
                width: '100%',
                textAlign: 'left',
              }}
              onClick={() => onWarningClick?.(warning)}
              aria-label={t('sidebar.warningClickAria', { title: warning.title })}
            >
              <span>►</span>
              <span>{warning.title}</span>
            </button>
          ))}
          {warnings.length > 2 && (
            <span style={warnStyles.warningsLink}>{t('sidebar.showAll')}</span>
          )}
        </div>
  );
}

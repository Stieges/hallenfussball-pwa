/**
 * Warnungen-Karte des mobilen Admin-Hubs (aus AdminMobileHub.tsx herausgelöst, H4-8, Verhalten gleich).
 * Die Liste ist heute leer (G9: die Statuszeile trägt den Hallenton); die Karte bleibt für künftige Warnungen.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { AdminWarning } from '../types/admin.types';
import { styles as hubStyles } from './adminMobileHubStyles';

const styles = {
  warningsCard: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  warningsIcon: {
    fontSize: 24,
    color: cssVars.colors.warning,
  } as CSSProperties,

  warningsContent: {
    flex: 1,
  } as CSSProperties,

  warningsTitle: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.warning,
  } as CSSProperties,

  warningsSubtitle: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

} as const;

export function AdminHubWarningsCard({ warnings }: { warnings: AdminWarning[] }) {
  const { t } = useTranslation('admin');
  return (
          <button
            style={styles.warningsCard}
            onClick={() => {
              // Could navigate to a warnings overview
            }}
          >
            <span style={styles.warningsIcon}>⚠️</span>
            <div style={styles.warningsContent}>
              <div style={styles.warningsTitle}>
                {t('mobileHub.warnings', { count: warnings.length })}
              </div>
              <div style={styles.warningsSubtitle}>
                {warnings[0]?.title}
                {warnings.length > 1 && ` ${t('mobileHub.andMore', { count: warnings.length - 1 })}`}
              </div>
            </div>
            <span style={hubStyles.categoryArrow}>→</span>
          </button>
  );
}

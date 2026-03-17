/**
 * NotificationsCategory - Push & Sound Settings
 *
 * Configure push notifications and sound alerts.
 * Currently marked as "Coming Soon" as it requires:
 * - Push notification infrastructure
 * - Trainer Cockpit
 * - Backend notification service
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.8
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';

// =============================================================================
// PROPS
// =============================================================================

interface NotificationsCategoryProps {
  tournamentId: string;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  comingSoon: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  comingSoonIcon: {
    fontSize: 48,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  comingSoonTitle: {
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  badge: {
    display: 'inline-block',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.medium,
    marginTop: cssVars.spacing.sm,
  } as CSSProperties,

  featureList: {
    textAlign: 'left',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceHover,
    borderRadius: cssVars.borderRadius.md,
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  note: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textMuted,
    fontStyle: 'italic',
    marginTop: cssVars.spacing.md,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function NotificationsCategory(_props: NotificationsCategoryProps) {
  const { t } = useTranslation('admin');
  return (
    <CategoryPage
      icon="🔔"
      title={t('notifications.title')}
      description={t('notifications.description')}
    >
      {/* Main Coming Soon notice */}
      <CollapsibleSection icon="📲" title={t('notifications.system')} defaultOpen>
        <div style={styles.comingSoon}>
          <div style={styles.comingSoonIcon}>🔔</div>
          <div style={styles.comingSoonTitle}>{t('notifications.comingSoonTitle')}</div>
          <p>
            {t('notifications.comingSoonDesc')}
          </p>

          <div style={styles.featureList}>
            <div style={styles.featureItem}>
              <span>📲</span>
              <span>{t('notifications.featurePushTrainer')}</span>
            </div>
            <div style={styles.featureItem}>
              <span>🔔</span>
              <span>{t('notifications.featureRealtimeAlerts')}</span>
            </div>
            <div style={styles.featureItem}>
              <span>🔊</span>
              <span>{t('notifications.featureSoundSignals')}</span>
            </div>
            <div style={styles.featureItem}>
              <span>📱</span>
              <span>{t('notifications.featureBrowserPush')}</span>
            </div>
          </div>

          <span style={styles.badge}>{t('notifications.inDevelopment')}</span>
          <p style={styles.note}>
            {t('notifications.soundSettingsNote')}
          </p>
        </div>
      </CollapsibleSection>

      {/* Trainer Notifications - Placeholder */}
      <CollapsibleSection icon="👥" title={t('notifications.trainerNotifications')}>
        <div style={styles.comingSoon}>
          <p>
            {t('notifications.trainerNotificationsDesc')}
          </p>
          <span style={styles.badge}>{t('notifications.requiresTrainerCockpit')}</span>
        </div>
      </CollapsibleSection>

      {/* Tournament Director Notifications - Placeholder */}
      <CollapsibleSection icon="🏆" title={t('notifications.tlNotifications')}>
        <div style={styles.comingSoon}>
          <p>
            {t('notifications.tlNotificationsDesc')}
          </p>
          <span style={styles.badge}>{t('notifications.requiresPushSystem')}</span>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default NotificationsCategory;

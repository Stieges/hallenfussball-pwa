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
  return (
    <CategoryPage
      icon="🔔"
      title="Benachrichtigungen"
      description="Push- und Sound-Einstellungen"
    >
      {/* Main Coming Soon notice */}
      <CollapsibleSection icon="📲" title="Benachrichtigungs-System" defaultOpen>
        <div style={styles.comingSoon}>
          <div style={styles.comingSoonIcon}>🔔</div>
          <div style={styles.comingSoonTitle}>Benachrichtigungen kommen bald</div>
          <p>
            Ein umfassendes Benachrichtigungssystem für Turnierleitungen und Trainer ist in
            Entwicklung.
          </p>

          <div style={styles.featureList}>
            <div style={styles.featureItem}>
              <span>📲</span>
              <span>Push-Benachrichtigungen an Trainer vor Spielbeginn</span>
            </div>
            <div style={styles.featureItem}>
              <span>🔔</span>
              <span>Echtzeit-Alerts bei Spielende, Karten und Korrekturen</span>
            </div>
            <div style={styles.featureItem}>
              <span>🔊</span>
              <span>Anpassbare Sound-Signale für verschiedene Ereignisse</span>
            </div>
            <div style={styles.featureItem}>
              <span>📱</span>
              <span>Browser-Push und In-App-Benachrichtigungen</span>
            </div>
          </div>

          <span style={styles.badge}>In Entwicklung</span>
          <p style={styles.note}>
            Sound-Einstellungen für das Match Cockpit Pro findest du unter Einstellungen → Match
            Cockpit Pro.
          </p>
        </div>
      </CollapsibleSection>

      {/* Trainer Notifications - Placeholder */}
      <CollapsibleSection icon="👥" title="Trainer-Benachrichtigungen">
        <div style={styles.comingSoon}>
          <p>
            Trainer können benachrichtigt werden, wenn ihr Team als nächstes spielt. Benötigt das
            Trainer-Cockpit.
          </p>
          <span style={styles.badge}>Benötigt Trainer-Cockpit</span>
        </div>
      </CollapsibleSection>

      {/* Tournament Director Notifications - Placeholder */}
      <CollapsibleSection icon="🏆" title="TL-Benachrichtigungen">
        <div style={styles.comingSoon}>
          <p>
            Turnierleitungs-spezifische Alerts bei Spielende, Roten Karten und
            Ergebnis-Korrekturen.
          </p>
          <span style={styles.badge}>Benötigt Push-System</span>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default NotificationsCategory;

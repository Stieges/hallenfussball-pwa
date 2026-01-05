/**
 * NotificationsCategory - Push & Sound Settings
 *
 * Configure push notifications and sound alerts.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.8
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface NotificationsCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
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
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  label: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  selectRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  select: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
  } as CSSProperties,

  button: {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function NotificationsCategory({
  tournament: _tournament,
}: NotificationsCategoryProps) {
  return (
    <CategoryPage
      icon="🔔"
      title="Benachrichtigungen"
      description="Push- und Sound-Einstellungen"
    >
      {/* Trainer Notifications */}
      <CollapsibleSection icon="📲" title="Push an Trainer" defaultOpen>
        <div style={styles.formGroup}>
          <label style={styles.label}>Vorlaufzeit für Spielbenachrichtigung</label>
          <div style={styles.selectRow}>
            <select style={styles.select} defaultValue="5">
              <option value="0">Aus</option>
              <option value="2">2 Minuten vorher</option>
              <option value="5">5 Minuten vorher</option>
              <option value="10">10 Minuten vorher</option>
              <option value="15">15 Minuten vorher</option>
            </select>
          </div>
        </div>

        <div style={styles.comingSoon}>
          <span style={styles.badge}>Benötigt Trainer-Cockpit</span>
        </div>
      </CollapsibleSection>

      {/* Tournament Director Notifications */}
      <CollapsibleSection icon="🔔" title="TL-Benachrichtigungen">
        <div style={styles.checkboxGroup}>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Bei Spielende benachrichtigen</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Bei Roter Karte benachrichtigen</span>
          </label>
          <label style={styles.checkbox}>
            <input type="checkbox" />
            <span>Bei Ergebnis-Korrektur benachrichtigen</span>
          </label>
        </div>
      </CollapsibleSection>

      {/* Sound Settings */}
      <CollapsibleSection icon="🔊" title="Sound-Einstellungen">
        <div style={styles.formGroup}>
          <label style={styles.checkbox}>
            <input type="checkbox" defaultChecked />
            <span>Sounds aktiviert</span>
          </label>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Signalton</label>
          <div style={styles.selectRow}>
            <select style={styles.select} defaultValue="default">
              <option value="default">Standard</option>
              <option value="whistle">Pfeife</option>
              <option value="bell">Glocke</option>
              <option value="chime">Gong</option>
            </select>
            <button style={styles.button}>🔊 Test</button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Push Notifications - Coming Soon */}
      <CollapsibleSection icon="📱" title="Push-Notifications">
        <div style={styles.comingSoon}>
          <div style={styles.comingSoonIcon}>📱</div>
          <div style={styles.comingSoonTitle}>Push-Notifications kommen bald</div>
          <p>
            Browser-Push-Notifications für Turnierleitung und Trainer werden in
            einer zukünftigen Version verfügbar sein.
          </p>
          <span style={styles.badge}>In Entwicklung</span>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default NotificationsCategory;

/**
 * TeamHelpersCategory - Team & Helper Management
 *
 * Invite helpers, manage roles, and oversee team activity.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.4
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface TeamHelpersCategoryProps {
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
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function TeamHelpersCategory({
  tournament,
}: TeamHelpersCategoryProps) {
  return (
    <CategoryPage
      icon="👥"
      title="Team & Helfer"
      description="Helfer einladen und Berechtigungen verwalten"
    >
      <CollapsibleSection icon="➕" title="Helfer einladen" defaultOpen>
        <div style={styles.comingSoon}>
          <div style={styles.comingSoonIcon}>👥</div>
          <div style={styles.comingSoonTitle}>Einladungsfunktion kommt bald</div>
          <p>
            Die Möglichkeit, Helfer per E-Mail oder Link einzuladen, wird in einer
            zukünftigen Version verfügbar sein.
          </p>
          <span style={styles.badge}>Benötigt Anmeldung</span>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon="👤" title="Aktuelle Helfer">
        <div style={styles.comingSoon}>
          <p>Noch keine Helfer zugewiesen.</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon="🔗" title="Einladungs-Link">
        <div style={styles.comingSoon}>
          <p>Einladungs-Links werden nach Aktivierung des Auth-Systems verfügbar.</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon="👔" title="Schiedsrichter-Zuweisung">
        <div style={styles.comingSoon}>
          <p>
            {tournament.refereeConfig?.mode === 'none'
              ? 'Schiedsrichter-Modus ist deaktiviert.'
              : 'Schiedsrichter-Übersicht wird in einer späteren Version verfügbar sein.'}
          </p>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default TeamHelpersCategory;

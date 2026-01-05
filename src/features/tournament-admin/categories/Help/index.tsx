/**
 * HelpCategory - Help & Support
 *
 * Tutorials, keyboard shortcuts, FAQ, and support options.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.10
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface HelpCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  linkCard: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: cssVars.spacing.sm,
    textDecoration: 'none',
    color: 'inherit',
    width: '100%',
  } as CSSProperties,

  linkIcon: {
    fontSize: 24,
  } as CSSProperties,

  linkContent: {
    flex: 1,
  } as CSSProperties,

  linkTitle: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  linkDescription: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  arrow: {
    fontSize: 16,
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  shortcutTable: {
    width: '100%',
    borderCollapse: 'collapse',
  } as CSSProperties,

  shortcutRow: {
    borderBottom: `1px solid ${cssVars.colors.border}`,
  } as CSSProperties,

  shortcutKey: {
    padding: `${cssVars.spacing.sm} 0`,
    fontFamily: cssVars.fontFamilies.mono,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textPrimary,
    width: 120,
  } as CSSProperties,

  shortcutDescription: {
    padding: `${cssVars.spacing.sm} 0`,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  kbd: {
    display: 'inline-block',
    padding: '2px 6px',
    background: cssVars.colors.surfaceHover,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontFamily: cssVars.fontFamilies.mono,
    fontSize: cssVars.fontSizes.labelSm,
  } as CSSProperties,

  aboutInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    textAlign: 'center',
  } as CSSProperties,

  appName: {
    fontSize: cssVars.fontSizes.headlineMd,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  version: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function HelpCategory({
  tournament: _tournament,
}: HelpCategoryProps) {
  return (
    <CategoryPage
      icon="❓"
      title="Hilfe & Support"
      description="Tutorials, FAQ und Unterstützung"
    >
      {/* Tutorial */}
      <CollapsibleSection icon="🎓" title="Einführung / Tutorial" defaultOpen>
        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>🎬</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Schnellstart-Tutorial</div>
            <div style={styles.linkDescription}>
              Lerne die Grundlagen der Turnierverwaltung
            </div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>

        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>📖</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Vollständige Dokumentation</div>
            <div style={styles.linkDescription}>
              Ausführliche Anleitungen zu allen Funktionen
            </div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>
      </CollapsibleSection>

      {/* Keyboard Shortcuts */}
      <CollapsibleSection icon="⌨️" title="Tastenkürzel">
        <table style={styles.shortcutTable}>
          <tbody>
            <tr style={styles.shortcutRow}>
              <td style={styles.shortcutKey}>
                <span style={styles.kbd}>Esc</span>
              </td>
              <td style={styles.shortcutDescription}>Dialog/Modal schließen</td>
            </tr>
            <tr style={styles.shortcutRow}>
              <td style={styles.shortcutKey}>
                <span style={styles.kbd}>↑</span> <span style={styles.kbd}>↓</span>
              </td>
              <td style={styles.shortcutDescription}>Navigation in Listen</td>
            </tr>
            <tr style={styles.shortcutRow}>
              <td style={styles.shortcutKey}>
                <span style={styles.kbd}>Enter</span>
              </td>
              <td style={styles.shortcutDescription}>Auswahl bestätigen</td>
            </tr>
            <tr style={styles.shortcutRow}>
              <td style={styles.shortcutKey}>
                <span style={styles.kbd}>Space</span>
              </td>
              <td style={styles.shortcutDescription}>Timer starten/stoppen (Live-Cockpit)</td>
            </tr>
            <tr style={styles.shortcutRow}>
              <td style={styles.shortcutKey}>
                <span style={styles.kbd}>Strg</span> + <span style={styles.kbd}>S</span>
              </td>
              <td style={styles.shortcutDescription}>Speichern</td>
            </tr>
            <tr style={styles.shortcutRow}>
              <td style={styles.shortcutKey}>
                <span style={styles.kbd}>Strg</span> + <span style={styles.kbd}>Z</span>
              </td>
              <td style={styles.shortcutDescription}>Rückgängig</td>
            </tr>
          </tbody>
        </table>
      </CollapsibleSection>

      {/* FAQ */}
      <CollapsibleSection icon="💡" title="FAQ">
        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>❓</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Wie ändere ich ein Ergebnis?</div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>

        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>❓</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Wie füge ich einen Sponsor hinzu?</div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>

        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>❓</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Wie teile ich das Turnier mit Zuschauern?</div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>

        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>❓</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Wie exportiere ich die Ergebnisse?</div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>
      </CollapsibleSection>

      {/* Report Problem */}
      <CollapsibleSection icon="🐛" title="Problem melden">
        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>🐛</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Fehler melden</div>
            <div style={styles.linkDescription}>
              Melde einen Bug oder ein Problem
            </div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>

        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>💡</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>Feature-Wunsch</div>
            <div style={styles.linkDescription}>
              Schlage eine neue Funktion vor
            </div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>
      </CollapsibleSection>

      {/* Support Contact */}
      <CollapsibleSection icon="📧" title="Support kontaktieren">
        <button style={styles.linkCard}>
          <span style={styles.linkIcon}>📧</span>
          <div style={styles.linkContent}>
            <div style={styles.linkTitle}>E-Mail Support</div>
            <div style={styles.linkDescription}>
              support@spielplan.app
            </div>
          </div>
          <span style={styles.arrow}>→</span>
        </button>
      </CollapsibleSection>

      {/* About */}
      <CollapsibleSection icon="ℹ️" title="Über diese App">
        <div style={styles.aboutInfo}>
          <div style={styles.appName}>Hallenfußball PWA</div>
          <div style={styles.version}>Version 1.0.0</div>
          <p style={{ color: cssVars.colors.textSecondary }}>
            Die moderne Turnierverwaltung für Hallenfußball-Turniere.
            Einfach, schnell und offline-fähig.
          </p>
          <p style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.labelSm }}>
            © 2026 Spielplan.app
          </p>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default HelpCategory;

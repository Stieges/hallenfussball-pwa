/**
 * SettingsCategory - Kategorie-Container für Einstellungen
 *
 * Gruppiert zusammengehörige Einstellungen mit Titel und optionalem Icon.
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import React, { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

// =============================================================================
// Types
// =============================================================================

interface SettingsCategoryProps {
  /** Titel der Kategorie */
  title: string;
  /** Optional: Icon vor dem Titel */
  icon?: string;
  /** Kinder (SettingItems) */
  children: ReactNode;
  /** Optional: zusätzliche Styles */
  style?: CSSProperties;
}

// =============================================================================
// Component
// =============================================================================

export const SettingsCategory: React.FC<SettingsCategoryProps> = ({
  title,
  icon,
  children,
  style,
}) => {
  return (
    <section style={{ ...styles.container, ...style }}>
      <h2 style={styles.title}>
        {icon && <span style={styles.icon}>{icon}</span>}
        {title}
      </h2>
      <div style={styles.content}>{children}</div>
    </section>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    marginBottom: cssVars.spacing.xl,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    margin: 0,
    marginBottom: cssVars.spacing.md,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  icon: {
    fontSize: cssVars.fontSizes.md,
  },
  content: {
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    padding: `0 ${cssVars.spacing.md}`,
  },
};

export default SettingsCategory;

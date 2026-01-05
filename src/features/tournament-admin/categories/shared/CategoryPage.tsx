/**
 * CategoryPage - Shared Category Page Layout
 *
 * Provides consistent layout structure for all category pages.
 * Includes title, description, and content sections.
 */

import { ReactNode, CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  } as CSSProperties,

  header: {
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  title: {
    fontSize: cssVars.fontSizes.headlineSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    margin: 0,
  } as CSSProperties,

  icon: {
    fontSize: 24,
  } as CSSProperties,

  description: {
    fontSize: cssVars.fontSizes.bodyMd,
    color: cssVars.colors.textSecondary,
    lineHeight: cssVars.lineHeights.bodyMd,
  } as CSSProperties,

  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  } as CSSProperties,
} as const;

// =============================================================================
// PROPS
// =============================================================================

interface CategoryPageProps {
  icon: string;
  title: string;
  description?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CategoryPage({
  icon,
  title,
  description,
  headerExtra,
  children,
}: CategoryPageProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>
            <span style={styles.icon}>{icon}</span>
            {title}
          </h1>
          {headerExtra}
        </div>
        {description && <p style={styles.description}>{description}</p>}
      </div>
      <div style={styles.content}>{children}</div>
    </div>
  );
}

export default CategoryPage;

/**
 * CategorySkeleton - Loading Skeleton for Category Content
 *
 * Displayed while category components are being lazy loaded.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 8
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    animation: 'pulse 1.5s ease-in-out infinite',
  } as CSSProperties,

  header: {
    height: 32,
    width: '40%',
    background: cssVars.colors.surfaceHover,
    borderRadius: cssVars.borderRadius.md,
  } as CSSProperties,

  card: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
  } as CSSProperties,

  cardTitle: {
    height: 24,
    width: '60%',
    background: cssVars.colors.surfaceHover,
    borderRadius: cssVars.borderRadius.sm,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  cardLine: {
    height: 16,
    background: cssVars.colors.surfaceHover,
    borderRadius: cssVars.borderRadius.sm,
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  cardLineShort: {
    width: '75%',
  } as CSSProperties,

  cardLineShorter: {
    width: '50%',
  } as CSSProperties,

  keyframes: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function CategorySkeleton() {
  return (
    <>
      <style>{styles.keyframes}</style>
      <div style={styles.container}>
        {/* Header skeleton */}
        <div style={styles.header} />

        {/* Card skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} style={styles.card}>
            <div style={styles.cardTitle} />
            <div style={{ ...styles.cardLine, ...styles.cardLineShort }} />
            <div style={styles.cardLine} />
            <div style={{ ...styles.cardLine, ...styles.cardLineShorter }} />
          </div>
        ))}
      </div>
    </>
  );
}

export default CategorySkeleton;

/**
 * CollapsibleSection - Expandable Content Section
 *
 * Collapsible card section with header, toggle, and content area.
 * Used throughout admin center for organizing settings.
 */

import { useState, ReactNode, CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    overflow: 'hidden',
  } as CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.15s ease',
  } as CSSProperties,

  headerHover: {
    background: cssVars.colors.surfaceHover,
  } as CSSProperties,

  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
  } as CSSProperties,

  icon: {
    fontSize: 20,
  } as CSSProperties,

  title: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  badge: {
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.medium,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
    marginLeft: cssVars.spacing.sm,
  } as CSSProperties,

  toggle: {
    fontSize: 16,
    color: cssVars.colors.textSecondary,
    transition: 'transform 0.2s ease',
  } as CSSProperties,

  toggleOpen: {
    transform: 'rotate(180deg)',
  } as CSSProperties,

  content: {
    padding: cssVars.spacing.md,
    paddingTop: 0,
    borderTop: `1px solid ${cssVars.colors.border}`,
  } as CSSProperties,

  contentInner: {
    paddingTop: cssVars.spacing.md,
  } as CSSProperties,
} as const;

// =============================================================================
// PROPS
// =============================================================================

interface CollapsibleSectionProps {
  icon?: string;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CollapsibleSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.header,
          ...(isHovered ? styles.headerHover : {}),
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        aria-expanded={isOpen}
      >
        <div style={styles.headerContent}>
          {icon && <span style={styles.icon}>{icon}</span>}
          <span style={styles.title}>{title}</span>
          {badge && <span style={styles.badge}>{badge}</span>}
        </div>
        <span
          style={{
            ...styles.toggle,
            ...(isOpen ? styles.toggleOpen : {}),
          }}
        >
          ▼
        </span>
      </div>
      {isOpen && (
        <div style={styles.content}>
          <div style={styles.contentInner}>{children}</div>
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;

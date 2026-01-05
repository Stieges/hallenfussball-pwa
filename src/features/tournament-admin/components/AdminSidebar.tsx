/**
 * AdminSidebar - Desktop Navigation Sidebar
 *
 * Fixed sidebar with category navigation, grouped sections,
 * and danger zone with visual separation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 4.2
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { AdminSidebarProps, AdminCategoryGroup } from '../types/admin.types';
import {
  ADMIN_CATEGORIES,
  ADMIN_CATEGORY_GROUPS,
  DANGER_ZONE_ITEMS,
  ADMIN_LAYOUT,
  getCategoriesByGroup,
} from '../constants/admin.constants';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  sidebar: {
    width: ADMIN_LAYOUT.sidebarWidth,
    minWidth: ADMIN_LAYOUT.sidebarWidth,
    height: '100%',
    background: cssVars.colors.surface,
    borderRight: `1px solid ${cssVars.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as CSSProperties,

  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: cssVars.spacing.md,
    paddingBottom: 0,
  } as CSSProperties,

  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    marginBottom: cssVars.spacing.md,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    textAlign: 'left',
  } as CSSProperties,

  groupLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${cssVars.spacing.md} ${cssVars.spacing.sm}`,
    paddingBottom: cssVars.spacing.xs,
  } as CSSProperties,

  categoryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    marginBottom: '2px',
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    textAlign: 'left',
    minHeight: ADMIN_LAYOUT.itemHeight,
  } as CSSProperties,

  categoryItemActive: {
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    borderLeft: `3px solid ${cssVars.colors.primary}`,
    marginLeft: '-3px',
  } as CSSProperties,

  categoryItemDanger: {
    color: cssVars.colors.error,
  } as CSSProperties,

  categoryItemWarning: {
    color: cssVars.colors.warning,
  } as CSSProperties,

  categoryIcon: {
    fontSize: ADMIN_LAYOUT.iconSize,
    width: ADMIN_LAYOUT.iconSize,
    textAlign: 'center',
  } as CSSProperties,

  categoryLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  badge: {
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    padding: '2px 6px',
    borderRadius: cssVars.borderRadius.full,
    minWidth: 20,
    textAlign: 'center',
  } as CSSProperties,

  comingSoonBadge: {
    background: cssVars.colors.surfaceHover,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.labelSm,
    padding: '2px 6px',
    borderRadius: cssVars.borderRadius.sm,
  } as CSSProperties,

  separator: {
    height: 1,
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.md} 0`,
  } as CSSProperties,

  dangerZone: {
    background: cssVars.colors.dangerSubtle,
    margin: `0 -${cssVars.spacing.md}`,
    padding: cssVars.spacing.md,
    marginTop: cssVars.spacing.sm,
  } as CSSProperties,

  dangerZoneLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    paddingBottom: cssVars.spacing.sm,
  } as CSSProperties,

  warningsWidget: {
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.md,
    margin: cssVars.spacing.md,
    marginTop: 'auto',
    position: 'sticky',
    bottom: cssVars.spacing.md,
  } as CSSProperties,

  warningsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.bodySm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  warningItem: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    padding: `${cssVars.spacing.xs} 0`,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
  } as CSSProperties,

  warningsLink: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.primary,
    cursor: 'pointer',
    marginTop: cssVars.spacing.xs,
    display: 'block',
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminSidebar({
  activeCategory,
  onNavigate,
  warnings = [],
  onBackToTournament,
  onWarningClick,
}: AdminSidebarProps) {
  const renderCategoryItem = (
    category: typeof ADMIN_CATEGORIES[0],
    isActive: boolean
  ) => {
    const itemStyle = {
      ...styles.categoryItem,
      ...(isActive ? styles.categoryItemActive : {}),
      ...(category.isDanger ? styles.categoryItemDanger : {}),
      ...(category.isWarning ? styles.categoryItemWarning : {}),
    };

    return (
      <button
        key={category.id}
        style={itemStyle}
        onClick={() => onNavigate(category.id)}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = cssVars.colors.surfaceHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
        disabled={category.isComingSoon}
        aria-current={isActive ? 'page' : undefined}
      >
        <span style={styles.categoryIcon}>{category.icon}</span>
        <span style={styles.categoryLabel}>{category.label}</span>
        {category.badge && category.badge > 0 && (
          <span style={styles.badge}>{category.badge}</span>
        )}
        {category.isComingSoon && (
          <span style={styles.comingSoonBadge}>Bald</span>
        )}
      </button>
    );
  };

  const renderGroup = (group: AdminCategoryGroup) => {
    const groupConfig = ADMIN_CATEGORY_GROUPS.find((g) => g.id === group);
    const categories = getCategoriesByGroup(group);

    if (categories.length === 0) {return null;}

    return (
      <div key={group}>
        {groupConfig?.showLabel && (
          <div style={styles.groupLabel}>{groupConfig.label}</div>
        )}
        {categories.map((cat) =>
          renderCategoryItem(cat, activeCategory === cat.id)
        )}
      </div>
    );
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.scrollContainer}>
        {/* Back to Tournament */}
        <button
          style={styles.backButton}
          onClick={onBackToTournament}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = cssVars.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span>←</span>
          <span>Zurück zum Turnier</span>
        </button>

        {/* Overview (Dashboard) */}
        {renderGroup('overview')}

        {/* Management Group */}
        {renderGroup('management')}

        {/* Settings Group */}
        {renderGroup('settings')}

        <div style={styles.separator} />

        {/* Support */}
        {renderGroup('support')}

        {/* Danger Zone */}
        <div style={styles.dangerZone}>
          <div style={styles.dangerZoneLabel}>Kritische Aktionen</div>
          {DANGER_ZONE_ITEMS.map((item) =>
            renderCategoryItem(item, activeCategory === item.id)
          )}
        </div>
      </div>

      {/* Warnings Widget */}
      {warnings.length > 0 && (
        <div style={styles.warningsWidget}>
          <div style={styles.warningsHeader}>
            <span>⚠️</span>
            <span>{warnings.length} Warnungen</span>
          </div>
          {warnings.slice(0, 2).map((warning) => (
            <button
              key={warning.id}
              style={{
                ...styles.warningItem,
                background: 'transparent',
                border: 'none',
                cursor: onWarningClick ? 'pointer' : 'default',
                width: '100%',
                textAlign: 'left',
              }}
              onClick={() => onWarningClick?.(warning)}
              aria-label={`Warnung: ${warning.title}. Klicken um zur Behebung zu navigieren.`}
            >
              <span>►</span>
              <span>{warning.title}</span>
            </button>
          ))}
          {warnings.length > 2 && (
            <span style={styles.warningsLink}>Alle anzeigen →</span>
          )}
        </div>
      )}
    </aside>
  );
}

export default AdminSidebar;

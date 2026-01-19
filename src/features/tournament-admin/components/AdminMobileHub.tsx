/**
 * AdminMobileHub - Mobile Navigation Hub (Hub-and-Spoke Pattern)
 *
 * Full-screen hub listing all admin categories as tappable cards.
 * Each tap navigates to a "spoke" (detail view).
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 4.4
 */

import { CSSProperties, useState, useMemo } from 'react';
import { cssVars } from '../../../design-tokens';
import type { AdminMobileHubProps, AdminCategoryGroup } from '../types/admin.types';
import {
  ADMIN_CATEGORIES,
  ADMIN_CATEGORY_GROUPS,
  DANGER_ZONE_ITEMS,
  ADMIN_LAYOUT,
} from '../constants/admin.constants';

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    background: cssVars.colors.background,
    paddingBottom: 'env(safe-area-inset-bottom)',
  } as CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  } as CSSProperties,

  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: '1.25rem',
    cursor: 'pointer',
  } as CSSProperties,

  headerTitle: {
    flex: 1,
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  content: {
    padding: cssVars.spacing.md,
  } as CSSProperties,

  groupLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${cssVars.spacing.md} 0 ${cssVars.spacing.sm}`,
  } as CSSProperties,

  categoryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.sm,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    minHeight: ADMIN_LAYOUT.mobileHubItemHeight,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  categoryCardDanger: {
    background: cssVars.colors.dangerSubtle,
    borderColor: cssVars.colors.dangerBorder,
  } as CSSProperties,

  categoryCardWarning: {
    background: cssVars.colors.warningSubtle,
    borderColor: cssVars.colors.warningBorder,
  } as CSSProperties,

  categoryCardDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as CSSProperties,

  categoryIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  } as CSSProperties,

  categoryContent: {
    flex: 1,
    minWidth: 0,
  } as CSSProperties,

  categoryLabel: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    marginBottom: 2,
  } as CSSProperties,

  categoryLabelDanger: {
    color: cssVars.colors.error,
  } as CSSProperties,

  categoryLabelWarning: {
    color: cssVars.colors.warning,
  } as CSSProperties,

  categoryDescription: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  categoryArrow: {
    fontSize: '1.25rem',
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  badge: {
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
  } as CSSProperties,

  comingSoonBadge: {
    background: cssVars.colors.surfaceHover,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.labelSm,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.sm,
  } as CSSProperties,

  separator: {
    height: 1,
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.lg} 0`,
  } as CSSProperties,

  dangerZoneSection: {
    background: cssVars.colors.dangerSubtle,
    margin: `${cssVars.spacing.md} -${cssVars.spacing.md}`,
    padding: cssVars.spacing.md,
    marginTop: cssVars.spacing.lg,
  } as CSSProperties,

  dangerZoneLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  warningsCard: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.warningSubtle,
    border: `1px solid ${cssVars.colors.warningBorder}`,
    borderRadius: cssVars.borderRadius.lg,
    cursor: 'pointer',
    marginTop: cssVars.spacing.md,
  } as CSSProperties,

  warningsIcon: {
    fontSize: 24,
    color: cssVars.colors.warning,
  } as CSSProperties,

  warningsContent: {
    flex: 1,
  } as CSSProperties,

  warningsTitle: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.warning,
  } as CSSProperties,

  warningsSubtitle: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  searchContainer: {
    padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}`,
    background: cssVars.colors.surface,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  } as CSSProperties,

  searchInput: {
    width: '100%',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.bodyMd,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    outline: 'none',
  } as CSSProperties,

  noResults: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.bodyMd,
  } as CSSProperties,
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminMobileHub({
  onNavigate,
  warnings = [],
  onBackToTournament,
}: AdminMobileHubProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return { categories: ADMIN_CATEGORIES, dangerItems: DANGER_ZONE_ITEMS };
    }

    const query = searchQuery.toLowerCase();
    return {
      categories: ADMIN_CATEGORIES.filter(
        (cat) =>
          cat.label.toLowerCase().includes(query) ||
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR chain for filter conditions
          cat.shortLabel?.toLowerCase().includes(query) ||
          cat.description?.toLowerCase().includes(query)
      ),
      dangerItems: DANGER_ZONE_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR chain for filter conditions
          item.shortLabel?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
      ),
    };
  }, [searchQuery]);

  const hasResults = filteredCategories.categories.length > 0 || filteredCategories.dangerItems.length > 0;

  const renderCategoryCard = (category: typeof ADMIN_CATEGORIES[0]) => {
    const cardStyle = {
      ...styles.categoryCard,
      ...(category.isDanger ? styles.categoryCardDanger : {}),
      ...(category.isWarning ? styles.categoryCardWarning : {}),
      ...(category.isComingSoon ? styles.categoryCardDisabled : {}),
    };

    const labelStyle = {
      ...styles.categoryLabel,
      ...(category.isDanger ? styles.categoryLabelDanger : {}),
      ...(category.isWarning ? styles.categoryLabelWarning : {}),
    };

    return (
      <button
        key={category.id}
        style={cardStyle}
        onClick={() => !category.isComingSoon && onNavigate(category.id)}
        disabled={category.isComingSoon}
      >
        <span style={styles.categoryIcon}>{category.icon}</span>
        <div style={styles.categoryContent}>
          <div style={labelStyle}>
            {category.shortLabel ?? category.label}
          </div>
          {category.description && (
            <div style={styles.categoryDescription}>
              {category.description}
            </div>
          )}
        </div>
        {category.badge && category.badge > 0 && (
          <span style={styles.badge}>{category.badge}</span>
        )}
        {category.isComingSoon && (
          <span style={styles.comingSoonBadge}>Bald</span>
        )}
        {!category.isComingSoon && !category.badge && (
          <span style={styles.categoryArrow}>→</span>
        )}
      </button>
    );
  };

  const renderGroup = (groupId: AdminCategoryGroup) => {
    const groupConfig = ADMIN_CATEGORY_GROUPS.find((g) => g.id === groupId);
    const categories = filteredCategories.categories.filter((cat) => cat.group === groupId);

    if (categories.length === 0) {return null;}

    return (
      <div key={groupId}>
        {groupConfig?.showLabel && (
          <div style={styles.groupLabel}>{groupConfig.label}</div>
        )}
        {categories.map(renderCategoryCard)}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBackToTournament}>
          ←
        </button>
        <div style={styles.headerTitle}>Admin Center</div>
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <input
          type="search"
          placeholder="Suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
          aria-label="Kategorien durchsuchen"
        />
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* No Results */}
        {!hasResults && searchQuery && (
          <div style={styles.noResults}>
            Keine Ergebnisse für &quot;{searchQuery}&quot;
          </div>
        )}

        {/* Overview (Dashboard) */}
        {renderGroup('overview')}

        {/* Management */}
        {renderGroup('management')}

        {/* Settings */}
        {renderGroup('settings')}

        {/* Only show separator if we have support or danger items */}
        {(filteredCategories.categories.some(c => c.group === 'support') ||
          filteredCategories.dangerItems.length > 0) && hasResults && (
          <div style={styles.separator} />
        )}

        {/* Support */}
        {renderGroup('support')}

        {/* Danger Zone - only show if there are danger items */}
        {filteredCategories.dangerItems.length > 0 && (
          <div style={styles.dangerZoneSection}>
            <div style={styles.dangerZoneLabel}>Kritische Aktionen</div>
            {filteredCategories.dangerItems.map(renderCategoryCard)}
          </div>
        )}

        {/* Warnings Card - only show when not searching */}
        {warnings.length > 0 && !searchQuery && (
          <button
            style={styles.warningsCard}
            onClick={() => {
              // Could navigate to a warnings overview
            }}
          >
            <span style={styles.warningsIcon}>⚠️</span>
            <div style={styles.warningsContent}>
              <div style={styles.warningsTitle}>
                {warnings.length} Warnungen
              </div>
              <div style={styles.warningsSubtitle}>
                {warnings[0]?.title}
                {warnings.length > 1 && ` und ${warnings.length - 1} weitere`}
              </div>
            </div>
            <span style={styles.categoryArrow}>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default AdminMobileHub;

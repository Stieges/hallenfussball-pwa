/**
 * AdminMobileHub - Mobile Navigation Hub (Hub-and-Spoke Pattern)
 *
 * Full-screen hub listing all admin categories as tappable cards.
 * Each tap navigates to a "spoke" (detail view).
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 4.4
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { styles } from './adminMobileHubStyles';
import { AdminHubWarningsCard } from './AdminHubWarningsCard';
import type { AdminMobileHubProps, AdminCategoryGroup } from '../types/admin.types';
import {
  ADMIN_CATEGORIES,
  ADMIN_CATEGORY_GROUPS,
  DANGER_ZONE_ITEMS,
} from '../constants/admin.constants';

// =============================================================================
// STYLES
// =============================================================================

// =============================================================================
// COMPONENT
// =============================================================================

export function AdminMobileHub({
  onNavigate,
  warnings = [],
  onBackToTournament,
}: AdminMobileHubProps) {
  const { t } = useTranslation('admin');

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
        {!category.badge && (
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
        <div style={styles.headerTitle}>{t('mobileHub.title')}</div>
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <input
          type="search"
          placeholder={t('mobileHub.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
          aria-label={t('mobileHub.searchAriaLabel')}
        />
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* No Results */}
        {!hasResults && searchQuery && (
          <div style={styles.noResults}>
            {t('mobileHub.noResults', { query: searchQuery })}
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
            <div style={styles.dangerZoneLabel}>{t('mobileHub.criticalActions')}</div>
            {filteredCategories.dangerItems.map(renderCategoryCard)}
          </div>
        )}

        {warnings.length > 0 && !searchQuery && <AdminHubWarningsCard warnings={warnings} />}
      </div>
    </div>
  );
}

export default AdminMobileHub;

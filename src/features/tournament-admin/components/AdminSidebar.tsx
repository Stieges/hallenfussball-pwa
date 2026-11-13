/**
 * AdminSidebar - Desktop Navigation Sidebar
 *
 * Fixed sidebar with category navigation, grouped sections,
 * and danger zone with visual separation.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 4.2
 */

import { useState, useRef, useCallback, useMemo, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { styles } from './adminSidebarStyles';
import { AdminSidebarWarnings } from './AdminSidebarWarnings';
import type { AdminSidebarProps, AdminCategoryGroup } from '../types/admin.types';
import {
  ADMIN_CATEGORIES,
  ADMIN_CATEGORY_GROUPS,
  DANGER_ZONE_ITEMS,
  getCategoriesByGroup,
} from '../constants/admin.constants';

// =============================================================================
// STYLES
// =============================================================================

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
  const { t } = useTranslation('admin');

  // Build flat list of all navigable category IDs for keyboard navigation
  const allCategoryIds = useMemo(() => {
    const ids: string[] = [];
    (['overview', 'management', 'settings', 'support'] as AdminCategoryGroup[]).forEach((group) => {
      getCategoriesByGroup(group).forEach((cat) => {
        if (!cat.isComingSoon) {
          ids.push(cat.id);
        }
      });
    });
    // Add danger zone items
    DANGER_ZONE_ITEMS.forEach((item) => {
      if (!item.isComingSoon) {
        ids.push(item.id);
      }
    });
    return ids;
  }, []);

  // Track focused item index for roving tabindex
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const idx = allCategoryIds.indexOf(activeCategory);
    return idx >= 0 ? idx : 0;
  });

  // Refs for all category buttons
  const itemRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Keyboard handler for arrow navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, categoryId: string) => {
      const currentIndex = allCategoryIds.indexOf(categoryId);
      if (currentIndex === -1) {return;}

      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = Math.min(currentIndex + 1, allCategoryIds.length - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = allCategoryIds.length - 1;
          break;
      }

      if (nextIndex !== null && nextIndex !== currentIndex) {
        setFocusedIndex(nextIndex);
        const nextId = allCategoryIds[nextIndex];
        itemRefs.current.get(nextId)?.focus();
      }
    },
    [allCategoryIds]
  );

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

    // Roving tabindex: only focused item is tabbable
    const categoryIndex = allCategoryIds.indexOf(category.id);
    const isFocusable = categoryIndex === focusedIndex;

    return (
      <button
        key={category.id}
        ref={(el) => { itemRefs.current.set(category.id, el); }}
        style={itemStyle}
        onClick={() => onNavigate(category.id)}
        onKeyDown={(e) => handleKeyDown(e, category.id)}
        onFocus={() => {
          if (categoryIndex !== -1) {
            setFocusedIndex(categoryIndex);
          }
        }}
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
        tabIndex={category.isComingSoon ? -1 : isFocusable ? 0 : -1}
        aria-current={isActive ? 'page' : undefined}
      >
        <span style={styles.categoryIcon}>{category.icon}</span>
        <span style={styles.categoryLabel}>{category.label}</span>
        {category.badge && category.badge > 0 && (
          <span style={styles.badge}>{category.badge}</span>
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
          <span>{t('sidebar.backToTournament')}</span>
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
          <div style={styles.dangerZoneLabel}>{t('sidebar.criticalActions')}</div>
          {DANGER_ZONE_ITEMS.map((item) =>
            renderCategoryItem(item, activeCategory === item.id)
          )}
        </div>
      </div>

      <AdminSidebarWarnings warnings={warnings} onWarningClick={onWarningClick} />
    </aside>
  );
}

export default AdminSidebar;

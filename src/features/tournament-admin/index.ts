/**
 * Tournament Admin Center - Feature Export
 *
 * Central admin area for tournament management.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md
 */

// Main Component
export { TournamentAdminCenter } from './TournamentAdminCenter';
export { default } from './TournamentAdminCenter';

// Navigation Components
export { AdminSidebar } from './components/AdminSidebar';
export { AdminMobileHub } from './components/AdminMobileHub';
export { AdminHeader } from './components/AdminHeader';
export { CategorySkeleton } from './components/CategorySkeleton';

// Types
export type {
  AdminCategoryId,
  AdminCategory,
  AdminCategoryGroup,
  AdminCategoryGroupConfig,
  AdminSidebarProps,
  AdminMobileHubProps,
  AdminHeaderProps,
  AdminLayoutProps,
  AdminCategoryPageProps,
  AdminWarning,
  WarningSeverity,
  ActivityAction,
  ActivityLogEntry,
  ActivityLogFilter,
  DangerAction,
  DangerActionConfig,
  ExportFormat,
  ExportOptions,
  AdminTournamentSettings,
} from './types/admin.types';

export { DEFAULT_ADMIN_SETTINGS } from './types/admin.types';

// Constants
export {
  ADMIN_CATEGORIES,
  ADMIN_CATEGORY_GROUPS,
  DANGER_ZONE_ITEMS,
  DANGER_ACTIONS,
  ADMIN_LAYOUT,
  ACTIVITY_LOG,
  getAllAdminCategories,
  getAdminCategory,
  getCategoriesByGroup,
  getCategoryGroupConfig,
} from './constants/admin.constants';

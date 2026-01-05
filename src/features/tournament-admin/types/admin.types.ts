/**
 * Tournament Admin Center - Type Definitions
 *
 * Central types for the Admin Center navigation, categories, and components.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md
 */

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

/**
 * All available admin categories (routes)
 * URL pattern: /tournament/:id/admin/:category
 */
export type AdminCategoryId =
  | 'dashboard'
  | 'activity-log'
  | 'exports'
  | 'team-helpers'
  | 'sponsors'
  | 'settings'
  | 'visibility'
  | 'notifications'
  | 'metadata'
  | 'help'
  | 'danger-zone';

/**
 * Sidebar groupings for visual organization
 */
export type AdminCategoryGroup =
  | 'overview'
  | 'management'
  | 'settings'
  | 'support'
  | 'danger';

/**
 * Category configuration for sidebar and navigation
 */
export interface AdminCategory {
  id: AdminCategoryId;
  label: string;
  shortLabel?: string; // For mobile hub
  description?: string; // Subtitle for mobile hub
  icon: string; // Emoji or icon name
  group: AdminCategoryGroup;
  path: string; // URL path segment
  isDanger?: boolean; // Red styling
  isWarning?: boolean; // Orange styling
  badge?: number; // Notification count
  isComingSoon?: boolean; // Feature not yet available
}

/**
 * Category group for sidebar sections
 */
export interface AdminCategoryGroupConfig {
  id: AdminCategoryGroup;
  label: string;
  showLabel: boolean; // Show group header in sidebar
}

// =============================================================================
// ACTIVITY LOG TYPES
// =============================================================================

/**
 * Activity log action types for audit trail
 */
export type ActivityAction =
  // Match events
  | 'result_entered'
  | 'result_changed'
  | 'goal_added'
  | 'goal_removed'
  | 'card_added'
  | 'card_removed'
  | 'match_started'
  | 'match_finished'
  | 'match_skipped'
  // Tournament events
  | 'tournament_paused'
  | 'tournament_resumed'
  | 'tournament_ended'
  | 'tournament_archived'
  | 'schedule_regenerated'
  | 'schedule_reset'
  // Settings events
  | 'setting_changed'
  | 'sponsor_added'
  | 'sponsor_removed'
  | 'sponsor_updated'
  | 'helper_invited'
  | 'helper_removed'
  // Export events
  | 'export_created'
  | 'backup_created'
  | 'backup_restored';

/**
 * Single activity log entry
 */
export interface ActivityLogEntry {
  id: string;
  timestamp: string; // ISO date
  userId?: string;
  userName: string;
  action: ActivityAction;
  details: Record<string, unknown>;
  entityType?: 'match' | 'tournament' | 'team' | 'sponsor' | 'setting';
  entityId?: string;
  canUndo: boolean;
  undoneAt?: string; // ISO date if action was reverted
}

/**
 * Activity log filter options
 */
export interface ActivityLogFilter {
  timeRange: 'today' | 'week' | 'month' | 'all';
  userId?: string;
  actions?: ActivityAction[];
  searchQuery?: string;
}

// =============================================================================
// DANGER ZONE TYPES
// =============================================================================

/**
 * Dangerous actions requiring confirmation
 */
export type DangerAction =
  | 'regenerate_schedule'
  | 'reset_schedule'
  | 'end_tournament'
  | 'archive_tournament'
  | 'delete_tournament';

/**
 * Confirmation dialog configuration
 */
export interface DangerActionConfig {
  action: DangerAction;
  title: string;
  description: string;
  consequences: string[];
  confirmText: string; // Text user must type
  buttonLabel: string;
  severity: 'warning' | 'danger';
}

// =============================================================================
// VALIDATION / WARNINGS TYPES
// =============================================================================

/**
 * Warning severity levels
 */
export type WarningSeverity = 'info' | 'warning' | 'error';

/**
 * System validation warning
 */
export interface AdminWarning {
  id: string;
  type: string;
  severity: WarningSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string; // Navigate to category
  dismissible: boolean;
  createdAt: string;
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

/**
 * Available export formats
 */
export type ExportFormat = 'pdf' | 'csv' | 'json';

/**
 * Export content options
 */
export interface ExportOptions {
  format: ExportFormat;
  includeGoals?: boolean;
  includeCards?: boolean;
  includeSubstitutions?: boolean;
  includeTimestamps?: boolean;
  matchId?: string; // 'all' or specific match
  timeRange?: 'all' | 'today' | 'custom';
}

// =============================================================================
// COMPONENT PROPS TYPES
// =============================================================================

/**
 * Props for category page components
 */
export interface AdminCategoryPageProps {
  tournamentId: string;
}

/**
 * Props for the main admin layout
 */
export interface AdminLayoutProps {
  tournamentId: string;
  activeCategory: AdminCategoryId;
  onNavigate: (category: AdminCategoryId) => void;
  children: React.ReactNode;
}

/**
 * Props for sidebar component
 */
export interface AdminSidebarProps {
  activeCategory: AdminCategoryId;
  onNavigate: (category: AdminCategoryId) => void;
  warnings?: AdminWarning[];
  onBackToTournament: () => void;
  /** Handle warning click for navigation */
  onWarningClick?: (warning: AdminWarning) => void;
}

/**
 * Props for mobile hub component
 */
export interface AdminMobileHubProps {
  onNavigate: (category: AdminCategoryId) => void;
  warnings?: AdminWarning[];
  onBackToTournament: () => void;
}

/**
 * Props for admin header component
 */
export interface AdminHeaderProps {
  title: string;
  showBackToHub?: boolean; // Mobile only
  onBackToHub?: () => void;
  onBackToTournament: () => void;
  onSearch?: (query: string) => void;
}

// =============================================================================
// SETTINGS EXTENSION TYPES
// =============================================================================

/**
 * Extended tournament settings for Admin Center
 */
export interface AdminTournamentSettings {
  // Activity Log
  activityLogEnabled: boolean;
  activityLogRetentionDays: number;
  activityLogMaxEntries: number;

  // Auto-time continuation
  autoTimeAdjustment: 'off' | 'automatic' | 'manual';
  autoTimeOffset?: number; // Minutes offset for manual mode

  // Visibility
  visibilityLevel: 'private' | 'unlisted' | 'public';
  showSchedule: boolean;
  showResults: boolean;
  showRankings: boolean;
  showScorers: boolean;
  showLiveTicker: boolean;
  resultDelay: number; // Minutes, 0 = immediate

  // Notifications
  trainerNotificationMinutes: number;
  notifyOnMatchEnd: boolean;
  notifyOnRedCard: boolean;
  notifyOnCorrection: boolean;
  soundEnabled: boolean;
  soundFile?: string;
}

/**
 * Default admin settings
 */
export const DEFAULT_ADMIN_SETTINGS: AdminTournamentSettings = {
  activityLogEnabled: true,
  activityLogRetentionDays: 90,
  activityLogMaxEntries: 500,
  autoTimeAdjustment: 'off',
  visibilityLevel: 'unlisted',
  showSchedule: true,
  showResults: true,
  showRankings: true,
  showScorers: true,
  showLiveTicker: true,
  resultDelay: 0,
  trainerNotificationMinutes: 5,
  notifyOnMatchEnd: true,
  notifyOnRedCard: true,
  notifyOnCorrection: false,
  soundEnabled: true,
};

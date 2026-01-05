/**
 * Tournament Admin Center - Constants
 *
 * Configuration for admin categories, navigation, and danger actions.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md
 */

import type {
  AdminCategory,
  AdminCategoryGroup,
  AdminCategoryGroupConfig,
  DangerAction,
  DangerActionConfig,
} from '../types/admin.types';

// =============================================================================
// CATEGORY GROUPS
// =============================================================================

export const ADMIN_CATEGORY_GROUPS: AdminCategoryGroupConfig[] = [
  { id: 'overview', label: '', showLabel: false },
  { id: 'management', label: 'Verwaltung', showLabel: true },
  { id: 'settings', label: 'Einstellungen', showLabel: true },
  { id: 'support', label: '', showLabel: false },
  { id: 'danger', label: 'Kritische Aktionen', showLabel: true },
];

// =============================================================================
// CATEGORIES CONFIGURATION
// =============================================================================

export const ADMIN_CATEGORIES: AdminCategory[] = [
  // Overview
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Turnier-Status, Stats',
    icon: '📊',
    group: 'overview',
    path: 'dashboard',
  },

  // Management
  {
    id: 'activity-log',
    label: 'Activity Log',
    description: 'Änderungsprotokoll',
    icon: '📋',
    group: 'management',
    path: 'activity-log',
  },
  {
    id: 'exports',
    label: 'Exporte',
    description: 'PDF, CSV, Backup',
    icon: '📤',
    group: 'management',
    path: 'exports',
  },
  {
    id: 'team-helpers',
    label: 'Team & Helfer',
    shortLabel: 'Team & Helfer',
    description: 'Helfer einladen',
    icon: '👥',
    group: 'management',
    path: 'team-helpers',
    isComingSoon: true,
  },
  {
    id: 'sponsors',
    label: 'Sponsoren',
    description: 'Logos & Einblendungen',
    icon: '🎯',
    group: 'management',
    path: 'sponsors',
  },

  // Settings
  {
    id: 'settings',
    label: 'Turnier-Einstellungen',
    shortLabel: 'Einstellungen',
    description: 'Pause, Felder, Zeiten',
    icon: '⚙️',
    group: 'settings',
    path: 'settings',
  },
  {
    id: 'visibility',
    label: 'Sichtbarkeit',
    shortLabel: 'Sichtbarkeit',
    description: 'QR-Code, Public View',
    icon: '👁',
    group: 'settings',
    path: 'visibility',
  },
  {
    id: 'notifications',
    label: 'Benachrichtigungen',
    shortLabel: 'Benachricht.',
    description: 'Push & Sound',
    icon: '🔔',
    group: 'settings',
    path: 'notifications',
    isComingSoon: true,
  },
  {
    id: 'metadata',
    label: 'Meta-Daten',
    shortLabel: 'Meta-Daten',
    description: 'Turnier-Grunddaten',
    icon: '📝',
    group: 'settings',
    path: 'metadata',
  },

  // Support
  {
    id: 'help',
    label: 'Hilfe & Support',
    shortLabel: 'Hilfe',
    description: 'FAQ, Tastenkürzel',
    icon: '❓',
    group: 'support',
    path: 'help',
  },
];

// =============================================================================
// DANGER ZONE ITEMS (separate from categories for special styling)
// =============================================================================

export const DANGER_ZONE_ITEMS: AdminCategory[] = [
  {
    id: 'danger-zone',
    label: 'Spielplan neu generieren',
    shortLabel: 'Neu generieren',
    description: 'Spielplan komplett neu erstellen',
    icon: '🔄',
    group: 'danger',
    path: 'danger-zone',
    isWarning: true,
  },
];

// =============================================================================
// DANGER ACTION CONFIGURATIONS
// =============================================================================

export const DANGER_ACTIONS: Record<DangerAction, DangerActionConfig> = {
  regenerate_schedule: {
    action: 'regenerate_schedule',
    title: 'Spielplan neu generieren',
    description:
      'Erstellt den kompletten Spielplan neu. Alle bisherigen Zeiten und Zuordnungen werden verworfen.',
    consequences: [
      'Alle Spielzeiten werden neu berechnet',
      'Manuelle Feld-Zuordnungen gehen verloren',
      'Ergebnisse bleiben erhalten',
    ],
    confirmText: 'NEU GENERIEREN',
    buttonLabel: 'Spielplan neu generieren',
    severity: 'warning',
  },
  reset_schedule: {
    action: 'reset_schedule',
    title: 'Spielplan zurücksetzen',
    description:
      'Setzt alle Spiele auf den Ausgangszustand zurück. ALLE Ergebnisse werden gelöscht!',
    consequences: [
      'Alle Ergebnisse werden gelöscht',
      'Alle Spielstatus werden zurückgesetzt',
      'Torschützenliste wird geleert',
      'Event-Log wird gelöscht',
      'Diese Aktion kann NICHT rückgängig gemacht werden',
    ],
    confirmText: 'ZURÜCKSETZEN',
    buttonLabel: 'Spielplan zurücksetzen',
    severity: 'danger',
  },
  end_tournament: {
    action: 'end_tournament',
    title: 'Turnier vorzeitig beenden',
    description:
      'Markiert das Turnier als abgeschlossen. Noch laufende Spiele werden gestoppt.',
    consequences: [
      'Alle laufenden Spiele werden beendet',
      'Keine weiteren Ergebnisse können eingetragen werden',
      'Tabellen und Platzierungen werden finalisiert',
      'Das Turnier wird archiviert',
    ],
    confirmText: 'BEENDEN',
    buttonLabel: 'Turnier beenden',
    severity: 'warning',
  },
  archive_tournament: {
    action: 'archive_tournament',
    title: 'Turnier archivieren',
    description:
      'Verschiebt das Turnier ins Archiv. Es wird read-only und kann später wiederhergestellt werden.',
    consequences: [
      'Keine Änderungen mehr möglich',
      'Turnier erscheint im Archiv-Bereich',
      'Kann jederzeit wiederhergestellt werden',
    ],
    confirmText: 'ARCHIVIEREN',
    buttonLabel: 'Turnier archivieren',
    severity: 'warning',
  },
  delete_tournament: {
    action: 'delete_tournament',
    title: 'Turnier endgültig löschen',
    description:
      'Verschiebt das Turnier in den Papierkorb. Nach 30 Tagen wird es endgültig gelöscht.',
    consequences: [
      'Turnier wird in den Papierkorb verschoben',
      'Kann innerhalb von 30 Tagen wiederhergestellt werden',
      'Nach 30 Tagen: Endgültige Löschung aller Daten',
      'Diese Aktion kann NICHT rückgängig gemacht werden',
    ],
    confirmText: 'LÖSCHEN',
    buttonLabel: 'Turnier löschen',
    severity: 'danger',
  },
};

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

export const ADMIN_LAYOUT = {
  sidebarWidth: 240,
  sidebarWidthTablet: 280,
  headerHeight: 56,
  contentMaxWidth: 800,
  itemHeight: 44,
  iconSize: 20,
  mobileHubItemHeight: 64,
} as const;

// =============================================================================
// ACTIVITY LOG CONSTANTS
// =============================================================================

export const ACTIVITY_LOG = {
  maxEntries: 500,
  defaultRetentionDays: 90,
  pageSize: 50,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all categories including danger zone items
 */
export function getAllAdminCategories(): AdminCategory[] {
  return [...ADMIN_CATEGORIES, ...DANGER_ZONE_ITEMS];
}

/**
 * Get category by ID
 */
export function getAdminCategory(id: string): AdminCategory | undefined {
  return getAllAdminCategories().find((cat) => cat.id === id);
}

/**
 * Get categories by group
 */
export function getCategoriesByGroup(group: AdminCategoryGroup): AdminCategory[] {
  return ADMIN_CATEGORIES.filter((cat) => cat.group === group);
}

/**
 * Get category group config
 */
export function getCategoryGroupConfig(
  group: AdminCategoryGroup
): AdminCategoryGroupConfig | undefined {
  return ADMIN_CATEGORY_GROUPS.find((g) => g.id === group);
}

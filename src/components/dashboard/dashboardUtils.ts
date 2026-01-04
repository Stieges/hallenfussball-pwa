/**
 * Dashboard Navigation Utilities
 *
 * Helper functions for URL-based dashboard navigation.
 */

export type DashboardTab = 'turniere' | 'archiv' | 'papierkorb';

/** Map tab IDs to URL paths */
export const TAB_PATHS: Record<DashboardTab, string> = {
  turniere: '/',
  archiv: '/archiv',
  papierkorb: '/papierkorb',
};

/** Get tab ID from URL path */
export function getTabFromPath(pathname: string): DashboardTab {
  if (pathname === '/archiv') { return 'archiv'; }
  if (pathname === '/papierkorb') { return 'papierkorb'; }
  return 'turniere';
}

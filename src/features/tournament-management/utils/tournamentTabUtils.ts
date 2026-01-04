/**
 * Tournament Tab Navigation Utilities
 *
 * Helper functions for URL-based tournament tab navigation.
 */

export type TournamentTab = 'schedule' | 'tabellen' | 'management' | 'monitor' | 'monitors' | 'teams' | 'settings';

/** Map tab IDs to URL path segments */
export const TAB_PATHS: Record<TournamentTab, string> = {
  schedule: 'schedule',
  tabellen: 'standings',
  management: 'live',
  monitor: 'monitor',
  monitors: 'monitors',
  teams: 'teams',
  settings: 'settings',
};

/** Reverse mapping: URL path segment to tab ID */
const PATH_TO_TAB: Record<string, TournamentTab> = {
  schedule: 'schedule',
  standings: 'tabellen',
  live: 'management',
  monitor: 'monitor',
  monitors: 'monitors',
  teams: 'teams',
  settings: 'settings',
};

/** Get tab ID from URL path segment */
export function getTabFromPath(tabPath: string | undefined): TournamentTab {
  if (!tabPath) { return 'schedule'; }
  return PATH_TO_TAB[tabPath] ?? 'schedule';
}

/** Build full URL path for tournament tab */
export function buildTournamentTabPath(tournamentId: string, tab: TournamentTab): string {
  return `/tournament/${tournamentId}/${TAB_PATHS[tab]}`;
}

/** Default tab to show when accessing /tournament/:id */
export const DEFAULT_TAB: TournamentTab = 'schedule';

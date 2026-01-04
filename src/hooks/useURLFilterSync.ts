/**
 * useURLFilterSync - Synchronisiert Filter-State mit URL Query-Parametern
 *
 * Ermöglicht:
 * - Teilen von gefilterten Ansichten via Link
 * - Browser-Navigation (Zurück/Vor) mit Filter-Persistenz
 * - Lesezeichen für spezifische Filter-Konfigurationen
 *
 * URL-Parameter (kurze Namen für kompakte URLs):
 * - p: phase (all/groupStage/finals)
 * - g: group (A/B/C/D/...)
 * - f: field (1/2/3/4/...)
 * - s: status (pending,running,finished - kommagetrennt)
 * - q: query (teamSearch)
 *
 * NOTE: Updated to work with react-router-dom HashRouter.
 * Uses location.search from react-router (not window.location.search)
 * to correctly handle query params in the hash portion of the URL.
 *
 * @see docs/concepts/URL-FILTER-PERSISTENZ.md
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScheduleFilters, DEFAULT_FILTERS } from '../types/scheduleFilters';
import { MatchStatus } from '../types/tournament';

// =============================================================================
// URL Parameter Mapping
// =============================================================================

const URL_PARAM_KEYS = {
  phase: 'p',
  group: 'g',
  field: 'f',
  status: 's',
  teamSearch: 'q',
} as const;


// =============================================================================
// URL Parsing & Serialization
// =============================================================================

/**
 * Parse URL search params to filter state
 */
export function parseURLFilters(searchParams: URLSearchParams): Partial<ScheduleFilters> {
  const filters: Partial<ScheduleFilters> = {};

  // Phase
  const phase = searchParams.get(URL_PARAM_KEYS.phase);
  if (phase === 'groupStage' || phase === 'finals') {
    filters.phase = phase;
  } else if (phase === 'all' || !phase) {
    filters.phase = 'all';
  }

  // Group
  const group = searchParams.get(URL_PARAM_KEYS.group);
  if (group) {
    filters.group = group;
  }

  // Field
  const field = searchParams.get(URL_PARAM_KEYS.field);
  if (field) {
    const fieldNum = parseInt(field, 10);
    if (!isNaN(fieldNum) && fieldNum > 0) {
      filters.field = fieldNum;
    }
  }

  // Status (comma-separated)
  const status = searchParams.get(URL_PARAM_KEYS.status);
  if (status) {
    const validStatuses: MatchStatus[] = ['scheduled', 'waiting', 'running', 'finished', 'skipped'];
    const statusArray = status.split(',').filter(
      (s): s is MatchStatus => validStatuses.includes(s as MatchStatus)
    );
    if (statusArray.length > 0) {
      filters.status = statusArray;
    }
  }

  // Team Search (query)
  const query = searchParams.get(URL_PARAM_KEYS.teamSearch);
  if (query) {
    filters.teamSearch = decodeURIComponent(query);
  }

  return filters;
}

/**
 * Serialize filter state to URL search params
 * Only includes non-default values
 */
export function serializeFiltersToURL(filters: ScheduleFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Phase (skip 'all' as it's the default)
  if (filters.phase !== 'all') {
    params.set(URL_PARAM_KEYS.phase, filters.phase);
  }

  // Group
  if (filters.group) {
    params.set(URL_PARAM_KEYS.group, filters.group);
  }

  // Field
  if (filters.field !== null) {
    params.set(URL_PARAM_KEYS.field, filters.field.toString());
  }

  // Status (comma-separated)
  if (filters.status.length > 0) {
    params.set(URL_PARAM_KEYS.status, filters.status.join(','));
  }

  // Team Search
  if (filters.teamSearch) {
    params.set(URL_PARAM_KEYS.teamSearch, encodeURIComponent(filters.teamSearch));
  }

  return params;
}

/**
 * Check if filters are all default values
 */
function areFiltersDefault(filters: ScheduleFilters): boolean {
  return (
    filters.phase === DEFAULT_FILTERS.phase &&
    filters.group === DEFAULT_FILTERS.group &&
    filters.field === DEFAULT_FILTERS.field &&
    filters.status.length === DEFAULT_FILTERS.status.length &&
    filters.teamSearch === DEFAULT_FILTERS.teamSearch
  );
}

// =============================================================================
// Hook Interface
// =============================================================================

export interface UseURLFilterSyncOptions {
  /** Enable URL sync (default: true) */
  enabled?: boolean;
  /** Debounce URL updates (ms, default: 300) */
  debounceMs?: number;
}

export interface UseURLFilterSyncReturn {
  /** Get initial filters from URL (call on mount) */
  getInitialFilters: () => Partial<ScheduleFilters>;
  /** Update URL to match current filters */
  syncToURL: (filters: ScheduleFilters) => void;
  /** Check if URL has filter params */
  hasURLFilters: () => boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useURLFilterSync(
  options: UseURLFilterSyncOptions = {}
): UseURLFilterSyncReturn {
  const { enabled = true, debounceMs = 300 } = options;

  // React Router hooks - works correctly with HashRouter
  const location = useLocation();
  const navigate = useNavigate();

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we're currently updating from URL to avoid loops
  const isUpdatingFromURL = useRef(false);

  // Get initial filters from current URL (using react-router's location.search)
  const getInitialFilters = useCallback((): Partial<ScheduleFilters> => {
    if (!enabled) {
      return {};
    }

    // Use location.search from react-router (works with HashRouter)
    const searchParams = new URLSearchParams(location.search);
    return parseURLFilters(searchParams);
  }, [enabled, location.search]);

  // Check if URL has filter params
  const hasURLFilters = useCallback((): boolean => {
    if (!enabled) {
      return false;
    }

    const searchParams = new URLSearchParams(location.search);
    return Object.values(URL_PARAM_KEYS).some(key => searchParams.has(key));
  }, [enabled, location.search]);

  // Sync filters to URL (debounced, using react-router's navigate)
  const syncToURL = useCallback(
    (filters: ScheduleFilters) => {
      if (!enabled) {
        return;
      }

      // Don't update URL if we're currently reading from it
      if (isUpdatingFromURL.current) {
        return;
      }

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const newParams = serializeFiltersToURL(filters);
        const currentParams = new URLSearchParams(location.search);

        // Preserve non-filter params (like matchId)
        const preservedKeys = ['matchId'];
        preservedKeys.forEach(key => {
          const value = currentParams.get(key);
          if (value) {
            newParams.set(key, value);
          }
        });

        // Build new search string
        let newSearch: string;

        if (areFiltersDefault(filters)) {
          // Keep only preserved params if filters are default
          const preservedParams = new URLSearchParams();
          preservedKeys.forEach(key => {
            const value = currentParams.get(key);
            if (value) {
              preservedParams.set(key, value);
            }
          });
          newSearch = preservedParams.toString();
        } else {
          newSearch = newParams.toString();
        }

        // Only update if changed
        if (newSearch !== currentParams.toString()) {
          // Use react-router's navigate with replace to update URL
          const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
          void navigate(newPath, { replace: true });
        }
      }, debounceMs);
    },
    [enabled, debounceMs, location.search, location.pathname, navigate]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    getInitialFilters,
    syncToURL,
    hasURLFilters,
  };
}

export default useURLFilterSync;

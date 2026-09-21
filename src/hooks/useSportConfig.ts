/**
 * useSportConfig Hook
 *
 * React hook for accessing sport-specific configuration.
 * Provides memoized access to sport terminology, defaults, rules, and features.
 */

import { useCallback, useMemo } from 'react';
import {
  SportId,
  SportConfig,
  SportTerminology,
  SportDefaults,
  SportRules,
  SportFeatures,
  AgeClassOption,
  SportValidation,
  getSportConfig,
  legacySportToSportId,
} from '../config/sports';
import { Tournament } from '../types/tournament';
import { useSportTerms } from './useSportTerms';

interface UseSportConfigReturn {
  /** Full sport configuration */
  config: SportConfig;
  /** Sport-specific terminology */
  terminology: SportTerminology;
  /** Sport defaults */
  defaults: SportDefaults;
  /** Sport rules */
  rules: SportRules;
  /** Sport features */
  features: SportFeatures;
  /** Available age classes */
  ageClasses: AgeClassOption[];
  /** Validation constraints */
  validation: SportValidation;
  /** Helper: Get localized field name */
  getFieldName: (count?: number) => string;
  /** Helper: Get localized goal name */
  getGoalName: (count?: number) => string;
  /** Helper: Get localized period name */
  getPeriodName: (count?: number) => string;
  /** Helper: Get localized match name */
  getMatchName: (count?: number) => string;
  /** Helper: Get localized team name */
  getTeamName: (count?: number) => string;
}

/**
 * Hook to access sport configuration by SportId
 *
 * @param sportId - The sport ID to get configuration for
 * @returns Sport configuration with helper functions
 *
 * @example
 * ```tsx
 * const { terminology, features, getGoalName } = useSportConfig('football-indoor');
 * console.log(getGoalName(3)); // "Tore"
 * ```
 */
export function useSportConfig(sportId: SportId | undefined): UseSportConfigReturn {
  const config = useMemo(() => getSportConfig(sportId), [sportId]);
  const { term } = useSportTerms(sportId);

  const terminology = config.terminology;
  const defaults = config.defaults;
  const rules = config.rules;
  const features = config.features;
  const ageClasses = config.ageClasses;
  const validation = config.validation;

  // Helper functions for pluralization — lösen über useSportTerms gegen
  // sport.json auf (Kontext = sportId, Fallback auf Basis-Terminologie).
  // `count ?? 2` erhält das bisherige Verhalten: ohne explizite Angabe wird
  // die Pluralform geliefert, wie zuvor beim direkten Config-Zugriff.
  const getFieldName = useCallback(
    (count?: number) => term('terminology.field', { count: count ?? 2 }),
    [term]
  );

  const getGoalName = useCallback(
    (count?: number) => term('terminology.goal', { count: count ?? 2 }),
    [term]
  );

  const getPeriodName = useCallback(
    (count?: number) => term('terminology.period', { count: count ?? 2 }),
    [term]
  );

  const getMatchName = useCallback(
    (count?: number) => term('terminology.match', { count: count ?? 2 }),
    [term]
  );

  const getTeamName = useCallback(
    (count?: number) => term('terminology.team', { count: count ?? 2 }),
    [term]
  );

  return {
    config,
    terminology,
    defaults,
    rules,
    features,
    ageClasses,
    validation,
    getFieldName,
    getGoalName,
    getPeriodName,
    getMatchName,
    getTeamName,
  };
}

/**
 * Hook to access sport configuration from a Tournament object
 *
 * @param tournament - Tournament object (uses sportId or falls back to legacy sport field)
 * @returns Sport configuration with helper functions
 *
 * @example
 * ```tsx
 * const { terminology, features } = useSportConfigFromTournament(tournament);
 * ```
 */
export function useSportConfigFromTournament(
  tournament: Pick<Tournament, 'sport'> & { sportId?: SportId }
): UseSportConfigReturn {
  // Use new sportId field if available, otherwise convert legacy sport field
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional for BC with old tournaments
  const sportId = tournament.sportId ?? legacySportToSportId(tournament.sport);
  return useSportConfig(sportId);
}

/**
 * Hook to get just the terminology for a sport
 * Lighter weight than full useSportConfig if you only need terminology
 *
 * @param sportId - The sport ID
 * @returns Sport terminology
 */
export function useSportTerminology(sportId: SportId | undefined): SportTerminology {
  return useMemo(() => getSportConfig(sportId).terminology, [sportId]);
}

/**
 * Hook to check if a feature is enabled for a sport
 *
 * @param sportId - The sport ID
 * @param feature - The feature to check
 * @returns Whether the feature is enabled
 *
 * @example
 * ```tsx
 * const hasGoalAnimation = useSportFeature('football-indoor', 'hasGoalAnimation');
 * ```
 */
export function useSportFeature(
  sportId: SportId | undefined,
  feature: keyof SportFeatures
): boolean {
  return useMemo(() => getSportConfig(sportId).features[feature], [sportId, feature]);
}

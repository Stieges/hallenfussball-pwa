/**
 * Sport Configuration Registry
 *
 * Central registry for all sport configurations.
 * Provides helper functions for accessing sport-specific settings.
 */

import { SportConfig, SportId } from './types';
import { footballIndoorConfig, footballOutdoorConfig } from './football';

// Re-export types
export * from './types';
export { footballIndoorConfig, footballOutdoorConfig };

/**
 * Sport Configuration Registry
 * Maps SportId to SportConfig for quick lookup
 */
export const sportRegistry = new Map<SportId, SportConfig>([
  ['football-indoor', footballIndoorConfig],
  ['football-outdoor', footballOutdoorConfig],
  // Future sports will be added here:
  // ['handball', handballConfig],
  // ['basketball', basketballConfig],
  // ['volleyball', volleyballConfig],
  // ['floorball', floorballConfig],
  // ['hockey-indoor', hockeyIndoorConfig],
  // ['hockey-outdoor', hockeyOutdoorConfig],
]);

/**
 * Default sport ID used when no sport is specified
 */
export const DEFAULT_SPORT_ID: SportId = 'football-indoor';

/**
 * Get sport configuration by ID
 * Falls back to football-indoor if sport not found
 */
export function getSportConfig(sportId: SportId | undefined): SportConfig {
  if (!sportId) {
    return footballIndoorConfig;
  }

  const config = sportRegistry.get(sportId);
  if (!config) {
    console.warn(`Sport config not found for "${sportId}", falling back to football-indoor`);
    return footballIndoorConfig;
  }

  return config;
}

/**
 * Get all available sports as an array
 */
export function getAvailableSports(): SportConfig[] {
  return Array.from(sportRegistry.values());
}

/**
 * Get sports grouped by category
 */
export function getSportsByCategory(): Record<SportConfig['category'], SportConfig[]> {
  const grouped: Record<SportConfig['category'], SportConfig[]> = {
    ball: [],
    team: [],
    individual: [],
    other: [],
  };

  for (const config of sportRegistry.values()) {
    grouped[config.category].push(config);
  }

  return grouped;
}

/**
 * Check if a sport ID is valid
 */
export function isValidSportId(sportId: string): sportId is SportId {
  return sportRegistry.has(sportId as SportId);
}

/**
 * Get terminology for a sport
 */
export function getSportTerminology(sportId: SportId | undefined) {
  return getSportConfig(sportId).terminology;
}

/**
 * Get defaults for a sport
 */
export function getSportDefaults(sportId: SportId | undefined) {
  return getSportConfig(sportId).defaults;
}

/**
 * Get rules for a sport
 */
export function getSportRules(sportId: SportId | undefined) {
  return getSportConfig(sportId).rules;
}

/**
 * Get features for a sport
 */
export function getSportFeatures(sportId: SportId | undefined) {
  return getSportConfig(sportId).features;
}

/**
 * Get age classes for a sport
 */
export function getSportAgeClasses(sportId: SportId | undefined) {
  return getSportConfig(sportId).ageClasses;
}

/**
 * Get validation constraints for a sport
 */
export function getSportValidation(sportId: SportId | undefined) {
  return getSportConfig(sportId).validation;
}

/**
 * Legacy compatibility: Map old Sport type to new SportId
 * @deprecated Use SportId directly in new code
 */
export function legacySportToSportId(sport: 'football' | 'other' | undefined): SportId {
  switch (sport) {
    case 'football':
      return 'football-indoor';
    case 'other':
      return 'custom';
    default:
      return DEFAULT_SPORT_ID;
  }
}

/**
 * Legacy compatibility: Map SportId back to old Sport type
 * @deprecated Use SportId directly in new code
 */
export function sportIdToLegacySport(sportId: SportId): 'football' | 'other' {
  if (sportId.startsWith('football')) {
    return 'football';
  }
  return 'other';
}

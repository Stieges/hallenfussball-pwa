/**
 * ConflictResolver - Handles sync conflicts between local and remote data
 *
 * Conflict Resolution Strategies:
 * - 'local': Keep local version, discard remote changes
 * - 'remote': Keep remote version, discard local changes
 * - 'merge': Attempt automatic merge using timestamps (newest wins per field)
 *
 * For manual resolution, the UI should present both versions to the user
 * and allow them to choose or manually merge.
 */

import { Tournament, Match, Team } from '../../types/tournament';
import { SyncConflict, ConflictResolutionStrategy } from './types';

/**
 * Result of a conflict resolution attempt
 */
export interface ConflictResult<T> {
  /** The resolved data */
  resolved: T;

  /** Whether there was actually a conflict */
  hadConflict: boolean;

  /** Strategy that was used to resolve */
  strategy: ConflictResolutionStrategy;

  /** Fields that were merged (only for 'merge' strategy) */
  mergedFields?: string[];

  /** Fields where local version was kept (during merge) */
  localWins?: string[];

  /** Fields where remote version was kept (during merge) */
  remoteWins?: string[];
}

/**
 * Metadata for tracking changes
 */
interface VersionedEntity {
  updatedAt: string;
  version?: number;
}

/**
 * Get the update timestamp from an entity
 */
function getUpdatedAt(entity: VersionedEntity): Date {
  return new Date(entity.updatedAt);
}

/**
 * Compare two versions using optimistic locking version number
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(
  a: VersionedEntity,
  b: VersionedEntity
): -1 | 0 | 1 {
  // If both have version numbers, use those
  if (a.version !== undefined && b.version !== undefined) {
    if (a.version < b.version) {return -1;}
    if (a.version > b.version) {return 1;}
    return 0;
  }

  // Fall back to timestamp comparison
  const timeA = getUpdatedAt(a).getTime();
  const timeB = getUpdatedAt(b).getTime();

  if (timeA < timeB) {return -1;}
  if (timeA > timeB) {return 1;}
  return 0;
}

/**
 * Check if two values are deeply equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {return true;}

  if (typeof a !== typeof b) {return false;}

  if (a === null || b === null) {return a === b;}

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {return false;}
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) {return false;}

    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Fields that should never be auto-merged (require manual review)
 */
const SENSITIVE_FIELDS: (keyof Tournament)[] = [
  'matches',
  'teams',
  'status',
  'deletedAt',
];

/**
 * Fields that are safe to auto-merge (take newest)
 */
const MERGEABLE_FIELDS: (keyof Tournament)[] = [
  'title',
  'ageClass',
  'location',
  'organizer',
  'contactInfo',
  'adminNotes',
  'groupPhaseGameDuration',
  'groupPhaseBreakDuration',
  'finalRoundGameDuration',
  'finalRoundBreakDuration',
  'breakBetweenPhases',
  'gamePeriods',
  'halftimeBreak',
  'matchCockpitSettings',
  'isPublic',
];

/**
 * Resolve a tournament conflict
 */
export function resolveTournamentConflict(
  local: Tournament,
  remote: Tournament,
  strategy: ConflictResolutionStrategy
): ConflictResult<Tournament> {
  // Check if there's actually a conflict
  const comparison = compareVersions(local, remote);

  // No conflict if versions are identical
  if (comparison === 0 && deepEqual(local, remote)) {
    return {
      resolved: local,
      hadConflict: false,
      strategy,
    };
  }

  switch (strategy) {
    case 'local':
      return {
        resolved: {
          ...local,
          // Increment version for optimistic locking
          version: Math.max(local.version ?? 0, remote.version ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        },
        hadConflict: true,
        strategy: 'local',
      };

    case 'remote':
      return {
        resolved: remote,
        hadConflict: true,
        strategy: 'remote',
      };

    case 'merge':
      return mergeTournaments(local, remote);

    default:
      throw new Error(`Unknown conflict resolution strategy: ${strategy as string}`);
  }
}

/**
 * Attempt to merge two tournament versions
 * Uses "newest wins" for individual fields
 */
function mergeTournaments(
  local: Tournament,
  remote: Tournament
): ConflictResult<Tournament> {
  const localTime = getUpdatedAt(local).getTime();
  const remoteTime = getUpdatedAt(remote).getTime();

  // Start with the newer version as base
  const base = localTime >= remoteTime ? local : remote;
  // Note: 'other' would be: localTime >= remoteTime ? remote : local

  const merged = { ...base };
  const mergedFields: string[] = [];
  const localWins: string[] = [];
  const remoteWins: string[] = [];

  // Merge safe fields (take from whichever was updated more recently)
  for (const field of MERGEABLE_FIELDS) {
    const localValue = local[field];
    const remoteValue = remote[field];

    if (!deepEqual(localValue, remoteValue)) {
      // For merge, take from the newer version
      // Using indexed access to avoid TypeScript union type assignment issues
      if (localTime >= remoteTime) {
        (merged as Record<string, unknown>)[field] = localValue;
        localWins.push(field);
      } else {
        (merged as Record<string, unknown>)[field] = remoteValue;
        remoteWins.push(field);
      }
      mergedFields.push(field);
    }
  }

  // For sensitive fields, check if they differ
  const hasSensitiveConflicts = SENSITIVE_FIELDS.some(
    (field) => !deepEqual(local[field], remote[field])
  );

  // If there are sensitive conflicts, we can't fully auto-merge
  // The caller should handle this by prompting the user
  if (hasSensitiveConflicts) {
    // For matches and teams, we need special handling
    if (!deepEqual(local.matches, remote.matches)) {
      merged.matches = mergeMatches(local.matches, remote.matches, localTime, remoteTime);
      mergedFields.push('matches');
    }

    if (!deepEqual(local.teams, remote.teams)) {
      merged.teams = mergeTeams(local.teams, remote.teams);
      mergedFields.push('teams');
    }
  }

  // Update metadata
  merged.version = Math.max(local.version ?? 0, remote.version ?? 0) + 1;
  merged.updatedAt = new Date().toISOString();

  return {
    resolved: merged,
    hadConflict: true,
    strategy: 'merge',
    mergedFields,
    localWins,
    remoteWins,
  };
}

/**
 * Merge match arrays
 * Uses match ID to correlate, then merges individual matches
 */
function mergeMatches(
  localMatches: Match[],
  remoteMatches: Match[],
  localTime: number,
  remoteTime: number
): Match[] {
  const remoteById = new Map(remoteMatches.map((m) => [m.id, m]));
  const localById = new Map(localMatches.map((m) => [m.id, m]));
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

  const merged: Match[] = [];

  for (const id of allIds) {
    const localMatch = localById.get(id);
    const remoteMatch = remoteById.get(id);

    if (localMatch && remoteMatch) {
      // Both have the match - merge based on which has results
      merged.push(mergeMatch(localMatch, remoteMatch, localTime, remoteTime));
    } else if (localMatch) {
      // Only in local (new match created locally)
      merged.push(localMatch);
    } else if (remoteMatch) {
      // Only in remote (new match from server)
      merged.push(remoteMatch);
    }
  }

  // Sort by match number to maintain order
  return merged.sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
}

/**
 * Merge two versions of the same match
 */
function mergeMatch(
  local: Match,
  remote: Match,
  localTime: number,
  remoteTime: number
): Match {
  // If one has results and the other doesn't, take the one with results
  const localHasScore = local.scoreA !== undefined && local.scoreB !== undefined;
  const remoteHasScore = remote.scoreA !== undefined && remote.scoreB !== undefined;

  if (localHasScore && !remoteHasScore) {
    return local;
  }
  if (remoteHasScore && !localHasScore) {
    return remote;
  }

  // Both have scores or neither has scores
  // Check if match is finished - finished matches take priority
  if (local.matchStatus === 'finished' && remote.matchStatus !== 'finished') {
    return local;
  }
  if (remote.matchStatus === 'finished' && local.matchStatus !== 'finished') {
    return remote;
  }

  // Both finished or both not finished - use timestamp
  // If local has finishedAt, compare those; otherwise use parent times
  const localFinished = local.finishedAt ? new Date(local.finishedAt).getTime() : localTime;
  const remoteFinished = remote.finishedAt ? new Date(remote.finishedAt).getTime() : remoteTime;

  return localFinished >= remoteFinished ? local : remote;
}

/**
 * Merge team arrays
 * Uses team ID to correlate
 */
function mergeTeams(localTeams: Team[], remoteTeams: Team[]): Team[] {
  const remoteById = new Map(remoteTeams.map((t) => [t.id, t]));
  const localById = new Map(localTeams.map((t) => [t.id, t]));
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

  const merged: Team[] = [];

  for (const id of allIds) {
    const localTeam = localById.get(id);
    const remoteTeam = remoteById.get(id);

    if (localTeam && remoteTeam) {
      // Both have the team - merge
      // Prefer local changes for team metadata (name, logo, colors)
      // but respect removal status from either side
      merged.push({
        ...remoteTeam,
        ...localTeam,
        // If either marks as removed, keep removed
        isRemoved: localTeam.isRemoved || remoteTeam.isRemoved,
        removedAt: localTeam.removedAt || remoteTeam.removedAt,
      });
    } else if (localTeam) {
      merged.push(localTeam);
    } else if (remoteTeam) {
      merged.push(remoteTeam);
    }
  }

  return merged;
}

/**
 * Resolve a match conflict (for individual match updates)
 */
export function resolveMatchConflict(
  local: Match,
  remote: Match,
  strategy: ConflictResolutionStrategy
): ConflictResult<Match> {
  // Check if there's actually a conflict
  if (deepEqual(local, remote)) {
    return {
      resolved: local,
      hadConflict: false,
      strategy,
    };
  }

  switch (strategy) {
    case 'local':
      return {
        resolved: local,
        hadConflict: true,
        strategy: 'local',
      };

    case 'remote':
      return {
        resolved: remote,
        hadConflict: true,
        strategy: 'remote',
      };

    case 'merge': {
      // For individual matches, use the more complete version
      const localHasResults = local.scoreA !== undefined && local.scoreB !== undefined;
      const remoteHasResults = remote.scoreA !== undefined && remote.scoreB !== undefined;

      if (localHasResults && !remoteHasResults) {
        return { resolved: local, hadConflict: true, strategy: 'merge' };
      }
      if (remoteHasResults && !localHasResults) {
        return { resolved: remote, hadConflict: true, strategy: 'merge' };
      }

      // Both have results or neither - prefer finished over unfinished
      if (local.matchStatus === 'finished' && remote.matchStatus !== 'finished') {
        return { resolved: local, hadConflict: true, strategy: 'merge' };
      }
      if (remote.matchStatus === 'finished' && local.matchStatus !== 'finished') {
        return { resolved: remote, hadConflict: true, strategy: 'merge' };
      }

      // Both same status - use finishedAt or fall back to local
      if (local.finishedAt && remote.finishedAt) {
        const resolved =
          new Date(local.finishedAt) >= new Date(remote.finishedAt) ? local : remote;
        return { resolved, hadConflict: true, strategy: 'merge' };
      }

      // Default to local
      return { resolved: local, hadConflict: true, strategy: 'merge' };
    }

    default:
      throw new Error(`Unknown strategy: ${strategy as string}`);
  }
}

/**
 * Create a SyncConflict object for UI display
 */
export function createSyncConflict(
  local: Tournament,
  remote: Tournament,
  conflictType: 'update' | 'delete' = 'update'
): SyncConflict {
  return {
    localVersion: local,
    remoteVersion: remote,
    conflictType,
    timestamp: new Date(),
  };
}

/**
 * Determine if manual resolution is required
 * Returns true if auto-merge would lose important data
 */
export function requiresManualResolution(
  local: Tournament,
  remote: Tournament
): boolean {
  // Check for conflicting match results
  const localMatches = new Map(local.matches.map((m) => [m.id, m]));

  for (const remoteMatch of remote.matches) {
    const localMatch = localMatches.get(remoteMatch.id);
    if (!localMatch) {continue;}

    // Both have different scores - needs manual resolution
    const localHasScore = localMatch.scoreA !== undefined && localMatch.scoreB !== undefined;
    const remoteHasScore = remoteMatch.scoreA !== undefined && remoteMatch.scoreB !== undefined;

    if (localHasScore && remoteHasScore) {
      if (localMatch.scoreA !== remoteMatch.scoreA || localMatch.scoreB !== remoteMatch.scoreB) {
        // Different scores - this is a real conflict
        // Unless one is finished and one isn't
        if (localMatch.matchStatus === 'finished' && remoteMatch.matchStatus === 'finished') {
          return true;
        }
      }
    }
  }

  // Check for conflicting tournament status
  if (local.status !== remote.status) {
    // Draft -> Published is fine, but Published -> Draft needs manual
    if (local.status === 'draft' && remote.status === 'published') {
      return false; // Remote wins
    }
    if (local.status === 'published' && remote.status === 'draft') {
      return true; // Conflict!
    }
  }

  // Check for deletion conflicts
  if ((local.deletedAt && !remote.deletedAt) || (!local.deletedAt && remote.deletedAt)) {
    return true;
  }

  return false;
}

/**
 * Get a human-readable description of what differs between versions
 */
export function describeConflict(local: Tournament, remote: Tournament): string[] {
  const differences: string[] = [];

  // Title
  if (local.title !== remote.title) {
    differences.push(`Titel: "${local.title}" vs "${remote.title}"`);
  }

  // Status
  if (local.status !== remote.status) {
    differences.push(`Status: ${local.status} vs ${remote.status}`);
  }

  // Matches with different scores
  const localMatches = new Map(local.matches.map((m) => [m.id, m]));
  let matchConflicts = 0;

  for (const remoteMatch of remote.matches) {
    const localMatch = localMatches.get(remoteMatch.id);
    if (!localMatch) {continue;}

    const localHasScore = localMatch.scoreA !== undefined;
    const remoteHasScore = remoteMatch.scoreA !== undefined;

    if (localHasScore && remoteHasScore) {
      if (localMatch.scoreA !== remoteMatch.scoreA || localMatch.scoreB !== remoteMatch.scoreB) {
        matchConflicts++;
      }
    }
  }

  if (matchConflicts > 0) {
    differences.push(`${matchConflicts} Spiel(e) mit unterschiedlichen Ergebnissen`);
  }

  // Teams
  if (local.teams.length !== remote.teams.length) {
    differences.push(`Teams: ${local.teams.length} vs ${remote.teams.length}`);
  }

  // Deletion
  if (local.deletedAt && !remote.deletedAt) {
    differences.push('Lokal gelöscht, auf Server noch vorhanden');
  } else if (!local.deletedAt && remote.deletedAt) {
    differences.push('Auf Server gelöscht, lokal noch vorhanden');
  }

  return differences;
}

/**
 * Guest Migration Service
 *
 * Handles migration of local (guest) tournament data to Supabase
 * when a user logs in or registers.
 *
 * Flow:
 * 1. Load all tournaments from localStorage
 * 2. Check which ones don't exist in Supabase (guest-created)
 * 3. Upload each to Supabase with the new user as owner
 * 4. Delete from localStorage after successful upload
 *
 * @see docs/TODO.md - Guest Data Migration section
 */

import { Tournament } from '../../../types/tournament';
import { LocalStorageRepository } from '../../../core/repositories/LocalStorageRepository';
import { SupabaseRepository } from '../../../core/repositories/SupabaseRepository';
import { isSupabaseConfigured } from '../../../lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface MigrationResult {
  /** Overall success (true if all tournaments migrated or no migrations needed) */
  success: boolean;
  /** Number of tournaments successfully migrated */
  migratedCount: number;
  /** Number of tournaments that failed to migrate */
  failedCount: number;
  /** Error messages for failed migrations */
  errors: string[];
  /** Titles of successfully migrated tournaments */
  migratedTitles: string[];
}

export interface MigrationProgress {
  /** Current tournament being migrated (1-indexed) */
  current: number;
  /** Total number of tournaments to migrate */
  total: number;
  /** Title of current tournament */
  currentTitle: string;
}

export type ProgressCallback = (progress: MigrationProgress) => void;

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Get all local tournaments that should be migrated
 * (tournaments that exist only in localStorage, not in Supabase)
 */
export async function getLocalTournamentsToMigrate(): Promise<Tournament[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const localRepo = new LocalStorageRepository();
  const supabaseRepo = new SupabaseRepository();

  // Get all local tournaments
  const localTournaments = await localRepo.listForCurrentUser();

  if (localTournaments.length === 0) {
    return [];
  }

  // Get tournaments already in Supabase for this user
  let cloudTournamentIds: Set<string>;
  try {
    const cloudTournaments = await supabaseRepo.listForCurrentUser();
    cloudTournamentIds = new Set(cloudTournaments.map((t) => t.id));
  } catch {
    // If we can't fetch cloud tournaments, assume all local ones need migration
    cloudTournamentIds = new Set();
  }

  // Filter to tournaments that don't exist in cloud
  return localTournaments.filter((t) => !cloudTournamentIds.has(t.id));
}

/**
 * Migrate a single tournament to Supabase
 */
async function migrateTournament(
  tournament: Tournament,
  supabaseRepo: SupabaseRepository,
  localRepo: LocalStorageRepository
): Promise<{ success: boolean; error?: string }> {
  try {
    // Save to Supabase (this will set owner_id from current user)
    await supabaseRepo.save(tournament);

    // Delete from localStorage after successful save
    await localRepo.delete(tournament.id);

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    if (import.meta.env.DEV) { console.error(`Failed to migrate tournament "${tournament.title}":`, error); }
    return { success: false, error: message };
  }
}

/**
 * Migrate all local (guest) tournaments to Supabase
 *
 * Should be called after successful login or registration.
 *
 * @param userId - The authenticated user's ID (for logging)
 * @param onProgress - Optional callback for progress updates
 * @returns Migration result with counts and any errors
 *
 * @example
 * ```typescript
 * const result = await migrateGuestTournaments(user.id, (progress) => {
 *   console.log(`Migrating ${progress.current}/${progress.total}: ${progress.currentTitle}`);
 * });
 *
 * if (result.migratedCount > 0) {
 *   showToast(`${result.migratedCount} Turnier(e) synchronisiert`);
 * }
 * ```
 */
export async function migrateGuestTournaments(
  onProgress?: ProgressCallback
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    failedCount: 0,
    errors: [],
    migratedTitles: [],
  };

  // Check if Supabase is configured
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) { console.warn('Guest migration skipped: Supabase not configured'); }
    return result;
  }

  // Get tournaments to migrate
  const tournamentsToMigrate = await getLocalTournamentsToMigrate();

  if (tournamentsToMigrate.length === 0) {
    return result;
  }

  const supabaseRepo = new SupabaseRepository();
  const localRepo = new LocalStorageRepository();

  // Migrate each tournament
  for (let i = 0; i < tournamentsToMigrate.length; i++) {
    const tournament = tournamentsToMigrate[i];

    // Report progress
    onProgress?.({
      current: i + 1,
      total: tournamentsToMigrate.length,
      currentTitle: tournament.title,
    });

    const migrationResult = await migrateTournament(
      tournament,
      supabaseRepo,
      localRepo
    );

    if (migrationResult.success) {
      result.migratedCount++;
      result.migratedTitles.push(tournament.title);
    } else {
      result.failedCount++;
      result.errors.push(
        `"${tournament.title}": ${migrationResult.error ?? 'Unknown error'}`
      );
    }
  }

  // Set overall success
  result.success = result.failedCount === 0;

  return result;
}

/**
 * Check if there are any local tournaments that need migration
 */
export async function hasLocalTournamentsToMigrate(): Promise<boolean> {
  const tournaments = await getLocalTournamentsToMigrate();
  return tournaments.length > 0;
}

/**
 * Get count of local tournaments that need migration
 */
export async function getLocalTournamentsMigrationCount(): Promise<number> {
  const tournaments = await getLocalTournamentsToMigrate();
  return tournaments.length;
}

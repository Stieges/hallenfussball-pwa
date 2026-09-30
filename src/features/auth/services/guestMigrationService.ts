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
import { hasGuestEngineEntries } from '../../../core/match/client/guestEngineEntries';
import { notifyGuestTournamentHidden } from '../../../core/services/guestTournamentNotices';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { captureFeatureError } from '../../../lib/sentry';

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
  /** G7: Number of tournaments skipped because they have guest engine entries */
  skippedCount: number;
  /** G7: Titles of the skipped tournaments */
  skippedTitles: string[];
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
 * Get all local tournaments that are not yet in the cloud (raw migration candidates).
 * G7 filter is NOT applied here — see `getLocalTournamentsToMigrate` and
 * `migrateGuestTournaments` (skip + hint).
 */
async function getLocalCandidates(): Promise<Tournament[]> {
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
 * M2 (task-C3b2-review.md): einzige Stelle, die Kandidaten in migrierbar/übersprungen/
 * fehlgeschlagen einteilt — sowohl `getLocalTournamentsToMigrate` (Zähler-Aufrufer:
 * `hasLocalTournamentsToMigrate`/`getLocalTournamentsMigrationCount`) als auch
 * `migrateGuestTournaments` nutzen dieselbe Quelle (vorher: zwei duplizierte Schleifen,
 * eine davon mit leerem `catch`, die bei einem Lesefehler zu wenig zählte). Ein
 * Lesefehler zählt immer als fehlgeschlagen (nie stillschweigend übersprungen) und
 * geht an Sentry — `captureFeatureError` ist hier erlaubt (diese Datei liegt unter
 * `src/features/auth/services/`, nicht unter `src/core/`, das `lib/sentry` nicht
 * importieren darf).
 */
interface LocalCandidateClassification {
  migratable: Tournament[];
  skipped: Tournament[];
  failedCount: number;
  errors: string[];
}

async function classifyLocalCandidates(
  candidates: Tournament[]
): Promise<LocalCandidateClassification> {
  const migratable: Tournament[] = [];
  const skipped: Tournament[] = [];
  const errors: string[] = [];
  let failedCount = 0;
  for (const tournament of candidates) {
    let hasEntries: boolean;
    try {
      hasEntries = await hasGuestEngineEntries(tournament);
    } catch (error) {
      // PC29: Lesefehler ist kein sicheres „nein" — das Turnier zaehlt als
      // fehlgeschlagen (nicht migrierbar in dieser Runde), nie als leiser Erfolg.
      failedCount++;
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`"${tournament.title}": ${message}`);
      captureFeatureError(
        error instanceof Error ? error : new Error(message),
        'guestMigration',
        'classifyLocalCandidates',
        { tournamentId: tournament.id }
      );
      continue;
    }
    if (hasEntries) {
      skipped.push(tournament);
    } else {
      migratable.push(tournament);
    }
  }
  return { migratable, skipped, failedCount, errors };
}

/**
 * Get all local tournaments that should be migrated
 * (tournaments that exist only in localStorage, not in Supabase).
 * G7: Tournaments with guest engine entries are never migrated — they must stay
 * local (and are not listed here, so counts stay truthful).
 */
export async function getLocalTournamentsToMigrate(): Promise<Tournament[]> {
  const candidates = await getLocalCandidates();
  const { migratable } = await classifyLocalCandidates(candidates);
  return migratable;
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
    skippedCount: 0,
    skippedTitles: [],
  };

  // Check if Supabase is configured
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) { console.warn('Guest migration skipped: Supabase not configured'); }
    return result;
  }

  // G7: tournaments with guest engine entries are never uploaded — skip them
  // (the upload would strand the local engine entries outside the account).
  // M2: dieselbe Klassifizierung wie getLocalTournamentsToMigrate (eine Quelle für
  // beide Zähler) — ein Lesefehler zählt hier wie dort als fehlgeschlagen, nie als
  // leerer catch.
  const candidates = await getLocalCandidates();
  const classification = await classifyLocalCandidates(candidates);
  result.failedCount += classification.failedCount;
  result.errors.push(...classification.errors);
  for (const tournament of classification.skipped) {
    result.skippedCount++;
    result.skippedTitles.push(tournament.title);
    // G7: einmaliger Hinweis „nur im Gastmodus nutzbar – kann ins Konto
    // übernommen werden" (Kanal dedupliziert je Turnier-ID).
    notifyGuestTournamentHidden({ tournamentId: tournament.id, title: tournament.title });
  }
  const tournamentsToMigrate: Tournament[] = classification.migratable;

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

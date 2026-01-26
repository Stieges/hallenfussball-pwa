import { useEffect, useRef } from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';
import { LocalStorageRepository } from '../core/repositories/LocalStorageRepository';
import { SupabaseRepository } from '../core/repositories/SupabaseRepository';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * Syncs localStorage tournaments to Supabase after first login.
 *
 * This hook runs once per session when:
 * 1. User is authenticated (not guest)
 * 2. Supabase is configured
 * 3. Hasn't synced before in this session
 *
 * It uploads all local tournaments that either:
 * - Have no ownerId
 * - Have ownerId = 'guest'
 *
 * This ensures that tournaments created before login get properly
 * synced to Supabase, including their share codes.
 */
export function useInitialSync(): void {
  const { user, isAuthenticated, isGuest } = useAuth();
  const hasSynced = useRef(false);

  useEffect(() => {
    // Guard conditions
    if (!isAuthenticated || isGuest || !user || hasSynced.current) {
      return;
    }
    if (!isSupabaseConfigured) {
      return;
    }

    hasSynced.current = true;

    const syncLocalToCloud = async () => {
      try {
        const localRepo = new LocalStorageRepository();
        const supabaseRepo = new SupabaseRepository();

        // Get all local tournaments
        const localTournaments = await localRepo.listForCurrentUser();

        if (localTournaments.length === 0) {
          return;
        }

        if (import.meta.env.DEV) {
          console.warn(`[useInitialSync] Found ${localTournaments.length} local tournaments, checking for sync...`);
        }

        let syncedCount = 0;

        for (const tournament of localTournaments) {
          // Skip if already has owner (already synced)
          if (tournament.ownerId && tournament.ownerId !== 'guest') {
            continue;
          }

          try {
            // Check if exists in Supabase
            const exists = await supabaseRepo.get(tournament.id);

            if (exists) {
              // Already in cloud - just update local owner reference
              await localRepo.save({
                ...tournament,
                ownerId: user.id,
              });
              continue;
            }

            // Upload to Supabase with current user as owner
            const tournamentWithOwner = {
              ...tournament,
              ownerId: user.id,
            };

            await supabaseRepo.save(tournamentWithOwner);

            // Update local copy with owner
            await localRepo.save(tournamentWithOwner);

            syncedCount++;

            if (import.meta.env.DEV) {
              console.warn(`[useInitialSync] Synced tournament: ${tournament.title}`);
            }
          } catch (error) {
            // Log but continue with other tournaments
            console.error(`[useInitialSync] Failed to sync tournament ${tournament.id}:`, error);
          }
        }

        if (syncedCount > 0 && import.meta.env.DEV) {
          console.warn(`[useInitialSync] Synced ${syncedCount} tournament(s) to cloud`);
        }
      } catch (error) {
        console.error('[useInitialSync] Sync failed:', error);
        // Non-fatal - user can continue, sync will retry on next login
      }
    };

    void syncLocalToCloud();
  }, [isAuthenticated, isGuest, user]);
}

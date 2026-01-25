import { ILiveMatchRepository } from './ILiveMatchRepository';
import { LiveMatch } from '../models/LiveMatch';
import { STORAGE_KEYS } from '../../constants/storage';

/**
 * localStorage Implementation of ILiveMatchRepository
 *
 * Stores live match data per tournament in localStorage.
 * Key format: liveMatchData_{tournamentId}
 *
 * C-5 FIX: Uses Web Locks API for atomic read-modify-write operations
 * to prevent race conditions in multi-tab scenarios.
 */
export class LocalStorageLiveMatchRepository implements ILiveMatchRepository {

    // C-5 FIX: In-memory lock fallback for browsers without Web Locks API
    private static lockPromises = new Map<string, Promise<void>>();

    private getStorageKey(tournamentId: string): string {
        return STORAGE_KEYS.liveMatches(tournamentId);
    }

    /**
     * C-5 FIX: Acquire a lock for atomic operations
     * Uses Web Locks API if available, falls back to in-memory locking
     */
    private async withLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
        // Try Web Locks API first (better for multi-tab)
        if (typeof navigator !== 'undefined' && 'locks' in navigator) {
            return navigator.locks.request(lockName, async () => fn());
        }

        // Fallback: Simple in-memory lock (same-tab only)
        const existingLock = LocalStorageLiveMatchRepository.lockPromises.get(lockName);
        if (existingLock) {
            await existingLock;
        }

        let resolve: () => void = () => { /* no-op, will be replaced */ };
        const lockPromise = new Promise<void>(r => { resolve = r; });
        LocalStorageLiveMatchRepository.lockPromises.set(lockName, lockPromise);

        try {
            return await fn();
        } finally {
            resolve();
            LocalStorageLiveMatchRepository.lockPromises.delete(lockName);
        }
    }

    async get(tournamentId: string, matchId: string): Promise<LiveMatch | null> {
        const all = await this.getAll(tournamentId);
        return all.get(matchId) ?? null;
    }

    async getAll(tournamentId: string): Promise<Map<string, LiveMatch>> {
        try {
            const key = this.getStorageKey(tournamentId);
            const stored = localStorage.getItem(key);

            if (!stored) {
                return new Map();
            }

            const parsed = JSON.parse(stored) as Record<string, LiveMatch>;

            // Detect and handle stale matches
            const entries = Object.entries(parsed).map(([id, match]) => {
                const recovered = this.recoverStaleMatch(match);
                return [id, recovered] as [string, LiveMatch];
            });

            return new Map(entries);
        } catch (error) {
            console.error('[LocalStorageLiveMatchRepository] Failed to parse stored data:', error);
            return new Map();
        }
    }

    async save(tournamentId: string, match: LiveMatch): Promise<void> {
        const lockName = `live-match-${tournamentId}`;

        // C-5 FIX: Use lock to prevent read-modify-write race conditions
        await this.withLock(lockName, async () => {
            const all = await this.getAll(tournamentId);

            // Increment version for consistency with Supabase optimistic locking
            const updatedMatch: LiveMatch = {
                ...match,
                version: (match.version ?? 0) + 1,
            };

            all.set(match.id, updatedMatch);
            await this.saveAll(tournamentId, all);
        });
    }

    async saveAll(tournamentId: string, matches: Map<string, LiveMatch>): Promise<void> {
        try {
            const key = this.getStorageKey(tournamentId);
            const obj = Object.fromEntries(matches.entries());
            const data = JSON.stringify(obj);

            // Use safe storage with quota handling
            this.safeLocalStorageSet(key, data);
        } catch (error) {
            console.error('[LocalStorageLiveMatchRepository] Failed to save:', error);
            throw error;
        }
    }

    async delete(tournamentId: string, matchId: string): Promise<void> {
        const lockName = `live-match-${tournamentId}`;

        // C-5 FIX: Use lock to prevent race conditions
        await this.withLock(lockName, async () => {
            const all = await this.getAll(tournamentId);
            all.delete(matchId);
            await this.saveAll(tournamentId, all);
        });
    }

    async clear(tournamentId: string): Promise<void> {
        const key = this.getStorageKey(tournamentId);
        localStorage.removeItem(key);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    /**
     * Recover a match that was left in RUNNING state for too long
     * (e.g., browser closed during a match)
     */
    private recoverStaleMatch(match: LiveMatch): LiveMatch {
        if (match.status !== 'RUNNING' || !match.timerStartTime) {
            return match;
        }

        const now = Date.now();
        const timerStart = new Date(match.timerStartTime).getTime();
        const timeSinceStart = now - timerStart;

        const maxExpectedDuration = (match.durationSeconds + 300) * 1000; // +5 min buffer
        const MAX_STALE_MS = 30 * 60 * 1000; // 30 minutes

        if (timeSinceStart > maxExpectedDuration || timeSinceStart > MAX_STALE_MS) {
            if (import.meta.env.DEV) {
                console.warn(
                    `[LocalStorageLiveMatchRepository] Stale match detected: ${match.id}. ` +
                    `Timer started ${Math.round(timeSinceStart / 1000 / 60)} minutes ago. ` +
                    `Auto-pausing and clamping elapsed time.`
                );
            }

            const maxElapsed = match.durationSeconds;
            const calculatedElapsed = (match.timerElapsedSeconds ?? 0) + Math.floor(timeSinceStart / 1000);
            const clampedElapsed = Math.min(calculatedElapsed, maxElapsed);

            return {
                ...match,
                status: 'PAUSED',
                elapsedSeconds: clampedElapsed,
                timerElapsedSeconds: clampedElapsed,
                timerPausedAt: new Date().toISOString(),
            };
        }

        return match;
    }

    /**
     * Safe localStorage setter with quota handling (H-5 FIX)
     * On QuotaExceededError: cleanup old matches and retry
     */
    private safeLocalStorageSet(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                if (import.meta.env.DEV) {
                    console.warn('[LocalStorageLiveMatchRepository] Storage quota exceeded, attempting cleanup...');
                }

                // Try cleanup and retry once
                const freedBytes = this.cleanupOldMatches();
                if (freedBytes > 0) {
                    if (import.meta.env.DEV) {
                        console.warn(`[LocalStorageLiveMatchRepository] Freed ${freedBytes} bytes, retrying save...`);
                    }
                    try {
                        localStorage.setItem(key, value);
                        return; // Success after cleanup
                    } catch (_) {
                        console.error('[LocalStorageLiveMatchRepository] Save failed even after cleanup');
                    }
                }

                // Cleanup didn't help or no cleanup possible
                console.error(
                    '[LocalStorageLiveMatchRepository] Storage quota exceeded. ' +
                    'Please clear browser data or finish some live matches.'
                );
            }
            throw error;
        }
    }

    /**
     * H-5 FIX: Cleanup old/finished matches to free storage space
     * Strategy:
     * 1. Find all live-match keys in localStorage
     * 2. Collect FINISHED matches older than 24 hours
     * 3. Delete the oldest ones (keep max 5 finished per tournament)
     *
     * @returns Number of bytes freed
     */
    private cleanupOldMatches(): number {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const MAX_FINISHED_PER_TOURNAMENT = 5;
        const now = Date.now();
        let freedBytes = 0;

        try {
            // Find all live-match storage keys
            const liveMatchKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('hallenfussball-live-matches-')) {
                    liveMatchKeys.push(key);
                }
            }

            for (const key of liveMatchKeys) {
                const stored = localStorage.getItem(key);
                if (!stored) {
                    continue;
                }

                const beforeSize = stored.length;
                const matches = JSON.parse(stored) as Record<string, LiveMatch>;
                const entries = Object.entries(matches);

                // Separate finished and active matches
                const finished: Array<[string, LiveMatch]> = [];
                const active: Array<[string, LiveMatch]> = [];

                for (const [id, match] of entries) {
                    if (match.status === 'FINISHED') {
                        finished.push([id, match]);
                    } else {
                        active.push([id, match]);
                    }
                }

                // Sort finished by estimated finish time (newest first)
                // Use scheduledKickoff + durationSeconds as proxy since finishedAt isn't available
                finished.sort((a, b) => {
                    const aKickoff = a[1].scheduledKickoff ? new Date(a[1].scheduledKickoff).getTime() : 0;
                    const bKickoff = b[1].scheduledKickoff ? new Date(b[1].scheduledKickoff).getTime() : 0;
                    const aFinishTime = aKickoff + (a[1].durationSeconds * 1000);
                    const bFinishTime = bKickoff + (b[1].durationSeconds * 1000);
                    return bFinishTime - aFinishTime;
                });

                // Keep only MAX_FINISHED_PER_TOURNAMENT recent finished matches
                // Delete those older than 24 hours OR beyond the limit
                const toKeep: Array<[string, LiveMatch]> = [...active];
                let deleted = 0;

                for (let i = 0; i < finished.length; i++) {
                    const [id, match] = finished[i];
                    // Use scheduledKickoff + duration as estimated finish time
                    const kickoff = match.scheduledKickoff ? new Date(match.scheduledKickoff).getTime() : 0;
                    const estimatedFinishTime = kickoff + (match.durationSeconds * 1000);
                    const age = now - estimatedFinishTime;

                    // Keep if: within limit AND not older than 24 hours
                    if (i < MAX_FINISHED_PER_TOURNAMENT && age < ONE_DAY_MS) {
                        toKeep.push([id, match]);
                    } else {
                        deleted++;
                        if (import.meta.env.DEV) {
                            console.warn(`[LocalStorageLiveMatchRepository] Cleaning up old match: ${id}`);
                        }
                    }
                }

                if (deleted > 0) {
                    // Save the cleaned data back
                    const cleanedData = JSON.stringify(Object.fromEntries(toKeep));
                    localStorage.setItem(key, cleanedData);
                    freedBytes += beforeSize - cleanedData.length;
                    if (import.meta.env.DEV) {
                        console.warn(`[LocalStorageLiveMatchRepository] Cleaned up ${deleted} old matches from ${key}`);
                    }
                }
            }
        } catch (error) {
            console.error('[LocalStorageLiveMatchRepository] Cleanup failed:', error);
        }

        return freedBytes;
    }
}

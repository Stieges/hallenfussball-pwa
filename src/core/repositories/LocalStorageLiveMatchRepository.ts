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
            console.warn(
                `[LocalStorageLiveMatchRepository] Stale match detected: ${match.id}. ` +
                `Timer started ${Math.round(timeSinceStart / 1000 / 60)} minutes ago. ` +
                `Auto-pausing and clamping elapsed time.`
            );

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
     * Safe localStorage setter with quota handling
     */
    private safeLocalStorageSet(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn('[LocalStorageLiveMatchRepository] Storage quota exceeded, attempting cleanup...');
                // Could implement cleanup logic here
            }
            throw error;
        }
    }
}

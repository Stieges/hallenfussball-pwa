import { ILiveMatchRepository } from './ILiveMatchRepository';
import { LiveMatch } from '../models/LiveMatch';
import { STORAGE_KEYS } from '../../constants/storage';

/**
 * localStorage Implementation of ILiveMatchRepository
 *
 * Stores live match data per tournament in localStorage.
 * Key format: liveMatchData_{tournamentId}
 *
 * Nur lesend (A-08d2a, @FU-084): Schreibwege entfernt; localStorage wird hier nicht mehr beschrieben.
 */
export class LocalStorageLiveMatchRepository implements ILiveMatchRepository {

    private getStorageKey(tournamentId: string): string {
        return STORAGE_KEYS.liveMatches(tournamentId);
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
}

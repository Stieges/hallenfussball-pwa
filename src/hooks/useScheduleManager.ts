import { useState, useCallback, useEffect, useMemo } from 'react';
import { ScheduleService } from '../core/services/ScheduleService';
import { Match, MatchUpdate } from '../core/models/types';
import { useRepository } from './useRepository';

/**
 * useScheduleManager Hook
 *
 * The "Controller" that bridges React Components to the Domain Logic.
 * Replaces the complex/buggy logic of `useTournamentSync`.
 */
export function useScheduleManager(tournamentId: string) {
    // Get auth-aware repository (Supabase for authenticated, localStorage for guests)
    const repository = useRepository();

    // Service Instantiation (recreates if repository changes)
    const service = useMemo(() => {
        return new ScheduleService(repository);
    }, [repository]);

    // View State (Read Model)
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Initialize (Load or Generate)
    const loadSchedule = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await service.initializeSchedule(tournamentId);
            setMatches(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Fehler beim Laden des Spielplans');
        } finally {
            setIsLoading(false);
        }
    }, [service, tournamentId]);

    // Initial Load on Mount
    useEffect(() => {
        if (tournamentId) {
            void loadSchedule(); // Fire and forget
        }
    }, [tournamentId, loadSchedule]);

    // 2. Action: Move/Update Match
    const updateMatch = useCallback(async (update: MatchUpdate) => {
        try {
            // Optimistic Update (optional, here we wait for consistency safety first)
            await service.updateMatch(tournamentId, update);

            // Reload state to ensure sync
            // Optimization: modifying local state directly would be faster
            // A2 Fixrunde 3 (N2): `null` in `update` means "explicitly cleared" (wire-safe form,
            // see core/models/types.ts) -- translate back to `undefined` for the local `Match`.
            setMatches(prev => prev.map(m => {
                if (m.id !== update.id) { return m; }
                const merged: Record<string, unknown> = { ...m };
                for (const [key, value] of Object.entries(update)) {
                    merged[key] = value ?? undefined;
                }
                return merged as unknown as Match;
            }));
        } catch (err) {
            console.error(err);
            setError('Fehler beim Speichern');
            // Revert optimization would go here
            await loadSchedule(); // Force sync on error
        }
    }, [service, tournamentId, loadSchedule]);

    // 3. Action: Regenerate (Reset)
    const regenerateSchedule = useCallback(async () => {
        if (!window.confirm("Bist du sicher? Alle manuellen Änderungen gehen verloren!")) {
            return;
        }

        try {
            setIsLoading(true);
            const newMatches = await service.regenerateSchedule(tournamentId);
            setMatches(newMatches);
        } catch (err) {
            console.error(err);
            setError('Fehler beim Generieren');
        } finally {
            setIsLoading(false);
        }
    }, [service, tournamentId]);

    return {
        matches,
        isLoading,
        error,
        updateMatch,
        regenerateSchedule,
        reload: loadSchedule
    };
}

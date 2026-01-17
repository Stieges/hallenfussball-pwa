import { useState, useCallback, useEffect, useMemo } from 'react';
import { TournamentService } from '../core/services/TournamentService';
import { Tournament } from '../core/models/types';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { Standing } from '../types/tournament';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { useRealtimeTournament } from './useRealtimeTournament';

/**
 * useTournamentManager Hook
 *
 * High-level hook for full Tournament lifecycle.
 * Replaces `useTournamentSync` for components needing the full Tournament object.
 */
export function useTournamentManager(tournamentId: string) {
    // Get auth-aware repository and realtime flag
    const { tournamentRepository, isRealtimeEnabled } = useRepositories();

    // Service Instantiation (recreates if repository changes)
    const service = useMemo(() => {
        return new TournamentService(tournamentRepository);
    }, [tournamentRepository]);

    // State
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load Tournament
    const loadTournament = useCallback(async () => {
        if (!tournamentId) {return;}

        try {
            setIsLoading(true);
            const data = await service.loadTournament(tournamentId);
            setTournament(data);
            setError(null);
        } catch (err) {
            console.error('Failed to load tournament:', err);
            setError('Fehler beim Laden des Turniers');
        } finally {
            setIsLoading(false);
        }
    }, [service, tournamentId]);

    // Initial Load
    useEffect(() => {
        void loadTournament();
    }, [loadTournament]);

    // Realtime Subscription (only when authenticated with Supabase)
    const { isConnected: isRealtimeConnected, status: realtimeStatus } = useRealtimeTournament(
        // Only enable realtime for authenticated users with Supabase
        isRealtimeEnabled ? tournamentId : undefined,
        {
            enabled: isRealtimeEnabled && !!tournament,
            onUpdate: () => {
                // Refetch when any tournament data changes
                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log('[useTournamentManager] Realtime update received, refetching...');
                }
                void loadTournament();
            },
            onError: (error) => {
                if (import.meta.env.DEV) {
                    console.error('[useTournamentManager] Realtime error:', error);
                }
            },
        }
    );

    // Update Handler (matches signature of useTournamentSync)
    const handleTournamentUpdate = useCallback(async (updated: Tournament) => {
        try {
            await service.updateTournament(updated);
            setTournament(updated);
        } catch (err) {
            console.error('Failed to update tournament:', err);
            setError('Speichern fehlgeschlagen');
            // Reload to get consistent state
            await loadTournament();
        }
    }, [service, loadTournament]);

    // =========================================================================
    // BACKWARD COMPATIBILITY: Schedule View and Standings
    // These are computed from the loaded tournament for display purposes.
    // The "Truth" remains in tournament.matches.
    // =========================================================================

    const schedule: GeneratedSchedule | null = useMemo(() => {
        if (!tournament) {return null;}
        try {
            // Generate schedule structure for VIEW display
            // Note: This is for UI structure (phases, labels), NOT for persistence.
            return generateFullSchedule(tournament);
        } catch (err) {
            console.error('Failed to generate schedule view:', err);
            return null;
        }
    }, [tournament]);

    const currentStandings: Standing[] = useMemo(() => {
        if (!tournament) {return [];}
        return calculateStandings(tournament.teams, tournament.matches, tournament);
    }, [tournament]);

    return {
        tournament,
        schedule,
        currentStandings,
        isLoading,
        loadingError: error,
        handleTournamentUpdate,
        reload: loadTournament,
        scheduleService: service.schedule,
        // Realtime status
        isRealtimeConnected,
        realtimeStatus,
    };
}

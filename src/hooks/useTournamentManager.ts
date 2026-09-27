import { useState, useCallback, useEffect, useMemo } from 'react';
import { TournamentService } from '../core/services/TournamentService';
import { Tournament } from '../core/models/types';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { Standing } from '../types/tournament';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { useRealtimeTournament } from './useRealtimeTournament';
import { useEngineOverlayForTournament, useEngineOverlaidMatchIds } from './useEngineOverlayForTournament';

/**
 * I3 (C3a-2a Fixrunde 1, Review-Befund 4): `handleTournamentUpdate` bekommt von seinem Aufrufer
 * ein Turnier-Objekt, das der Aufrufer typischerweise aus der UEBERLAGERTEN Ausgabe dieses Hooks
 * gelesen und fuer EIN anderes Spiel geaendert hat (z. B. Spielplan-Schnelleingabe). Fuer JEDES
 * Spiel, das die Engine gerade kontrolliert, werden die Ergebnis-/Status-Felder deshalb IMMER auf
 * den ROHEN (nicht ueberlagerten) Stand zurueckgesetzt, bevor gespeichert wird -- sonst wuerden
 * Overlay-Werte (und `pending`-Ereignisse, falls der Aufrufer sie mitgenommen haette) in die
 * Rohdaten und die MutationQueue gelangen (bis V4/C3a-2b auch zum Server). Engine-Spiele haben
 * ohnehin nie einen unterstuetzten Weg, ihr Ergebnis ueber `handleTournamentUpdate` zu aendern --
 * das ist ausschliesslich der RPC/`MatchCommands` (B4/PC16).
 */
function stripEngineOverlayFields(
    updated: Tournament,
    raw: Tournament | null,
    overlaidIds: ReadonlySet<string>,
): Tournament {
    if (!raw || overlaidIds.size === 0) {
        return updated;
    }
    const rawById = new Map(raw.matches.map((m) => [m.id, m]));
    let changed = false;
    const matches = updated.matches.map((match) => {
        if (!overlaidIds.has(match.id)) {
            return match;
        }
        const rawMatch = rawById.get(match.id);
        if (!rawMatch) {
            return match;
        }
        const restored = {
            ...match,
            scoreA: rawMatch.scoreA,
            scoreB: rawMatch.scoreB,
            overtimeScoreA: rawMatch.overtimeScoreA,
            overtimeScoreB: rawMatch.overtimeScoreB,
            penaltyScoreA: rawMatch.penaltyScoreA,
            penaltyScoreB: rawMatch.penaltyScoreB,
            matchStatus: rawMatch.matchStatus,
            decidedBy: rawMatch.decidedBy,
            finishedAt: rawMatch.finishedAt,
        };
        if (JSON.stringify(restored) !== JSON.stringify(match)) {
            changed = true;
        }
        return restored;
    });
    return changed ? { ...updated, matches } : updated;
}

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

    // I3: welche Spiele die Engine GERADE kontrolliert (Ref, synchron waehrend des Renderns
    // aktualisiert -- kein Effekt-/Render-Zyklus, s. useEngineOverlaidMatchIds).
    const overlaidMatchIdsRef = useEngineOverlaidMatchIds(tournament);

    // Update Handler (matches signature of useTournamentSync)
    const handleTournamentUpdate = useCallback(async (updated: Tournament) => {
        const sanitized = stripEngineOverlayFields(updated, tournament, overlaidMatchIdsRef.current);
        try {
            await service.updateTournament(sanitized);
            setTournament(sanitized);
        } catch (err) {
            console.error('Failed to update tournament:', err);
            setError('Speichern fehlgeschlagen');
            // Reload to get consistent state
            await loadTournament();
        }
    }, [service, loadTournament, tournament, overlaidMatchIdsRef]);

    // Task A1 (Sofortschutz): Gegenstück zu handleTournamentUpdate OHNE Speicherpfad. Manche
    // Aufrufer (z. B. useMatchExecution nach Spielende) wollen den lokalen Zustand nur mit dem
    // bereits über einen anderen Weg persistierten Server-Stand synchronisieren — nicht das ganze
    // Turnier erneut speichern. Für einen Helfer (Rolle collaborator, kein tournamentSettings-
    // Recht) schlägt ein voller Turnier-Save per RLS fehl (0 Zeilen → OptimisticLockError → nach
    // Retries Dead-Letter in der MutationQueue); der eigentliche Spielstand ist über
    // MatchExecutionService.persistFinalResult (updateMatch, per writeMatchData erlaubt) längst
    // in der DB. `applyRemote` übernimmt nur den bereits frisch geladenen Tournament-State.
    const applyRemote = useCallback((updated: Tournament) => {
        setTournament(updated);
    }, []);

    // W7 (C3a-2a): Engine-Ergebnisse fliessen NUR lokal in JEDE Turnier-Ausgabe (Tabelle/Spielplan)
    // -- kein Versionssprung, kein syncUp, keine MutationQueue. `tournament` (State) bleibt die
    // Wahrheit fuer handleTournamentUpdate/applyRemote; nur die nach AUSSEN gegebene Form ist
    // ueberlagert.
    const overlaidTournament = useEngineOverlayForTournament(tournament);

    // =========================================================================
    // BACKWARD COMPATIBILITY: Schedule View and Standings
    // These are computed from the loaded tournament for display purposes.
    // The "Truth" remains in tournament.matches.
    // =========================================================================

    const schedule: GeneratedSchedule | null = useMemo(() => {
        if (!overlaidTournament) {return null;}
        try {
            // Generate schedule structure for VIEW display
            // Note: This is for UI structure (phases, labels), NOT for persistence.
            return generateFullSchedule(overlaidTournament);
        } catch (err) {
            console.error('Failed to generate schedule view:', err);
            return null;
        }
    }, [overlaidTournament]);

    const currentStandings: Standing[] = useMemo(() => {
        if (!overlaidTournament) {return [];}
        return calculateStandings(overlaidTournament.teams, overlaidTournament.matches, overlaidTournament);
    }, [overlaidTournament]);

    return {
        tournament: overlaidTournament,
        schedule,
        currentStandings,
        isLoading,
        loadingError: error,
        handleTournamentUpdate,
        applyRemote,
        reload: loadTournament,
        scheduleService: service.schedule,
        // Realtime status
        isRealtimeConnected,
        realtimeStatus,
    };
}

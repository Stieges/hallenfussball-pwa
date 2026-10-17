import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TournamentService } from '../core/services/TournamentService';
import { Tournament, type MatchUpdate } from '../core/models/types';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { Standing } from '../types/tournament';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { useRealtimeTournament } from './useRealtimeTournament';
import { useRealtimePollFallback } from './realtimePollFallback';
import { tournamentChannelStatusKey } from './realtimeChannelStatus';
import { useEngineOverlayForTournament, useEngineOverlaidMatchIds } from './useEngineOverlayForTournament';
import { useKoResolutionAfterAck } from './useKoResolutionAfterAck';
import { applySlotUpdates } from './koSlotResolution';
import { useEngineCatchUpOnCloudChange } from './useEngineCatchUpOnCloudChange';
import { createPushCoalescer } from './coalescePushes';

const FRESH = { fresh: true } as const;

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
    const loadTournament = useCallback(async (options?: { fresh?: boolean }) => {
        if (!tournamentId) {return;}

        try {
            if (!options?.fresh) { setIsLoading(true); } // A-08f3b: Laden-Anzeige nur beim ersten Laden
            const data = await service.loadTournament(tournamentId, options);
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
    // A-08f3b (@FU-087, @FU-001): Push und Abfrage-Ausweichen lesen frisch aus der Cloud
    const loadFresh = useCallback(() => loadTournament(FRESH), [loadTournament]);
    useEngineCatchUpOnCloudChange(tournamentId); // H-1: geladene Engine-Kopien nachladen
    // A-08f3b2-F (I-1): Pushes eines Turniers bündeln (Debounce + Max-Wait), dann EIN frisches Lesen
    const loadFreshRef = useRef(loadFresh);
    loadFreshRef.current = loadFresh;
    const pushCoalescer = useMemo(() => createPushCoalescer(() => { void loadFreshRef.current(); }), []); // ein Bündler je Hook, liest immer das aktuelle loadFresh
    useEffect(() => () => { pushCoalescer.cancel(); }, [pushCoalescer]);

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
                pushCoalescer.trigger();
            },
            onError: (error) => {
                if (import.meta.env.DEV) {
                    console.error('[useTournamentManager] Realtime error:', error);
                }
            },
        }
    );

    // A-08f-F (@FU-087): Turnier-Kanal unterbrochen -> Spielstand-Quelle alle 5 s nachladen, ohne Hinweis
    useRealtimePollFallback(tournamentChannelStatusKey(tournamentId), isRealtimeEnabled, loadFresh);

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
    // Aufrufer (z. B. das Cockpit nach Spielende) wollen den lokalen Zustand nur mit dem
    // bereits über einen anderen Weg persistierten Server-Stand synchronisieren — nicht das ganze
    // Turnier erneut speichern. Für einen Helfer (Rolle collaborator, kein tournamentSettings-
    // Recht) schlägt ein voller Turnier-Save per RLS fehl (0 Zeilen → OptimisticLockError → nach
    // Retries Dead-Letter in der MutationQueue); der eigentliche Spielstand ist über
    // der frühere Altweg persistFinalResult (updateMatch, per writeMatchData erlaubt) längst
    // in der DB.
    // I3 Fixrunde 2 (Re-Review-Befund): `applyRemote` übernahm das übergebene Turnier bisher
    // UNGESÄUBERT in den Roh-State (`tournament`) -- alle Aufrufer von `onLocalTournamentUpdate`
    // (Schnelleingabe, ScheduleEditor, Korrekturmodus, DangerZone, Cockpit) übergeben
    // aber eine Kopie der ÜBERLAGERTEN Ausgabe. Der verschmutzte Roh-State landete dann beim
    // nächsten `handleTournamentUpdate` (Voll-Save) in `stripEngineOverlayFields` -- das stellt
    // nur die Felder wieder her, die im ROHEN `tournament` selbst schon sauber waren; war der
    // Roh-State bereits verschmutzt, half das nichts mehr. Fix: dieselbe Säuberung wie bei
    // `handleTournamentUpdate`, gegen den ZULETZT bekannten sauberen Roh-Stand.
    const applyRemote = useCallback((updated: Tournament) => {
        setTournament(stripEngineOverlayFields(updated, tournament, overlaidMatchIdsRef.current));
    }, [tournament, overlaidMatchIdsRef]);

    // W7 (C3a-2a): Engine-Ergebnisse fliessen NUR lokal in JEDE Turnier-Ausgabe (Tabelle/Spielplan)
    // -- kein Versionssprung, kein syncUp, keine MutationQueue. `tournament` (State) bleibt die
    // Wahrheit fuer handleTournamentUpdate/applyRemote; nur die nach AUSSEN gegebene Form ist
    // ueberlagert.
    const overlaidTournament = useEngineOverlayForTournament(tournament);
    // A-08f3e2 Fixrunde 1 (I-1): K.-o.-Plätze nach Server-Bestätigung besetzen, auch ohne offenen Spielplan-Tab
    const applyKoSlots = useCallback((updates: MatchUpdate[]) => {
        setTournament((current) => (current ? applySlotUpdates(current, updates) : current));
        service.schedule.updateMatches(tournamentId, updates).catch(() => { setError('Speichern fehlgeschlagen'); });
    }, [service, tournamentId]);
    useKoResolutionAfterAck(overlaidTournament, applyKoSlots);

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

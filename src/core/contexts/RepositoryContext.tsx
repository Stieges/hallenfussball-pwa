import React, { createContext, useContext, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { ILiveMatchRepository } from '../repositories/ILiveMatchRepository';
import { LocalStorageRepository } from '../repositories/LocalStorageRepository';
import { LocalStorageLiveMatchRepository } from '../repositories/LocalStorageLiveMatchRepository';
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { SupabaseLiveMatchRepository } from '../repositories/SupabaseLiveMatchRepository';
import { OfflineRepository } from '../repositories/OfflineRepository';
import { isSupabaseConfigured } from '../../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

interface RepositoryContextValue {
    tournamentRepository: ITournamentRepository;
    liveMatchRepository: ILiveMatchRepository;
    /** True if using Supabase with realtime capabilities */
    isRealtimeEnabled: boolean;
    /** Supabase-specific repo for subscriptions (null if not available) */
    supabaseLiveMatchRepo: SupabaseLiveMatchRepository | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth(); // Wait for auth to settle
    const supabaseLiveMatchRepoRef = useRef<SupabaseLiveMatchRepository | null>(null);

    const value = useMemo(() => {
        // Always need local repos
        const localTournamentRepo = new LocalStorageRepository();
        const localLiveMatchRepo = new LocalStorageLiveMatchRepository();

        // If authenticated AND Supabase is configured -> Use Supabase repos
        if (user && isSupabaseConfigured) {
            try {
                const supabaseTournamentRepo = new SupabaseRepository();
                const offlineTournamentRepo = new OfflineRepository(localTournamentRepo, supabaseTournamentRepo);

                // Create Supabase live match repo
                const supabaseLiveMatchRepo = new SupabaseLiveMatchRepository();
                supabaseLiveMatchRepoRef.current = supabaseLiveMatchRepo;

                return {
                    tournamentRepository: offlineTournamentRepo,
                    liveMatchRepository: supabaseLiveMatchRepo,
                    isRealtimeEnabled: true,
                    supabaseLiveMatchRepo: supabaseLiveMatchRepo,
                };
            } catch (e) {
                console.error('RepositoryProvider: Failed to init Supabase repos', e);
                supabaseLiveMatchRepoRef.current = null;
                return {
                    tournamentRepository: localTournamentRepo,
                    liveMatchRepository: localLiveMatchRepo,
                    isRealtimeEnabled: false,
                    supabaseLiveMatchRepo: null,
                };
            }
        }

        // Fallback / Guest -> Local Only
        supabaseLiveMatchRepoRef.current = null;
        return {
            tournamentRepository: localTournamentRepo,
            liveMatchRepository: localLiveMatchRepo,
            isRealtimeEnabled: false,
            supabaseLiveMatchRepo: null,
        };
    }, [user]);

    // Cleanup subscriptions on unmount
    useEffect(() => {
        return () => {
            supabaseLiveMatchRepoRef.current?.unsubscribeAll();
        };
    }, []);

    return (
        <RepositoryContext.Provider value={value}>
            {children}
        </RepositoryContext.Provider>
    );
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * @deprecated Use useRepositories() instead for full context
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useRepositoryContext = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useRepositoryContext must be used within a RepositoryProvider');
    }
    // For backwards compatibility, return just the tournament repository
    return context.tournamentRepository;
};

/**
 * Access all repositories and realtime capabilities
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useRepositories = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useRepositories must be used within a RepositoryProvider');
    }
    return context;
};

/**
 * Access just the live match repository
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useLiveMatchRepository = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useLiveMatchRepository must be used within a RepositoryProvider');
    }
    return context.liveMatchRepository;
};

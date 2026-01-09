import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { LocalStorageRepository } from '../repositories/LocalStorageRepository';
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { OfflineRepository } from '../repositories/OfflineRepository';
import { isSupabaseConfigured } from '../../lib/supabase';

const RepositoryContext = createContext<ITournamentRepository | null>(null);

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth(); // Wait for auth to settle

    const repository = useMemo(() => {
        // Always need local repo
        const localRepo = new LocalStorageRepository();

        // If authenticated AND Supabase is configured -> Use Offline/Sync Repo
        if (user && isSupabaseConfigured) {
            try {
                const supabaseRepo = new SupabaseRepository();
                const offlineRepo = new OfflineRepository(localRepo, supabaseRepo);

                return offlineRepo;
            } catch (e) {
                console.error('RepositoryProvider: Failed to init SupabaseRepo', e);
                return localRepo;
            }
        }

        // Fallback / Guest -> Local Only
        return localRepo;
    }, [user]);

    return (
        <RepositoryContext.Provider value={repository}>
            {children}
        </RepositoryContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRepositoryContext = () => {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useRepositoryContext must be used within a RepositoryProvider');
    }
    return context;
};

/* eslint-disable no-console */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Types for dynamically imported modules
// import type { LocalStorageRepository as LocalStorageRepoType } from './core/repositories/LocalStorageRepository';
import type { SupabaseRepository as SupabaseRepoType } from './core/repositories/SupabaseRepository';
import type { OfflineRepository as OfflineRepoType } from './core/repositories/OfflineRepository';
import type { TournamentCreationService as CreationServiceType } from './core/services/TournamentCreationService';

describe('Integration: Cloud Sync Verification', () => {
    let offlineRepo: OfflineRepoType;
    let supabaseRepo: SupabaseRepoType;
    let creationService: CreationServiceType;
    let testSupabase: any;

    // Custom memory storage for Node.js
    const memoryStorage = (() => {
        let store: Record<string, string> = {};
        return {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = value; },
            removeItem: (key: string) => {
                const { [key]: _removed, ...rest } = store;
                store = rest;
            },
            clear: () => { store = {}; }
        };
    })();

    beforeAll(async () => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error("Supabase env vars missing");
        }

        // 1. Create a persistence-enabled client
        testSupabase = createClient(url, key, {
            auth: {
                persistSession: true,
                storage: memoryStorage,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        // 2. Mock the supabase library used by repositories
        // We must do this BEFORE importing the repositories
        vi.doMock('./lib/supabase', () => ({
            supabase: testSupabase,
            isSupabaseConfigured: true,
            getCurrentUser: async () => (await testSupabase.auth.getUser()).data.user,
            getCurrentSession: async () => (await testSupabase.auth.getSession()).data.session,
        }));

        // 3. Dynamically import repositories (they will now use the mocked supabase)
        const { LocalStorageRepository } = await import('./core/repositories/LocalStorageRepository');
        const { SupabaseRepository } = await import('./core/repositories/SupabaseRepository');
        const { OfflineRepository } = await import('./core/repositories/OfflineRepository');
        const { TournamentCreationService } = await import('./core/services/TournamentCreationService');

        // 4. Authenticate
        /* 
         * NOTE: Using verified test credentials provided by user.
         */
        const email = 'test@hallenfussball.de';
        const password = 'Test1234!';

        // Try login
        const { error: signInError } = await testSupabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            console.error("Login failed:", signInError);
            throw new Error(`Login failed for test user: ${signInError.message}`);
        }

        // Verify session
        const { data: { user }, error: userError } = await testSupabase.auth.getUser();
        if (userError || !user) {
            console.error("Authentication failed. Cannot verify cloud sync.");
            throw new Error(`Pulse check: No authenticated user. Error: ${userError?.message || 'No session'}`);
        }

        console.log("✅ Authenticated as:", user.id);

        // 5. Instantiate Services
        const localRepo = new LocalStorageRepository();
        supabaseRepo = new SupabaseRepository(); // References mocked supabase
        offlineRepo = new OfflineRepository(localRepo, supabaseRepo);
        creationService = new TournamentCreationService(offlineRepo);
    });

    it('should create a tournament and sync it to Supabase', async () => {
        const title = `E2E Verify ${Date.now()}`;
        console.log(`Creating tournament: ${title}`);

        // 1. Create Draft
        const draft = creationService.createDraft({
            title,
            teams: [
                { id: crypto.randomUUID(), name: 'Integrator A' },
                { id: crypto.randomUUID(), name: 'Integrator B' }
            ],
            date: new Date().toISOString().split('T')[0],
            // Use simple string to avoid "time zone displacement value out of range" error
            timeSlot: "09:00",
            location: { name: 'Integration Test Lab' }
        });

        // 2. Publish (saves to OfflineRepo -> Enqueues to Supabase)
        const published = await creationService.publish(draft);
        expect(published.id).toBeDefined();

        // 3. Trigger manual sync/save to ensure it's pushed immediately 
        await offlineRepo.save(published);

        console.log(`Tournament ${published.id} published locally. Waiting for sync...`);

        // 4. Wait for MutationQueue to process
        // Mock online status for Node environment if needed
        if (typeof navigator === 'undefined') {
            (global as any).navigator = { onLine: true };
        } else {
            Object.defineProperty(navigator, 'onLine', {
                value: true,
                writable: true,
            });
        }

        const queue = offlineRepo.mutationQueue;

        // Force process just in case
        await queue.process();

        // Poll until empty or timeout
        let retries = 0;
        while (queue.getPendingCount() > 0 && retries < 20) {
            await new Promise(r => setTimeout(r, 500));
            // Force process again if stuck
            await queue.process();
            retries++;
        }

        if (queue.getFailedCount() > 0) {
            console.error("Mutation failed:", JSON.stringify(queue.getFailedMutations(), null, 2));
        }

        expect(queue.getPendingCount()).toBe(0);
        expect(queue.getFailedCount()).toBe(0);

        // 5. Verify direct fetch from Supabase (bypassing local cache)
        // Use our local test client
        const { data: cloudData, error } = await testSupabase
            .from('tournaments')
            .select('*')
            .eq('id', published.id)
            .single();

        if (!cloudData) {
            console.error("Cloud data not found for ID:", published.id);
            if (error) {
                console.error("Supabase Error:", error);
            }
        }

        expect(cloudData).not.toBeNull();
        expect(cloudData?.id).toBe(published.id);
        expect(cloudData?.title).toBe(title);

        console.log('✅ Verified: Data found in Supabase!');
    }, 15000); // 15s timeout
});

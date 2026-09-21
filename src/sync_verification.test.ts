/* eslint-disable no-console */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Types for dynamically imported modules
// Types for dynamically imported modules
// import type { LocalStorageRepository as LocalStorageRepoType } from './core/repositories/LocalStorageRepository';
import type { SupabaseRepository as SupabaseRepoType } from './core/repositories/SupabaseRepository';
import type { OfflineRepository as OfflineRepoType } from './core/repositories/OfflineRepository';
import type { TournamentCreationService as CreationServiceType } from './core/services/TournamentCreationService';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const hasEnvVars = Boolean(rawSupabaseUrl) && Boolean(rawSupabaseAnonKey);

// Harter Riegel gegen Schreiben in die Produktions-DB (siehe Vorfall-Analyse
// .superpowers/sdd/2026-09-21-db-baseline-und-testmuell/): Dieser Integrationstest legt
// echte "E2E Verify <Zeitstempel>"-Turniere in der Zieldatenbank an. Ein reines
// "sind Env-Vars gesetzt?"-Gate reicht nicht, weil lokale .env.local-Dateien (auch auf
// CI-Runnern, falls dort je gesetzt) häufig auf die PRODUKTIONS-Datenbank zeigen, nicht auf
// ein Test-Projekt. Deshalb wird zusätzlich die Supabase-Projekt-Ref aus VITE_SUPABASE_URL
// extrahiert: Zeigt sie auf das Produktionsprojekt, wird übersprungen statt abgebrochen
// (Prozess-Exit != 0) — ein Abbruch würde `npm test` auf jeder Entwicklermaschine mit
// produktiven Zugangsdaten rot machen, auch bei völlig unbeteiligter Arbeit. Der Skip ist
// bewusst LAUT (console.warn), damit er nicht wie in den letzten 8 Monaten unbemerkt bleibt.
//
// FAIL-CLOSED (Review-Fixrunde 1, Befund 1): "Die Projekt-Ref ließ sich nicht aus der URL
// extrahieren" ist NICHT dasselbe wie "das Ziel ist sicher kein Produktionsprojekt". Eine
// gesetzte, aber nicht auf das bekannte Muster passende URL (z.B. ein versehentlich
// mitkopiertes Anführungszeichen, eine protokollrelative Schreibweise, oder eine eigene
// Domain vor demselben Supabase-Projekt) wird deshalb ebenfalls übersprungen — mit einer
// eigenen, unterscheidbaren Warnung, damit niemand einen "unbekanntes Ziel"-Skip für einen
// "kein Produktionsziel"-Befund hält.
const PRODUCTION_SUPABASE_PROJECT_REF = 'amtlqicosscsjnnthvzm';

// Exportiert für die Mutationsprobe/den parametrisierten Test weiter unten in dieser Datei:
// Diese Funktion IST der gesamte Schutz. Ein kleines eigenes Modul unter src/core wäre hier
// unpassend (Guard-Logik ist reines Testinfrastruktur, nicht Produktionscode und hat nichts
// in core/ zu suchen, siehe .claude/conventions/LAYERING.md) — Export aus der Testdatei reicht.
export function extractSupabaseProjectRef(url: string | undefined): string | null {
    if (!url) {return null;}
    let normalized = url.trim();

    // Ein mitkopiertes umschließendes Anführungszeichen (z.B. aus einer kopierten .env-Zeile)
    // darf die Erkennung nicht kaputt machen.
    if (normalized.length >= 2) {
        const first = normalized[0];
        const last = normalized[normalized.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            normalized = normalized.slice(1, -1).trim();
        }
    }

    // Akzeptiert absolute (https://) und protokollrelative (//) Supabase-Hostnamen, optional
    // mit Port und Pfad, case-insensitive.
    const match = /^(?:https?:)?\/\/([a-z0-9-]+)\.supabase\.co(?::\d+)?(?:\/.*)?$/i.exec(normalized);
    return match ? match[1].toLowerCase() : null;
}

export type SupabaseIntegrationSkipReason = 'production' | 'target-undetermined' | null;

/**
 * Einzige Entscheidungsstelle dafür, ob der Cloud-Sync-Integrationstest aus
 * Sicherheitsgründen übersprungen werden muss. `null` bedeutet: kein Sperrgrund gefunden.
 * Wird sowohl von der Skip-Entscheidung als auch vom parametrisierten Test unten benutzt,
 * damit Test und Produktionslogik nicht auseinanderlaufen können.
 */
export function resolveSupabaseIntegrationSkipReason(url: string | undefined): SupabaseIntegrationSkipReason {
    if (!url) {return null;}
    const projectRef = extractSupabaseProjectRef(url);
    if (projectRef === null) {return 'target-undetermined';}
    if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {return 'production';}
    return null;
}

const skipReason = hasEnvVars ? resolveSupabaseIntegrationSkipReason(rawSupabaseUrl) : null;
const isProductionTarget = skipReason === 'production';
const targetUndetermined = skipReason === 'target-undetermined';

if (isProductionTarget) {
    console.warn(
        '\n' +
        '🚫🚫🚫 INTEGRATIONSTEST ÜBERSPRUNGEN — Ziel ist die PRODUKTIONSDATENBANK 🚫🚫🚫\n' +
        `   VITE_SUPABASE_URL zeigt auf Projekt-Ref "${PRODUCTION_SUPABASE_PROJECT_REF}" (Produktion).\n` +
        '   "Integration: Cloud Sync Verification" legt echte Turnier-Datensätze an und darf\n' +
        '   NIEMALS gegen Produktion laufen (siehe Vorfall: 356+ "E2E Verify"-Testartefakte).\n' +
        '   -> Für einen echten Testlauf VITE_SUPABASE_URL in .env.local auf ein\n' +
        '      Test-/Staging-Supabase-Projekt umbiegen.\n'
    );
} else if (targetUndetermined) {
    console.warn(
        '\n' +
        '⚠️⚠️⚠️ INTEGRATIONSTEST ÜBERSPRUNGEN — Ziel konnte nicht bestimmt werden ⚠️⚠️⚠️\n' +
        '   VITE_SUPABASE_URL ist gesetzt, passt aber auf kein erkanntes Supabase-URL-Muster\n' +
        '   (https://<ref>.supabase.co, optional mit Port/Pfad, oder protokollrelativ).\n' +
        '   Sicherheitshalber wird NICHT angenommen, dass das Ziel kein Produktionsprojekt ist —\n' +
        '   "Ziel unbekannt" ist kein Beleg für "Ziel ist sicher".\n' +
        '   -> VITE_SUPABASE_URL in .env.local auf eine reguläre Supabase-Projekt-URL setzen,\n' +
        '      um diesen Integrationstest auszuführen.\n'
    );
}

const runIntegration = (hasEnvVars && skipReason === null) ? describe : describe.skip;

runIntegration('Integration: Cloud Sync Verification', () => {
    let offlineRepo: OfflineRepoType;
    let supabaseRepo: SupabaseRepoType;
    let creationService: CreationServiceType;
    let testSupabase: any;
    let supabaseReachable = true;

    if (!hasEnvVars) {
        console.warn('Skipping Cloud Sync Verification: Missing Supabase Environment Variables');
        return;
    }
    if (skipReason !== null) {
        // Dies ist KEIN eigener Schutzmechanismus gegen ein falsch-negatives Ziel (dafür ist
        // ausschließlich resolveSupabaseIntegrationSkipReason()/runIntegration oben zuständig,
        // siehe Fail-Closed-Kommentar dort). Es ist nur ein zusätzlicher, redundanter
        // Kurzschluss für den Fall, dass sich Vitests describe.skip-Verhalten künftig ändert
        // und der Suite-Body trotz Skip ausgeführt wird — die laute Warnung wurde bereits oben
        // auf Modul-Ebene ausgegeben.
        return;
    }

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

        // Double check for type safety, though conditional describe handles it
        if (!url || !key) {return;}

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
            // Skip gracefully when Supabase is unreachable (e.g., project paused)
            const hasFetchError = signInError.message?.includes('fetch failed') === true;
            const hasZeroStatus = signInError.status === 0;
            const isNetworkError = hasFetchError || hasZeroStatus;
            if (isNetworkError) {
                console.warn('⏭️ Skipping: Supabase unreachable (project may be paused)');
                supabaseReachable = false;
                return;
            }
            console.error("Login failed:", signInError);
            throw new Error(`Login failed for test user: ${signInError.message}`);
        }

        // Verify session
        const { data: { user }, error: userError } = await testSupabase.auth.getUser();
        if (userError || !user) {
            console.error("Authentication failed. Cannot verify cloud sync.");
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty message should use fallback
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
        if (!supabaseReachable) {
            console.warn('⏭️ Test skipped: Supabase not reachable');
            return;
        }
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

// ---------------------------------------------------------------------------------------------
// Guard-Tests: laufen IMMER (unabhängig von hasEnvVars), weil sie reine Funktionen ohne
// Netzwerkzugriff prüfen. Das ist der Schutzmechanismus gegen den Produktions-Vorfall selbst —
// ein Wächter, der acht Monate unbemerkt kaputt sein konnte, darf nicht ungetestet bleiben.
// ---------------------------------------------------------------------------------------------
describe('extractSupabaseProjectRef', () => {
    it.each([
        ['literale Produktions-URL', 'https://amtlqicosscsjnnthvzm.supabase.co'],
        ['mit Port', 'https://amtlqicosscsjnnthvzm.supabase.co:443'],
        ['mit Pfad', 'https://amtlqicosscsjnnthvzm.supabase.co/rest/v1'],
        ['in Großschreibung', 'HTTPS://AMTLQICOSSCSJNNTHVZM.SUPABASE.CO'],
        ['protokollrelativ', '//amtlqicosscsjnnthvzm.supabase.co'],
        ['mit umschließenden doppelten Anführungszeichen', '"https://amtlqicosscsjnnthvzm.supabase.co"'],
        ['mit umschließenden einfachen Anführungszeichen', "'https://amtlqicosscsjnnthvzm.supabase.co'"],
    ])('erkennt die Produktions-Ref bei: %s', (_label, url) => {
        expect(extractSupabaseProjectRef(url)).toBe('amtlqicosscsjnnthvzm');
    });

    it('erkennt die Ref eines anderen, nicht-produktiven Projekts korrekt (und nicht als Produktion)', () => {
        expect(extractSupabaseProjectRef('https://testprojectxyz123.supabase.co')).toBe('testprojectxyz123');
    });

    it('liefert null, wenn keine URL gesetzt ist', () => {
        expect(extractSupabaseProjectRef(undefined)).toBeNull();
    });

    it('liefert null bei einer eigenen Domain vor einem Supabase-Projekt (Ref nicht extrahierbar)', () => {
        expect(extractSupabaseProjectRef('https://db.meine-eigene-domain.de')).toBeNull();
    });
});

describe('resolveSupabaseIntegrationSkipReason', () => {
    it.each([
        ['literale Produktions-URL', 'https://amtlqicosscsjnnthvzm.supabase.co'],
        ['mit Port', 'https://amtlqicosscsjnnthvzm.supabase.co:443'],
        ['mit Pfad', 'https://amtlqicosscsjnnthvzm.supabase.co/rest/v1'],
        ['in Großschreibung', 'HTTPS://AMTLQICOSSCSJNNTHVZM.SUPABASE.CO'],
        ['protokollrelativ', '//amtlqicosscsjnnthvzm.supabase.co'],
        ['mit umschließendem Anführungszeichen', '"https://amtlqicosscsjnnthvzm.supabase.co"'],
    ])('sperrt (Grund "production") bei: %s', (_label, url) => {
        expect(resolveSupabaseIntegrationSkipReason(url)).toBe('production');
    });

    it('sperrt NICHT bei einer URL auf ein anderes, nicht-produktives Projekt', () => {
        expect(resolveSupabaseIntegrationSkipReason('https://testprojectxyz123.supabase.co')).toBeNull();
    });

    it('sperrt NICHT, wenn keine URL gesetzt ist (davon geht ein anderes Gate aus: hasEnvVars)', () => {
        expect(resolveSupabaseIntegrationSkipReason(undefined)).toBeNull();
    });

    it('BEFUND 1 (Fail-Closed): sperrt (Grund "target-undetermined"), wenn eine gesetzte URL nicht geparst werden kann', () => {
        // z.B. eine eigene Domain vor demselben Produktions-Supabase-Projekt — die Projekt-Ref
        // ist aus dem String nicht erkennbar, darf aber NICHT als "sicher kein Produktionsziel"
        // gewertet werden.
        expect(resolveSupabaseIntegrationSkipReason('https://db.meine-eigene-domain.de')).toBe('target-undetermined');
        expect(resolveSupabaseIntegrationSkipReason('not-a-url-at-all')).toBe('target-undetermined');
    });
});

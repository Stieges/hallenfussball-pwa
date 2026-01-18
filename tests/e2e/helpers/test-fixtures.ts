import { test as base } from '@playwright/test';


/**
 * Consent status structure matching lib/consent.ts
 * Set errorTracking: true to bypass ConsentDialog in E2E tests.
 */
const TEST_CONSENT_STATUS = {
    errorTracking: true,
    sessionReplay: false,
    timestamp: Date.now(),
    version: 1,
};

/**
 * IndexedDB configuration matching src/core/storage/IndexedDBAdapter.ts
 */
const INDEXED_DB_CONFIG = {
    dbName: 'hallenfussball',
    storeName: 'cache',
    version: 1,
};

/**
 * Extended Test Fixtures
 */
export type TestOptions = {
    /**
     * Helper to seed data into IndexedDB before app load
     * This is the primary method for seeding test data since the app uses IndexedDB.
     */
    seedIndexedDB: (data: Record<string, unknown>) => Promise<void>;
    /**
     * @deprecated Use seedIndexedDB instead. localStorage data won't be read by the app.
     * Kept for backwards compatibility with existing tests.
     */
    seedLocalStorage: (data: Record<string, unknown>) => Promise<void>;
};

/**
 * Custom test instance with reset functionality
 *
 * Automatically sets consent status to bypass ConsentDialog in tests.
 *
 * IMPORTANT: The app uses IndexedDB as primary storage.
 * Use seedIndexedDB() to seed test data, not seedLocalStorage().
 */
export const test = base.extend<TestOptions>({
    // Auto-set consent before each test to bypass ConsentDialog
    page: async ({ page }, use) => {
        // Navigate to app first (needed to access storage for this origin)
        await page.goto('/');

        // Set consent status in localStorage first
        // The app's autoMigrate will move it to IndexedDB
        await page.evaluate((consent) => {
            localStorage.setItem('app:consent', JSON.stringify(consent));
        }, TEST_CONSENT_STATUS);

        // Reload to pick up the consent and wait for page to be ready
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Now use the page with consent already set
        await use(page);
    },

    seedIndexedDB: async ({ page }, use) => {
        const seedFn = async (data: Record<string, unknown>) => {
            await page.evaluate(({ data, config }) => {
                return new Promise<void>((resolve, reject) => {
                    const request = indexedDB.open(config.dbName, config.version);

                    request.onerror = () => {
                        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
                    };

                    request.onupgradeneeded = (event) => {
                        const db = (event.target as IDBOpenDBRequest).result;
                        if (!db.objectStoreNames.contains(config.storeName)) {
                            db.createObjectStore(config.storeName, { keyPath: 'key' });
                        }
                    };

                    request.onsuccess = (event) => {
                        const db = (event.target as IDBOpenDBRequest).result;
                        const transaction = db.transaction(config.storeName, 'readwrite');
                        const store = transaction.objectStore(config.storeName);

                        // Write each key-value pair
                        Object.entries(data).forEach(([key, value]) => {
                            store.put({ key, value });
                        });

                        transaction.oncomplete = () => {
                            db.close();
                            resolve();
                        };

                        transaction.onerror = () => {
                            db.close();
                            reject(new Error(`Failed to seed IndexedDB: ${transaction.error?.message}`));
                        };
                    };
                });
            }, { data, config: INDEXED_DB_CONFIG });

            // Reload to pick up changes
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
        };
        await use(seedFn);
    },

    /**
     * @deprecated Use seedIndexedDB instead
     */
    seedLocalStorage: async ({ page }, use) => {
        const seedFn = async (data: Record<string, unknown>) => {
            await page.evaluate((data) => {
                Object.entries(data).forEach(([key, value]) => {
                    localStorage.setItem(key, JSON.stringify(value));
                });
            }, data);
            await page.reload(); // Reload to pick up changes
            await page.waitForLoadState('domcontentloaded');
        };
        await use(seedFn);
    },
});

export { expect } from '@playwright/test';

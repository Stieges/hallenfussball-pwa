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
 * Extended Test Fixtures
 */
export type TestOptions = {
    /**
     * Helper to seed localStorage before app load
     */
    seedLocalStorage: (data: Record<string, unknown>) => Promise<void>;
};

/**
 * Custom test instance with reset functionality
 *
 * Automatically sets consent status to bypass ConsentDialog in tests.
 */
export const test = base.extend<TestOptions>({
    // Auto-set consent before each test to bypass ConsentDialog
    page: async ({ page }, use) => {
        // Navigate to app first (needed to access localStorage for this origin)
        await page.goto('/');

        // Set consent status to bypass ConsentDialog
        await page.evaluate((consent) => {
            localStorage.setItem('app:consent', JSON.stringify(consent));
        }, TEST_CONSENT_STATUS);

        // Reload to pick up the consent and wait for page to be ready
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Now use the page with consent already set
        await use(page);
    },

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

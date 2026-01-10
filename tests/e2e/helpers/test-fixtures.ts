import { test as base } from '@playwright/test';


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
 */
export const test = base.extend<TestOptions>({
    seedLocalStorage: async ({ page }, use) => {
        const seedFn = async (data: Record<string, unknown>) => {
            await page.goto('/'); // Navigate to a page (needed to access localStorage)
            await page.evaluate((data) => {
                Object.entries(data).forEach(([key, value]) => {
                    localStorage.setItem(key, JSON.stringify(value));
                });
            }, data);
            await page.reload(); // Reload to pick up changes
        };
        await use(seedFn);
    },
});

export { expect } from '@playwright/test';

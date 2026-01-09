
import { test, expect } from '@playwright/test';

// TEMPORARILY SKIPPED: This test uses hardcoded paths and needs CI-compatibility fixes
// TODO: Fix absolute paths and stabilize for CI environment
test.skip('Verify Register -> Create Tournament -> Admin Center Flow', async ({ page }) => {
    // 1. Go to Home and wait for load
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Handle potential Guest Banner or Login overlays if they exist
    // We assume we want to start fresh or handle current state

    // 2. Register
    const loginButton = page.locator('button:has-text("Anmelden")').first();
    if (await loginButton.isVisible()) {
        await loginButton.click({ force: true });
        await page.click('text=Registrieren', { force: true });

        // Fill Registration
        await page.fill('input[type="text"]', 'Admin User');
        const randomId = Math.floor(Math.random() * 100000);
        await page.fill('input[type="email"]', `admin-${randomId}@test.com`);
        await page.click('button:has-text("Konto erstellen")', { force: true });

        // Wait for success/redirect
        await expect(page).toHaveURL(/.*\/$/);
        await page.waitForTimeout(1000); // Wait for toasts to clear
    }

    // 3. Create Tournament
    // Force click to bypass any lingering toasts/overlays
    await page.click('text=Neues Turnier', { force: true });

    // Step 1: Name
    await page.fill('input[placeholder="z.B. Hallenkreismeisterschaft"]', 'Admin Verify Tournament');
    await page.click('text=Weiter', { force: true });

    // Step 2: Mode
    await page.click('text=Liga', { force: true });
    await page.click('text=Weiter', { force: true });

    // Step 3: Fields
    await page.click('text=Weiter', { force: true });

    // Step 4: Teams
    await page.fill('input[placeholder="Teamname eingeben..."]', 'Team A');
    await page.keyboard.press('Enter');
    await page.fill('input[placeholder="Teamname eingeben..."]', 'Team B');
    await page.keyboard.press('Enter');
    await page.click('text=Weiter', { force: true });

    // Step 5: Settings
    await page.click('text=Weiter', { force: true });

    // Step 6: Summary
    await page.click('text=Turnier erstellen', { force: true });

    // Wait for redirect to tournament dashboard
    await expect(page).toHaveURL(/\/tournament\/[a-zA-Z0-9-]+\/?$/);

    // 4. Go to Admin Center
    const adminButton = page.locator('text=Admin Center');
    await page.waitForTimeout(1000); // 1s wait for stability
    if (await adminButton.count() > 0) {
        await adminButton.first().click({ force: true });
    } else {
        await page.click('text=Admin', { force: true });
    }

    // Verify Admin Center URL
    await expect(page).toHaveURL(/.*\/admin/);

    // Wait for content
    await page.waitForSelector('text=Dashboard');

    // Take screenshot of Dashboard
    await page.screenshot({ path: '/Users/daniel.stiegler/.gemini/antigravity/brain/cbf03481-9a39-4e11-b37e-ef418a61df06/admin_flow_dashboard.png' });

    // Navigate to Settings
    await page.click('text=Einstellungen', { force: true });
    await expect(page).toHaveURL(/.*\/admin\/settings/);
    await page.isEnabled('text=Einstellungen'); // just wait a bit
    await page.screenshot({ path: '/Users/daniel.stiegler/.gemini/antigravity/brain/cbf03481-9a39-4e11-b37e-ef418a61df06/admin_flow_settings.png' });
});

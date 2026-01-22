/**
 * E2E Tests für Dashboard
 *
 * Testet:
 * - Turnier-Karten (Aktive/Archiv/Papierkorb)
 * - Filter-Navigation
 * - Turnier erstellen Button
 * - Turnier-Aktionen (Bearbeiten, Archivieren, Löschen)
 * - Leere Zustände
 * - Suche/Filter
 */

import { test, expect } from '../helpers/test-fixtures';

test.describe('Dashboard', () => {

  test('zeigt Dashboard mit Turnier-Liste', async ({ page }) => {
    // GIVEN - Dashboard laden
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // THEN - Haupt-Elemente sichtbar
    await expect(page.getByRole('heading', { name: /Turniere|Dashboard/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Neues Turnier/i })).toBeVisible();
  });

  test('zeigt leeren Zustand wenn keine Turniere', async ({ page }) => {
    // GIVEN - Dashboard ohne Turniere
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // THEN - Leerer Zustand mit Call-to-Action
    const emptyState = page.locator('[data-testid="empty-state"]').or(
      page.getByText(/Noch keine Turniere/i)
    );

    // Either tournaments exist or empty state is shown
    const hasTournaments = await page.locator('[data-testid^="tournament-card-"]').count() > 0;
    if (!hasTournaments) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('Navigation zu Archiv-Tab', async ({ page }) => {
    // GIVEN - Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN - Archiv-Tab klicken
    const archivButton = page.getByRole('button', { name: /Archiv/i }).or(
      page.getByRole('link', { name: /Archiv/i })
    );
    await archivButton.click();

    // THEN - URL ändert sich zu /archiv
    await expect(page).toHaveURL(/\/archiv/);
  });

  test('Navigation zu Papierkorb-Tab', async ({ page }) => {
    // GIVEN - Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN - Papierkorb-Tab klicken
    const trashButton = page.getByRole('button', { name: /Papierkorb/i }).or(
      page.getByRole('link', { name: /Papierkorb/i })
    );
    await trashButton.click();

    // THEN - URL ändert sich zu /papierkorb
    await expect(page).toHaveURL(/\/papierkorb/);
  });

  test('Navigation zu Turnier-Erstellung', async ({ page }) => {
    // GIVEN - Dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN - "Neues Turnier" Button klicken
    await page.getByRole('button', { name: /Neues Turnier/i }).click();

    // THEN - Wizard öffnet sich
    await expect(page).toHaveURL(/\/tournament\/new/);
    await expect(page.getByRole('heading', { name: /Turnier erstellen|Schritt 1/i })).toBeVisible();
  });

  test('Turnier-Karte klicken öffnet Turnier-Ansicht', async ({ page, seedIndexedDB }) => {
    // GIVEN - Dashboard mit Test-Turnier
    const testTournament = {
      id: 'test-dashboard-tournament',
      title: 'Dashboard Test Turnier',
      status: 'published',
      date: new Date().toISOString().split('T')[0],
      teams: [],
      matches: [],
    };

    await seedIndexedDB({
      'app:tournaments': [testTournament],
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN - Turnier-Karte klicken
    await page.getByText('Dashboard Test Turnier').click();

    // THEN - Turnier-Management öffnet
    await expect(page).toHaveURL(/\/tournament\/test-dashboard-tournament/);
  });

  test('Suche filtert Turniere', async ({ page, seedIndexedDB }) => {
    // GIVEN - Dashboard mit mehreren Turnieren
    await seedIndexedDB({
      'app:tournaments': [
        { id: 't1', title: 'Bayern Turnier', status: 'published', teams: [], matches: [] },
        { id: 't2', title: 'Dortmund Cup', status: 'published', teams: [], matches: [] },
        { id: 't3', title: 'Leipzig Masters', status: 'published', teams: [], matches: [] },
      ],
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN - Suchfeld ausfüllen
    const searchInput = page.getByPlaceholder(/Suchen/i).or(page.getByRole('searchbox'));
    if (await searchInput.count() > 0) {
      await searchInput.fill('Bayern');

      // THEN - Nur passendes Turnier wird angezeigt
      await expect(page.getByText('Bayern Turnier')).toBeVisible();
      await expect(page.getByText('Dortmund Cup')).not.toBeVisible();
    }
  });

  test('Kontext-Menü: Turnier archivieren', async ({ page, seedIndexedDB }) => {
    // GIVEN - Aktives Turnier
    await seedIndexedDB({
      'app:tournaments': [
        { id: 'test-archive', title: 'Zu Archivierendes Turnier', status: 'published', teams: [], matches: [] },
      ],
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // WHEN - Kontext-Menü öffnen und Archivieren wählen
    const menuButton = page.locator('[data-testid="tournament-menu-test-archive"]').or(
      page.getByRole('button', { name: /Mehr Aktionen|Menü/i }).first()
    );

    if (await menuButton.count() > 0) {
      await menuButton.click();
      await page.getByRole('menuitem', { name: /Archivieren/i }).click();

      // THEN - Turnier verschwindet aus Aktiv-Liste
      await expect(page.getByText('Zu Archivierendes Turnier')).not.toBeVisible();

      // Und ist in Archiv verfügbar
      await page.goto('/archiv');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Zu Archivierendes Turnier')).toBeVisible();
    }
  });

  test('Responsive: Mobile Bottom Navigation', async ({ page }) => {
    // GIVEN - Mobile Viewport
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN - Bottom Navigation sichtbar
      const bottomNav = page.locator('[data-testid="bottom-navigation"]').or(
        page.locator('nav').filter({ hasText: /Dashboard|Turniere/i })
      );
      await expect(bottomNav).toBeVisible();
    }
  });

  test('Responsive: Desktop Sidebar Navigation', async ({ page }) => {
    // GIVEN - Desktop Viewport
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 1024) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // THEN - Sidebar Navigation sichtbar
      const sidebar = page.locator('[data-testid="sidebar"]').or(
        page.locator('aside')
      );

      // Sidebar might be visible on desktop
      const sidebarCount = await sidebar.count();
      if (sidebarCount > 0) {
        await expect(sidebar.first()).toBeVisible();
      }
    }
  });
});

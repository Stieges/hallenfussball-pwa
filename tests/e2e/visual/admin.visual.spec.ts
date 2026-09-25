/**
 * Visual Regression: Turnier-Admin (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Screen: /tournament/:id/admin/dashboard (Dashboard-Kategorie, src/features/tournament-admin/
 * TournamentAdminCenter.tsx). Mit explizitem `dashboard`-Kategorie-Segment in der URL rendert
 * diese Kategorie auf ALLEN Breakpoints denselben Aufbau (Sidebar+Content auf Tablet/Desktop,
 * AdminHeader+Content im "Spoke"-View auf Mobile) -- ohne das Segment würde Mobile stattdessen
 * den Hub (AdminMobileHub, eine andere Komponente) zeigen (TournamentAdminCenter.tsx:163-179).
 *
 * Maske `sync-status`: AdminHeader rendert SyncStatusBar (src/features/tournament-admin/
 * components/AdminHeader.tsx:198), die im Offline-Betrieb zwar keinen "vor X Min."-Text zeigt
 * (siehe helpers.ts-Kommentar), aber trotzdem als Badge sichtbar ist -- defensiv mitmaskiert.
 */

import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';
import { freezeClock, commonMasks, buildVisualTournament } from './helpers';

test('Turnier-Admin: Dashboard-Kategorie', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: 'visual-admin-tournament',
    title: 'Nordstadt Hallencup',
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto('/#/tournament/visual-admin-tournament/admin/dashboard');
  await page.waitForLoadState('networkidle');
  // NICHT auf t('admin:dashboard.title') ("Dashboard") warten: dieser Text erscheint auch im
  // AdminHeader-Breadcrumb (Mobile), der SOFORT da ist, noch während die lazy-geladene Kategorie
  // per <Suspense fallback={<CategorySkeleton />}> lädt (TournamentAdminCenter.tsx) -- ein
  // `.first()`-Fix dagegen hätte auf den Breadcrumb gewartet, nicht auf den echten Inhalt (genau
  // das ist beim ersten lokalen Stabilitäts-Lauf passiert: der zweite Vergleichslauf traf den
  // Screenshot noch im Skeleton-Zustand). "Fortschritt" (Stats-Karte) kommt nur im geladenen
  // Inhalt vor -- eindeutiges Signal, dass die Kategorie fertig gerendert hat.
  await expect(page.getByText(t('admin:dashboard.progress'))).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('admin.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});

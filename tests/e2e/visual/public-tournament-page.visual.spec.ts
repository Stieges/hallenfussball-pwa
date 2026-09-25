/**
 * Visual Regression: Öffentliche Turnierseite (Task T5, Ruling AE aus der Fixrunde-1-Vorgabe des
 * Controllers nach `task-T5-review.md`, Issue #1).
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * WICHTIG (Korrektur gegenüber dem ursprünglichen `public-view.visual.spec.ts`): Diese Route
 * (`/public/:tournamentId`, `PublicTournamentViewScreen`) ist EIN EIGENER Screen -- nicht
 * dieselbe Zuschauersicht wie `/live/:shareCode` (`LiveViewScreen`). Der ursprüngliche Report
 * behauptete fälschlich, beide rendere "denselben Screen"; tatsächlich zeigt `src/App.tsx:706-712`
 * (Kommentar "PublicLiveViewScreen was causing duplicate rendering with LiveViewScreen") und ein
 * Vergleich der beiden Komponenten, dass `LiveViewScreen` eigenständigen State hat
 * (`PublicBottomNav`, "Mein Team"-Auswahl, Pull-to-Refresh, Theme-Umschalter, URL-Filter
 * `g`/`p`/`s`/`tab`/`my`), den `PublicTournamentViewScreen` nicht besitzt (dafür
 * `ScheduleActionButtons` für Share/PDF). Diese Datei prüft deshalb nur die "Öffentliche
 * Turnierseite" als eigenständigen Screen -- die echte Zuschauersicht (`/live/:shareCode`) ist
 * als eigene Lücke in `live-view.visual.spec.ts` (`test.fixme`) dokumentiert, nicht hier
 * mitabgedeckt.
 */

import { test, expect } from '../helpers/test-fixtures';
import { freezeClock, commonMasks, buildVisualTournament } from './helpers';

test('Öffentliche Turnierseite: Turnier mit Ergebnissen', async ({ page, seedIndexedDB }) => {
  await freezeClock(page);

  const tournament = buildVisualTournament({
    id: 'visual-public-tournament',
    title: 'Nordstadt Hallencup',
  });

  await seedIndexedDB({ tournaments: [tournament] });

  await page.goto('/#/public/visual-public-tournament');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /Nordstadt Hallencup/i }).first()).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveScreenshot('public-tournament-page.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});

/**
 * D5b-D5d, D6b: Netz, Klärungsliste, Schnelleingabe und Update während eines Spiels (Plan (b)).
 * Alle expectedFail; jeder Schritt hat eine Soll-Wirkung, die der Besitzer baut.
 */
import { expect } from '@playwright/test';
import { fetchTurniertagBracket, expectPageAnchor, expectSollMarker, openTurniertagPath, TURNIERTAG_ID } from './shared';
import { newRoleContext, openCockpit } from '../../engineHelpers';
import type { StepContext, TurniertagStep } from './types';

/** D5b: Netzwechsel in der Halle (WLAN mehrmals weg und wieder da): kein Fehler, kein toter Kanal (@FU-025, C-REALTIME-RESUBSCRIBE-WIRFT). */
async function netzwechsel({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const { context, page } = await newRoleContext(browser, 'owner');
  try {
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await openCockpit(page, TURNIERTAG_ID, groupMatches[0].id);
    await expectPageAnchor(page.locator('[data-testid="team-name-home"]'), 'Cockpit');
    for (let i = 0; i < 3; i++) {
      await context.setOffline(true);
      await page.waitForTimeout(400);
      await context.setOffline(false);
      await page.waitForTimeout(400);
    }
    expect(fehler, 'kein Seitenfehler beim Netzwechsel').toEqual([]);
    await expect(page.locator('[data-testid="realtime-interrupted-hint"]')).toHaveCount(0, { timeout: 10000 });
    await expectSollMarker(page, 'realtime-channel-live');
  } finally {
    await context.close();
  }
}

/** D5c: widersprüchliche Offline-Einträge zweier Geräte landen in der Klärungsliste (Besitzer A-35/B-50). */
async function klaerungsliste({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'review-list');
}

/** D5d: Schnelleingabe im Spielplan, zweistelliges Ergebnis (10:2) ohne vorzeitiges Ende (@FU-080, C-SCHNELLEINGABE-TASTENDRUCK). */
async function schnelleingabe({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  const zelle = ownerPage.locator('[data-testid="quick-score-expand"]').first();
  await expect(zelle, 'Schnelleingabe-Zelle eines Spiels').toBeVisible({ timeout: 5000 });
  await zelle.click();
  const heim = ownerPage.getByLabel(/Heim|home/i).first();
  await heim.pressSequentially('10');
  await expect(heim, 'beide Ziffern bleiben stehen, kein Speichern nach der ersten').toHaveValue('10', { timeout: 3000 });
}

/** D6b: eine neue App-Version kommt nicht mitten im Spiel, die Version ist sichtbar (Ü1.4, B-31). */
async function updateImSpiel({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, groupMatches[0].id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit');
  await expectSollMarker(ownerPage, 'app-version-label');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D5b', title: 'Netzwechsel in der Halle: Realtime fängt sich, kein Fehler', scenarios: ['@FU-025'], befunde: ['C-REALTIME-RESUBSCRIBE-WIRFT'], owner: 'Paket RS (Realtime-Neuabo)', expectedFail: true, run: netzwechsel },
  { id: 'D5c', title: 'Widersprüchliche Offline-Einträge zweier Geräte: Klärungsliste', scenarios: ['@FU-037', '@FU-038'], befunde: ['C-KLAERUNGSLISTE-OHNE-PAKET'], owner: 'A-35/B-50', expectedFail: true, run: klaerungsliste },
  { id: 'D5d', title: 'Schnelleingabe im Spielplan: zweistelliges Ergebnis 10:2', scenarios: ['@FU-080'], befunde: ['C-SCHNELLEINGABE-TASTENDRUCK'], owner: 'H-Rest Kleinfix (Schnelleingabe)', expectedFail: true, run: schnelleingabe },
];

/** Nach D6 (Halbzeit, Zeitstrafe). */
export const stepsNachHalbzeit: readonly TurniertagStep[] = [
  { id: 'D6b', title: 'Neue Version während eines Spiels: kein Update im Spiel, Version sichtbar', scenarios: [], owner: 'B-31 (Ü1.4)', expectedFail: true, run: updateImSpiel },
];

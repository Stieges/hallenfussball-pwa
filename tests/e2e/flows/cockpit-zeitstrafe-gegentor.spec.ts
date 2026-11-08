/**
 * E2E (Gast, lokal) Zeitstrafe endet beim Gegentor (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT), Cockpit.
 * @SL-030 / @W2A-013: SV Süd hat eine Zeitstrafe; ein Tor für FC Nord beendet sie, das Cockpit zeigt „darf sich ergänzen“.
 * @W2A-015: Regel „endet bei Gegentor“ aus → die Strafe läuft nach dem Tor weiter, kein Hinweis.
 * @SL-200: ein Tor in derselben Sekunde wie der Strafbeginn beendet die Strafe nicht (Einheit: LiveCockpit.zeitstrafeGegentor.engine).
 * Bilder (gleiche Daten vorher/nachher) nach `ZSG_BILDER`, sonst keine. Läuft in den Offline-Projekten.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { cup, anpfeifen } from '../helpers/laptopCup';
import { schliesseTorAuswahl, wartePicker } from '../helpers/cockpitNeu';

const BILDER = process.env.ZSG_BILDER ?? '';

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === '') { return; }
  mkdirSync(BILDER, { recursive: true });
  writeFileSync(join(BILDER, `${name}.png`), await page.screenshot());
}

function cupMitRegel(endetBeiGegentor: boolean) {
  return { ...cup(), matchCockpitSettings: { penaltyEndsOnGoal: endetBeiGegentor } };
}

/** Zeitstrafe für die Rückennummer 5 des Gastteams (SV Süd). */
async function strafeFuerNr5(page: Page): Promise<void> {
  await page.getByTestId('penalty-button-away').click();
  await wartePicker(page);
  await page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
  await expect(page.getByTestId('number-picker')).toBeHidden();
}

/** Laufende Strafen: Marke in der Tafel (Handy, Tablet hochkant) oder Karte in der Strafen-Spalte (Laptop). */
const marke = (page: Page) => page.getByTestId('scoreboard').getByText(/^#5 [01]:\d{2}$/)
  .or(page.getByRole('listitem', { name: /, #5, Restzeit [01]:\d{2}$/ }));

async function torFuerHeim(page: Page): Promise<void> {
  // @SL-200: ein Tor in derselben Sekunde wie der Strafbeginn zählt nicht – also warten, bis die Uhranzeige weitergesprungen ist
  const tafel = page.getByTestId('scoreboard');
  const uhrVorher = await tafel.innerText();
  await expect.poll(async () => tafel.innerText(), { timeout: 5_000 }).not.toBe(uhrVorher);
  await page.getByTestId('goal-button-home').click();
  await schliesseTorAuswahl(page);
}

test.describe('Zeitstrafe endet beim Gegentor (@SL-030, @W2A-013, @W2A-015)', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
  });

  test('@SL-030 @W2A-013 Regel an: das Tor von FC Nord beendet die Strafe von SV Süd, das Cockpit zeigt „darf sich ergänzen“', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cupMitRegel(true)] });
    await anpfeifen(page);
    await strafeFuerNr5(page);
    await expect(marke(page)).toBeVisible();
    await expect(page.getByTestId('team-ergaenzen-away')).toHaveCount(0);
    await bild(page, `cockpit-strafe-laeuft-${testInfo.project.name}`);
    await torFuerHeim(page);
    await bild(page, `cockpit-nach-gegentor-regel-an-${testInfo.project.name}`);
    await expect(marke(page)).toHaveCount(0);
    await expect(page.getByTestId('team-ergaenzen-away')).toHaveText('darf sich ergänzen');
    await expect(page.getByTestId('team-ergaenzen-home')).toHaveCount(0);
  });

  test('@W2A-015 Regel aus: nach dem Tor von FC Nord läuft die Strafe weiter, kein Hinweis', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cupMitRegel(false)] });
    await anpfeifen(page);
    await strafeFuerNr5(page);
    await torFuerHeim(page);
    await bild(page, `cockpit-nach-gegentor-regel-aus-${testInfo.project.name}`);
    await expect(marke(page)).toBeVisible();
    await expect(page.getByTestId('team-ergaenzen-away')).toHaveCount(0);
  });
});

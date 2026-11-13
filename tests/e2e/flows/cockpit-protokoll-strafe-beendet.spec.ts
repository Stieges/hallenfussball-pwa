/**
 * E2E (Gast, lokal) @SL-242 Das Ereignisprotokoll im Cockpit sagt an der Zeitstrafe, dass ein Tor sie beendet hat.
 * Weg: Strafe für SV Süd Nr. 5, Gegentor von FC Nord, Protokoll öffnen (Laptop: Liste daneben, sonst Knopf „Ereignisse“) → Zeile der Zeitstrafe
 * trägt „beendet durch Tor mm:ss“; Tor zurücknehmen → Zusatz weg, Strafe läuft weiter (@SL-044). Gegenbeispiel: Regel „endet bei Gegentor“
 * aus → kein Zusatz. Zeile bricht um, nichts läuft über (360 px). Bilder (gleiche Daten) nach `PSB_BILDER`, sonst keine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { animationenFertig } from '../helpers/animationenFertig';
import { cup, anpfeifen } from '../helpers/laptopCup';
import { schliesseTorAuswahl, wartePicker } from '../helpers/cockpitNeu';

const BILDER = process.env.PSB_BILDER ?? '';
const zusatz = (page: Page) => page.getByTestId('event-penalty-ended-by-goal').filter({ visible: true });

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === '') { return; }
  await animationenFertig(page);
  mkdirSync(BILDER, { recursive: true });
  writeFileSync(join(BILDER, `${name}.png`), await page.screenshot());
}

async function strafeFuerNr5(page: Page): Promise<void> {
  await page.getByTestId('penalty-button-away').click();
  await wartePicker(page);
  await page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
  await expect(page.getByTestId('number-picker')).toBeHidden();
}

/** Laufende Strafe: Marke in der Tafel (Handy, Tablet hochkant) oder Karte in der Strafen-Spalte (Laptop). */
const marke = (page: Page) => page.getByTestId('scoreboard').getByText(/^#5 [01]:\d{2}$/)
  .or(page.getByRole('listitem', { name: /, #5, Restzeit [01]:\d{2}$/ }));

async function torFuerHeim(page: Page): Promise<void> {
  // @SL-200: ein Tor in derselben Sekunde wie der Strafbeginn zählt nicht – erst wenn die Strafe angezeigt wird, dann warten, bis die Uhranzeige weitergesprungen ist
  await expect(marke(page)).toBeVisible();
  const tafel = page.getByTestId('scoreboard');
  const uhrVorher = await tafel.innerText();
  await expect.poll(async () => tafel.innerText(), { timeout: 5_000 }).not.toBe(uhrVorher);
  await page.getByTestId('goal-button-home').click();
  await schliesseTorAuswahl(page);
}

const listeDaneben = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;

async function oeffneProtokoll(page: Page): Promise<void> {
  if (!listeDaneben(page)) {
    await page.getByTestId('match-event-log-button').click();
    await expect(page.getByTestId('event-log-sheet')).toBeVisible();
  }
}

async function schliesseProtokoll(page: Page): Promise<void> {
  if (!listeDaneben(page)) {
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('event-log-sheet')).toBeHidden();
  }
}

/** Nichts läuft über: kein waagerechter Überlauf der Seite, die Zeile des Zusatzes liegt ganz im Fenster. */
async function zeileSauber(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = (await zusatz(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const abgeschnitten = await zusatz(page).evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(abgeschnitten, 'Zusatz nicht abgeschnitten').toBe(false);
}

test.describe('@SL-242 Zusatz „beendet durch Tor“ im Ereignisprotokoll des Cockpits', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie cockpit-zeitstrafe-gegentor.spec.ts)');
  });

  test('@SL-242 Gegentor beendet die Strafe: Zeile trägt den Zusatz; Tor zurücknehmen → Zusatz weg', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [{ ...cup(), matchCockpitSettings: { penaltyEndsOnGoal: true } }] });
    await anpfeifen(page);
    await strafeFuerNr5(page);
    await oeffneProtokoll(page);
    await expect(zusatz(page)).toHaveCount(0); // läuft noch: kein Zusatz
    await bild(page, `protokoll-strafe-laeuft-${testInfo.project.name}`);
    await schliesseProtokoll(page);

    await torFuerHeim(page);
    await oeffneProtokoll(page);
    await expect(zusatz(page)).toHaveCount(1);
    await expect(zusatz(page)).toHaveText(/^beendet durch Tor \d{2}:\d{2}$/);
    await zeileSauber(page);
    await bild(page, `protokoll-strafe-beendet-${testInfo.project.name}`);
    await schliesseProtokoll(page);

    await page.getByTestId('match-undo-button').click();
    await oeffneProtokoll(page);
    await expect(zusatz(page)).toHaveCount(0);
    await bild(page, `protokoll-strafe-tor-zurueck-${testInfo.project.name}`);
  });

  test('@SL-242 Regel „endet bei Gegentor“ aus: das Tor erzeugt keinen Zusatz', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [{ ...cup(), matchCockpitSettings: { penaltyEndsOnGoal: false } }] });
    await anpfeifen(page);
    await strafeFuerNr5(page);
    await torFuerHeim(page);
    await oeffneProtokoll(page);
    await expect(page.getByTestId('event-penalty-ended-by-goal')).toHaveCount(0);
    await bild(page, `protokoll-strafe-regel-aus-${testInfo.project.name}`);
  });
});

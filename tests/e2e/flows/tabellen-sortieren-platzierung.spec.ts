/**
 * Task 6 „Tabellen sortieren“, Reiter Tabellen, Ansicht „Gesamtplatzierung“ (Regel T2-UI): @TS-002 sortiert nach „Gruppe“ / „Gegentore“,
 * der Rang bleibt am Team; @TS-005 „Nach Platzierung“; @TS-012 am Handy nur über „Sortieren nach …“. Saat `hallencup-messlauf`
 * (zwei Gruppen, Finalrunde). Läuft gegen den lokalen Dev-Server ohne Supabase; nie gegen die Produktion.
 * Mit `BILDER_ORDNER=<pfad>` entstehen zusätzlich Bilder (Vorgabe, nach Gruppe, nach Gegentore) bei 1280 und 390 px.
 */
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const ID = 'hallencup-messlauf';
const ADRESSE = `/#/tournament/${ID}/standings?ansicht=platzierung`;
const BILDER = process.env.BILDER_ORDNER;

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
});

async function oeffne(page: import('@playwright/test').Page, breite: number, adresse = ADRESSE): Promise<void> {
  await page.setViewportSize({ width: breite, height: 900 });
  await installiereSaat(page.context(), leseSaat(ID));
  await page.goto(adresse);
  await expect(page.locator('table:visible').first()).toBeVisible({ timeout: 25000 });
}

const plaetze = (page: import('@playwright/test').Page) => page.locator('table:visible tbody tr:has([data-testid="place-medal"]) [data-testid="place-medal"]').allTextContents();

test('@TS-002 @TS-005 Platzierung am Laptop: nach „Gruppe“ sortiert, Rang bleibt, „Platz“ stellt die Vorgabe wieder her', async ({ page }) => {
  await oeffne(page, 1280);
  const vorgabe = await plaetze(page);
  expect(vorgabe.length).toBeGreaterThan(4);
  if (BILDER) {await page.screenshot({ path: `${BILDER}/leitung-1280-1-vorgabe.png` });}

  await page.getByTestId('sort-head-gesamt-gruppe').click();
  await expect(page).toHaveURL(/ts=gesamt\.gruppe/);
  const nachGruppe = await plaetze(page);
  expect(nachGruppe).not.toEqual(vorgabe);
  expect([...nachGruppe].sort()).toEqual([...vorgabe].sort()); // gleiche Plätze, nur andere Zeilenfolge
  const gruppen = await page.locator('table:visible tbody tr td:nth-child(4)').allTextContents();
  expect(gruppen).toEqual([...gruppen].sort());
  if (BILDER) {await page.screenshot({ path: `${BILDER}/leitung-1280-2-gruppe.png` });}

  await page.getByTestId('sort-head-gesamt-tore').click(); // Tore meiste
  await page.getByTestId('sort-head-gesamt-tore').click(); // Tore wenigste
  await page.getByTestId('sort-head-gesamt-tore').click(); // Gegentore wenigste
  await expect(page.getByTestId('sort-head-gesamt-tore')).toHaveAccessibleName(/^Gegentore, wenigste zuerst/);
  await expect(page.locator('table:visible [data-goals-focus="against"]').first()).toBeVisible();
  if (BILDER) {await page.screenshot({ path: `${BILDER}/leitung-1280-3-gegentore.png` });}

  await page.getByTestId('sort-head-gesamt-platz').click();
  expect(await plaetze(page)).toEqual(vorgabe);
  await expect(page.getByTestId('sort-reset-gesamt')).toHaveCount(0);
});

test('@TS-012 @TS-005 Platzierung am Handy: Köpfe nur Anzeige, „Sortieren nach …“ ändert die Reihenfolge, „Nach Platzierung“ stellt sie wieder her', async ({ page }) => {
  await oeffne(page, 390);
  const vorgabe = await plaetze(page);
  await expect(page.locator('table:visible thead button')).toHaveCount(0);
  if (BILDER) {await page.screenshot({ path: `${BILDER}/leitung-390-1-vorgabe.png` });}

  const auswahl = page.getByTestId('sort-picker-gesamt');
  await auswahl.selectOption('gruppe');
  await expect(page).toHaveURL(/ts=gesamt\.gruppe/);
  expect(await plaetze(page)).not.toEqual(vorgabe);
  if (BILDER) {await page.screenshot({ path: `${BILDER}/leitung-390-2-gruppe.png` });}

  // „Gegentore“ ist am Handy keine sichtbare Spalte und steht nicht in der Auswahl (@TS-012 geparkt, Daniel 27.11.): stattdessen „Punkte“
  await auswahl.selectOption('pkt');
  await expect(page).toHaveURL(/ts=gesamt\.pkt/);
  if (BILDER) {await page.screenshot({ path: `${BILDER}/leitung-390-3-punkte.png` });}

  await auswahl.selectOption('platz');
  expect(await plaetze(page)).toEqual(vorgabe);
  await expect(page.getByTestId('sort-reset-gesamt')).toHaveCount(0);
});

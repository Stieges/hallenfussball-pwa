/**
 * H4-10 (@HT-011, @HT-013, @HT-014, @HT-023, @HT-033 Zeile 8, @HT-037, @HT-039, @HT-017): große Zustände am Gerät, Regler und die Rückfrage beim
 * Anhören am Prüfstand tests/e2e/harness/hallenton-dieses-geraet.html (echte Seitenleiste, echte Seitenansicht mit dem echten Abschnitt; der Zustand je
 * Feld kommt aus den echten Funktionen, die Frage aus dem echten Hook), bei 360×640 und 1280×720, hell und dunkel.
 * Je Fall: die Wortlaute des Records stehen da, das Statuswort hat die Größe 28 px (Handy) bzw. 48 px (Rechner), jede Taste ≥ 44 px, nichts
 * läuft über, kein HART-Befund der Messung von `npm run visual:metrics`. Bilder: Ordner aus H410_BILDER (sonst Testausgabe).
 * Läuft nur im Projekt `desktop` am Dev-Server (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { GERAETE, hartBefunde, speichereBild } from './helpers/hallentonPruefstand';

const FAELLE = ['bereit', 'eingerichtet', 'lautstaerke0', 'schlafen', 'angehalten', 'anderesFenster', 'anhoerenFrage'] as const;
type Fall = (typeof FAELLE)[number];
const BENENNUNG: Record<Fall, string> = {
  bereit: 'bereit', eingerichtet: 'ton-nicht-aktiviert', lautstaerke0: 'lautstaerke-0', schlafen: 'schlafen-gelegt', angehalten: 'app-angehalten',
  anderesFenster: 'zweites-fenster', anhoerenFrage: 'anhoeren-rueckfrage',
};

async function pruefeWortlaute(page: Page, fall: Fall): Promise<void> {
  const zustand = page.locator('[data-zustand][data-ton]');
  switch (fall) {
    case 'bereit':
      await expect(zustand).toContainText('Lautsprecher bereit');
      await expect(zustand).toContainText('Feld 1 · Laptop Turnierleitung');
      await expect(page.getByText(/Nächster Ton/), 'geparkt (Record), nicht gebaut').toHaveCount(0);
      await expect(page.getByTestId('hallenton-fussleiste')).toHaveCount(0);
      break;
    case 'eingerichtet':
      await expect(zustand).toContainText('Lautsprecher nicht bereit');
      await expect(zustand).toContainText('Grund: Ton nicht aktiviert');
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText('nicht bereit – Ton nicht aktiviert');
      await expect(page.getByTestId('ton-aktivieren')).toBeVisible();
      break;
    case 'lautstaerke0':
      await expect(zustand).toContainText('Lautstärke steht auf 0 %');
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText('nicht bereit – Lautstärke 0 %');
      await expect(page.getByTestId('regler-abpfiff-wert')).toHaveText('0 %');
      break;
    case 'schlafen':
      await expect(zustand).toContainText('Lautsprecher schlafen gelegt');
      await expect(zustand).toContainText('Der Browser hat den Lautsprecher schlafen gelegt');
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText('nicht bereit – schlafen gelegt');
      await expect(page.getByTestId('ton-aktivieren')).toBeVisible();
      break;
    case 'angehalten':
      await expect(zustand).toContainText('Lautsprecher bereit');
      await expect(page.getByTestId('geraet-banner-angehalten')).toContainText('App war angehalten – Töne können gefehlt haben');
      await expect(page.getByTestId('geraet-angehalten-bestaetigen')).toHaveText('Bestätigen');
      break;
    case 'anderesFenster':
      await expect(zustand).toContainText('Lautsprecher läuft schon in einem anderen Fenster');
      await expect(zustand).toHaveAttribute('data-ton', 'info'); // ruhig: keine Warnfarbe
      await expect(zustand.getByRole('button')).toHaveCount(0);
      await expect(page.getByTestId('hallenton-fussleiste')).toHaveCount(0);
      break;
    case 'anhoerenFrage':
      await expect(page.getByText('Auf Feld 1 läuft Spiel 11. Trotzdem anhören?')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Anhören', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible();
      break;
  }
  // @HT-023: drei Regler mit Wert und „Anhören“ (Abpfiff 80 %, Halbzeit 50 %, Torhymne 40 %; bei „Lautstärke 0 %“ der Abpfiff auf 0 %)
  await expect(page.locator('[data-testid^="regler-"][data-testid$="-schieber"]')).toHaveCount(3);
  await expect(page.getByTestId('regler-halbzeit-wert')).toHaveText('50 %');
  await expect(page.getByTestId('regler-tor-wert')).toHaveText('40 %');
}

/** Anordnung der Regler: am Handy wie im Mockup (Schieber über die Breite, „Anhören“ darunter), am Rechner in einer Zeile. */
async function pruefeReglerAnordnung(page: Page, schmal: boolean): Promise<void> {
  const schieber = await page.getByTestId('regler-abpfiff-schieber').boundingBox();
  const taste = await page.getByTestId('regler-abpfiff-anhoeren').boundingBox();
  expect(schieber && taste).toBeTruthy();
  if (schieber === null || taste === null) { return; }
  if (schmal) {
    expect(taste.y, 'Handy: „Anhören“ steht unter dem Schieber').toBeGreaterThanOrEqual(schieber.y + schieber.height);
    expect(schieber.width, 'Handy: der Schieber ist breit genug zum Einstellen').toBeGreaterThan(150);
  } else {
    expect(Math.abs((taste.y + taste.height / 2) - (schieber.y + schieber.height / 2)), 'Rechner: Schieber und „Anhören“ in einer Zeile').toBeLessThan(taste.height);
  }
}

test.describe('@HT-011 @HT-013 @HT-014 @HT-023 @HT-033 @HT-037 @HT-017 H4-10 „Dieses Gerät“ b (Prüfstand)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const fall of FAELLE) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`@HT-023 ${fall} ${g.name}, ${thema}: Wortlaute, Statuswort, Tasten ≥ 44 px, nichts läuft über`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/hallenton-dieses-geraet.html?fall=${fall}`);
          await expect(page.getByTestId('hallenton-seite')).toBeVisible();
          await pruefeWortlaute(page, fall);
          await pruefeReglerAnordnung(page, g.schmal);
          const wortGroesse = await page.locator('[data-zustand][data-ton] p').first().evaluate((el) => getComputedStyle(el).fontSize);
          expect(wortGroesse, 'Statuswort: 28 px am Handy, 48 px am Rechner').toBe(g.schmal ? '28px' : '48px');
          const tasten = fall === 'anhoerenFrage' ? page.locator('button') : page.locator('[data-testid="hallenton-seite"] button');
          for (const k of await tasten.all()) {
            if (await k.isVisible()) {
              expect((await k.boundingBox())?.height ?? 0, `Taste ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
            }
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="hallenton-seite"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
          expect(ueberlauf, 'kein Überlauf').toEqual([]);
          await page.waitForTimeout(400);
          for (const b of await hartBefunde(page, g.art)) {
            testInfo.annotations.push({ type: 'befund-gesamt', description: b });
          }
          await page.addStyleTag({ content: 'aside { visibility: hidden; }' });
          expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung (Seite ohne Seitenleiste)').toEqual([]);
          await page.addStyleTag({ content: 'aside { visibility: visible; }' });
          await speichereBild(page, testInfo.outputDir, 'H410_BILDER', `h4-10-${BENENNUNG[fall]}-${g.name}-${thema}`);
        });
      }
    }
  }
});

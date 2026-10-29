/**
 * R5 PR 3 „Kleinteile“ (Regel T2-UI): @ZM-177 keine Gruppenangabe bei einer Gruppe (Monitor-Kopfzeile),
 * @W2A-059 Markierung „Strafstoß folgt“ / „wird entschieden“ auf der Monitor-Tabelle, @HT-030 „Anhören“ im Assistenten
 * (Schritt „Modus“, Bereich Cockpit), @W3-039 „Farbe & Logo“ mit Farbpunkt im Assistenten (Schritt Teams).
 * Läuft gegen den lokalen Dev-Server ohne Supabase; Daten über Saaten. Bilder nur mit R5_BILDER=<Ordner>.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.R5_BILDER;
async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

interface Saat { datenbanken: { store: string; eintraege: { tournaments?: Array<Record<string, unknown> & { id: string; matches?: Array<Record<string, unknown>> }> } }[] }
const turnierIn = (saat: Saat, id: string) => saat.datenbanken.find((d) => d.store === 'cache')?.eintraege.tournaments?.find((x) => x.id === id);

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || !['desktop', 'mobile-sm', 'mobile-md'].includes(testInfo.project.name), 'eigene Fenstergrößen');
});

test.describe('@ZM-177 Kopfzeile der Live-Folie', () => {
  for (const [gruppe, erwartet] of [['all', ''], ['A', 'Gruppe A']] as const) {
    test(`Spiel in Gruppe „${gruppe}“: Gruppenangabe „${erwartet}“`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const saat = leseSaat('hallencup-messlauf') as Saat;
      const spiel = turnierIn(saat, 'hallencup-messlauf')?.matches?.find((m) => m.matchStatus === 'running');
      expect(spiel, 'laufendes Spiel in der Saat').toBeDefined();
      if (spiel) { spiel.group = gruppe; }
      await installiereSaat(page.context(), saat);
      await page.goto('/#/display/hallencup-messlauf/mon-live');
      await expect(page.getByTestId('live-header')).toBeVisible({ timeout: 25000 });
      await expect(page.getByTestId('live-group')).toHaveText(erwartet);
      await expect(page.getByTestId('live-header')).not.toContainText(/\ball\b/);
      await bild(page, `monitor-kopfzeile-${gruppe}-1920`);
    });
  }
});

test.describe('@W2A-059 Monitor-Tabelle mit offenem Gleichstand', () => {
  for (const [pflicht, text, art] of [[[3], 'Strafstoß folgt', 'follows'], [[1], 'wird entschieden', 'deciding']] as const) {
    test(`Platz 3 ${pflicht[0] === 3 ? 'mit' : 'ohne'} Pflicht: „${text}“ an beiden Zeilen, gleiche Platzziffer, keine Taste`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const saat = leseSaat('nikolaus-gleichstand') as Saat;
      const turnier = turnierIn(saat, 'nikolaus-gleichstand');
      expect(turnier).toBeDefined();
      if (turnier) {
        turnier.placementsToPlayOut = [...pflicht];
        turnier.version = 1;
        turnier.monitors = [{ id: 'mon-tab', name: 'Tabelle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0, theme: 'dark', performanceMode: 'auto',
          slides: [{ id: 's-alle', type: 'all-standings', config: {}, order: 0, duration: null }], createdAt: '2026-11-14T07:00:00.000Z', updatedAt: '2026-11-14T07:00:00.000Z' }];
      }
      await installiereSaat(page.context(), saat);
      await page.goto('/#/display/nikolaus-gleichstand/mon-tab');
      const marken = page.getByTestId('monitor-tie-mark');
      await expect(marken).toHaveCount(2, { timeout: 25000 });
      await expect(marken.first()).toHaveAttribute('data-mark', art);
      const zeilen = page.getByTestId('standings-row').filter({ has: marken });
      await expect(zeilen).toHaveCount(2);
      const ziffern = await zeilen.evaluateAll((rows) => rows.map((r) => r.children[0].textContent));
      expect(new Set(ziffern).size, 'gleiche Platzziffer').toBe(1);
      await expect(zeilen.locator('button, a, input')).toHaveCount(0);
      await bild(page, `monitor-tabelle-${art}-1920`);
    });
  }
});

test.describe('@HT-030 Anhören im Assistenten', () => {
  test('Schritt „Modus“, Bereich Cockpit: zwei „Anhören“-Knöpfe ≥ 44 px, Klick spielt den Ton', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __gespielt: number };
      w.__gespielt = 0;
      HTMLMediaElement.prototype.play = function play() { w.__gespielt += 1; return Promise.resolve(); };
    });
    await page.goto('/#/tournament/new?step=3');
    await page.getByRole('button', { name: /Cockpit/i }).first().click();
    const knoepfe = page.getByRole('button', { name: 'Anhören' });
    await expect(knoepfe).toHaveCount(2);
    for (const k of await knoepfe.all()) {
      await k.scrollIntoViewIfNeeded();
      expect((await k.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await bild(page, `wizard-schritt3-anhoeren-${page.viewportSize()?.width ?? 0}`);
    await knoepfe.first().click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __gespielt: number }).__gespielt)).toBeGreaterThanOrEqual(1);
  });
});

test.describe('@W3-039 Farbe & Logo im Assistenten', () => {
  test('Schritt Teams: beschrifteter Knopf je Team ≥ 44 px, aria-expanded, Farbpunkt nach Farbwahl', async ({ page }) => {
    await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
    await page.goto('/#/tournament/hallencup-entwurf/edit?step=5');
    const knopf = page.getByRole('button', { name: /Farbe & Logo/ }).first();
    await expect(knopf).toBeVisible({ timeout: 25000 });
    await knopf.scrollIntoViewIfNeeded();
    expect((await knopf.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await bild(page, `wizard-schritt5-farbe-logo-zu-${page.viewportSize()?.width ?? 0}`);
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-expanded', 'true');
    await page.locator('button[aria-haspopup="true"]').first().click();
    await page.getByRole('option', { name: /Farbe #000000/i }).or(page.getByLabel(/Farbe #000000/i)).first().click();
    await expect(knopf.locator('[role="img"]')).toBeVisible();
    await bild(page, `wizard-schritt5-farbe-logo-offen-${page.viewportSize()?.width ?? 0}`);
  });
});

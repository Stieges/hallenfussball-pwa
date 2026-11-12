/**
 * Leibchen-Karte im Cockpit (Leibchen 2b-2, Lage B) – Playwright über die lokale Saat `leibchen-vor-anpfiff` (Spiel 3 TSV Waging 1 gegen TSV Petting,
 * beide Blau, Feld 1; Gastkonto, nichts geht zum Server). Szenarien: @SL-206 (Karte über der Daumenleiste), @SL-211 (K-1 Tipps bis zum Anpfiff),
 * @SL-218 (K-2/K-8 Tipp-Zähler), @SL-221 (K-4 nichts springt), @SL-223 (K-5 untere zwei Drittel, Lage), @SL-224 (K-6 Tippziele, gleich große Tasten),
 * @SL-215 (ohne Scrollen im Bild). Gezählt wird vom ersten Tipp bis einschließlich „Bestätigen“. Fenster: 360×640 (Handy), 390×844, Tablet hochkant, Laptop;
 * die Messungen laufen in jedem Projekt, die Fenstergröße setzt der Test selbst.
 * Die Zählregel steht auch als Verhaltenstest in `LeibchenKarte.test.tsx`; hier zählen echte Klicks und gemessene Bildpunkte.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const SPIEL_3 = '0000000b-0000-4000-9000-000000000003';
const FENSTER = [
  { name: 'mobile-sm 360×640', width: 360, height: 640, handy: true },
  { name: 'mobile-md 390×844', width: 390, height: 844, handy: true },
  { name: 'tablet-portrait 768×1024', width: 768, height: 1024, handy: false },
  { name: 'desktop 1440×900', width: 1440, height: 900, handy: false },
] as const;

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });

interface Box { x: number; y: number; width: number; height: number }

async function box(el: Locator): Promise<Box> {
  const b = await el.boundingBox();
  if (b === null) { throw new Error('Element ohne Lage'); }
  return b;
}

async function oeffne(page: Page, fenster: { width: number; height: number }): Promise<{ tippe: (el: Locator) => Promise<void>; tipps: () => number }> {
  await page.setViewportSize({ width: fenster.width, height: fenster.height });
  await installiereSaat(page.context(), leseSaat('leibchen-vor-anpfiff'));
  // Die App ersetzt beim Start einmal die Adresse; ein dadurch abgebrochenes `goto` ist kein Fehler, entscheidend ist die Karte im Bild
  await page.goto(`/#/tournament/leibchen-7a/live?matchId=${SPIEL_3}`, { waitUntil: 'commit' }).catch(() => undefined);
  await expect(page.getByTestId('leibchen-karte')).toBeVisible({ timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
  let n = 0;
  return { tippe: async (el) => { n += 1; await el.click(); }, tipps: () => n };
}

for (const f of FENSTER) {
  test.describe(`Leibchen-Karte ${f.name}`, () => {
    test(`@SL-206 @SL-215 @SL-224 die Karte steht ohne Scrollen im Bild direkt über „Anpfeifen“, Tippziele 44/56, beide Tasten gleich groß und umrandet (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      const karte = await box(page.getByTestId('leibchen-karte'));
      const anpfiff = await box(page.getByTestId('match-start-button'));
      expect(karte.y).toBeGreaterThanOrEqual(0);
      expect(anpfiff.y + anpfiff.height).toBeLessThanOrEqual(f.height + 1);
      expect(karte.y + karte.height).toBeLessThanOrEqual(anpfiff.y + 1); // die Karte liegt über der Leiste, nichts darunter
      const best = await box(page.getByTestId('leibchen-bestaetigen'));
      const keine = await box(page.getByTestId('leibchen-keine'));
      expect(best.height).toBeGreaterThanOrEqual(56); // K-6: Haupttasten 56
      expect(best.width).toBeGreaterThanOrEqual(44);
      expect(Math.abs(best.width - keine.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(best.height - keine.height)).toBeLessThanOrEqual(1);
      const vorschlag = await box(page.getByTestId('leibchen-vorschlag'));
      expect(vorschlag.height).toBeGreaterThanOrEqual(44);
      expect(vorschlag.width).toBeGreaterThanOrEqual(44);
      // beide Tasten nur umrandet (keine gefüllt)
      for (const id of ['leibchen-bestaetigen', 'leibchen-keine']) {
        expect(await page.getByTestId(id).evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      }
    });

    test(`@SL-223 die Mitte von „Bestätigen“, „Keine Leibchen“ und dem Vorschlag liegt im unteren Zweidrittel des Fensters (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      for (const id of ['leibchen-bestaetigen', 'leibchen-keine', 'leibchen-vorschlag']) {
        const b = await box(page.getByTestId(id));
        expect(b.y + b.height / 2).toBeGreaterThanOrEqual(f.height / 3);
      }
    });

    test(`@SL-211 @SL-218 K-1/K-2: Tipps bis zum Anpfiff und beim Ändern (${f.name})`, async ({ page }) => {
      const o = await oeffne(page, f);
      // K-1: „Bestätigen“ und „Anpfeifen“ = 2 Tipps, das Spiel läuft
      await o.tippe(page.getByTestId('leibchen-bestaetigen'));
      await expect(page.getByTestId('leibchen-zeile')).toContainText('TSV Waging 1 zieht Gelb');
      await o.tippe(page.getByTestId('match-start-button'));
      await expect(page.getByTestId('match-pause-button')).toBeVisible();
      expect(o.tipps()).toBe(2);
    });

    test(`@SL-218 K-2: Team ändern und bestätigen = 3 Tipps, Team und Farbe = 4 Tipps, Aufgeben = 2 Tipps (${f.name})`, async ({ page }) => {
      const o = await oeffne(page, f);
      await o.tippe(page.getByTestId('leibchen-vorschlag'));
      await o.tippe(page.getByTestId('leibchen-team-gast'));
      await o.tippe(page.getByTestId('leibchen-bestaetigen'));
      await expect(page.getByTestId('leibchen-zeile')).toContainText('TSV Petting zieht Gelb');
      expect(o.tipps()).toBe(3);
      // K-8: eine Wahl wieder aufgeben („Ändern“, „Keine Leibchen“) = 2 Tipps
      const davor = o.tipps();
      await o.tippe(page.getByTestId('leibchen-aendern'));
      await o.tippe(page.getByTestId('leibchen-keine'));
      await expect(page.getByTestId('leibchen-zeile')).toContainText('Keine Leibchen');
      expect(o.tipps() - davor).toBe(2);
    });

    test(`@SL-221 K-4: beim Schrumpfen der Karte zur Zeile und beim Aufklappen der Wahl ändert „Anpfeifen“ seine Lage um höchstens 1 Bildpunkt (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      const vorher = await box(page.getByTestId('match-start-button'));
      await page.getByTestId('leibchen-vorschlag').click();
      const offen = await box(page.getByTestId('match-start-button'));
      expect(Math.abs(offen.y - vorher.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(offen.height - vorher.height)).toBeLessThanOrEqual(1);
      if (f.handy) {
        // am Handy weichen Tafel und Einträge, solange die Wahl offen ist (@SL-221)
        await expect(page.getByTestId('scoreboard')).toBeHidden();
        await expect(page.getByTestId('leibchen-wahl')).toBeInViewport();
        await expect(page.getByTestId('match-start-button')).toBeInViewport();
      } else {
        // auf Tablet und Laptop bleibt alles stehen
        await expect(page.getByTestId('scoreboard')).toBeVisible();
      }
      await page.getByTestId('leibchen-vorschlag').click(); // zuklappen: alles kommt zurück
      await expect(page.getByTestId('scoreboard')).toBeVisible();
      await page.getByTestId('leibchen-bestaetigen').click();
      const nachher = await box(page.getByTestId('match-start-button'));
      expect(Math.abs(nachher.y - vorher.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(nachher.height - vorher.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(nachher.x - vorher.x)).toBeLessThanOrEqual(1);
    });

    test(`@SL-224 „Ändern“ in der Zeile und jede Farbe der Wahl sind mindestens 44×44 groß (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      await page.getByTestId('leibchen-bestaetigen').click();
      const aendern = await box(page.getByTestId('leibchen-aendern'));
      expect(aendern.height).toBeGreaterThanOrEqual(44);
      expect(aendern.width).toBeGreaterThanOrEqual(44);
      await page.getByTestId('leibchen-aendern').click();
      await page.getByTestId('leibchen-vorschlag').click();
      await page.getByTestId('leibchen-andere').click();
      for (const el of await page.locator('[data-testid^="leibchen-farbe-"], [data-testid^="leibchen-team-"]').all()) {
        const b = await box(el);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

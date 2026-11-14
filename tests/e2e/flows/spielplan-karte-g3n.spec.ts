/**
 * E2E (G3-N N1a, Regel T2-UI): die Karte „Läuft / Nächstes Spiel“ oben im Spielplan der Turnierleitung und die schwebende Taste
 * „Zum laufenden Spiel“, offline (Gast = Turnierleitung, Wegwerf-Turnier im lokalen Speicher).
 *
 * Szenario @ZP-109 (docs/anforderungen/2026-10-02_zeitplan-rueckt-nach.md): Karte mit Haupttaste und „Danach“-Zeile; Taste „Zum laufenden Spiel“
 * nur unter 1280 Bildpunkten, nur nach mehr als 200 Bildpunkten Scrollen, wenn die Karte aus dem Bild ist; sie springt zur Karte und verschwindet,
 * sobald die Karte wieder im Bild ist. Haupttaste mindestens 56 px hoch (@OB-022), nichts ragt über den Rand (@OB-021).
 */
import { test, expect } from '../helpers/test-fixtures';
import { animationenFertig } from '../helpers/animationenFertig';
import { cup, ID, NAMEN, NAME_50, anpfeifen } from '../helpers/laptopCup';

const NAMEN_LANG = [NAME_50, ...NAMEN.slice(1)];

test.describe('@ZP-109 Karte oben im Spielplan der Turnierleitung', () => {
  test.beforeEach(async ({ seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation stört die Klicks');
    await seedIndexedDB({ tournaments: [cup({ namen: NAMEN_LANG })] });
  });

  test('@ZP-109 vor dem Anpfiff: „Nächstes Spiel · Spiel 1“, Haupttaste „Spiel im Cockpit anpfeifen“ mindestens 56 px hoch, nichts ragt über den Rand', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/schedule`);
    const karte = page.getByTestId('schedule-current');
    await expect(karte).toContainText('Nächstes Spiel · Spiel 1', { timeout: 15_000 });
    const taste = page.locator('[data-testid^="schedule-current-cockpit-"]');
    await expect(taste).toHaveText('Spiel im Cockpit anpfeifen');
    await animationenFertig(page);
    const box = (await taste.boundingBox())!;
    expect(box.height, 'Haupttaste mindestens 56 px hoch').toBeGreaterThanOrEqual(55.9);
    const rahmen = (await karte.boundingBox())!;
    const breite = page.viewportSize()!.width;
    expect(rahmen.x, 'Karte beginnt im Fenster').toBeGreaterThanOrEqual(0);
    expect(rahmen.x + rahmen.width, 'Karte endet im Fenster').toBeLessThanOrEqual(breite);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
    await expect(karte.getByText('Danach:')).toHaveCount(0);
  });

  test('@ZP-109 läuft Spiel 1: „Läuft · Spiel 1 · Feld 1“ mit Restzeit, Haupttaste „Zum Cockpit“, „Danach: Spiel 2“; Tipp führt ins Cockpit', async ({ page }) => {
    await anpfeifen(page);
    await page.goto(`/#/tournament/${ID}/schedule`);
    const karte = page.getByTestId('schedule-current');
    await expect(karte).toContainText('Läuft · Spiel 1 · Feld 1', { timeout: 15_000 });
    await expect(karte).toContainText('Restzeit');
    await expect(karte.getByTestId(/^schedule-current-after-/)).toContainText('Danach: Spiel 2');
    const taste = page.locator('[data-testid^="schedule-current-cockpit-"]');
    await expect(taste).toHaveText('Zum Cockpit');
    await taste.click();
    await expect(page).not.toHaveURL(/\/schedule/);
    await expect(page.getByTestId('match-pause-button')).toBeVisible({ timeout: 15_000 });
  });

  test('@ZP-109 Sprungtaste: unter 1280 Bildpunkten nach dem Scrollen da, springt zur Karte und verschwindet; ab 1280 nie', async ({ page }) => {
    await anpfeifen(page);
    await page.goto(`/#/tournament/${ID}/schedule`);
    const karte = page.getByTestId('schedule-current');
    await expect(karte).toContainText('Läuft · Spiel 1', { timeout: 15_000 });
    const sprung = page.getByTestId('schedule-jump-to-live');
    await expect(sprung, 'oben, Karte im Bild: keine Taste').toHaveCount(0);

    await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); });
    if (page.viewportSize()!.width >= 1280) {
      await animationenFertig(page);
      await expect(sprung, 'ab 1280 Bildpunkten nie').toHaveCount(0);
      return;
    }
    await expect(sprung).toBeVisible();
    await expect(sprung).toHaveText('Zum laufenden Spiel');
    await animationenFertig(page);
    const taste = (await sprung.boundingBox())!;
    expect(taste.height, 'Touch mindestens 44 px (Haupttasten-Höhe)').toBeGreaterThanOrEqual(43.9);
    // Ganz unten liegt die Pille weder über der Fußzeile (Impressum, Datenschutz) noch über der unteren Navigation
    const schneidet = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    for (const ziel of [page.getByTestId('footer-impressum-link'), page.getByTestId('footer-datenschutz-link'), page.getByTestId('bottom-nav-schedule')]) {
      if (await ziel.count() > 0 && await ziel.first().isVisible()) {
        expect(schneidet(taste, (await ziel.first().boundingBox())!), 'Pille liegt nicht über Fußzeile oder Navigation').toBe(false);
      }
    }
    await sprung.click();
    await expect(karte.locator('[data-testid^="schedule-current-card-"]').first(), 'nach dem Sprung hat die Karte den Fokus (Tastatur, Bildschirmleser)').toBeFocused();
    await expect(sprung, 'nach dem Sprung ist die Karte im Bild, die Taste weg').toHaveCount(0);
    await expect.poll(async () => (await karte.boundingBox())!.y, { message: 'Karte liegt im Bild' }).toBeGreaterThanOrEqual(-1);
    expect((await karte.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height);
  });

  test('@ZP-109 schwebende Tasten verdecken die Karte nie: in jeder Fensterhöhe, an jeder Rollstelle, vor dem Anpfiff und während das Spiel läuft', async ({ page }) => {
    for (const laeuft of [false, true]) {
      if (laeuft) { await anpfeifen(page); }
      for (const [w, h] of [[360, 568], [360, 640], [390, 844], [768, 1024]] as const) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/#/tournament/${ID}/schedule`);
        const karte = page.getByTestId('schedule-current');
        await expect(karte).toBeVisible({ timeout: 15_000 });
        await animationenFertig(page);
        for (const y of [0, 120, 300]) {
          await page.evaluate((top) => { window.scrollTo(0, top); }, y);
          await animationenFertig(page);
          const verdeckt = await page.evaluate(() => {
            const k = document.querySelector('[data-no-float-cover]')!.getBoundingClientRect();
            return Array.from(document.querySelectorAll<HTMLElement>('.schedule-action-buttons, [data-testid="schedule-jump-to-live"]')).filter((el) => {
              const st = getComputedStyle(el);
              if (st.position !== 'fixed' || st.visibility === 'hidden' || st.display === 'none') { return false; }
              const r = el.getBoundingClientRect();
              return r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top;
            }).map((el) => el.className !== '' ? el.className : (el.getAttribute('data-testid') ?? el.tagName));
          });
          expect(verdeckt, `${laeuft ? 'läuft' : 'vor Anpfiff'} ${String(w)}×${String(h)} scrollY ${String(y)}: schwebende Elemente über der Karte`).toEqual([]);
        }
      }
    }
  });
});

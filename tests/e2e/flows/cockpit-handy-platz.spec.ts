/**
 * E2E: Handy hoch, viele Hinweise über den Tasten (Plan Cockpit v2 PR B, N1 aus dem Review zu PR A): die Tastenfläche wird nie auf (fast) 0 gedrückt,
 * das Tor beider Teams bleibt erreichbar (@SL-061), Tafel und Leiste bleiben im Bild. Die Hinweise (Nur-Lesen, Ausgang, „nur zusehen“) kommen aus
 * mehreren Quellen; der Test legt dieselbe Last als Blöcke zwischen Tafel und Tasten, damit die Anordnung unabhängig von der Quelle gilt.
 */
import { test, expect } from '../helpers/test-fixtures';
import { anpfeifen, cup } from '../helpers/laptopCup';

test.describe('Handy hoch: viele Hinweise über den Tasten', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'cockpit-360x640', 'nur das kleinste Handy (360 × 640)');
  });

  test('@SL-061 vier Hinweise zugleich: die Tastenfläche behält Kopf und Tor, das Tor beider Teams ist durch Scrollen erreichbar, Leiste bleibt unten', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    // vier Hinweiszeilen wie Nur-Lesen, Ausgang, „nur zusehen“ und Klärung (je zwei Zeilen hoch)
    await page.evaluate(() => {
      const tafel = document.querySelector('[data-testid="scoreboard"]');
      for (let i = 0; i < 4; i += 1) {
        const zeile = document.createElement('p');
        zeile.setAttribute('data-testid', `test-hinweis-${String(i)}`);
        zeile.style.cssText = 'margin:0;padding:8px;min-height:44px';
        zeile.textContent = `Hinweis ${String(i)}: erste Zeile und eine zweite Zeile, damit der Block zwei Zeilen hoch wird`;
        tafel?.insertAdjacentElement('afterend', zeile);
      }
    });
    const flaeche = await page.getByTestId('cockpit-tastenflaeche').boundingBox();
    expect(flaeche?.height ?? 0, 'Tastenfläche bleibt mindestens so hoch wie Kopf und Tor').toBeGreaterThanOrEqual(56 + 40);
    const leiste = await page.getByRole('toolbar').boundingBox();
    expect((leiste?.y ?? 0) + (leiste?.height ?? 0)).toBeLessThanOrEqual(640 + 1);
    for (const seite of ['home', 'away']) {
      await page.getByTestId(`goal-button-${seite}`).scrollIntoViewIfNeeded();
      const tor = await page.getByTestId(`goal-button-${seite}`).boundingBox();
      expect(tor?.height ?? 0).toBeGreaterThanOrEqual(56);
      expect((tor?.y ?? 0) + (tor?.height ?? 0), `Tor ${seite} über der Leiste`).toBeLessThanOrEqual((leiste?.y ?? 0) + 1);
      expect(tor?.y ?? 0, `Tor ${seite} unter der Kopfleiste`).toBeGreaterThanOrEqual(0);
    }
  });
});

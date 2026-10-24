/**
 * E2E: Tafel und Tastenfläche am Handy (Plan Cockpit v2 A3): @SL-179 Doppelpunkt der Kästen senkrecht über dem der Uhr, @SL-061 kleine Handys:
 * Tor ohne Scrollen, Foul/Zeitstrafe/Karte durch Scrollen der Tastenfläche, Tafel und Leiste fest; @SL-155 Platz der Zeile „Nächstes“ bleibt
 * reserviert (die Tasten springen nie, F3 Variante R). Läuft in `cockpit-360x640` und `mobile-md` (390 × 844); Laptop siehe `cockpit-hoehen`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { cup, anpfeifen, anAnfangRollen } from '../helpers/laptopCup';

const mitteX = async (page: Page, testId: string): Promise<number> => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return box.x + box.width / 2;
};
const oben = async (page: Page, testId: string): Promise<number> => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return box.y;
};

test.describe('Cockpit am Handy: Tafel und Tastenfläche (Gast, lokal)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'Handy-Layout (Tablet hochkant folgt derselben Quelle, Laptop siehe cockpit-hoehen)');
  });

  for (const minuten of [9, 12, 10]) {
    test(`@SL-179 Doppelpunkt über Doppelpunkt: Uhr ${String(minuten)}:00 – die Achse weicht höchstens 1 px ab`, async ({ page, seedIndexedDB }) => {
      await seedIndexedDB({ tournaments: [cup({ minuten, perioden: 1 })] });
      await anpfeifen(page);
      const kaesten = await mitteX(page, 'scoreboard-colon');
      const uhr = await mitteX(page, 'scoreboard-clock-rest-colon');
      expect(Math.abs(kaesten - uhr), `Kästen ${String(kaesten)} px, Uhr ${String(uhr)} px`).toBeLessThanOrEqual(1);
    });
  }

  test('@SL-061 Tor beider Teams ohne Scrollen; unter 800 px Höhe scrollt nur die Tastenfläche, Tafel und Leiste bleiben stehen', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await anAnfangRollen(page);
    const hoehe = page.viewportSize()?.height ?? 0;
    const leisteOben = (await page.getByRole('toolbar').boundingBox())?.y ?? 0;
    const flaeche = page.getByTestId('cockpit-tastenflaeche');
    for (const id of ['goal-button-home', 'goal-button-away']) {
      const box = await page.getByTestId(id).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0), `${id} über der Leiste`).toBeLessThanOrEqual(leisteOben + 1);
    }
    const mass = await flaeche.evaluate((el) => ({ scroll: el.scrollHeight, sicht: el.clientHeight, seite: document.documentElement.scrollHeight - window.innerHeight }));
    expect(mass.seite, 'die Seite selbst scrollt nie').toBeLessThanOrEqual(1);
    if (hoehe >= 800) {
      expect(mass.scroll, 'ab 800 px Höhe passt die Tastenfläche ohne Scrollen').toBeLessThanOrEqual(mass.sicht + 1);
      return;
    }
    expect(mass.scroll, 'unter 800 px Höhe ist die Tastenfläche höher als ihr Platz').toBeGreaterThan(mass.sicht);
    const tafelOben = await oben(page, 'scoreboard');
    const leisteAlt = leisteOben;
    await flaeche.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    for (const id of ['foul-button-home', 'penalty-button-away', 'card-button-away']) {
      const box = await page.getByTestId(id).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0), `${id} nach dem Scrollen über der Leiste`).toBeLessThanOrEqual(leisteOben + 1);
    }
    expect(await oben(page, 'scoreboard'), 'Tafel steht fest').toBe(tafelOben);
    expect((await page.getByRole('toolbar').boundingBox())?.y, 'Leiste steht fest').toBe(leisteAlt);
  });

  test('@SL-155 der Platz der Zeile „Nächstes“ bleibt davor reserviert: wird sie sichtbar, stehen die Tasten unverändert (sie springen nie)', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 4, perioden: 1 })] });
    await anpfeifen(page);
    const zeile = page.getByTestId('cockpit-naechstes');
    await expect(zeile).toHaveAttribute('data-verborgen', 'true');
    const davor = { tor: await oben(page, 'goal-button-home'), foul: await oben(page, 'foul-button-home') };
    expect((await zeile.boundingBox())?.height ?? 0, 'der Streifen hat Höhe, obwohl die Zeile nicht zu sehen ist').toBeGreaterThan(20);
    await zeile.evaluate((el) => { el.style.visibility = 'visible'; }); // so sieht die Zeile ab 3:00 aus: gleicher Platz
    expect(await oben(page, 'goal-button-home')).toBe(davor.tor);
    expect(await oben(page, 'foul-button-home')).toBe(davor.foul);
  });

  test('@SL-155 ab 3:00 steht die Zeile da (Vorwarnung), davor nicht', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).not.toHaveAttribute('data-verborgen', 'true');
    await expect(page.getByTestId('cockpit-naechstes')).toBeVisible();
  });
});

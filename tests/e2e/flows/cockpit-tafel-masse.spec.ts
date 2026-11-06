/**
 * E2E: Tafel und Tastenfläche am Handy (Plan Cockpit v2 A3): @SL-179 Doppelpunkt der Kästen senkrecht über dem der Uhr, @SL-061 Tor ohne
 * Scrollen, Tafel und Leiste fest. Cockpit-Paket K5/K12 (05.11.): Foul, Zeitstrafe und Karte stehen in einer Reihe und ebenfalls ohne Scrollen
 * da; die Zeile „Nächstes“ steht am Handy in der Tafel (Platz der Meldezeile) statt in einem reservierten Streifen – die Tasten springen nie. Läuft in der CI im schlanken Projekt `cockpit-390x664` und in `mobile-sm`/`mobile-md`, lokal zusätzlich in `cockpit-360x640`; Laptop siehe `cockpit-hoehen` (PR B).
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

  test('@SL-061 Tor, Foul, Zeitstrafe und Karte beider Teams ohne Scrollen über der Leiste (Cockpit-Paket K5)', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await anAnfangRollen(page);
    const leisteOben = (await page.getByRole('toolbar').boundingBox())?.y ?? 0;
    const flaeche = page.getByTestId('cockpit-tastenflaeche');
    for (const id of ['goal-button-home', 'goal-button-away']) {
      const box = await page.getByTestId(id).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0), `${id} über der Leiste`).toBeLessThanOrEqual(leisteOben + 1);
    }
    const mass = await flaeche.evaluate((el) => ({ scroll: el.scrollHeight, sicht: el.clientHeight, seite: document.documentElement.scrollHeight - window.innerHeight }));
    expect(mass.seite, 'die Seite selbst scrollt nie').toBeLessThanOrEqual(1);
    // Cockpit-Paket K5: Foul, Zeitstrafe und Karte ebenfalls ohne Scrollen, auch unter 800 px Höhe (Wächter: cockpit-handy-waechter)
    expect(mass.scroll, 'die Tastenfläche passt ohne Scrollen').toBeLessThanOrEqual(mass.sicht + 1);
    for (const id of ['foul-button-home', 'penalty-button-away', 'card-button-away']) {
      const box = await page.getByTestId(id).boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0), `${id} ohne Scrollen über der Leiste`).toBeLessThanOrEqual(leisteOben + 1);
    }
  });

  test('@SL-155 kein reservierter Streifen: vor der Vorwarnung steht die Zeile nicht da, die Team-Köpfe folgen direkt auf die Tafel', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 4, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toHaveCount(0);
    const tafel = await page.getByTestId('scoreboard').boundingBox();
    const kopf = await oben(page, 'team-head-home');
    expect(kopf - ((tafel?.y ?? 0) + (tafel?.height ?? 0)), 'zwischen Tafel und Team-Kopf kein leerer Streifen').toBeLessThanOrEqual(16);
  });

  test('@SL-155 echter Übergang 3:01 → 3:00 (Uhr vorgespult): die Zeile erscheint, Tor, Foul und Zeile selbst bleiben an ihrem Platz und gleich groß', async ({ page, seedIndexedDB }) => {
    await page.clock.install();
    await seedIndexedDB({ tournaments: [cup({ minuten: 4, perioden: 1 })] });
    await anpfeifen(page);
    const zeile = page.getByTestId('cockpit-naechstes');
    await page.clock.fastForward(55_000); // Restzeit etwa 3:05
    await expect(zeile).toHaveCount(0);
    const davor = { tor: await oben(page, 'goal-button-home'), foul: await oben(page, 'foul-button-home'), tafel: await page.getByTestId('scoreboard').boundingBox() };
    await page.clock.fastForward(10_000); // Restzeit etwa 2:55: die Vorwarnung ist aktiv
    await expect(zeile).toHaveAttribute('data-modus', 'vorwarnung');
    await expect(zeile).toHaveAttribute('data-auf-tafel', 'true');
    const danach = { tor: await oben(page, 'goal-button-home'), foul: await oben(page, 'foul-button-home'), tafel: await page.getByTestId('scoreboard').boundingBox() };
    expect(danach.tor, 'Tor springt nicht').toBe(davor.tor);
    expect(danach.foul, 'Foul springt nicht').toBe(davor.foul);
    expect(danach.tafel?.height, 'die Tafel bleibt gleich hoch').toBe(davor.tafel?.height);
  });

  test('@SL-155 ab 3:00 steht die Zeile da (Vorwarnung), davor nicht', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toBeVisible();
  });
});

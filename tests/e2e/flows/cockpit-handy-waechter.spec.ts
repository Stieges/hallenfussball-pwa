/**
 * E2E-Wächter: Handy hoch 360 × 640 und 390 × 664 (Cockpit-Paket K5/K6/K12, @SL-061 nach Auftrag „alle Tasten ohne Scrollen“, @SL-155, @SL-137,
 * @SL-149, @SL-196): Tor, Foul, Zeitstrafe und Karte beider Teams stehen ohne Scrollen über der Daumenleiste – vor dem Anpfiff (Leibchen-Wahl),
 * im laufenden Spiel, mit „Nächstes“-Vorwarnung und mit Weste; schwerer Fall: Name mit 50 Zeichen und gleiche Trikotfarbe.
 * Läuft in den Projekten `cockpit-360x640` und `cockpit-390x664`. Bilder: `LT23_BILDER=<Ordner>`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { anpfeifen, bild, cup, ID, NAME_50 } from '../helpers/laptopCup';
import { tippeKarte, tippeTor, tippeZeitstrafe } from '../helpers/cockpitNeu';

const BLAU = '#1565C0';
const BLAU_2 = '#1E56D9';
const TASTEN = ['goal-button', 'foul-button', 'penalty-button', 'card-button'];

const unten = async (page: Page, testId: string): Promise<number> => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return box.y + box.height;
};
const oben = async (page: Page, testId: string): Promise<number> => (await page.getByTestId(testId).boundingBox())?.y ?? -1;
const leisteOben = async (page: Page): Promise<number> => (await page.getByRole('toolbar').boundingBox())?.y ?? 0;

/** Team-Köpfe: der Name steht vollständig da, ohne Überlauf und ohne Kürzung (@OB-025, @OB-058; Review #448 P1). */
async function namenVollstaendig(page: Page, lage: string): Promise<void> {
  for (const seite of ['home', 'away']) {
    const mass = await page.getByTestId(`team-name-${seite}`).evaluate((el) => {
      const kopf = el.closest('[data-testid^="team-head-"]')?.getBoundingClientRect();
      const woerter = [...el.querySelectorAll('span')].map((w) => w.getBoundingClientRect());
      return {
        ueberlauf: el.scrollWidth - el.clientWidth, text: el.textContent ?? '', ellipse: getComputedStyle(el).textOverflow,
        draussen: kopf ? woerter.filter((w) => w.right > kopf.right + 1 || w.left < kopf.left - 1).length : -1,
      };
    });
    expect(mass.ueberlauf, `${lage}: team-name-${seite} läuft nicht über`).toBeLessThanOrEqual(0);
    expect(mass.draussen, `${lage}: jedes Wort von team-name-${seite} steht im Kopf`).toBe(0);
    expect(mass.text, `${lage}: team-name-${seite} ohne „…“`).not.toContain('…');
    expect(mass.ellipse).not.toBe('ellipsis');
  }
}

/** Alle vier Tasten beider Teams ohne Scrollen über der Leiste (Tastenfläche oben), die Seite scrollt nie, die Namen stehen voll da. */
async function alleTastenSichtbar(page: Page, lage: string): Promise<void> {
  // Ein Klick von Playwright rollt das Ziel ins Bild; gemessen wird die Ansicht, wie Tom sie hat: Tastenfläche oben
  await page.getByTestId('cockpit-tastenflaeche').evaluate((el) => { el.scrollTop = 0; });
  const grenze = await leisteOben(page);
  for (const seite of ['home', 'away']) {
    for (const taste of TASTEN) {
      expect(await unten(page, `${taste}-${seite}`), `${lage}: ${taste}-${seite} über der Leiste`).toBeLessThanOrEqual(grenze + 1);
    }
  }
  const mass = await page.getByTestId('cockpit-tastenflaeche').evaluate(() => ({ seite: document.documentElement.scrollHeight - window.innerHeight }));
  expect(mass.seite, `${lage}: die Seite scrollt nie`).toBeLessThanOrEqual(1);
  await namenVollstaendig(page, lage);
}

test.describe('Cockpit am kleinen Handy: alle Tasten ohne Scrollen', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(!['cockpit-360x640', 'cockpit-390x664'].includes(testInfo.project.name), 'nur 360 × 640 und 390 × 664');
  });

  test('@SL-137 @SL-196 @SL-149 vor dem Anpfiff: Hinweis in der Tafel, Leibchen-Wahl und „Ohne Leibchen anpfeifen“ ohne Scrollen', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ namen: ['TSV Waging', NAME_50, 'TSV Ost', 'FC West'], farben: [BLAU, BLAU_2, '#2E8B57', '#C0392B'], minuten: 9, perioden: 1 })] });
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('match-start-button')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('scoreboard-farb-hinweis')).toBeVisible();
    // @SL-196: echte Trikotfarben – der Gast steht in Blau, nicht in der Ausweichfarbe
    await expect(page.getByTestId('team-head-away')).toHaveAttribute('data-color', BLAU_2);
    await expect(page.getByTestId('team-name-away')).toHaveText(NAME_50);
    await namenVollstaendig(page, 'vor dem Anpfiff');
    const grenze = await leisteOben(page);
    for (const id of ['anpfiff-leibchen-heim', 'anpfiff-leibchen-gast', 'anpfiff-leibchen-farbe-gelb']) {
      expect(await unten(page, id), `${id} über der Leiste`).toBeLessThanOrEqual(grenze + 1);
    }
    await expect(page.getByTestId('anpfiff-leibchen-heim')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('anpfiff-ohne-leibchen')).toBeVisible();
    await bild(page, `waechter-${testInfo.project.name}-vor`);
  });

  test('@SL-061 im laufenden Spiel, schwerer Fall (50 Zeichen, Weste): Tor, Foul, Zeitstrafe, Karte beider Teams über der Leiste', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ namen: ['TSV Waging', NAME_50, 'TSV Ost', 'FC West'], farben: [BLAU, BLAU_2, '#2E8B57', '#C0392B'], minuten: 9, perioden: 1 })] });
    await anpfeifen(page); // mit der Vorbelegung: Heim trägt Leibchen
    await expect(page.getByTestId('team-head-home-leibchen')).toBeVisible();
    await alleTastenSichtbar(page, 'läuft mit Weste');
    await bild(page, `waechter-${testInfo.project.name}-laeuft-weste`);
  });

  test('@SL-061 im laufenden Spiel ohne Leibchen (Normalfall)', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 9, perioden: 1 })] });
    await anpfeifen(page);
    await alleTastenSichtbar(page, 'läuft');
  });

  test('@SL-155 Vorwarnung: „Nächstes“ steht in der Tafel, die Tasten bleiben an ihrem Platz und über der Leiste', async ({ page, seedIndexedDB }, testInfo) => {
    await page.clock.install();
    await seedIndexedDB({ tournaments: [cup({ namen: ['TSV Waging', NAME_50, 'TSV Ost', 'FC West'], minuten: 4, perioden: 1 })] });
    await anpfeifen(page);
    await page.clock.fastForward(55_000); // Restzeit etwa 3:05
    await expect(page.getByTestId('cockpit-naechstes')).toHaveCount(0);
    const davor = { tor: await oben(page, 'goal-button-home'), karte: await oben(page, 'card-button-away') };
    await page.clock.fastForward(10_000); // Restzeit etwa 2:55
    const zeile = page.getByTestId('cockpit-naechstes');
    await expect(zeile).toHaveAttribute('data-modus', 'vorwarnung');
    await expect(page.getByTestId('scoreboard')).toContainText('Nächstes');
    expect(await oben(page, 'goal-button-home'), 'Tor springt nicht').toBe(davor.tor);
    expect(await oben(page, 'card-button-away'), 'Karte springt nicht').toBe(davor.karte);
    await alleTastenSichtbar(page, 'Vorwarnung');
    await bild(page, `waechter-${testInfo.project.name}-vorwarnung`);
  });

  test('@SL-061 @SL-031 Meldung, zwei Zeitstrafen und rote Karte (Sperr-Hinweis), 50 Zeichen: alle Tasten bleiben über der Leiste', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ namen: ['TSV Waging', NAME_50, 'TSV Ost', 'FC West'], minuten: 9, perioden: 1 })] });
    await anpfeifen(page);
    await tippeZeitstrafe(page, 'away');
    await tippeZeitstrafe(page, 'away');
    await tippeKarte(page, 'home', 'Rot', 4);
    await tippeTor(page, 'away'); // Meldung „Tor für …“ in der Meldezeile
    await expect(page.locator('[data-testid^="scoreboard-strafe-"]')).toHaveCount(2); // beide Zeitstrafen mit Restzeit in der Tafel
    await alleTastenSichtbar(page, 'Meldung, Zeitstrafen, rote Karte');
    await bild(page, `waechter-${testInfo.project.name}-strafen-karte`);
  });
});

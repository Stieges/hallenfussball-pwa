/**
 * E2E: Desktop-Tafel, Maße nach Fensterhöhe, Team-Leiste und Zeitstrafen-Karten (Plan Cockpit v2, PR B), gemessen am echten Fenster.
 * Szenarien: @SL-178 (Ziffern ≥ 11 mm in jeder Stufe ab 620 px Fensterhöhe), @SL-179 (Doppelpunkte auf einer Achse), @SL-180 (Tafel wie Monitor: „Restzeit“,
 * Zeitbalken, gespielte Zeit in der Kopfzeile, „Live“ ohne rote Fläche), @SL-181 (Name klein über dem Kasten, groß in der Leiste; unter 720 px nur „Heim“/„Gast“),
 * @SL-182 (lange Namen brechen um, nie „…“), @SL-183 (Einblendung „Tor für …“ verschiebt nichts), @SL-061/@SL-187 (Fläche passt ab 620 px ohne Scrollen,
 * 600 bis 619 px scrollt, nichts wird abgeschnitten), @SL-186 (Zeitstrafen als Karten: keine / zwei / drei).
 * Bilder für den Sichtvergleich gegen das Mockup: `LT23_BILDER=<Ordner>`.
 */
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { tippeZeitstrafe, tippeTor } from '../helpers/cockpitNeu';
import { anpfeifen, cup, BILDER, NAME_50 } from '../helpers/laptopCup';

const NAMEN = ['TSV Petting', 'DJK Otting', 'TSV Waging rot', 'DJK Kammer'];
const FARBEN = ['#6B21A8', '#2E7D32', '#C0392B', '#1E56D9'];
const NAME_45 = 'Eintracht Oberweiler-Niederstetten 1919 e. V.';
/** Fensterhöhen der Stufen und ihre Breiten: knapp (620, 719), normal (720, 799), gross (800, 1080 auf dem großen Bildschirm) */
const FENSTER = [[1280, 620], [1280, 719], [1280, 720], [1280, 799], [1280, 800], [1920, 1080]] as const;
const ZIFFERN_ANTEIL = 0.727; // Höhe der Ziffern in Inter (wie `cockpit.ziffern` in visual:metrics)

const bildDavon = async (page: Page, name: string): Promise<void> => { if (BILDER !== '') { writeFileSync(`${BILDER}/${name}.png`, await page.screenshot()); } };
const hoeheVon = async (page: Page, testId: string): Promise<number> => (await page.getByTestId(testId).boundingBox())?.height ?? 0;
const schrift = (page: Page, testId: string): Promise<number> => page.getByTestId(testId).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const ueberstand = (page: Page): Promise<number> => page.locator('[data-testid="live-cockpit"] > main').evaluate((el) => el.scrollHeight - el.clientHeight);
const mitte = async (page: Page, testId: string): Promise<number> => { const b = await page.getByTestId(testId).boundingBox(); if (!b) { throw new Error(`${testId} nicht sichtbar`); } return b.x + b.width / 2; };
const vorbereiten = async (page: Page, seedIndexedDB: (d: { tournaments: unknown[] }) => Promise<void>, optionen: Parameters<typeof cup>[0] = { namen: NAMEN, farben: FARBEN }): Promise<void> => {
  await seedIndexedDB({ tournaments: [cup(optionen)] });
  await anpfeifen(page);
  await expect(page.getByTestId('scoreboard-kopf-text')).toBeVisible();
};

test.beforeEach(async ({ browserName: _b }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'), 'Laptop-Fenster: nur in den Projekten „desktop“ und „desktop-webkit“');
});

for (const [breite, fh] of FENSTER) {
  test.describe(`Laptop ${String(breite)}×${String(fh)}`, () => {
    test.use({ viewport: { width: breite, height: fh } });

    test(`@SL-187 @SL-061 ab 620 px passt alles ohne Scrollen: Tor ≥ 56 px, übrige Tasten ≥ 44 px, kein Überstand (${String(fh)} px)`, async ({ page, seedIndexedDB }) => {
      await vorbereiten(page, seedIndexedDB);
      await tippeTor(page, 'home');
      await tippeZeitstrafe(page, 'away');
      await page.waitForTimeout(3300); // die Einblendung ist weg
      expect(await ueberstand(page)).toBeLessThanOrEqual(1);
      const dokument = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, ih: window.innerHeight }));
      expect(dokument.h).toBeLessThanOrEqual(dokument.ih);
      for (const seite of ['home', 'away']) {
        expect(await hoeheVon(page, `goal-button-${seite}`), `Tor ${seite}`).toBeGreaterThanOrEqual(56);
        for (const art of ['foul', 'penalty', 'card']) { expect(await hoeheVon(page, `${art}-button-${seite}`), `${art} ${seite}`).toBeGreaterThanOrEqual(44); }
      }
      for (const id of ['match-pause-button', 'match-finish-button', 'match-undo-button', 'cockpit-more-button']) { expect(await hoeheVon(page, id), id).toBeGreaterThanOrEqual(44); }
      const leiste = await page.getByRole('toolbar').boundingBox();
      expect((leiste?.y ?? 0) + (leiste?.height ?? 0)).toBeLessThanOrEqual(fh + 1);
      await bildDavon(page, `haupt-${String(fh)}`);
    });

    test(`@SL-178 Ziffern von Stand und Uhr sind mindestens 55 px hoch (11 mm), in jeder Stufe (${String(fh)} px)`, async ({ page, seedIndexedDB }) => {
      await vorbereiten(page, seedIndexedDB);
      expect((await schrift(page, 'scoreboard-clock-rest')) * ZIFFERN_ANTEIL).toBeGreaterThanOrEqual(55);
      expect((await schrift(page, 'scoreboard-box-links-digits')) * ZIFFERN_ANTEIL).toBeGreaterThanOrEqual(55);
    });

    test(`@SL-181 Name klein über dem Kasten ab 720 px, darunter nur „Heim“/„Gast“; der Name steht in jedem Fall groß in der Leiste (${String(fh)} px)`, async ({ page, seedIndexedDB }) => {
      await vorbereiten(page, seedIndexedDB);
      const variantA = fh < 720;
      await expect(page.getByTestId('scoreboard-label-links')).toHaveCount(variantA ? 1 : 0);
      await expect(page.getByTestId('scoreboard-name-links')).toHaveCount(variantA ? 0 : 1);
      if (variantA) { await expect(page.getByTestId('scoreboard-label-links')).toHaveText('Heim'); await expect(page.getByTestId('scoreboard-label-rechts')).toHaveText('Gast'); }
      await expect(page.getByTestId('team-name-home')).toHaveText('TSV Petting');
    });

    test(`@SL-180 @SL-179 Uhr wie am Monitor: „Restzeit“ über der Uhr, Zeitbalken darunter, gespielte Zeit in der Kopfzeile, Doppelpunkte auf einer Achse (${String(fh)} px)`, async ({ page, seedIndexedDB }) => {
      await vorbereiten(page, seedIndexedDB);
      const uhr = await page.getByTestId('scoreboard-clock-rest').boundingBox();
      const balken = await page.getByTestId('scoreboard-zeitbalken').boundingBox();
      const etikett = await page.getByTestId('scoreboard-clock').getByText('Restzeit', { exact: true }).boundingBox();
      expect(etikett && uhr && etikett.y + etikett.height).toBeLessThanOrEqual((uhr?.y ?? 0) + 1);
      expect((balken?.y ?? 0)).toBeGreaterThanOrEqual((uhr?.y ?? 0) + (uhr?.height ?? 0) - 1);
      await expect(page.getByTestId('scoreboard-kopf-text')).toContainText(/Spiel 1 · Feld 1 · 1\. Halbzeit · Gespielt \d+:\d{2}/i); // die Kopfzeile steht in Großbuchstaben (CSS)
      await expect(page.getByTestId('scoreboard-clock-sub')).toHaveCount(0);
      const achse = Math.abs((await mitte(page, 'scoreboard-colon')) - (await mitte(page, 'scoreboard-clock-rest-colon')));
      expect(achse, 'Doppelpunkt der Uhr unter dem der Kästen').toBeLessThanOrEqual(1);
      // „Live“ ohne rote Fläche
      const flaeche = await page.getByTestId('scoreboard-abzeichen').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(flaeche).toBe('rgba(0, 0, 0, 0)');
    });
  });
}

test.describe('Laptop 1280×600 (unter 620 px)', () => {
  test.use({ viewport: { width: 1280, height: 600 } });

  test('@SL-187 600 bis 619 px: die Fläche scrollt, nichts wird abgeschnitten, die Ziffern von Uhr und Stand bleiben gleich groß', async ({ page, seedIndexedDB }) => {
    await vorbereiten(page, seedIndexedDB);
    expect(await ueberstand(page)).toBeGreaterThan(0);
    const ziffer = await schrift(page, 'scoreboard-clock-rest');
    await page.setViewportSize({ width: 1280, height: 620 });
    expect(await schrift(page, 'scoreboard-clock-rest')).toBe(ziffer);
    await page.setViewportSize({ width: 1280, height: 600 });
    // jede Taste ist durch Scrollen erreichbar: die letzte Zeile liegt nach dem Rollen im Fenster
    await page.getByTestId('foul-button-home').scrollIntoViewIfNeeded();
    const foul = await page.getByTestId('foul-button-home').boundingBox();
    const leiste = await page.getByRole('toolbar').boundingBox();
    expect((foul?.y ?? 0) + (foul?.height ?? 0)).toBeLessThanOrEqual((leiste?.y ?? 0) + 1);
  });
});

test.describe('Laptop 1280×720: Einblendung, Zeitstrafen, lange Namen', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('@SL-183 nach einem Tor blendet die Tafel „Tor für TSV Petting“ in der Kopfzeile ein, nichts verschiebt sich, nach etwa drei Sekunden ist sie weg', async ({ page, seedIndexedDB }) => {
    await vorbereiten(page, seedIndexedDB);
    const vorher = { uhr: await page.getByTestId('scoreboard-clock-rest').boundingBox(), kasten: await page.getByTestId('scoreboard-box-links').boundingBox(), tor: await page.getByTestId('goal-button-home').boundingBox() };
    await page.getByTestId('goal-button-home').click();
    const meldung = page.getByTestId('notice-line');
    await expect(meldung).toContainText('Tor für TSV Petting');
    const tafel = await page.getByTestId('scoreboard').boundingBox();
    const box = await meldung.boundingBox();
    expect((box?.y ?? 0)).toBeGreaterThanOrEqual((tafel?.y ?? 0));
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((await page.getByTestId('scoreboard-box-links').boundingBox())?.y ?? 0); // verdeckt weder Kasten noch Uhr
    const waehrend = { uhr: await page.getByTestId('scoreboard-clock-rest').boundingBox(), kasten: await page.getByTestId('scoreboard-box-links').boundingBox(), tor: await page.getByTestId('goal-button-home').boundingBox() };
    expect(waehrend).toEqual(vorher);
    await bildDavon(page, 'toast-720');
    await expect(meldung).not.toContainText('Tor für', { timeout: 6000 });
  });

  test('@SL-186 Zeitstrafen als Karten: keine → „Keine aktiven Zeitstrafen“, zwei → zwei Karten, drei → zwei Karten und „+ 1 weitere“', async ({ page, seedIndexedDB }) => {
    await vorbereiten(page, seedIndexedDB);
    await expect(page.getByTestId('strafen-keine')).toHaveText('Keine aktiven Zeitstrafen');
    await bildDavon(page, 'ohne-strafe-720');
    await tippeZeitstrafe(page, 'away');
    await tippeZeitstrafe(page, 'away');
    await expect(page.getByTestId('strafen-spalte')).toHaveAttribute('data-anzahl', '2');
    await expect(page.getByTestId('strafen-weitere')).toHaveCount(0);
    await expect(page.getByTestId('team-penalty-p1')).toHaveCount(0);
    await tippeZeitstrafe(page, 'away');
    await expect(page.getByTestId('strafen-spalte')).toHaveAttribute('data-anzahl', '2');
    await expect(page.getByTestId('strafen-weitere')).toHaveText('+ 1 weitere');
    const karten = page.locator('[data-testid^="strafen-karte-"][data-anteil]');
    await expect(karten).toHaveCount(2);
    await expect(karten.first()).toContainText('DJK Otting, ohne Nr.');
    await expect(karten.first()).toContainText('Zeitstrafe 2 Min · seit Spielzeit');
    expect(await ueberstand(page)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(3300);
    await bildDavon(page, 'strafen-drei-720');
  });

  test('@SL-182 lange Teamnamen (50 und 45 Zeichen) brechen in Tafel, Leiste und Strafen-Karte um, stehen vollständig da, nie „…“, nichts ragt heraus', async ({ page, seedIndexedDB }) => {
    await vorbereiten(page, seedIndexedDB, { namen: [NAME_50, NAME_45, 'TSV Waging rot', 'DJK Kammer'], farben: FARBEN });
    await tippeZeitstrafe(page, 'home');
    await page.waitForTimeout(3300);
    for (const [id, name] of [['scoreboard-name-links', NAME_50], ['scoreboard-name-rechts', NAME_45], ['team-name-home', NAME_50], ['team-name-away', NAME_45]] as const) {
      const element = page.getByTestId(id);
      await expect(element).toHaveText(name);
      const mass = await element.evaluate((el) => ({ ueberlauf: el.scrollWidth > el.clientWidth + 1, ellipsis: getComputedStyle(el).textOverflow, nowrap: getComputedStyle(el).whiteSpace === 'nowrap' }));
      expect(mass, id).toEqual({ ueberlauf: false, ellipsis: 'clip', nowrap: false });
    }
    await expect(page.locator('[data-testid^="strafen-karte-"][data-testid$="-titel"]').first()).toContainText(NAME_50);
    const breite = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(breite.w).toBeLessThanOrEqual(breite.iw);
    await bildDavon(page, 'lang-haupt-720');
  });
});

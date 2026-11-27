/**
 * Task 8 „Tabellen sortieren“ – Abnahme im Browser (Regel T2-UI): @TS-003 drei Stufen am Kopf „Team“ (Turnierleitung, Reiter „Tabellen“),
 * @TS-014 Kopf „Tore“ in fünf Stufen, @TS-010 Sortierung in der Adresse, @TS-011 Gerät merkt die Wahl (Link geht vor),
 * @TS-012 am Handy nur über „Sortieren nach …“, dazu die Maße der Köpfe (Entscheidung 26.11.: Desktop-Köpfe 44 px hoch, mindestens 24 px breit).
 * Saat `hallencup-messlauf` (zwei Gruppen, Zuschauer-Code MESS26) und `nikolaus-alle-beendet` (eine Gruppe, NIKO26). Läuft gegen den lokalen
 * Dev-Server bzw. Build ohne Supabase, nie gegen die Produktion. Die Saat gilt nur beim ersten Laden des Tabs (sonst schriebe sie nach jedem Neuladen zurück).
 * Laptop-Fälle laufen nur im Projekt `desktop`; Handy-Fälle laufen in jedem Profil mit eigenem Fenster, im Projekt `desktop` bei 390 Pixeln.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { neuLaden } from '../helpers/neuLaden';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const NUR_ERSTES_LADEN = { nurErstesLaden: true };
const ZUSCHAUER = '/#/live/MESS26?tab=standings';
const NIKOLAUS = '/#/live/NIKO26?tab=standings';
const LEITUNG = '/#/tournament/hallencup-messlauf/standings';

interface Zeile { name: string; tore: number; gegentore: number }

/** Die breite Tabelle einer Gruppe (steht auch am Handy im DOM, dort nur ausgeblendet). */
const breiteTabelle = (page: Page, schluessel: string): Locator => page.getByTestId(`sort-head-${schluessel}-platz`).locator('xpath=ancestor::table[1]');

/** Öffnet die Seite mit der Standard-Saat (echte Standardregel, „Tore“ gehört zur Platzierungsregel). */
async function oeffne(page: Page, saat: string, adresse: string, warteAuf: string): Promise<void> {
  const daten = leseSaat(saat);
  await installiereSaat(page.context(), daten, NUR_ERSTES_LADEN);
  await page.goto(adresse);
  await expect(page.getByTestId(warteAuf)).toBeAttached({ timeout: 25000 });
}

/** Zeilen der breiten Tabelle (Teamname, Tore, Gegentore) – aus den Zellen gelesen, nicht aus dem Code. */
async function zeilen(page: Page, schluessel: string): Promise<Zeile[]> {
  return breiteTabelle(page, schluessel).evaluate((tabelle) => {
    const koepfe = [...tabelle.querySelectorAll('thead th')];
    const spalte = koepfe.findIndex((th) => th.querySelector('[data-testid$="-tore"]') !== null);
    return [...tabelle.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('[data-teamname]') !== null).map((tr) => {
      const [fuer, gegen] = (tr.querySelectorAll('td')[spalte]?.textContent ?? '').split(':').map((z) => Number(z.trim()));
      return { name: tr.querySelector('[data-teamname]')?.textContent?.trim() ?? '', tore: fuer, gegentore: gegen };
    });
  });
}

const namen = async (page: Page, schluessel: string): Promise<string[]> => (await zeilen(page, schluessel)).map((z) => z.name);

const absteigend = (zahlen: number[]): boolean => zahlen.every((z, i) => i === 0 || zahlen[i - 1] >= z);
const aufsteigend = (zahlen: number[]): boolean => zahlen.every((z, i) => i === 0 || zahlen[i - 1] <= z);

/** Bei gleichem Wert entscheidet die Platzierung: gleiche Werte stehen in der Reihenfolge der Vorgabe. */
function gleichstandNachVorgabe(sortiert: Zeile[], vorgabe: string[], wert: (z: Zeile) => number): boolean {
  return sortiert.every((z, i) => i === 0 || wert(sortiert[i - 1]) !== wert(z) || vorgabe.indexOf(sortiert[i - 1].name) < vorgabe.indexOf(z.name));
}

async function schriftgewicht(element: Locator): Promise<number> {
  return element.evaluate((el) => Number(getComputedStyle(el).fontWeight));
}

test.describe('Tabellen sortieren – Laptop 1280 (Zuschauer-Seite, Turnierleitung)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'Laptop-Fälle setzen die Fenstergröße selbst');
  });

  test('@TS-014 Kopf „Tore“ schaltet in fünf Tipps durch (Tore meiste, wenigste, Gegentore wenigste, meiste, zurück); die gemeinte Zahl ist fett', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-head-gA-tore');
    const vorgabe = await namen(page, 'gA');
    const kopf = page.getByTestId('sort-head-gA-tore');
    const gruppeB = await namen(page, 'gB');

    await kopf.click(); // 1. Tipp
    await expect(kopf).toHaveAccessibleName('Tore, meiste zuerst sortiert');
    await expect(kopf).toHaveAttribute('data-sorted', 'true');
    const eins = await zeilen(page, 'gA');
    expect(absteigend(eins.map((z) => z.tore)), 'meiste Tore zuerst').toBe(true);
    expect(gleichstandNachVorgabe(eins, vorgabe, (z) => z.tore), 'bei gleichen Toren entscheidet die Platzierung').toBe(true);
    const fuer = breiteTabelle(page, 'gA').locator('[data-goals-focus="for"]');
    await expect(fuer).toHaveCount(eins.length);
    expect(await schriftgewicht(fuer.first()), 'die erste Zahl ist fett').toBeGreaterThanOrEqual(600);
    expect(await schriftgewicht(breiteTabelle(page, 'gA').locator('tbody tr').first().locator('td:has([data-goals-focus="for"]) span:not([data-goals-focus])').last()), 'die andere Zahl bleibt normal').toBeLessThan(600);
    await expect(page).toHaveURL(/ts=gA\.tore(&|$)/);

    await kopf.click(); // 2. Tipp
    await expect(kopf).toHaveAccessibleName('Tore, wenigste zuerst sortiert');
    expect(aufsteigend((await zeilen(page, 'gA')).map((z) => z.tore)), 'wenigste Tore zuerst').toBe(true);
    await expect(page).toHaveURL(/ts=gA\.tore\.r(&|$)/);

    await kopf.click(); // 3. Tipp: der Kopf heißt jetzt „Gegentore“
    await expect(kopf).toHaveAccessibleName('Gegentore, wenigste zuerst sortiert');
    await expect(kopf).toContainText('Gegentore');
    const drei = await zeilen(page, 'gA');
    expect(aufsteigend(drei.map((z) => z.gegentore)), 'wenigste Gegentore zuerst').toBe(true);
    expect(gleichstandNachVorgabe(drei, vorgabe, (z) => z.gegentore)).toBe(true);
    const gegen = breiteTabelle(page, 'gA').locator('[data-goals-focus="against"]');
    await expect(gegen).toHaveCount(drei.length);
    expect(await schriftgewicht(gegen.first()), 'die zweite Zahl ist fett').toBeGreaterThanOrEqual(600);
    await expect(breiteTabelle(page, 'gA').locator('[data-goals-focus="for"]')).toHaveCount(0);
    await expect(page).toHaveURL(/ts=gA\.gegentore(&|$)/);

    await kopf.click(); // 4. Tipp
    await expect(kopf).toHaveAccessibleName('Gegentore, meiste zuerst sortiert');
    expect(absteigend((await zeilen(page, 'gA')).map((z) => z.gegentore)), 'meiste Gegentore zuerst').toBe(true);

    await kopf.click(); // 5. Tipp: zurück zur Platzierung, Kopf wieder „Tore“
    await expect(kopf).toHaveAccessibleName('Tore');
    await expect(kopf).toHaveAttribute('data-sorted', 'false');
    expect(await namen(page, 'gA')).toEqual(vorgabe);
    await expect(breiteTabelle(page, 'gA').locator('[data-goals-focus]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/ts=gA/);
    expect(await namen(page, 'gB'), 'Gruppe B blieb die ganze Zeit in der Platzierung').toEqual(gruppeB);
  });

  test('@TS-014 Torspalte (Saat mit „Tore“ in der Platzierungsregel): nach Gegentore sortiert ist nur die gemeinte Zahl fett, die Zelle trägt keine Wertungsfläche', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-head-gA-tore');
    const kopf = page.getByTestId('sort-head-gA-tore');
    await kopf.click(); await kopf.click(); await kopf.click(); // Tore meiste, Tore wenigste, Gegentore wenigste
    await expect(kopf).toHaveAccessibleName('Gegentore, wenigste zuerst sortiert');
    const zellen = breiteTabelle(page, 'gA').locator('tbody tr td:has([data-goals-focus="against"])');
    await expect(zellen).toHaveCount(4);
    for (const zelle of await zellen.all()) {
      const gemeint = zelle.locator('[data-goals-focus="against"]');
      const andere = zelle.locator('span:not([data-goals-focus])');
      expect(await schriftgewicht(gemeint), 'gemeinte Zahl fett').toBeGreaterThanOrEqual(700);
      for (const nicht of await andere.all()) { expect(await schriftgewicht(nicht), 'andere Zahl nicht fett').toBeLessThan(600); }
      const flaeche = await zelle.locator('span').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(flaeche, 'keine Wertungsfläche').toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('@TS-003 Kopfmaße: Kurzformen im Kopf, jede Taste 44 px hoch und mindestens 24 px breit mit begründeter Ausnahme `data-touch-ok`, Pfeil am aktiven Kopf', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-head-gA-tore');
    const koepfe = page.locator('[data-testid^="sort-head-gA-"]');
    await expect(koepfe).toHaveCount(9);
    const texte = await koepfe.allInnerTexts();
    expect(texte.map((t) => t.split('\n')[0].trim())).toEqual(['#', 'Team', 'Sp.', 'S', 'U', 'N', 'Tore', 'Diff.', 'Pkt.']);
    for (const kopf of await koepfe.all()) {
      const kasten = await kopf.boundingBox();
      expect(Math.round(kasten?.height ?? 0), `${await kopf.getAttribute('data-testid')} Höhe`).toBeGreaterThanOrEqual(44);
      expect(Math.round(kasten?.width ?? 0), `${await kopf.getAttribute('data-testid')} Breite`).toBeGreaterThanOrEqual(24);
      await expect(kopf).toHaveAttribute('data-touch-ok', /\S/);
    }
    await expect(breiteTabelle(page, 'gA').locator('thead svg'), 'ohne Sortierung nur der Pfeil am Kopf „Platz“').toHaveCount(1);
    await page.getByTestId('sort-head-gA-pkt').click();
    const aktiv = page.getByTestId('sort-head-gA-pkt');
    await expect(aktiv.locator('svg')).toHaveCount(1);
    await expect(aktiv.locator('xpath=..')).toHaveAttribute('aria-sort', 'descending');
    await expect(page.getByTestId('sort-head-gA-sp').locator('svg')).toHaveCount(0);
  });

  test('@TS-003 Pfeil steht rechts neben dem Wort; die Kopfzeile ist sortiert so hoch wie unsortiert, die Teamnamen brechen nicht um (Entscheidung 26.11.)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-head-gA-tore');
    const tabelle = breiteTabelle(page, 'gA');
    const zeilenHoehe = async (): Promise<number[]> => tabelle.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => tr.getBoundingClientRect().height));
    const kopfHoehe = async (): Promise<number> => (await tabelle.locator('thead tr').first().boundingBox())?.height ?? 0;
    const vorherKopf = await kopfHoehe();
    const vorherZeilen = await zeilenHoehe();
    await page.getByTestId('sort-head-gA-pkt').click();
    await expect(page.getByTestId('sort-head-gA-pkt').locator('svg')).toHaveCount(1);
    expect(Math.abs((await kopfHoehe()) - vorherKopf), 'Kopfzeile sortiert == unsortiert (±1 px)').toBeLessThanOrEqual(1);
    const wort = (await page.getByTestId('sort-head-gA-pkt').locator('span').first().boundingBox())!;
    const pfeil = (await page.getByTestId('sort-head-gA-pkt').locator('svg').boundingBox())!;
    expect(pfeil.x, 'Pfeil rechts neben dem Wort').toBeGreaterThanOrEqual(wort.x + wort.width - 1);
    expect(Math.abs((pfeil.y + pfeil.height / 2) - (wort.y + wort.height / 2)), 'Pfeil auf Höhe des Wortes').toBeLessThanOrEqual(4);
    const nachherZeilen = await zeilenHoehe();
    expect(nachherZeilen.length).toBe(vorherZeilen.length);
    expect(Math.max(...nachherZeilen) - Math.max(...vorherZeilen), 'Teamnamen brechen nicht um (Zeilen werden nicht höher)').toBeLessThanOrEqual(1);
  });

  test('@TS-010 @TS-011 Sortierung nach Tore bleibt nach dem Neuladen; neu geöffnet ohne `ts` setzt das Gerät Tore; ein Link geht vor; eine unbekannte Spalte ergibt die Platzierung', async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-head-gA-tore');
    const vorgabeA = await namen(page, 'gA');
    const vorgabeB = await namen(page, 'gB');
    await page.getByTestId('sort-head-gA-tore').click();
    await expect(page).toHaveURL(/ts=gA\.tore(&|$)/);
    const nachTore = await namen(page, 'gA');
    expect(nachTore).not.toEqual(vorgabeA);

    await neuLaden(page); // @TS-010: dieselbe Adresse, dieselbe Sortierung
    await expect(page.getByTestId('sort-head-gA-tore')).toHaveAccessibleName('Tore, meiste zuerst sortiert');
    expect(await namen(page, 'gA')).toEqual(nachTore);
    expect(await namen(page, 'gB'), 'Gruppe B blieb in der Platzierung').toEqual(vorgabeB);

    // @TS-011: zweiter Tab desselben Geräts, Adresse ohne `ts` – das Gerät merkt Tore für alle Gruppentabellen
    const zweiter = await context.newPage();
    await installiereSaat(context, leseSaat('hallencup-messlauf'), NUR_ERSTES_LADEN);
    await zweiter.goto(ZUSCHAUER);
    await expect(zweiter.getByTestId('sort-head-gA-tore')).toHaveAccessibleName('Tore, meiste zuerst sortiert', { timeout: 25000 });
    await expect(zweiter).toHaveURL(/ts=gA\.tore(,|%2C)gB\.tore/);
    expect(await namen(zweiter, 'gA')).toEqual(nachTore);

    // Ein Link mit anderer Sortierung geht vor: `ts=gA.pkt.r` = wenigste Punkte zuerst, Gruppe B ohne Eintrag = Platzierung
    const dritter = await context.newPage();
    await dritter.goto(`${ZUSCHAUER}&ts=gA.pkt.r`);
    await expect(dritter.getByTestId('sort-head-gA-pkt')).toHaveAccessibleName('Punkte, wenigste zuerst sortiert', { timeout: 25000 });
    await expect(dritter.getByTestId('sort-head-gA-tore')).toHaveAccessibleName('Tore');
    expect(await namen(dritter, 'gB'), 'Link ohne Eintrag für B: Platzierung, nicht die Gerätewahl').toEqual(vorgabeB);

    // Unbekannte Spalte in der Adresse: Platzierung
    const vierter = await context.newPage();
    await vierter.goto(`${ZUSCHAUER}&ts=gA.gibtsnicht`);
    await expect(vierter.getByTestId('sort-head-gA-platz')).toHaveAttribute('data-sorted', 'true', { timeout: 25000 });
    expect(await namen(vierter, 'gA')).toEqual(vorgabeA);

    // Zuletzt „Nach Platzierung“ gewählt (Tipp auf „#“): beim nächsten Öffnen ohne `ts` steht die Platzierung
    await page.getByTestId('sort-head-gA-platz').click();
    await expect(page.getByTestId('sort-head-gA-platz')).toHaveAttribute('data-sorted', 'true');
    const fuenfter = await context.newPage();
    await fuenfter.goto(ZUSCHAUER);
    await expect(fuenfter.getByTestId('sort-head-gA-platz')).toHaveAttribute('data-sorted', 'true', { timeout: 25000 });
    expect(await namen(fuenfter, 'gA')).toEqual(vorgabeA);
  });

  test('@TS-010 Neuladen mit `ts=g.gegentore.r` stellt „Gegentore, meiste zuerst“ wieder her (Turnier ohne Gruppen)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'nikolaus-alle-beendet', `${NIKOLAUS}&ts=g.gegentore.r`, 'sort-head-g-tore');
    const kopf = page.getByTestId('sort-head-g-tore');
    await expect(kopf).toHaveAccessibleName('Gegentore, meiste zuerst sortiert');
    const davor = await zeilen(page, 'g');
    expect(absteigend(davor.map((z) => z.gegentore)), 'meiste Gegentore zuerst').toBe(true);
    await neuLaden(page);
    await expect(kopf).toHaveAccessibleName('Gegentore, meiste zuerst sortiert');
    expect(await zeilen(page, 'g')).toEqual(davor);
    await expect(page).toHaveURL(/ts=g\.gegentore\.r/);
  });

  test('@TS-003 Turnierleitung, Reiter „Tabellen“: Kopf „Team“ hat drei Stufen (A bis Z, Z bis A, zurück zur Platzierung)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await oeffne(page, 'hallencup-messlauf', LEITUNG, 'sort-head-gA-team');
    const vorgabe = await namen(page, 'gA');
    const kopf = page.getByTestId('sort-head-gA-team');
    const abc = new Intl.Collator('de', { sensitivity: 'base' });

    await kopf.click();
    await expect(kopf).toHaveAccessibleName('Team, A bis Z sortiert');
    await expect(kopf.locator('svg')).toHaveCount(1);
    expect(await namen(page, 'gA')).toEqual([...vorgabe].sort(abc.compare));

    await kopf.click();
    await expect(kopf).toHaveAccessibleName('Team, Z bis A sortiert');
    expect(await namen(page, 'gA')).toEqual([...vorgabe].sort(abc.compare).reverse());

    await kopf.click();
    await expect(kopf).toHaveAccessibleName('Team');
    await expect(kopf.locator('svg')).toHaveCount(0);
    expect(await namen(page, 'gA')).toEqual(vorgabe);
    await expect(page).not.toHaveURL(/ts=gA/);
  });
});

test.describe('Tabellen sortieren – Handy (Fenster des Profils, im Projekt desktop 390 Pixel)', () => {
  test('@TS-004 @TS-005 @TS-020 am Handy: Köpfe nur Anzeige; „Sortieren nach …“ → „Tordifferenz“ sortiert, Gruppe B bleibt, „Nach Platzierung“ stellt die Vorgabe her', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'desktop') { await page.setViewportSize({ width: 390, height: 844 }); }
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-picker-gA');
    const auswahl = page.getByTestId('sort-picker-gA');
    test.skip(!(await auswahl.isVisible()), 'ab 768 Pixel gilt die breite Tabelle (Köpfe bedienbar, Laptop-Fälle)');
    const tabelle = page.locator('.standings-table').first();
    const vorgabe = await namen(page, 'gA');
    const vorgabeB = await namen(page, 'gB');

    await expect(tabelle.locator('.mobile-view thead button'), 'am Handy ist kein Kopf eine Taste').toHaveCount(0);
    await expect(page.locator('[data-testid^="sort-head-gA-"]:visible')).toHaveCount(0);
    expect(Number.parseFloat(await auswahl.evaluate((el) => getComputedStyle(el).fontSize)), 'Schrift der Auswahl ≥ 16 px').toBeGreaterThanOrEqual(16);
    expect((await auswahl.boundingBox())?.height ?? 0, 'Auswahl ≥ 44 px hoch').toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('sort-reset-gA'), 'ohne Sortierung keine Taste „Nach Platzierung“').toHaveCount(0);

    await auswahl.selectOption({ label: 'Tordifferenz' });
    await expect(page).toHaveURL(/ts=gA\.diff(&|$)/);
    const sortiert = await zeilen(page, 'gA');
    expect(absteigend(sortiert.map((z) => z.tore - z.gegentore)), 'beste Tordifferenz zuerst').toBe(true);
    expect(sortiert.map((z) => z.name)).not.toEqual(vorgabe);
    expect(gleichstandNachVorgabe(sortiert, vorgabe, (z) => z.tore - z.gegentore)).toBe(true);
    // Der Pfeil steht am aktiven Kopf „Diff.“ der Handy-Tabelle (nur Anzeige), keine Taste
    await expect(tabelle.locator('.mobile-view thead button')).toHaveCount(0);
    expect(await namen(page, 'gB'), 'Gruppe B blieb in der Platzierung').toEqual(vorgabeB);

    const zurueck = page.getByTestId('sort-reset-gA');
    await expect(zurueck).toBeVisible();
    expect((await zurueck.boundingBox())?.height ?? 0, '„Nach Platzierung“ ≥ 44 px hoch').toBeGreaterThanOrEqual(44);
    await zurueck.click();
    expect(await namen(page, 'gA')).toEqual(vorgabe);
    await expect(page).not.toHaveURL(/ts=gA/);
    await expect(page.getByTestId('sort-reset-gA')).toHaveCount(0);
  });

  // @TS-012 geparkt (Daniel 27.11.): Die Handy-Auswahl bietet nur die am Handy sichtbaren Spalten; „Gegentore“ gehört nicht dazu.
  test.skip('@TS-012 geparkt (Daniel 27.11.) „Sortieren nach …“ → „Gegentore“ sortiert auch ohne sichtbare Torspalte', async ({ page }) => {
    await page.getByTestId('sort-picker-gA').selectOption({ label: 'Gegentore' });
  });

  test('@TS-012 @TS-014 am Handy: „Sortieren nach …“ „Punkte“ zeigt den Pfeil am Kopf „Pkt.“ (nur Anzeige)', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'desktop') { await page.setViewportSize({ width: 390, height: 844 }); }
    await oeffne(page, 'hallencup-messlauf', ZUSCHAUER, 'sort-picker-gA');
    const auswahl = page.getByTestId('sort-picker-gA');
    test.skip(!(await auswahl.isVisible()), 'ab 768 Pixel gilt die breite Tabelle (Köpfe bedienbar, Laptop-Fälle)');
    await auswahl.selectOption({ label: 'Punkte' });
    const kopf = page.locator('.standings-table').first().locator('.mobile-view thead th[data-sort-indicator]');
    await expect(kopf).toHaveCount(1);
    await expect(kopf).toHaveAttribute('aria-sort', 'descending');
    await expect(kopf.locator('svg')).toHaveCount(1);
  });
});

/**
 * Paket SK – @OB-064 „Tore folgen der Anordnung der Mannschaften, der Sieger steht fett“ im Spielplan der Verwaltung
 * (Handy 360×640 hoch, Tablet hochkant 768, Laptop 1280×800) und C-FINALRUNDE-MOBIL-EINGABE.
 *
 * Saat `hallencup-messlauf` (scripts/visual-metrics/saat, Paket SM): 12 Gruppenspiele beendet, Halbfinale 1 nach Verlängerung
 * (reguläre Zeit 1:1, Verlängerung 1:0 → 2:1 n. V.), Halbfinale 2 nach Strafstoßschießen (0:0, 4:3), Finale läuft (2:1),
 * Spiel um Platz 3 offen. Das laufende Finale erscheint im Spielplan nicht als „läuft“: `runningMatchIds` kommt aus `useLiveMatches`,
 * die Engine-Kopien der Saat zählen dort erst nach dem Öffnen des Cockpits. „Läuft“ mit Spielzeit deckt deshalb der RTL-Test ab.
 * Werte der Erwartung stammen aus dem Gherkin von @OB-064 (Zeilen je Mannschaft, Zusatz, Tabelle).
 * Bilder: Ordner aus SK_BILDER, Namensvorsatz aus SK_PHASE (vorher | nachher). Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const SPIELPLAN = '/#/tournament/hallencup-messlauf/schedule';
const BILDER = process.env.SK_BILDER;
const PHASE = process.env.SK_PHASE ?? 'nachher';

const HANDY = { width: 360, height: 640 };
const TABLET_HOCH = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 800 };

async function oeffneSpielplan(page: Page, groesse: { width: number; height: number }) {
  await page.setViewportSize(groesse);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(SPIELPLAN);
  await expect(page.locator('[data-testid^="final-card-"]').first()).toBeAttached({ timeout: 20000 });
}

async function bild(page: Page, name: string, ziel?: ReturnType<Page['locator']>) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  const pfad = join(BILDER, `${PHASE}-${name}.png`);
  if (ziel) { await ziel.screenshot({ path: pfad }); } else { await page.screenshot({ path: pfad, fullPage: false }); }
}


/**
 * @OB-025 (Lange Teamnamen) in der Karte: der Name bricht nur an Leerzeichen bzw. an der Fuge (Bindestrich), nie mitten im Wort.
 * Gemessen: das breiteste Wortstück jedes Namens passt in die Breite des Namens-Elements.
 */
const breitestesWortstueck = (page: Page, selektor: string) =>
  page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((el) => el.offsetParent !== null).map((el) => {
    const stil = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${stil.font};font-variant-numeric:${stil.fontVariantNumeric}`;
    document.body.appendChild(probe);
    let breit = 0;
    for (const stueck of (el.textContent ?? '').split(/(?<=-)|\s+/)) { probe.textContent = stueck; breit = Math.max(breit, probe.getBoundingClientRect().width); }
    probe.remove();
    return { name: el.textContent ?? '', wort: Math.ceil(breit), breite: Math.floor(el.getBoundingClientRect().width) };
  }), selektor);

const finalKarte = (page: Page, nr: number) => page.locator('[data-testid^="final-card-"]').nth(nr);
const gewicht = (el: ReturnType<Page['locator']>) => el.evaluate((n) => Number(getComputedStyle(n).fontWeight));

test.describe('@OB-064 Spielplan der Verwaltung, Handy 360×640 hoch', () => {
  test.beforeEach(async ({ page }) => { await oeffneSpielplan(page, HANDY); });

  test('Halbfinale 1 nach Verlängerung: Tore 2 und 1 je Zeile, „n. V.“ in der Kopfzeile, Sieger fett', async ({ page }) => {
    const karte = finalKarte(page, 0);
    await karte.scrollIntoViewIfNeeded();
    await expect(karte.locator('[data-testid^="final-goals-"]').nth(0)).toHaveText('2');
    await expect(karte.locator('[data-testid^="final-goals-"]').nth(1)).toHaveText('1');
    await expect(karte.locator('[data-testid^="final-decision-"]')).toHaveText('n. V.');
    await expect(karte.locator('[data-testid^="final-penalty-"]')).toHaveCount(0);
    await expect(karte.locator('[data-winner="true"]')).toHaveCount(1);
    expect(await gewicht(karte.locator('[data-testid^="final-name-"]').nth(0))).toBeGreaterThanOrEqual(700);
    expect(await gewicht(karte.locator('[data-testid^="final-name-"]').nth(1))).toBeLessThan(700);
    await bild(page, 'handy-360-halbfinale-1-nV', karte);
  });

  test('Halbfinale 2 nach Strafstoßschießen: Tore 0 und 0, (4) und (3) je Zeile, „beendet i. E.“, Sieger fett', async ({ page }) => {
    const karte = finalKarte(page, 1);
    await karte.scrollIntoViewIfNeeded();
    await expect(karte.locator('[data-testid^="final-goals-"]').nth(0)).toHaveText('0');
    await expect(karte.locator('[data-testid^="final-goals-"]').nth(1)).toHaveText('0');
    await expect(karte.locator('[data-testid^="final-penalty-"]').nth(0)).toHaveText('(4)');
    await expect(karte.locator('[data-testid^="final-penalty-"]').nth(1)).toHaveText('(3)');
    await expect(karte.locator('[data-testid^="final-decision-"]')).toHaveText('beendet i. E.');
    // Sieger (Heim) fett, Gegenbeispiel: der Verlierer (Gast) steht nicht fett
    expect(await gewicht(karte.locator('[data-testid^="final-name-"]').nth(0))).toBeGreaterThanOrEqual(700);
    expect(await gewicht(karte.locator('[data-testid^="final-name-"]').nth(1))).toBeLessThan(700);
    await bild(page, 'handy-360-halbfinale-2-strafstoss', karte);
  });

  test('Langer Teamname (50 Zeichen) bricht in Gruppen- und Finalkarte nur an Leerzeichen, nie im Wort', async ({ page }) => {
    for (const selektor of ['.mobile-view [data-testid^="match-name-"]', '[data-testid^="final-name-"]']) {
      const namen = await breitestesWortstueck(page, selektor);
      const lang = namen.filter((n) => n.name.length >= 50);
      expect(lang.length, selektor).toBeGreaterThan(0);
      for (const n of namen) { expect(n.wort, `${n.name} (${selektor})`).toBeLessThanOrEqual(n.breite); }
    }
  });

  test('Name und Torfläche überlappen nicht (Bounding-Box, Gruppen- und Finalkarte)', async ({ page }) => {
    const paare = await page.evaluate(() => {
      const liste: { art: string; nameRechts: number; toreLinks: number; name: string }[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('.mobile-view [data-testid^="match-name-"]')) {
        const id = el.dataset.testid?.replace('match-name-', '') ?? '';
        const tore = document.querySelector<HTMLElement>(`[data-testid="match-goals-${id}"]`);
        if (el.offsetParent !== null && tore) { liste.push({ art: 'gruppe', nameRechts: el.getBoundingClientRect().right, toreLinks: tore.getBoundingClientRect().left, name: el.textContent ?? '' }); }
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid^="final-name-"]')) {
        const tore = el.nextElementSibling;
        if (el.offsetParent !== null && tore) { liste.push({ art: 'final', nameRechts: el.getBoundingClientRect().right, toreLinks: tore.getBoundingClientRect().left, name: el.textContent ?? '' }); }
      }
      return liste;
    });
    expect(paare.length).toBeGreaterThan(8);
    for (const p of paare) { expect(p.nameRechts, `${p.art}: ${p.name}`).toBeLessThanOrEqual(p.toreLinks + 0.5); }
  });

  test('Gruppenspiel: Spielkarte mit Tore je Zeile, Torzahl-Fläche ≥ 44 px, kein Fortschrittsring', async ({ page }) => {
    const erste = page.locator('[data-match-card] [data-testid^="match-goals-"]').first();
    await erste.scrollIntoViewIfNeeded();
    const box = await erste.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.locator('[data-match-card] svg[role="progressbar"]')).toHaveCount(0);

    // Anordnung: Mannschaften untereinander, Torzahlen rechts in einer Spalte, Namen nicht in eine Spalte gequetscht
    const karte = page.locator('.mobile-view [data-match-card]').first();
    const kasten = async (testid: string) => {
      const b = await karte.locator(`[data-testid^="${testid}"]`).first().boundingBox();
      return b ?? { x: 0, y: 0, width: 0, height: 0 };
    };
    const kasten2 = async (testid: string) => {
      const b = await karte.locator(`[data-testid^="${testid}"]`).nth(1).boundingBox();
      return b ?? { x: 0, y: 0, width: 0, height: 0 };
    };
    const heim = await kasten('match-name-');
    const gast = await kasten2('match-name-');
    const toreHeim = await kasten('match-goals-');
    const toreGast = await kasten2('match-goals-');
    expect(gast.y).toBeGreaterThan(heim.y + heim.height - 1);
    expect(Math.abs(gast.x - heim.x)).toBeLessThan(2);
    expect(heim.width).toBeGreaterThan(80);
    expect(Math.abs(toreGast.x - toreHeim.x)).toBeLessThan(2);
    expect(toreHeim.x).toBeGreaterThan(heim.x + heim.width - 1);
    expect(toreGast.y).toBeGreaterThan(toreHeim.y);
    await bild(page, 'handy-360-gruppenspiel', karte);
  });
});

for (const [name, groesse] of [['Handy 360', HANDY], ['Tablet hochkant 768', TABLET_HOCH]] as const) {
  test.describe(`C-FINALRUNDE-MOBIL-EINGABE: ${name}`, () => {
    test('offenes Finalrunden-Spiel (Platz 3): beide Felder nacheinander eintragbar, die Eingabe springt nicht zurück', async ({ page }) => {
      await oeffneSpielplan(page, groesse);
      const karte = finalKarte(page, 3);
      await karte.scrollIntoViewIfNeeded();
      const heim = karte.locator('input[data-testid$="-home"]');
      const gast = karte.locator('input[data-testid$="-away"]');
      await expect(heim).toBeVisible();
      await bild(page, `${name.startsWith('Handy') ? 'handy-360' : 'tablet-768'}-platz-3-offen`, karte);

      await heim.fill('2');
      await expect(heim).toHaveValue('2'); // vorher sprang das Feld auf leer zurück
      await gast.fill('1');
      // Das Spiel ist eingetragen: die Eingabefelder weichen den Torzahlen der beendeten Karte
      await expect(karte.locator('[data-testid^="final-goals-"]').nth(0)).toHaveText('2', { timeout: 15000 });
      await expect(karte.locator('[data-testid^="final-goals-"]').nth(1)).toHaveText('1');
      await bild(page, `${name.startsWith('Handy') ? 'handy-360' : 'tablet-768'}-platz-3-eingetragen`, karte);
    });
  });
}

test.describe('@OB-064 Spielplan der Verwaltung, Laptop 1280×800: Tabellenzeile waagerecht', () => {
  test.beforeEach(async ({ page }) => { await oeffneSpielplan(page, LAPTOP); });

  test('Halbfinale 1 „2:1 n. V.“, Halbfinale 2 „0:0 (4:3 i. E.)“, Gruppenspiel „3:1“', async ({ page }) => {
    const zellen = page.locator('.match-score-cell-finished');
    await expect(zellen.nth(0)).toHaveText(/^2:1 n\. V\./);
    await expect(zellen.nth(1)).toHaveText(/^0:0 \(4:3 i\. E\.\)/);
    await expect(page.locator('[data-testid^="match-circle-"]').first()).toHaveText('3:1');
    await zellen.nth(0).scrollIntoViewIfNeeded();
    await bild(page, 'desktop-1280-tabelle-finalrunde', page.locator('.final-stage-schedule .desktop-view'));
    const gruppenzeile = page.locator('.desktop-view [data-match-card]').first();
    await gruppenzeile.scrollIntoViewIfNeeded();
    await bild(page, 'desktop-1280-tabelle-gruppenphase', page.locator('.desktop-view').first());
  });

  test('offenes Spiel (Platz 3): Heim und Gast haben dieselbe Schriftstärke, nur Sieger beendeter Spiele sind fett', async ({ page }) => {
    const zeile = page.locator('.final-stage-schedule table tbody tr').nth(3);
    const namen = zeile.locator('td:nth-child(4), td:nth-child(6)');
    const gewichte = await namen.evaluateAll((tds) => tds.map((t) => getComputedStyle(t).fontWeight));
    expect(gewichte).toHaveLength(2);
    expect(gewichte[0]).toBe(gewichte[1]);
    expect(Number(gewichte[0])).toBeLessThan(700);
    // Gegenbeispiel beendet (Halbfinale 1): Sieger fett, Verlierer nicht
    const hf1 = await page.locator('.final-stage-schedule table tbody tr').nth(0).locator('td:nth-child(4), td:nth-child(6)')
      .evaluateAll((tds) => tds.map((t) => Number(getComputedStyle(t).fontWeight)));
    expect(hf1[0]).toBeGreaterThanOrEqual(700);
    expect(hf1[1]).toBeLessThan(700);
    await bild(page, 'desktop-1280-tabelle-zeile-16-platz-3', page.locator('.final-stage-schedule table'));
  });

  test('Gegenbeispiel: ein regulär beendetes Gruppenspiel trägt keinen Zusatz', async ({ page }) => {
    const gruppe = page.locator('[data-testid^="match-circle-"]');
    const texte = await gruppe.allTextContents();
    expect(texte.length).toBeGreaterThan(0);
    for (const text of texte) { expect(text).not.toMatch(/n\. V\.|i\. E\./); }
  });

  test('Klickziel ins Cockpit bleibt: die Ergebnis-Fläche der Gruppenspiel-Zeile ist ≥ 44 px hoch', async ({ page }) => {
    const box = await page.locator('[data-testid^="match-circle-"]').first().boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

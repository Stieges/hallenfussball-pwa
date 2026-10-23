/**
 * Paket TB-B, TB-6b/c/d (Regel T2-UI): der Gleichstand in der Tabelle im echten Ablauf – Hinweis und Marken, Wahl-Dialog,
 * Strafstoßschießen eintragen, „Platz teilen“ (Wortlaut Daniel 23.10.), Fehler ohne Sieger, Assistent (Reihenfolge, feste
 * Zeile, Auswahl der Plätze), Einstellung mit Rückfrage – auf Desktop und 360 px. Helfer und Zuschauer (offline nicht
 * erreichbar) über den Prüfstand `tests/e2e/harness/gleichstand.html`. Daten: Saat `nikolaus-gleichstand` (Nikolausturnier,
 * Plan Abschnitt 6). Gherkin: @ET-025, @ET-055, @W2A-044, @W2A-047, @W2A-050, @W2A-056, @W2A-059, @W2A-061, @W2A-063,
 * @W2A-064, @W2A-066, @W2A-067, @W2A-068, @W2A-070, @W2A-071. Bilder nach `TB6_BILDER`. Läuft gegen den lokalen Dev-Server
 * ohne Supabase; nie gegen die Produktion.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.TB6_BILDER;
const ID = 'nikolaus-gleichstand';
const GROESSEN = [{ name: 'desktop', breite: 1280, hoehe: 900 }, { name: 'handy', breite: 360, hoehe: 740 }] as const;

interface SaatLike { datenbanken: { store: string; eintraege: { tournaments?: Array<Record<string, unknown>> } }[] }

async function oeffne(page: Page, breite: number, hoehe: number, plaetze: number[] = [1]): Promise<void> {
  const saat = leseSaat(ID) as SaatLike;
  const cache = saat.datenbanken.find((d) => d.store === 'cache');
  if (cache?.eintraege.tournaments) {
    cache.eintraege.tournaments[0].placementsToPlayOut = plaetze;
    cache.eintraege.tournaments[0].version = 1;
  }
  await page.setViewportSize({ width: breite, height: hoehe });
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/tournament/${ID}/standings`);
  await page.getByRole('button', { name: 'Gesamtplatzierung' }).click();
  // die Marken in der Tabelle; der eigene Hinweis-Kasten entfällt bei fertiger Gruppe (Daniel 23.10.)
  await expect(page.getByTestId('tie-marker').first()).toBeVisible({ timeout: 25000 });
}

async function bild(page: Page, name: string, breite: number): Promise<void> {
  if (BILDER === undefined) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}-${breite === 360 ? 'handy' : 'desktop'}.png`), fullPage: false, animations: 'disabled' });
}

/** Nichts läuft seitlich über, Ziele mindestens 44 px, Hauptziel mindestens 56 px (VISUAL-DESIGN § 1 und § 6). */
async function pruefeMasse(page: Page, selektoren: string[]): Promise<void> {
  const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(ueberlauf, 'Seite läuft seitlich über').toBe(false);
  for (const selektor of selektoren) {
    const box = await page.locator(selektor).first().boundingBox();
    expect(box?.height ?? 0, `${selektor} Höhe`).toBeGreaterThanOrEqual(44);
    await keinWortgebrochen(page, selektor);
    const ragtHinaus = await page.locator(selektor).first().evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(ragtHinaus, `${selektor}: Text ragt über den Rand`).toBe(false);
  }
  // Marken, Hinweis-Tasten und „zurücknehmen“ auf jeder Größe: nie ein Wort über zwei Zeilen (auch auf 360 px)
  for (const selektor of ['[data-testid="tie-marker"]', '[data-testid="tie-hints"] button']) {
    await keinWortgebrochen(page, selektor);
  }
}

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
});

/**
 * Kein Wort des Elements steht über zwei Zeilen (VISUAL-DESIGN § 2; C-TABELLE-HANDY-NAME-SENKRECHT): je Wort die Zeilen aller
 * Rechtecke zählen. Ein Umbruch zwischen Wörtern ist erlaubt, im Wort nie.
 */
async function keinWortgebrochen(page: Page, selektor: string): Promise<void> {
  const gebrochen = await page.locator(selektor).evaluateAll((els) => {
    const out: string[] = [];
    for (const el of els) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (const m of text.matchAll(/[^\s]+/g)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const zeilen = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top)));
          if (zeilen.size > 1) { out.push(m[0]); }
        }
      }
    }
    return out;
  });
  expect(gebrochen, `Wort im Wort gebrochen in ${selektor}`).toEqual([]);
}

const zeilen = (page: Page) => page.locator('tbody tr:not([data-testid="tie-marker-row"])'); // ohne die Markenzeilen des Handys
const teamReihenfolge = async (page: Page): Promise<string[]> => zeilen(page).evaluateAll((els) => els.map((tr) => (tr.querySelectorAll('td')[1] as HTMLElement).innerText));

// Daniel 23.10. (Ansicht und Wortlaut): bei fertiger Gruppe EIN Kasten mit EINER Haupttaste oben – „Gleichstand entscheiden“ (Wahl),
// „Strafstoßschießen eintragen“ (auszuspielender Platz), sonst „Gruppe abschließen“; die Entscheidung schließt die Gruppe in einem Zug ab.
const HAUPTTASTE = '[data-testid="group-close-button-all"]';

for (const g of GROESSEN) {
  test.describe(`${g.name} ${g.breite} px`, () => {
    test(`@ET-025 @W2A-067 Wahl-Fall (nur Platz 1): zwei Marken „Gleichstand – Entscheidung nötig“ und die Taste „Gleichstand entscheiden“`, async ({ page }) => {
      await oeffne(page, g.breite, g.hoehe);
      await expect(page.getByTestId('tie-marker')).toHaveCount(2);
      await expect(page.getByTestId('tie-marker').first()).toContainText('Gleichstand – Entscheidung nötig');
      const taste = page.locator(HAUPTTASTE);
      await expect(taste).toHaveText('Gleichstand entscheiden');
      await expect(taste).toBeInViewport(); // Haupttaste ohne Scrollen sichtbar
      await expect(page.getByTestId('group-close-then-all')).toHaveText('Danach ist die Gruppe abgeschlossen.');
      await expect(page.getByTestId('tie-hint-choice'), 'kein zweiter Kasten').toHaveCount(0);
      await expect(page.locator('[data-primary]'), 'eine Haupttaste je Ansicht (VISUAL-DESIGN § 8)').toHaveCount(1);
      await pruefeMasse(page, [HAUPTTASTE]);
      await bild(page, 'wahl-fall', g.breite);
      await page.getByTestId('tie-marker').first().scrollIntoViewIfNeeded();
      await bild(page, 'gesamtplatzierung', g.breite);
    });

    test(`@W2A-064 Pflicht-Fall (Plätze 1 bis 3): „Strafstoßschießen nötig“, nur die Taste „Strafstoßschießen eintragen“`, async ({ page }) => {
      await oeffne(page, g.breite, g.hoehe, [1, 2, 3]);
      await expect(page.getByTestId('tie-marker').first()).toContainText('Strafstoßschießen nötig');
      await expect(page.locator(HAUPTTASTE)).toHaveText('Strafstoßschießen eintragen');
      await expect(page.locator(HAUPTTASTE)).toBeInViewport();
      await expect(page.locator('[data-primary]')).toHaveCount(1);
      await pruefeMasse(page, [HAUPTTASTE]);
      await bild(page, 'pflicht-fall', g.breite);
    });

    test(`@ET-055 @W2A-061 Strafstoßschießen: 4:4 wird am Feld abgelehnt, 4:3 für Otting stellt Otting vor Petting, danach ist die Gruppe abgeschlossen`, async ({ page }) => {
      await oeffne(page, g.breite, g.hoehe, [1, 2, 3]);
      await page.locator(HAUPTTASTE).click();
      const dialog = page.getByTestId('tie-decision-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('tie-why')).toContainText('Warum nur das Strafstoßschießen?');
      await expect(dialog.getByTestId('tie-accept-result'), 'Gegenbeispiel: kein „Platz teilen“ auf einem auszuspielenden Platz').toHaveCount(0);
      await expect(dialog.getByTestId('tie-then-closed')).toHaveText('Danach ist die Gruppe abgeschlossen.');
      await dialog.getByLabel(/DJK Otting/).fill('4');
      await dialog.getByLabel(/TSV Petting/).fill('4');
      await page.getByTestId('group-close-confirm').click();
      await expect(dialog.getByRole('alert')).toContainText('braucht einen Sieger');
      await bild(page, 'dialog-fehler', g.breite);
      await dialog.getByLabel(/DJK Otting/).fill('4');
      await dialog.getByLabel(/TSV Petting/).fill('3');
      await expect(dialog.getByTestId('tie-effect')).toContainText('3. DJK Otting, 4. TSV Petting');
      await pruefeMasse(page, ['[data-testid="group-close-confirm"]', '[data-testid="tie-shootout-score-0"]']);
      const feldGroesse = await page.getByTestId('tie-shootout-score-0').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(feldGroesse, 'Eingabeschrift mindestens 16 px').toBeGreaterThanOrEqual(16);
      await bild(page, 'dialog', g.breite);
      await page.getByTestId('group-close-confirm').click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId('group-state-all')).toHaveText('abgeschlossen');
      await expect(page.getByTestId('tie-decided-info')).toContainText('Strafstoßschießen');
      const reihenfolge = await teamReihenfolge(page);
      expect(reihenfolge.findIndex((r) => r.includes('DJK Otting'))).toBeLessThan(reihenfolge.findIndex((r) => r.includes('TSV Petting')));
      expect(await page.getByTestId('tie-marker').allInnerTexts()).toEqual(['Strafstoßschießen 4:3', 'Strafstoßschießen 3:4']);
      await expect(page.getByTestId('tie-accept-withdraw'), 'nach dem Abschluss kein Zurücknehmen (@W2A-070)').toHaveCount(0);
      await bild(page, 'nach-strafstossschiessen', g.breite);
    });

    test(`@W2A-063 Wahl-Dialog: „Gleichstand auf Platz 3“, „Platz teilen“ in einem Tipp ohne Grundfeld; beide auf Platz 3, das nächste Team auf 5, Gruppe abgeschlossen`, async ({ page }) => {
      await oeffne(page, g.breite, g.hoehe);
      await page.locator(HAUPTTASTE).click();
      const dialog = page.getByTestId('tie-decision-dialog');
      await expect(dialog.getByRole('heading', { name: 'Gleichstand auf Platz 3' })).toBeVisible();
      await expect(dialog.getByTestId('tie-dialog-context')).toHaveText('TSV Petting und DJK Otting sind nach allen Regeln gleich.');
      await expect(dialog.getByTestId('tie-accept-result')).toHaveText('Platz teilen');
      await expect(dialog).toContainText('Beide auf Platz 3, danach folgt Platz 5.');
      await expect(dialog.getByTestId('tie-reason')).toHaveCount(0);
      await pruefeMasse(page, ['[data-testid="tie-pick-shootout"]', '[data-testid="tie-accept-result"]']);
      await bild(page, 'dialog-wahl', g.breite);
      await dialog.getByTestId('tie-accept-result').click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId('group-state-all')).toHaveText('abgeschlossen');
      await expect(page.getByTestId('tie-decided-info')).toContainText('Platz geteilt');
      expect(await page.getByTestId('tie-marker').allInnerTexts()).toEqual(['Gleicher Platz', 'Gleicher Platz']);
      const plaetze = await zeilen(page).evaluateAll((els) => els.map((tr) => (tr.querySelectorAll('td')[0] as HTMLElement).innerText.trim()));
      expect(plaetze.slice(2, 5)).toEqual(['3', '3', '5']);
      await bild(page, 'nach-annahme', g.breite);
    });
  });
}

test.describe('Prüfstand: Helfer und Zuschauer', () => {
  test.beforeEach(() => {
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GROESSEN) {
    test(`@W2A-050 @W2A-071 Helfer ${g.name}: Marken und Hinweis, keine Taste; entschieden: Ergebnis ohne Name und Zeit`, async ({ page }) => {
      await page.setViewportSize({ width: g.breite, height: g.hoehe });
      await page.goto('/tests/e2e/harness/gleichstand.html?rolle=helfer&plaetze=1,2,3');
      await page.getByRole('button', { name: 'Gesamtplatzierung' }).click();
      await expect(page.getByTestId('tie-hint-mandatory')).toContainText('Die Turnierleitung trägt das Ergebnis des Strafstoßschießens ein.');
      await expect(page.getByTestId('tie-marker')).toHaveCount(2);
      await expect(page.getByTestId('tie-hints').getByRole('button')).toHaveCount(0);
      await bild(page, 'helfer', g.breite);
      await page.goto('/tests/e2e/harness/gleichstand.html?rolle=helfer&zustand=schiessen');
      await page.getByRole('button', { name: 'Gesamtplatzierung' }).click();
      await expect(page.getByTestId('tie-decided-info')).toContainText('Strafstoßschießen 4:3 für DJK Otting');
      await expect(page.getByTestId('tie-decided-info').getByRole('button')).toHaveCount(0);
      await expect(page.getByTestId('tie-closed-note')).toHaveCount(0);
      await keinWortgebrochen(page, '[data-testid="tie-marker"]');
      await keinWortgebrochen(page, 'tbody td:nth-child(2)');
      await bild(page, 'helfer-entschieden', g.breite);
    });

    test(`@W2A-059 Zuschauer ${g.name}: nur Reihenfolge und gemeinsame Platzziffer, keine Marke, kein Hinweis`, async ({ page }) => {
      await page.setViewportSize({ width: g.breite, height: g.hoehe });
      await page.goto('/tests/e2e/harness/gleichstand.html?rolle=zuschauer&zustand=annahme');
      await expect(page.locator('.standings-table').first()).toBeVisible();
      await expect(page.getByTestId('tie-marker')).toHaveCount(0);
      await expect(page.getByTestId('tie-hints')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toMatch(/Strafstoß|Entscheidung nötig|Gleicher Platz/);
      await bild(page, 'zuschauer', g.breite);
    });
  }

  test('@W2A-070 Gruppe abgeschlossen: Schloss-Hinweis statt „zurücknehmen“ (Turnierleitung)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tests/e2e/harness/gleichstand.html?rolle=leitung&zustand=abgeschlossen');
    await page.getByRole('button', { name: 'Gesamtplatzierung' }).click();
    await expect(page.getByTestId('tie-closed-note')).toContainText('Die Gruppe ist abgeschlossen.');
    await expect(page.getByTestId('tie-accept-withdraw')).toHaveCount(0);
    await bild(page, 'gruppe-abgeschlossen', 1280);
  });

  test('@W2A-062 ohne Netz: Taste gesperrt, Hinweis nennt „Gruppe abschließen“', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/tests/e2e/harness/gleichstand.html?rolle=leitung&netz=aus');
    await page.getByRole('button', { name: 'Gesamtplatzierung' }).click();
    await expect(page.getByTestId('tie-decide-entry')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('tie-offline-hint')).toContainText('Gruppe abschließen');
    await bild(page, 'ohne-netz', 360);
  });
});

for (const g of GROESSEN) {
  test(`@W2A-056 @W2A-066 Assistent ${g.name}: Reihenfolge mit fester Zeile, Auswahl der Plätze (Platz 1 vorbelegt)`, async ({ page }) => {
    await page.setViewportSize({ width: g.breite, height: g.hoehe });
    await page.goto('/#/tournament/new?step=3');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Tabellenregeln/ }).click();
    const liste = page.getByRole('list', { name: 'Platzierungskriterien, sortierbar' }).getByRole('listitem');
    await expect(liste).toHaveCount(4);
    await expect(page.getByTestId('placement-after-row')).toContainText('danach: Strafstoßschießen (Entscheidung der Turnierleitung)');
    await expect(page.getByTestId('playout-place-1')).toBeChecked();
    await expect(page.getByTestId('playout-place-2')).not.toBeChecked();
    await page.getByTestId('playout-place-3').check();
    await expect(page.getByTestId('playout-summary')).toContainText('Platz 1 und Platz 3');
    await pruefeMasse(page, ['[data-testid="playout-chip-3"]']);
    await page.getByTestId('playout-section').scrollIntoViewIfNeeded();
    await bild(page, 'assistent', g.breite);
  });
}

test('@W2A-068 Einstellungen: Platz 3 anhaken hebt den geteilten Platz auf – die App fragt vor dem Speichern (Desktop)', async ({ page }) => {
  await oeffne(page, 1280, 900);
  await page.locator(HAUPTTASTE).click();
  await page.getByTestId('tie-accept-result').click();
  await expect(page.getByTestId('tie-decided-info')).toBeVisible();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).first().click();
  await page.getByTestId('playout-section').scrollIntoViewIfNeeded();
  await page.getByTestId('playout-place-3').check();
  await page.getByTestId('playout-save').click();
  const rueckfrage = page.getByTestId('tie-places-confirm');
  await expect(rueckfrage).toContainText('Geteilter Platz wird aufgehoben');
  await expect(rueckfrage).toContainText('TSV Petting und DJK Otting');
  await bild(page, 'einstellung-rueckfrage', 1280);
  await page.getByTestId('playout-confirm-ok').click();
  await expect(rueckfrage).toHaveCount(0);
});

/**
 * @OB-061 Tasten im Dialog-Fuß stehen einzeilig nebeneinander oder untereinander (Haupttaste unten), @OB-022 (Haupttaste ≥ 56 px).
 * Werte aus dem Gherkin: Laptop 1440×900 (nebeneinander, wenn beide in eine Zeile passen, sonst untereinander), Handy 360×640
 * (untereinander in voller Breite, „Als PDF speichern“ unten); keine Taste auf zwei Zeilen, gekürzt oder mit „…“.
 * Bilder: Ordner aus DIALOG_ACTIONS_SCR (sonst im Testergebnis-Ordner). Läuft nur im Projekt `desktop` (setzt Fenster selbst).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'dialog-actions-tournament';
const GERAETE = [
  { name: 'laptop-1440x900', width: 1440, height: 900, untereinander: false },
  { name: 'handy-360x640', width: 360, height: 640, untereinander: true },
] as const;

interface Messung {
  cancel: { top: number; left: number; width: number; height: number; zeilen: number; textOverflow: string };
  save: { top: number; left: number; width: number; height: number; zeilen: number; textOverflow: string; text: string };
  fuss: { width: number };
  einzeilBreite: number;
}

async function oeffneDialog(page: Page, seed: (d: Record<string, unknown>) => Promise<void>) {
  await seed({ tournaments: [buildVisualTournament({ id: ID, title: 'Nordstadt Hallencup' })] });
  await page.goto(`/#/tournament/${ID}/schedule`);
  await page.getByTestId('schedule-action-pdf').click();
  await expect(page.getByTestId('pdf-save')).toBeVisible();
  // Dialog-Einblendung abwarten (Öffnungszustand)
  await page.waitForTimeout(600);
}

/** Bild im Öffnungszustand, dann das scrollende Panel ganz nach unten und ein zweites Bild. */
async function bilder(page: Page, ordner: string, name: string) {
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}-geoeffnet.png`) });
  await page.evaluate(() => {
    for (let e = document.querySelector<HTMLElement>('[data-dialog-actions]'); e; e = e.parentElement) {
      if (e.scrollHeight > e.clientHeight && /auto|scroll/.test(getComputedStyle(e).overflowY)) {
        e.scrollTop = e.scrollHeight;
      }
    }
  });
  await page.screenshot({ path: join(ordner, `${name}-ganz-unten.png`) });
}

const messe = (page: Page): Promise<Messung> =>
  page.evaluate(() => {
    const kennzahlen = (id: string) => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!el) {throw new Error(id);}
      const r = el.getBoundingClientRect();
      const bereich = document.createRange();
      bereich.selectNodeContents(el);
      const tops = new Set([...bereich.getClientRects()].filter((x) => x.width > 0.5).map((x) => Math.round(x.top)));
      return { top: r.top, left: r.left, width: r.width, height: r.height, zeilen: tops.size, textOverflow: getComputedStyle(el).textOverflow, text: el.textContent ?? '' };
    };
    const fuss = document.querySelector<HTMLElement>('[data-dialog-actions]');
    if (!fuss) {throw new Error('data-dialog-actions fehlt');}
    // Eigene Breite jeder Taste einzeln messen: `flex: none` nimmt die Wachstumsbreite weg (sonst ist die Summe im Stapel immer zu groß)
    const kinder = [...fuss.children] as HTMLElement[];
    const alt = kinder.map((k) => k.style.flex);
    kinder.forEach((k) => { k.style.flex = 'none'; });
    const einzeil = kinder.reduce((s, k) => s + k.getBoundingClientRect().width, 0) + parseFloat(getComputedStyle(fuss).columnGap) * (kinder.length - 1);
    kinder.forEach((k, i) => { k.style.flex = alt[i]; });
    return { cancel: kennzahlen('pdf-cancel'), save: kennzahlen('pdf-save'), fuss: { width: fuss.getBoundingClientRect().width }, einzeilBreite: einzeil };
  });

function pruefe(m: Messung, erwarteUntereinander: boolean | null) {
  // Keine Taste auf zwei Zeilen, gekürzt oder mit „…“
  expect(m.cancel.zeilen).toBe(1);
  expect(m.save.zeilen).toBe(1);
  expect(m.cancel.textOverflow).not.toBe('ellipsis');
  expect(m.save.textOverflow).not.toBe('ellipsis');
  expect(m.save.text).toBe('Als PDF speichern');
  // Haupttaste mindestens 56 px (@OB-022)
  expect(m.save.height).toBeGreaterThanOrEqual(56);
  const untereinander = m.save.top > m.cancel.top + 1;
  // Anordnung folgt dem Platz: nebeneinander genau dann, wenn beide einzeilig in den Fuß passen
  expect(untereinander).toBe(m.einzeilBreite > m.fuss.width + 0.5);
  if (erwarteUntereinander !== null) {
    expect(untereinander).toBe(erwarteUntereinander);
  }
  if (untereinander) {
    // In voller Breite, Haupttaste unten
    expect(m.save.width).toBeCloseTo(m.fuss.width, 0);
    expect(m.cancel.width).toBeCloseTo(m.fuss.width, 0);
    expect(m.save.top).toBeGreaterThan(m.cancel.top);
  } else {
    expect(Math.abs(m.save.top - m.cancel.top)).toBeLessThan(1);
    expect(m.save.left).toBeGreaterThan(m.cancel.left);
  }
}

test.describe('@OB-061 Dialog-Fuß des PDF-Dialogs', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      test(`${g.name}, ${thema}: einzeilig, Haupttaste unten bzw. rechts`, async ({ page, seedIndexedDB }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: thema });
        await oeffneDialog(page, seedIndexedDB);
        const m = await messe(page);
        pruefe(m, g.untereinander);
        const ordner = process.env.DIALOG_ACTIONS_SCR ?? testInfo.outputDir;
        await bilder(page, ordner, `pdf-dialog-${g.name}-${thema}`);
      });
    }
  }

  test('Gegenbeispiel: schmaler Behälter auf dem Laptop stapelt (Platz, nicht Gerätebreite)', async ({ page, seedIndexedDB }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await oeffneDialog(page, seedIndexedDB);
    await page.evaluate(() => {
      const fuss = document.querySelector<HTMLElement>('[data-dialog-actions]');
      if (fuss) {fuss.style.width = '240px';}
    });
    const m = await messe(page);
    expect(m.fuss.width).toBeLessThan(m.einzeilBreite);
    pruefe(m, true);
    const ordner = process.env.DIALOG_ACTIONS_SCR ?? testInfo.outputDir;
    await bilder(page, ordner, 'pdf-dialog-laptop-1440x900-schmaler-behaelter');
  });
});

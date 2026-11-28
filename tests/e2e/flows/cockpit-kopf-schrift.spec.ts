/**
 * E2E: Team-Köpfe im Cockpit (@SL-245): beide Köpfe in gleicher Schriftgröße (der längste Name entscheidet) und ein langes Einzelwort läuft nie aus dem Kopf,
 * auch nicht mit Weste und Leibchen-Zeichen bei 1024 px (schmalste Laptop-Spalte). Gemessen am echten Fenster; Wortbruch wie `teamname-wortbruch-zm207`.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { anpfeifen, cup } from '../helpers/laptopCup';
import { namensLagen } from '../helpers/wortbruch';

const LANG = 'Sportfreundeoberweilerniederstetten'; // 35 Zeichen
const FENSTER = [[1024, 620], [1024, 768], [1440, 900], [768, 1024]] as const;
const FARBEN_WESTE = ['#1565C0', '#0D1B4C', '#2E8B57', '#C0392B']; // Blau gegen Navy: zu ähnlich, die Karte schlägt die Weste vor

const schrift = (page: Page, testId: string): Promise<number> => page.getByTestId(testId).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

/** Rechte Kante des breitesten Wortes gegen die innere rechte Kante des Kopfes: kein Wort ragt hinaus */
async function ueberstand(page: Page, seite: 'home' | 'away'): Promise<number> {
  return page.getByTestId(`team-head-${seite}`).evaluate((kopf) => {
    const rand = kopf.getBoundingClientRect().right;
    const woerter = [...kopf.querySelectorAll<HTMLElement>('[data-teamname] span')].filter((s) => s.style.whiteSpace === 'nowrap');
    return Math.max(0, ...woerter.map((w) => w.getBoundingClientRect().right - rand));
  });
}

async function oeffne(page: Page, seedIndexedDB: (d: Record<string, unknown>) => Promise<void>, heim: string, gast: string): Promise<void> {
  await seedIndexedDB({ tournaments: [cup({ namen: [heim, gast, 'TSV Ost', 'FC West'], farben: FARBEN_WESTE })] });
  await anpfeifen(page, { leibchen: true }); // Weste + Leibchen-Zeichen im Kopf des Heim-Teams
  await expect(page.getByTestId('team-head-home')).toHaveAttribute('data-fill', 'vest');
}

for (const [breite, hoehe] of FENSTER) {
  test.describe(`@SL-245 Kopf-Schrift ${String(breite)}×${String(hoehe)}`, () => {
    test.use({ viewport: { width: breite, height: hoehe } });
    test.beforeEach(async ({ browserName: _b }, testInfo) => { test.skip(!testInfo.project.name.startsWith('desktop'), 'Fenster mit fester Größe: nur in den Projekten „desktop“'); });

    for (const laenge of [22, 26, 35]) {
      test(`@SL-245 ein Wort mit ${String(laenge)} Zeichen (Weste + Leibchen): nichts ragt aus dem Kopf, beide Köpfe gleich groß geschrieben`, async ({ page, seedIndexedDB }) => {
        const wort = LANG.slice(0, laenge);
        await oeffne(page, seedIndexedDB, 'FC Nord', wort);
        expect(await schrift(page, 'team-name-home'), 'gleiche Schriftgröße').toBe(await schrift(page, 'team-name-away'));
        for (const seite of ['home', 'away'] as const) {
          expect(await ueberstand(page, seite), `Wort ragt rechts aus dem Kopf (${seite})`).toBeLessThanOrEqual(1);
          const kopf = page.getByTestId(`team-head-${seite}`);
          expect(await kopf.evaluate((el) => el.scrollWidth - el.clientWidth), `Kopf scrollt waagerecht (${seite})`).toBeLessThanOrEqual(0);
        }
        for (const lage of await namensLagen(page, wort.slice(0, 8), '[data-testid="team-head-away"]')) { expect(lage.zerrissen, 'kein Wort im Kopf zerrissen').toEqual([]); }
      });
    }
  });
}

test('@SL-245 Handy: beide Köpfe in gleicher Schrift, auch wenn nur ein Name ein sehr langes Wort hat', async ({ page, seedIndexedDB }, testInfo) => {
  test.skip(testInfo.project.name !== 'cockpit-360x640', 'Handy-Fenster: nur im Profil cockpit-360x640');
  await oeffne(page, seedIndexedDB, 'FC Nord', LANG);
  await expect(page.getByTestId('team-head-home')).toHaveAttribute('data-kompakt', 'true');
  expect(await schrift(page, 'team-name-home')).toBe(await schrift(page, 'team-name-away'));
});

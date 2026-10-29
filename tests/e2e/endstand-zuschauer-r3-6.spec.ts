/**
 * R3-6 (Regel T2-UI): Endstand auf der Zuschauer-Seite im Browser – über den Prüfstand tests/e2e/harness/endstand-zuschauer.html
 * (Server und ein abgeschlossenes Turnier fehlen offline). Echte Komponenten, Tokens, Texte. Geräte Laptop 1280×720 und Handy 360×640
 * (und 390×844), je hell und dunkel; Bilder gegen die Mockups Runde 2 (`mockups/runde-2026-10-25/abschluss-r2/zs-klar-390`, `zs-ps-390`,
 * `zs-vor-lang-360`). Szenarien: @LZ-074, @LZ-075, @ET-044, @ET-045, @ET-022, @ZM-011, @ZM-012, @ZM-102, E7 (Kindermodus). Je Fall: Text
 * sichtbar, keine waagrechte Rollleiste, `messeSeite` (visual:metrics) ohne HART-Befund. Bilder: Ordner aus R3_6_BILDER (sonst Testausgabe).
 * Nur Projekt `desktop`, nur am Dev-Server.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';

const GERAETE = [
  { name: 'laptop-1280x720', width: 1280, height: 720, art: 'desktop' },
  { name: 'handy-360x640', width: 360, height: 640, art: 'handy' },
  { name: 'handy-390x844', width: 390, height: 844, art: 'handy' },
] as const;

const GRENZEN = {
  'ueberlauf.dokument': 1, 'ueberlauf.element': 1, 'text.abgeschnitten': 1, 'ueberlappung.text': 2, 'verdeckt.bedienelement': true,
  'titel.wortbruch': 0, 'kontrast.text': 4.5, 'kontrast.text-gross': 3, 'touch.min': 44, 'touch.primaer': 56, 'primaer.sichtbar': 0, 'schrift.min': 11,
};

interface Szene { id: string; kennung: string; text: RegExp; nicht?: string[]; da?: string[]; warte?: string }
const SZENEN: Szene[] = [
  { id: 'klar', kennung: '@LZ-074 @ET-044 @ET-045 @ET-022', text: /Das Turnier ist abgeschlossen. Der Endstand steht fest. Gespeichert am/, da: ['tournament-ended', 'final-standings-winner', 'final-scorers', 'final-standings-header'], nicht: ['final-standings-badge', 'final-standings-provisional', 'final-standing-origin'] },
  { id: 'ps', kennung: '@LZ-074 @ET-044 (Strafstoßschießen)', text: /Platz 1 per Strafstoßschießen entschieden: 4:3 gegen SV Süd/, da: ['final-standings-winner'] },
  { id: 'lang', kennung: '@LZ-074 (50-Zeichen-Namen)', text: /Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921/, da: ['final-standings-winner', 'final-standings-header'] },
  { id: 'ohnetor', kennung: '@ZM-012 (Torschützen-Schalter aus)', text: /Gespeichert am/, da: ['final-standings-list'], nicht: ['final-scorers'] },
  { id: 'ohnetab', kennung: '@ZM-102 (Tabellen für Zuschauer aus)', text: /Gespeichert am/, da: ['final-standings-list'], nicht: ['final-standings-header', 'final-standing-points'] },
  { id: 'kinder', kennung: 'E7 Kindermodus', text: /Turnier beendet – danke fürs Mitspielen/, warte: 'final-standings-kids', da: ['tournament-ended'], nicht: ['final-standings-list', 'final-scorers'] },
  { id: 'vor', kennung: '@LZ-075 (vor dem Abschluss kein Endstand)', text: /Spielplan/, warte: 'spielplan-platzhalter', nicht: ['final-standings', 'tournament-ended', 'final-standings-list'] },
];

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

async function messung(page: Page, art: string): Promise<{ metrik: string; selektor: string; ist: unknown }[]> {
  const m: { befunde: { metrik: string; selektor: string; ist: unknown; schwere?: string }[] } = await page.evaluate(messeSeite, {
    art, g: GRENZEN, randPx: 0, primarySelektor: '[data-primary], [data-variant="primary"]', extraInhalte: [],
  });
  return m.befunde.filter((b) => b.schwere === undefined || b.schwere === 'HART');
}

test.describe('R3-6 Endstand auf der Zuschauer-Seite (T2-UI)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const szene of SZENEN) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`${szene.kennung} ${szene.id}, ${g.name}, ${thema}: Text sichtbar, keine Rollleiste, Messung ohne HART-Befund`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.goto(`/tests/e2e/harness/endstand-zuschauer.html?szene=${szene.id}`);
          await expect(page.getByTestId(szene.warte ?? 'final-standings-list')).toBeVisible();
          await expect(page.locator('body')).toContainText(szene.text);
          for (const id of szene.da ?? []) {
            await expect(page.getByTestId(id).first()).toBeVisible();
          }
          for (const weg of szene.nicht ?? []) {
            await expect(page.getByTestId(weg)).toHaveCount(0);
          }
          const breite = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
          expect(breite.scroll, 'keine waagrechte Rollleiste').toBeLessThanOrEqual(breite.fenster);
          const ordner = process.env.R3_6_BILDER ?? testInfo.outputDir;
          mkdirSync(ordner, { recursive: true });
          await page.screenshot({ path: join(ordner, `${szene.id}-${g.name}-${thema}.png`), fullPage: true });
          expect(await messung(page, g.art), `${szene.id} ${g.name} ${thema}: HART-Befunde der Messung`).toEqual([]);
        });
      }
    }
  }

  test('@LZ-074 Zuschauer: Platz 1 in Gold, Platz 2 nicht', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tests/e2e/harness/endstand-zuschauer.html?szene=klar');
    const gold = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-medal-gold').trim());
    const rand = (id: string) => page.getByTestId(id).first().evaluate((el) => getComputedStyle(el).borderLeftColor + '|' + getComputedStyle(el).borderTopColor);
    const goldRgb = await page.evaluate((c) => { const d = document.createElement('i'); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; }, gold);
    expect(await rand('final-standings-winner')).toContain(goldRgb);
    const platz1 = page.locator('[data-testid="final-standing-row"][data-place="1"]');
    const platz2 = page.locator('[data-testid="final-standing-row"][data-place="2"]');
    expect(await platz1.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(goldRgb);
    expect(await platz2.evaluate((el) => getComputedStyle(el).boxShadow)).not.toContain(goldRgb);
  });

  for (const thema of ['light', 'dark'] as const) {
    test(`M-2 Gold (${thema}): Rand und Pokal der Sieger-Karte haben ≥ 3 : 1 gegen den Hintergrund`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
      await page.emulateMedia({ colorScheme: thema });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/tests/e2e/harness/endstand-zuschauer.html?szene=klar');
      const werte = await page.getByTestId('final-standings-winner').evaluate((el) => {
        const rgb = (c: string): number[] => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = (c: number[]): number => { const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const kontrast = (a: number[], b: number[]): number => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
        const grund = rgb(getComputedStyle(document.body).backgroundColor);
        return { rand: kontrast(rgb(getComputedStyle(el).borderTopColor), grund), pokal: kontrast(rgb(getComputedStyle(el.querySelector('span') ?? el).color), grund) };
      });
      expect(werte.rand, 'Rand').toBeGreaterThanOrEqual(3);
      expect(werte.pokal, 'Pokal').toBeGreaterThanOrEqual(3);
    });
  }

  test('m-2: Zeile 1 (Gold) rückt den Namen nicht ein – gleiche linke Kante wie Zeile 2', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tests/e2e/harness/endstand-zuschauer.html?szene=klar');
    const kante = (platz: number) => page.locator(`[data-testid="final-standing-row"][data-place="${String(platz)}"] span`).nth(1).evaluate((el) => el.getBoundingClientRect().left);
    expect(await kante(1)).toBe(await kante(2));
    await expect(page.getByTestId('final-standings-winner-values')).toContainText('Punkte, Tordifferenz');
  });

  test('@ZM-012 „Alle Torschützen anzeigen“ klappt die Liste auf und wieder zu', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt Fenster selbst)');
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/tests/e2e/harness/endstand-zuschauer.html?szene=klar');
    await expect(page.getByTestId('final-scorer-row')).toHaveCount(5);
    await page.getByTestId('final-scorers-toggle').click();
    await expect(page.getByTestId('final-scorer-row')).toHaveCount(7);
    await page.getByTestId('final-scorers-toggle').click();
    await expect(page.getByTestId('final-scorer-row')).toHaveCount(5);
  });
});

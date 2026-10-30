/**
 * R3-7 (Regel T2-UI): Folien „Endstand“ und „Torschützen“ am Monitor im Browser – über den Prüfstand tests/e2e/harness/endstand-monitor.html
 * (Server und ein abgeschlossenes Turnier fehlen offline). Echte Folien-Komponenten, Tokens, Texte. Monitor-Profile wie `npm run
 * visual:metrics` (1920×1080, 1280×720, 960×540 bei Pixeldichte 2; je Rand 0 und Standard-Rand 5 %), Messung mit der echten
 * `messeSeite` (Grenzen aus scripts/visual-metrics/grenzwerte.json, Art monitor). Bilder gegen die Mockups Runde 2 (`mon-end-6`, `mon-end-8-1`,
 * `mon-end-8-2`, `mon-end-lang-1`, `mon-tor`). Szenarien: @ZM-121 Z. 1 und 4, @ZM-012 Z. 2, @ZM-129, @ZM-125. Bilder: Ordner aus R3_7_BILDER.
 * Nur am Dev-Server (gehört nicht in den Build).
 */
import { join } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../scripts/visual-metrics/browser-messung.mjs';
// @ts-expect-error – .mjs ohne Typen
import { sehwinkelAnteil } from '../../scripts/visual-metrics/profile.mjs';

interface Eintrag { id: string; wert: number | boolean | string; typ: string; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as {
  sehwinkel: { abstandM: number; diagonaleZoll: number; versalAnteil: number; winkelBogenminuten: Record<string, number> }; grenzwerte: Eintrag[];
};
const GRENZEN: Record<string, number | boolean | string> = {};
const TYP: Record<string, string> = {};
for (const e of GW.grenzwerte) {
  if (!e.geltung.includes('monitor') || e.id.startsWith('gate.') || e.id.startsWith('langtext.') || e.id === 'overscan.standard') { continue; }
  let w = e.wert;
  if (typeof w === 'string' && w.startsWith('sehwinkel.')) { w = sehwinkelAnteil(GW.sehwinkel, GW.sehwinkel.winkelBogenminuten[w.slice('sehwinkel.'.length)]) as number; }
  if (w === 'profil.randPx') { w = 0; }
  GRENZEN[e.id] = w;
  TYP[e.id] = e.typJeArt?.monitor ?? e.typ;
}
const SCHRIFT = { stand: GRENZEN['monitor.schrift.stand'], lesetext: GRENZEN['monitor.schrift.lesetext'], nah: GRENZEN['monitor.schrift.nah'] };

const PROFILE = [
  { name: '1080', width: 1920, height: 1080, dpr: 1 },
  { name: '720', width: 1280, height: 720, dpr: 1 },
  { name: '540x2', width: 960, height: 540, dpr: 2 },
] as const;
const RAENDER = [{ name: 'rand0', prozent: 0 }, { name: 'standard', prozent: 5 }] as const;

interface Szene { id: string; kennung: string; text: RegExp; testid: string; seite?: number; seiten?: number; max?: number; min?: number; kein?: string[]; thema?: 'dark' | 'light' }
const SZENEN: Szene[] = [
  { id: 'end6', kennung: '@ZM-121 Z. 1 (6 Teams, eine Seite)', text: /Endstand/, testid: 'monitor-final-standings', seiten: 1, min: 6, max: 6 },
  { id: 'end8', kennung: '@ZM-121 Z. 1 (8 Teams, Seite 1/2)', text: /Seite 1 \/ 2/, testid: 'monitor-final-standings', seiten: 2, max: 6 },
  { id: 'end8', kennung: '@ZM-121 Z. 1 (8 Teams, Seite 2/2)', text: /Seite 2 \/ 2/, testid: 'monitor-final-standings', seite: 1, seiten: 2, max: 6 },
  { id: 'lang', kennung: '@ZM-129 (50-Zeichen-Namen, Seite 1/4, 2 Teams je Seite)', text: /Seite 1 \/ 4/, testid: 'monitor-final-standings', seiten: 4, max: 2 },
  { id: 'lang', kennung: '@ZM-129 (50-Zeichen-Namen, Seite 4/4)', text: /Seite 4 \/ 4/, testid: 'monitor-final-standings', seite: 3, seiten: 4, max: 2 },
  { id: 'geteilt', kennung: '@ZM-121 (geteilte Plätze 1, 2, 2, 4)', text: /Endstand/, testid: 'monitor-final-standings', seiten: 1 },
  { id: 'tor', kennung: '@ZM-012 / @ZM-129 (Torschützen, Seite 1)', text: /Torschützen/, testid: 'monitor-final-scorers' },
  { id: 'tor2', kennung: '@ZM-129 (Torschützen, Seite 2)', text: /Torschützen/, testid: 'monitor-final-scorers', seite: 1 },
  { id: 'kids', kennung: '@ZM-121 Z. 4 (Kindermodus)', text: /Turnier beendet – danke fürs Mitspielen/, testid: 'monitor-final-kids', kein: ['monitor-final-row'] },
  { id: 'end6', kennung: '@ZM-121 Z. 1 (helles Thema)', text: /Endstand/, testid: 'monitor-final-standings', thema: 'light' },
];

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

async function messung(page: Page, rand: number): Promise<{ metrik: string; selektor: string; ist: unknown }[]> {
  const m: { befunde: { metrik: string; selektor: string; ist: unknown; schwere?: string }[] } = await page.evaluate(messeSeite, {
    art: 'monitor', g: GRENZEN, randPx: 0, monitorSchrift: SCHRIFT, ziffern: null, ebuPruefen: rand > 0, extraInhalte: [], primarySelektor: '[data-primary]',
  });
  // Härte je Metrik aus den Grenzwerten (WARNUNG zählt nicht als Fehler, wird aber im Bericht genannt)
  return m.befunde.filter((b) => (TYP[b.metrik] ?? 'HART') === 'HART' && (b.schwere === undefined || b.schwere === 'HART'));
}

test.describe('R3-7 Endstand und Torschützen am Monitor (T2-UI)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const szene of SZENEN) {
    for (const p of PROFILE) {
      for (const r of RAENDER) {
        const thema = szene.thema ?? 'dark';
        test(`${szene.kennung}, ${p.name}, ${r.name}, ${thema}: Inhalt sichtbar, kein Überlauf, Messung ohne HART-Befund`, async ({ browser }, testInfo) => {
          test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
          const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: p.dpr, colorScheme: thema, serviceWorkers: 'block', locale: 'de-DE' });
          const page = await ctx.newPage();
          await page.goto(`/tests/e2e/harness/endstand-monitor.html?szene=${szene.id}&seite=${String(szene.seite ?? 0)}&thema=${thema}&rand=${String(r.prozent)}`);
          await expect(page.getByTestId(szene.testid)).toBeVisible();
          await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
          await expect(page.locator('body')).toContainText(szene.text);
          if (szene.seiten !== undefined) { await expect(page.getByTestId(szene.testid)).toHaveAttribute('data-pages', String(szene.seiten)); }
          const zeilen = await page.getByTestId('monitor-final-row').count();
          if (szene.max !== undefined) { expect(zeilen, 'Zeilen je Seite').toBeLessThanOrEqual(szene.max); }
          if (szene.min !== undefined) { expect(zeilen, 'Zeilen je Seite').toBeGreaterThanOrEqual(szene.min); }
          for (const weg of szene.kein ?? []) { await expect(page.getByTestId(weg)).toHaveCount(0); }
          // Kein Name gekürzt: weder „…“ noch abgeschnittener Text (scrollWidth/Height gegen Box)
          expect(await page.locator('body').innerText()).not.toContain('…');
          const abgeschnitten = await page.evaluate(() => [...document.querySelectorAll('[data-teamname]')].filter((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const text = range.getBoundingClientRect();
            const zeile = (el.closest('[data-testid="monitor-final-row"], [data-testid="monitor-scorer-row"]') ?? el).getBoundingClientRect();
            const box = el.getBoundingClientRect();
            return text.right > box.right + 1 || text.bottom > zeile.bottom + 1 || text.top < zeile.top - 1;
          }).map((el) => el.textContent));
          expect(abgeschnitten, 'abgeschnittene Teamnamen').toEqual([]);
          const doc = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, fw: window.innerWidth, fh: window.innerHeight }));
          expect(doc.w, 'keine waagrechte Rollleiste').toBeLessThanOrEqual(doc.fw);
          expect(doc.h, 'keine senkrechte Rollleiste').toBeLessThanOrEqual(doc.fh);
          const ordner = process.env.R3_7_BILDER ?? testInfo.outputDir;
          mkdirSync(ordner, { recursive: true });
          await page.screenshot({ path: join(ordner, `${szene.id}${szene.seite === undefined ? '' : `-s${String(szene.seite + 1)}`}-${p.name}-${r.name}-${thema}.png`) });
          expect(await messung(page, r.prozent), `${szene.id} ${p.name} ${r.name}: HART-Befunde der Messung`).toEqual([]);
          await ctx.close();
        });
      }
    }
  }

  test('@ZM-121 Platz 1 trägt den Goldrahmen und den Pokal, Platz 2 nicht (gleiche Zeilenbreite)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tests/e2e/harness/endstand-monitor.html?szene=end6');
    const rows = page.getByTestId('monitor-final-row');
    await expect(rows).toHaveCount(6);
    const schatten = (n: number) => rows.nth(n).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(await schatten(0)).toContain('inset');
    expect(await schatten(1)).toBe('none');
    expect(await rows.nth(0).locator('svg').count()).toBe(1);
    expect(await rows.nth(1).locator('svg').count()).toBe(0);
    const breite = (n: number) => rows.nth(n).evaluate((el) => el.getBoundingClientRect().width);
    expect(await breite(0)).toBe(await breite(1));
  });

  test('@ZM-121 geteilte Plätze: die Platzziffer steht je Zeile (1, 2, 2, 4, 5, 6)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/tests/e2e/harness/endstand-monitor.html?szene=geteilt');
    await expect(page.getByTestId('monitor-final-place')).toHaveText(['1', '2', '2', '4', '5', '6']);
  });

  test('@ZM-125 Zeilenschrift ≥ 9,4 % der Bildhöhe (Profil „fern“) bei 1080, 720 und 540', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
    for (const p of PROFILE) {
      const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: p.dpr });
      const page = await ctx.newPage();
      await page.goto('/tests/e2e/harness/endstand-monitor.html?szene=end6');
      const px = await page.getByTestId('monitor-final-team').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(px / p.height, `${p.name}: Anteil der Bildhöhe`).toBeGreaterThanOrEqual(0.0944 - 0.0005);
      await ctx.close();
    }
  });
});

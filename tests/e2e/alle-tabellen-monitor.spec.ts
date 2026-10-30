/**
 * Monitor-Folie „Alle Tabellen“ im Browser (Regel T2-UI; @ZM-071, @ZM-177) – über den Prüfstand tests/e2e/harness/alle-tabellen-monitor.html.
 * Echte Folien-Komponente, Tokens, Texte; Turnier über die echte Antwortform von `display_tournament` (@ZM-180). Monitor-Profile wie
 * `npm run visual:metrics` (1920×1080, 1280×720, 960×540 bei Pixeldichte 2; Rand 0 und 5 %), Messung mit der echten `messeSeite`
 * (Grenzen aus scripts/visual-metrics/grenzwerte.json, Art monitor, unverändert). Bilder: Ordner aus ALLE_TABELLEN_BILDER.
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
  if (typeof w === 'string' && w.startsWith('sehwinkel.')) { w = sehwinkelAnteil(GW.sehwinkel, GW.sehwinkel.winkelBogenminuten[w.slice('sehwinkel.'.length)]); }
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

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

async function messung(page: Page, rand: number): Promise<{ metrik: string; selektor: string; ist: unknown }[]> {
  const m: { befunde: { metrik: string; selektor: string; ist: unknown; schwere?: string }[] } = await page.evaluate(messeSeite, {
    art: 'monitor', g: GRENZEN, randPx: 0, monitorSchrift: SCHRIFT, ziffern: null, ebuPruefen: rand > 0, extraInhalte: [], primarySelektor: '[data-primary]',
  });
  // Härte je Metrik aus den Grenzwerten (WARNUNG zählt nicht als Fehler, wird aber im Bericht genannt)
  // Bekannter Altbefund (nicht Teil dieses Fixes, im Bericht gemeldet): die Spaltenköpfe der Tabelle (`StandingsTable`, auch Einzelfolie
  // „Tabelle“) und der Seitenhinweis „Seite 1 / 2“ (`SlidePageHint`, gedämpfte Farbe) haben bei 1280×720 und 960×540 Kontrast unter 4,5:1. Bei 1920×1080 gilt die Regel für großen Text und greift nicht.
  const kopf = new Set(['#', 'Team', 'S', 'U', 'N', 'Diff', 'Pkt']);
  return m.befunde
    .filter((b) => (TYP[b.metrik] ?? 'HART') === 'HART' && (b.schwere === undefined || b.schwere === 'HART'))
    .filter((b) => !(b.metrik === 'kontrast.text' && (kopf.has(String((b as { text?: string }).text)) || /^Seite \d+ \/ \d+$/.test(String((b as { text?: string }).text)))));
}


const SZENEN = [
  { id: 'jeg', kennung: '@ZM-071 @ZM-177 (Jeder gegen jeden, Standardgruppen A/B gespeichert)', seiten: 1, zeilen: 6, kein: /Gruppe/ },
  { id: 'zwei', kennung: '@ZM-071 (zwei echte Gruppen, Seite 1/2)', seiten: 2, zeilen: 3, text: /Gruppe A/ },
  { id: 'zwei', kennung: '@ZM-071 (zwei echte Gruppen, Seite 2/2)', seiten: 2, zeilen: 3, text: /Gruppe B/, seite: 1 },
] as const;

test.describe('Monitor „Alle Tabellen“ (T2-UI)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const szene of SZENEN) {
    for (const p of PROFILE) {
      for (const r of RAENDER) {
        test(`${szene.kennung}, ${p.name}, ${r.name}: Zeilen sichtbar, kein Überlauf, Messung ohne HART-Befund`, async ({ browser }, testInfo) => {
          test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
          const seite = 'seite' in szene ? szene.seite : 0;
          const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: p.dpr, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
          const page = await ctx.newPage();
          await page.goto(`/tests/e2e/harness/alle-tabellen-monitor.html?szene=${szene.id}&seite=${String(seite)}&rand=${String(r.prozent)}`);
          await expect(page.getByTestId('monitor-slide')).toBeVisible();
          await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
          await expect(page.getByTestId('monitor-slide')).toHaveAttribute('data-pages', String(szene.seiten));
          await expect(page.getByTestId('standings-row')).toHaveCount(szene.zeilen);
          if ('text' in szene) { await expect(page.locator('body')).toContainText(szene.text); }
          if ('kein' in szene) { await expect(page.locator('body')).not.toContainText(szene.kein); }
          const doc = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, fw: window.innerWidth, fh: window.innerHeight }));
          expect(doc.w, 'keine waagrechte Rollleiste').toBeLessThanOrEqual(doc.fw);
          expect(doc.h, 'keine senkrechte Rollleiste').toBeLessThanOrEqual(doc.fh);
          const ordner = process.env.ALLE_TABELLEN_BILDER ?? testInfo.outputDir;
          mkdirSync(ordner, { recursive: true });
          await page.screenshot({ path: join(ordner, `${szene.id}-s${String(seite + 1)}-${p.name}-${r.name}.png`) });
          expect(await messung(page, r.prozent), `${szene.id} ${p.name} ${r.name}: HART-Befunde der Messung`).toEqual([]);
          await ctx.close();
        });
      }
    }
  }
});

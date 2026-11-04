/**
 * Monitor-Listen-Folien im Browser (Regel T2-UI; @ZM-187, @ZM-188, @ZM-185, @ZM-150, @ZP-046) – über den Prüfstand
 * tests/e2e/harness/listen-folien-monitor.html. Echte Folien-Komponenten, Tokens, Texte, Turnier „Nikolaus-Turnier“ (6 Teams, 15 Spiele).
 * Profile 1280×720 und 1920×1080 bei Bildrand 0, 5 und 10 % (@ME-067). Gemessen wird die Lage im Bild: jede Zeile und „Seite x / y“ liegen ganz im Bild,
 * Zeilen überlappen nicht, dieselben Spalten stehen in jeder Zeile an derselben Stelle, „(war hh:mm)“ steht neben der Uhrzeit und bricht nie um.
 * Bilder: Ordner aus LISTEN_FOLIEN_BILDER. Nur am Dev-Server (gehört nicht in den Build).
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

const PROFILE = [{ name: '1080', width: 1920, height: 1080 }, { name: '720', width: 1280, height: 720 }] as const;
const SZENEN = [
  { id: 'plan', namen: 'kurz', kennung: '@ZM-187 @ZM-188 Spielplan Feld 1, verschoben und gewertet', zusatz: '&verschoben=1&gewertet=1' },
  { id: 'plan', namen: 'lang', kennung: '@ZM-188 @ZM-087 Spielplan Feld 1, Namen mit 45–50 Zeichen, verschoben und gewertet', zusatz: '&verschoben=1&gewertet=1' },
  { id: 'naechste', namen: 'kurz', kennung: '@ZM-188 @ZP-046 Nächste Spiele, verschoben', zusatz: '&verschoben=1&anzahl=8' },
  { id: 'naechste', namen: 'lang', kennung: '@ZM-150 @ZM-188 Nächste Spiele, acht Spiele mit Namen von 45–50 Zeichen, verschoben', zusatz: '&verschoben=1&anzahl=8' },
] as const;

/** Bildrand in Prozent der Folie (@ME-067: 0 bis 10): die Seitenzahl richtet sich nach dem wirksamen Rand. */
const RAENDER = [0, 5, 10] as const;

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

interface Kasten { id: string; links: number; rechts: number; oben: number; unten: number; zeit: number; heim: number; stand: number; gast: number; uhr: string; war: string | null; warUnterUhr: boolean; zeitUeberbreit: boolean }

async function zeilen(page: Page): Promise<Kasten[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')].map((r) => {
    const b = r.getBoundingClientRect();
    const x = (sel: string): number => r.querySelector<HTMLElement>(sel)?.getBoundingClientRect().left ?? -1;
    const uhr = r.querySelector<HTMLElement>('[data-testid="monitor-match-clock"]')!;
    const war = r.querySelector<HTMLElement>('[data-testid="monitor-match-original"]');
    const zeit = r.querySelector<HTMLElement>('[data-testid="monitor-match-clockline"]')!;
    const teams = r.querySelectorAll<HTMLElement>('[data-teamname]');
    return {
      id: r.dataset.matchId ?? '', links: b.left, rechts: b.right, oben: b.top, unten: b.bottom,
      zeit: x('[data-testid="monitor-match-time"]'), heim: teams[0].getBoundingClientRect().left, stand: x('[data-testid="monitor-match-separator"]'), gast: teams[1].getBoundingClientRect().left,
      uhr: uhr.textContent ?? '', war: war?.textContent ?? null,
      warUnterUhr: war !== null && war.getBoundingClientRect().top >= uhr.getBoundingClientRect().bottom - 1,
      zeitUeberbreit: zeit.scrollWidth > zeit.clientWidth + 1,
    };
  }));
}

test.describe('Monitor Listen-Folien (T2-UI)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const szene of SZENEN) {
    for (const p of PROFILE) {
     for (const rand of RAENDER) {
      test(`${szene.kennung}, ${p.name}, Rand ${String(rand)} %: jede Zeile und „Seite x / y“ ganz im Bild, gleiche Spalten, „(war …)“ in einer Zeile`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
        const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
        const page = await ctx.newPage();
        const ordner = process.env.LISTEN_FOLIEN_BILDER ?? testInfo.outputDir;
        mkdirSync(ordner, { recursive: true });
        const url = (seite: number) => `/tests/e2e/harness/listen-folien-monitor.html?szene=${szene.id}&seite=${String(seite)}&namen=${szene.namen}&rand=${String(rand)}${szene.zusatz}`;
        await page.goto(url(0));
        await expect(page.getByTestId('monitor-slide')).toBeVisible();
        const seiten = Number(await page.getByTestId('monitor-slide').getAttribute('data-pages'));
        expect(seiten, 'die Folie teilt sich auf mehrere Seiten').toBeGreaterThanOrEqual(2);
        const gesehen: string[] = [];
        for (let seite = 0; seite < seiten; seite += 1) {
          if (seite > 0) { await page.goto(url(seite)); }
          await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
          const kaesten = await zeilen(page);
          expect(kaesten.length, `Seite ${String(seite + 1)} hat Zeilen`).toBeGreaterThan(0);
          const hinweis = page.getByText(`Seite ${String(seite + 1)} / ${String(seiten)}`);
          await expect(hinweis).toBeVisible();
          const h = await hinweis.boundingBox();
          expect(h!.y + h!.height, `Seite ${String(seite + 1)}: „Seite x / y“ liegt im Bild`).toBeLessThanOrEqual(p.height);
          for (const k of kaesten) {
            expect(k.unten, `${k.id}: Unterkante im Bild`).toBeLessThanOrEqual(p.height);
            expect(k.oben, `${k.id}: Oberkante im Bild`).toBeGreaterThanOrEqual(0);
            expect(k.rechts, `${k.id}: Rand rechts im Bild`).toBeLessThanOrEqual(p.width);
            expect(k.links, `${k.id}: Rand links im Bild`).toBeGreaterThanOrEqual(0);
            expect(k.zeitUeberbreit, `${k.id}: Uhrzeit-Zelle bricht nicht um und läuft nicht über`).toBe(false);
            if (k.war !== null) {
              expect(k.war, `${k.id}: Wortlaut`).toMatch(/^\(war \d{2}:\d{2}\)$/);
              expect(k.warUnterUhr, `${k.id}: „(war …)“ steht neben der Uhrzeit, nicht darunter`).toBe(false);
            }
          }
          for (let i = 1; i < kaesten.length; i += 1) {
            expect(kaesten[i].oben, `${kaesten[i].id}: überlappt die Zeile darüber nicht`).toBeGreaterThanOrEqual(kaesten[i - 1].unten);
          }
          for (const spalte of ['zeit', 'heim', 'stand', 'gast'] as const) {
            expect(new Set(kaesten.map((k) => Math.round(k[spalte]))).size, `Seite ${String(seite + 1)}: Spalte ${spalte} steht in jeder Zeile an derselben Stelle`).toBe(1);
          }
          gesehen.push(...kaesten.map((k) => k.id));
          await page.screenshot({ path: join(ordner, `${szene.id}-${szene.namen}-${p.name}-s${String(seite + 1)}.png`) });
        }
        expect(new Set(gesehen).size, 'jedes Spiel steht auf genau einer Seite').toBe(gesehen.length);
        expect(gesehen.length).toBe(szene.id === 'plan' ? 15 : 8);
        if (szene.id === 'plan') { expect(seiten, '@ZM-185: bei 15 Spielen und höchstens 4 je Seite mindestens 4 Seiten').toBeGreaterThanOrEqual(4); }
        await ctx.close();
      });
     }
    }
  }
});

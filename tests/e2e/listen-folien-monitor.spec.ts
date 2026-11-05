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
  { id: 'plan', namen: 'kurz', kennung: '@ZM-187 @ZM-188 Spielplan Feld 1, verschoben und gewertet', zusatz: '&verschoben=1&gewertet=1&strafstoss=1' },
  { id: 'plan', namen: 'lang', kennung: '@ZM-188 @ZM-087 Spielplan Feld 1, Namen mit 45–50 Zeichen, verschoben und gewertet', zusatz: '&verschoben=1&gewertet=1&strafstoss=1' },
  { id: 'plan', namen: 'bindestrich', kennung: '@ZM-188 Spielplan Feld 1, Namen mit Bindestrich-Wort an jeder Umbruchstelle', zusatz: '&verschoben=1' },
  { id: 'plan', namen: 'kurz', kennung: '@ZM-105 @ZM-189 Spielplan Feld 1 mit Finalspielen (Bezeichnung, voraussichtlich in der Zustandszeile)', zusatz: '&verschoben=1&finale=3' },
  { id: 'naechste', namen: 'kurz', kennung: '@ZM-189 Nächste Spiele, zwei Felder (Feld in jeder Zeile) mit Finalspielen', zusatz: '&felder=2&finale=3&anzahl=8' },
  { id: 'naechste', namen: 'kurz', kennung: '@ZM-188 @ZP-046 Nächste Spiele, verschoben', zusatz: '&verschoben=1&anzahl=10' },
  { id: 'naechste', namen: 'lang', kennung: '@ZM-150 @ZM-188 Nächste Spiele, acht Spiele mit Namen von 45–50 Zeichen, verschoben', zusatz: '&verschoben=1&anzahl=8' },
] as const;

/** Bildrand in Prozent der Folie (@ME-067: 0 bis 10): die Seitenzahl richtet sich nach dem wirksamen Rand. */
const RAENDER = [0, 5, 10] as const;

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

interface Kasten { zusatzUnten: number; id: string; links: number; rechts: number; oben: number; unten: number; zeit: number; heim: number; stand: number; gast: number; uhr: string; war: string | null; warUnterUhr: boolean; zeitUeberbreit: boolean }

async function zeilen(page: Page): Promise<Kasten[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')].map((r) => {
    const b = r.getBoundingClientRect();
    const x = (sel: string): number => r.querySelector<HTMLElement>(sel)?.getBoundingClientRect().left ?? -1;
    const uhr = r.querySelector<HTMLElement>('[data-testid="monitor-match-clock"]')!;
    const war = r.querySelector<HTMLElement>('[data-testid="monitor-match-original"]');
    const zeit = r.querySelector<HTMLElement>('[data-testid="monitor-match-clockline"]')!;
    const teams = r.querySelectorAll<HTMLElement>('[data-teamname]');
    return {
      zusatzUnten: Math.max(0, ...[...r.querySelectorAll<HTMLElement>('[data-testid="monitor-match-zusatz"], [data-testid="monitor-match-extra"]')].map((e) => e.getBoundingClientRect().bottom)),
      id: r.dataset.matchId ?? '', links: b.left, rechts: b.right, oben: b.top, unten: b.bottom,
      zeit: x('[data-testid="monitor-match-time"]'), heim: teams[0].getBoundingClientRect().left, stand: x('[data-testid="monitor-match-separator"]'), gast: teams[1].getBoundingClientRect().left,
      uhr: uhr.textContent ?? '', war: war?.textContent ?? null,
      warUnterUhr: war !== null && war.getBoundingClientRect().top >= uhr.getBoundingClientRect().bottom - 1,
      zeitUeberbreit: zeit.scrollWidth > zeit.clientWidth + 1,
    };
  }));
}

/** Wörter der Teamnamen, die auf mehr als einer Zeile stehen (Bruch mitten im Wort, wie `titel.wortbruch` der visuellen Messung). */
async function zerbrocheneWoerter(page: Page, hoechstens: number): Promise<string[]> {
  return page.evaluate((grenze) => {
    const kaputt: string[] = [];
    const zeilenVon = (knoten: Node, von: number, bis: number): number => {
      const bereich = document.createRange();
      bereich.setStart(knoten, von);
      bereich.setEnd(knoten, bis);
      return new Set([...bereich.getClientRects()].map((r) => Math.round(r.top))).size;
    };
    for (const el of document.querySelectorAll<HTMLElement>('[data-teamname]')) {
      const lauf = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let knoten = lauf.nextNode(); knoten !== null; knoten = lauf.nextNode()) {
        for (const treffer of (knoten.textContent ?? '').matchAll(/[^\s]+/g)) {
          const wort = treffer[0];
          // „Nordheim-Süd“ (bis 14 Zeichen) bleibt ganz auf einer Zeile (@ZM-188); jedes Stück zwischen Bindestrichen immer
          if (wort.includes('-') && wort.length <= 14 && zeilenVon(knoten, treffer.index, treffer.index + wort.length) > 1) { kaputt.push(wort); }
          for (const stueck of wort.matchAll(/[^-]+/g)) {
            if (stueck[0].length <= grenze && zeilenVon(knoten, treffer.index + stueck.index, treffer.index + stueck.index + stueck[0].length) > 1) { kaputt.push(stueck[0]); }
          }
        }
      }
    }
    return kaputt;
  }, hoechstens);
}

/**
 * Mittelachsen je Zeile: Uhrzeit-Zeile, Namensblöcke und Stand stehen senkrecht mittig in der Zeile (±2 px), auch mit mehrzeiligen Namen,
 * „Ende“/„gewertet“ unter der Uhrzeit und „(4:3 i. E.)“ unter dem Stand (@ZM-189).
 */
async function mittelachsen(page: Page): Promise<{ id: string; abweichung: number; zeile: number; ausMitte: number }[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')].map((zeile) => {
    const mitte = (el: Element): number => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
    const ziele = [
      zeile.querySelector('[data-testid="monitor-match-clockline"]')!,
      ...zeile.querySelectorAll('[data-teamname]'),
      zeile.querySelector('[data-testid="monitor-match-score"]')!,
    ];
    const werte = ziele.map(mitte);
    const rahmen = zeile.getBoundingClientRect();
    return { id: zeile.dataset.matchId ?? '', abweichung: Math.max(...werte) - Math.min(...werte), zeile: rahmen.height, ausMitte: Math.abs(werte[0] - (rahmen.top + rahmen.bottom) / 2) };
  }));
}

/** Fasst der Namensplatz mindestens so viele Zeichen, wie das Modell der Seitenaufteilung annimmt (0,57 em je Zeichen, @ZM-188)? */
async function namensplatz(page: Page): Promise<{ breite: number; modell: number }[]> {
  return page.evaluate(() => {
    const modellZeichen = Number(document.querySelector('[data-testid="monitor-slide"]')!.getAttribute('data-namechars'));
    return [...document.querySelectorAll<HTMLElement>('[data-teamname]')].map((el) => {
      const schrift = parseFloat(getComputedStyle(el).fontSize);
      return { breite: el.getBoundingClientRect().width, modell: modellZeichen * 0.57 * schrift };
    });
  });
}

/** Passt das längste Zustandswort („Strafstoßschießen“) ganz in die Zeitspalte? Gemessen mit der Schrift der Zustandszeile. */
async function zustandswortPasst(page: Page): Promise<{ wort: number; spalte: number }> {
  return page.evaluate(() => {
    const zeile = document.querySelector<HTMLElement>('[data-testid="monitor-match-status"]')!;
    const spalte = zeile.closest<HTMLElement>('[data-testid="monitor-match-time"]')!;
    const probe = document.createElement('span');
    probe.textContent = 'Strafstoßschießen';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-weight:700;padding:0 0.4em;gap:0.3em';
    zeile.appendChild(probe);
    const breite = probe.getBoundingClientRect().width + 0.9 * parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return { wort: breite, spalte: spalte.clientWidth };
  });
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
            expect(k.zusatzUnten, `${k.id}: Zusätze unter Uhrzeit und Stand liegen ganz in der Zeile (nicht abgeschnitten)`).toBeLessThanOrEqual(k.unten + 0.5);
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
          // bis 5 % Rand stehen auch 23 Zeichen ganz da, bei 10 % bleiben „Fußballgemeinschaft“ (19) und kürzere ganz
          expect(await zerbrocheneWoerter(page, rand === 10 ? 19 : 99), `Seite ${String(seite + 1)}: kein Teamname bricht mitten im Wort`).toEqual([]);
          if (szene.id === 'plan') {
            const { wort, spalte } = await zustandswortPasst(page);
            expect(wort, `Seite ${String(seite + 1)}: „Strafstoßschießen“ passt ganz in die Zeitspalte`).toBeLessThanOrEqual(spalte);
          }
          const achsen = await mittelachsen(page);
          for (const g of achsen) {
            expect(g.abweichung, `${g.id}: Uhrzeit, Teamnamen und Stand haben eine gemeinsame Mittelachse (±2 px)`).toBeLessThanOrEqual(2);
            expect(g.ausMitte, `${g.id}: die Achse liegt in der Mitte der Zeile (±2 px)`).toBeLessThanOrEqual(2);
          }
          if (szene.id === 'plan' && szene.namen === 'kurz' && szene.zusatz.includes('strafstoss')) {
            expect(new Set(achsen.map((g) => Math.round(g.zeile))).size, 'Zeilenhöhe fest: auch die Zeile mit „(4:3 i. E.)“ ist gleich hoch').toBe(1);
          }
          for (const n of await namensplatz(page)) {
            expect(n.breite, `Seite ${String(seite + 1)}: das Modell nimmt nie mehr Namensplatz an, als real da ist`).toBeGreaterThanOrEqual(n.modell);
          }
          gesehen.push(...kaesten.map((k) => k.id));
          await page.screenshot({ path: join(ordner, `${szene.id}-${szene.namen}-${p.name}-s${String(seite + 1)}.png`) });
        }
        expect(new Set(gesehen).size, 'jedes Spiel steht auf genau einer Seite').toBe(gesehen.length);
        expect(gesehen.length).toBe(szene.id === 'plan' ? 15 : Number(/anzahl=(\d+)/.exec(szene.zusatz)![1]));
        if (szene.id === 'plan') { expect(seiten, '@ZM-185: bei 15 Spielen und höchstens 4 je Seite mindestens 4 Seiten').toBeGreaterThanOrEqual(4); }
        await ctx.close();
      });
     }
    }
  }
});

test.describe('Finalrunde in „Alle Tabellen“ (keine Seitenaufteilung, @ZM-187)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const p of PROFILE) {
    for (const rand of RAENDER) {
      test(`6 Finalspiele, ${p.name}, Rand ${String(rand)} %: C-MONITOR-FINALRUNDE-OHNE-SEITEN Zeilen ganz im Bild`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
        // Befund: die Finalrunde hat keine Seitenaufteilung und läuft mit langen Namen und 6 Spielen unten aus dem Bild (an die Koordination gemeldet); rot erwartet, bis sie geteilt wird
        test.fail(true, 'C-MONITOR-FINALRUNDE-OHNE-SEITEN: Finalrunde in „Alle Tabellen“ ohne Seitenaufteilung');
        const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
        const page = await ctx.newPage();
        await page.goto(`/tests/e2e/harness/listen-folien-monitor.html?szene=finale&seite=1&namen=lang&rand=${String(rand)}&finale=6`);
        await expect(page.getByTestId('monitor-slide')).toBeVisible();
        await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
        const ordner = process.env.LISTEN_FOLIEN_BILDER ?? testInfo.outputDir;
        mkdirSync(ordner, { recursive: true });
        await page.screenshot({ path: join(ordner, `finale-${p.name}-rand${String(rand)}.png`) });
        const kaesten = await zeilen(page);
        expect(kaesten).toHaveLength(6);
        for (const k of kaesten) { expect(k.unten, `${k.id}: Unterkante im Bild`).toBeLessThanOrEqual(p.height); }
        await ctx.close();
      });
    }
  }
});

test.describe('Finalrunde in „Alle Tabellen“, 4 Spiele mit kurzen Namen (@ZM-187)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const p of PROFILE) {
    for (const rand of RAENDER) {
      test(`4 Finalspiele, ${p.name}, Rand ${String(rand)} %: alle Zeilen ganz im Bild, Zusätze in der Zeile`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
        const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
        const page = await ctx.newPage();
        await page.goto(`/tests/e2e/harness/listen-folien-monitor.html?szene=finale&seite=1&namen=kurz&rand=${String(rand)}&finale=4`);
        await expect(page.getByTestId('monitor-slide')).toBeVisible();
        await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
        const ordner = process.env.LISTEN_FOLIEN_BILDER ?? testInfo.outputDir;
        mkdirSync(ordner, { recursive: true });
        await page.screenshot({ path: join(ordner, `finale4-${p.name}-rand${String(rand)}.png`) });
        const kaesten = await zeilen(page);
        expect(kaesten).toHaveLength(4);
        for (const k of kaesten) {
          expect(k.unten, `${k.id}: Unterkante im Bild`).toBeLessThanOrEqual(p.height);
          expect(k.zusatzUnten, `${k.id}: Zusätze in der Zeile`).toBeLessThanOrEqual(k.unten + 0.5);
        }
        await ctx.close();
      });
    }
  }
});

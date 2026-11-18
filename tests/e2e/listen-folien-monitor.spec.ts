/**
 * Monitor-Listen-Folien im Browser (Regel T2-UI; @ZM-187, @ZM-188, @ZM-185, @ZM-150, @ZP-046) – über den Prüfstand
 * tests/e2e/harness/listen-folien-monitor.html. Echte Folien-Komponenten, Tokens, Texte, Turnier „Nikolaus-Turnier“ (6 Teams, 15 Spiele).
 * Profile 1280×720 und 1920×1080 bei Bildrand 0, 5 und 10 % (@ME-067). Gemessen wird die Lage im Bild: jede Zeile und „Seite x / y“ liegen ganz im Bild,
 * Zeilen überlappen nicht, dieselben Spalten stehen in jeder Zeile an derselben Stelle, „(war hh:mm)“ bricht nie um.
 * @ZM-211 (Bild-OK PR #559, 18.11.2026): Wächst die Schrift auf der Folie (schmale Aufteilung), ist die Zeitspalte schmaler als bisher (9,6 em), die
 * Teamnamen sind größer als bisher, „(war …)“ steht UNTER der Uhrzeit (Block oben links), Teamnamen und Stand stehen mittig in der Zeile. Wächst sie nicht,
 * bleibt die Folie in der bisherigen Aufteilung („(war …)“ hinter der Uhrzeit, gemeinsame Mittelachse). Nie kleiner als bisher, in keiner Aufteilung.
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
  { id: 'plan', namen: 'kurz', kennung: '@ZM-105 @ZM-189 Spielplan Feld 1 mit Finalspielen (Bezeichnung als Zwischenzeile über der Karte, ohne „voraussichtlich“)', zusatz: '&verschoben=1&finale=3' },
  { id: 'naechste', namen: 'kurz', kennung: '@ZM-189 Nächste Spiele, zwei Felder (Feld in jeder Zeile) mit Finalspielen', zusatz: '&felder=2&finale=3&anzahl=8' },
  { id: 'naechste', namen: 'kurz', kennung: '@ZM-188 @ZP-046 Nächste Spiele, verschoben', zusatz: '&verschoben=1&anzahl=10' },
  { id: 'naechste', namen: 'lang', kennung: '@ZM-150 @ZM-188 Nächste Spiele, acht Spiele mit Namen von 45–50 Zeichen, verschoben', zusatz: '&verschoben=1&anzahl=8' },
] as const;

/** Bildrand in Prozent der Folie (@ME-067: 0 bis 10): die Seitenzahl richtet sich nach dem wirksamen Rand. */
const RAENDER = [0, 5, 10] as const;

const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

interface Kasten { schmal: boolean; schrift: number; zeitBreite: number; blockAbweichung: number; labelProbleme: string[]; zusatzUnten: number; id: string; links: number; rechts: number; oben: number; unten: number; zeit: number; heim: number; stand: number; gast: number; uhr: string; war: string | null; warUnterUhr: boolean; zeitUeberbreit: boolean }

async function zeilen(page: Page): Promise<Kasten[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')].map((r) => {
    const b = r.getBoundingClientRect();
    const x = (sel: string): number => r.querySelector<HTMLElement>(sel)?.getBoundingClientRect().left ?? -1;
    const uhr = r.querySelector<HTMLElement>('[data-testid="monitor-match-clock"]')!;
    const war = r.querySelector<HTMLElement>('[data-testid="monitor-match-original"]');
    const zeit = r.querySelector<HTMLElement>('[data-testid="monitor-match-clockline"]')!;
    const teams = r.querySelectorAll<HTMLElement>('[data-teamname]');
    const block = r.parentElement!;
    const sollPx = (parseFloat(block.dataset.heightVh ?? '0') / 100) * window.innerHeight;
    return {
      // schmale Aufteilung (@ZM-211): „(war …)“ hat eine eigene Zeile unter der Uhrzeit, in jeder Zeile der Folie
      schmal: r.querySelector('[data-testid="monitor-match-warline"]') !== null,
      schrift: parseFloat(getComputedStyle(teams[0]).fontSize),
      zeitBreite: r.querySelector<HTMLElement>('[data-testid="monitor-match-time"]')!.getBoundingClientRect().width,
      // Höhe von Oberkante der Zwischenzeile (bzw. der Karte) bis Unterkante der Karte gegen die Zeilenhöhe aus dem Modell (listRows)
      blockAbweichung: Math.abs(block.getBoundingClientRect().height - sollPx),
      labelProbleme: (() => {
        // Zwischenzeile über der Karte: ganz über der Karte ihres Spiels, waagrecht mittig über der Standspalte (± 2 px) und über keiner Karte
        const label = r.parentElement!.querySelector<HTMLElement>('[data-testid="monitor-match-label"]');
        if (label === null) { return []; }
        const textRange = document.createRange();
        textRange.selectNodeContents(label);
        const l = textRange.getBoundingClientRect();
        const probleme: string[] = [];
        if (l.bottom > b.top + 0.5) { probleme.push('Bezeichnung liegt nicht über der Karte'); }
        const stand = r.querySelector<HTMLElement>('[data-testid="monitor-match-separator"]')!.getBoundingClientRect();
        if (Math.abs((l.left + l.right) / 2 - (stand.left + stand.right) / 2) > 2) { probleme.push('Bezeichnung nicht mittig über der Standspalte'); }
        const schneidet = (a: DOMRect, c: DOMRect): boolean => a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top;
        for (const andere of document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')) {
          if (schneidet(l, andere.getBoundingClientRect())) { probleme.push('Bezeichnung überdeckt eine Zeilenkarte'); }
        }
        return probleme;
      })(),
      zusatzUnten: Math.max(0, ...[...r.querySelectorAll<HTMLElement>('[data-testid="monitor-match-zusatz"], [data-testid="monitor-match-extra"]')].map((e) => e.getBoundingClientRect().bottom)),
      id: r.dataset.matchId ?? '', links: b.left, rechts: b.right, oben: b.top, unten: b.bottom,
      zeit: x('[data-testid="monitor-match-time"]'), heim: teams[0].getBoundingClientRect().left, stand: x('[data-testid="monitor-match-separator"]'), gast: teams[1].getBoundingClientRect().left,
      uhr: uhr.textContent ?? '', war: war?.textContent ?? null,
      // „unter“: die Mitte von „(war …)“ liegt unter der Uhrzeit und beide beginnen links an derselben Kante; „hinter“: auf der Höhe der Uhrzeit, rechts von ihr
      warUnterUhr: war !== null && (war.getBoundingClientRect().top + war.getBoundingClientRect().bottom) / 2 >= uhr.getBoundingClientRect().bottom
        && Math.abs(war.getBoundingClientRect().left - uhr.getBoundingClientRect().left) <= 2,
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
 * Mittelachsen je Zeile: Namensblöcke und Stand stehen senkrecht mittig in der Zeile (±2 px), auch mit mehrzeiligen Namen; die Uhrzeit-Zeile steht
 * in der bisherigen Aufteilung auf derselben Achse, in der schmalen oben links (@ZM-211), „Ende“/„gewertet“ unter der Uhrzeit und „(4:3 i. E.)“ unter dem Stand (@ZM-189).
 */
async function mittelachsen(page: Page): Promise<{ id: string; abweichung: number; mitUhr: number; zeile: number; ausMitte: number; uhrUeberMitte: number }[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')].map((zeile) => {
    const mitte = (el: Element): number => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
    const uhr = mitte(zeile.querySelector('[data-testid="monitor-match-clockline"]')!);
    const ziele = [...zeile.querySelectorAll('[data-teamname]'), zeile.querySelector('[data-testid="monitor-match-score"]')!];
    const werte = ziele.map(mitte);
    const rahmen = zeile.getBoundingClientRect();
    const zeilenMitte = (rahmen.top + rahmen.bottom) / 2;
    return {
      id: zeile.dataset.matchId ?? '', abweichung: Math.max(...werte) - Math.min(...werte), mitUhr: Math.max(...werte, uhr) - Math.min(...werte, uhr),
      zeile: rahmen.height, ausMitte: Math.abs(werte[0] - zeilenMitte), uhrUeberMitte: zeilenMitte - uhr,
    };
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
      test(`${szene.kennung}, ${p.name}, Rand ${String(rand)} %: jede Zeile und „Seite x / y“ ganz im Bild, gleiche Spalten, „(war …)“ unter der Uhrzeit (schmale Aufteilung, @ZM-211) oder hinter ihr`, async ({ browser }, testInfo) => {
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
            expect(k.labelProbleme, `${k.id}: Zwischenzeile`).toEqual([]);
            expect(k.blockAbweichung, `${k.id}: Höhe von Zwischenzeile plus Karte = Zeilenhöhe aus dem Modell (± 1 px)`).toBeLessThanOrEqual(1);
            expect(k.oben, `${k.id}: Oberkante im Bild`).toBeGreaterThanOrEqual(0);
            expect(k.rechts, `${k.id}: Rand rechts im Bild`).toBeLessThanOrEqual(p.width);
            expect(k.links, `${k.id}: Rand links im Bild`).toBeGreaterThanOrEqual(0);
            expect(k.zeitUeberbreit, `${k.id}: Uhrzeit-Zelle bricht nicht um und läuft nicht über`).toBe(false);
            if (k.war !== null) {
              expect(k.war, `${k.id}: Wortlaut`).toMatch(/^\(war \d{2}:\d{2}\)$/);
              expect(k.warUnterUhr, `${k.id}: „(war …)“ steht in der schmalen Aufteilung unter der Uhrzeit, in der bisherigen hinter ihr (@ZM-211)`).toBe(k.schmal);
            }
            // Schrift nie kleiner als bisher (3,6 % der Bildhöhe, @ZM-150); wo die Folie die schmale Aufteilung nimmt, ist die Zeitspalte schmaler als 9,6 em, und mit kurzen Namen ist die Schrift größer
            const bisher = 0.036 * p.height;
            expect(k.schrift, `${k.id}: Teamnamen nie kleiner als bisher`).toBeGreaterThanOrEqual(bisher - 0.5);
            if (k.schmal) {
              // mit kurzen Namen ist Platz: die Schrift wächst (@ZM-211); mit Namen von 45 bis 50 Zeichen bleibt sie womöglich wie bisher (@ZM-150), nie kleiner
              if (szene.namen === 'kurz') { expect(k.schrift, `${k.id}: schmale Aufteilung mit kurzen Namen: Teamnamen größer als bisher`).toBeGreaterThan(bisher + 0.5); }
              expect(k.zeitBreite, `${k.id}: schmale Aufteilung: Zeitspalte schmaler als die bisherigen 9,6 em (Abstand 0,4 em für Rundung)`).toBeLessThan(9.2 * k.schrift);
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
          const schmal = kaesten[0].schmal;
          expect(new Set(kaesten.map((k) => k.schmal)).size, `Seite ${String(seite + 1)}: alle Zeilen der Folie haben dieselbe Aufteilung`).toBe(1);
          for (const g of achsen) {
            expect(g.abweichung, `${g.id}: Teamnamen und Stand haben eine gemeinsame Mittelachse (±2 px)`).toBeLessThanOrEqual(2);
            expect(g.ausMitte, `${g.id}: die Achse liegt in der Mitte der Zeile (±2 px)`).toBeLessThanOrEqual(2);
            if (schmal) {
              expect(g.uhrUeberMitte, `${g.id}: schmale Aufteilung: die Uhrzeit steht oben links, über der Mitte der Zeile`).toBeGreaterThan(2);
            } else {
              expect(g.mitUhr, `${g.id}: bisherige Aufteilung: auch die Uhrzeit liegt auf der gemeinsamen Mittelachse (±2 px)`).toBeLessThanOrEqual(2);
            }
          }
          if (szene.id === 'plan' && szene.namen === 'kurz' && szene.zusatz.includes('strafstoss')) {
            expect(new Set(achsen.map((g) => Math.round(g.zeile))).size, 'Zeilenhöhe fest: auch die Zeile mit „(4:3 i. E.)“ ist gleich hoch').toBe(1);
          }
          // das Seitenmodell rechnet mit den Schriftstufen von bisher; in der schmalen Aufteilung (größere Schrift) prüft listen-folien-umbruch.spec.ts, dass kein Name neu umbricht
          if (!schmal) {
            for (const n of await namensplatz(page)) {
              expect(n.breite, `Seite ${String(seite + 1)}: das Modell nimmt nie mehr Namensplatz an, als real da ist`).toBeGreaterThanOrEqual(n.modell);
            }
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

test.describe('@ZM-211 Auf „Nächste Spiele“ gehört der Platz neben der Uhrzeit den Teamnamen (Beispiel „Nikolaus-Turnier“)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');
  const NAMEN = 'SV Kirchanschöring|SpVgg Fridolfing|TSV Waging 2|TSV Freilassing|TSV Waging 1|SG Taching/Tengling';

  for (const p of PROFILE) {
    for (const verschoben of [false, true]) {
      test(`${p.name}, Rand 5 %, ${verschoben ? 'ab dem dritten Spiel um 10 Minuten verschoben' : 'nichts verschoben'}: Zeitspalte schmal, Teamnamen deutlich größer als bisher und jeder in einer Zeile, „(war …)“ unter der Uhrzeit`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
        const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
        const page = await ctx.newPage();
        await page.goto(`/tests/e2e/harness/listen-folien-monitor.html?szene=naechste&seite=0&anzahl=5&rand=5&namenliste=${encodeURIComponent(NAMEN)}${verschoben ? '&verschoben=1' : ''}`);
        await expect(page.getByTestId('monitor-slide')).toBeVisible();
        await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
        const kaesten = await zeilen(page);
        expect(kaesten).toHaveLength(5);
        const hoehen = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-teamname]')].map((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).fontSize)));
        for (const h of hoehen) { expect(h, 'jeder Teamname steht in einer Zeile').toBeLessThan(1.6); }
        for (const k of kaesten) {
          expect(k.schmal, `${k.id}: schmale Aufteilung`).toBe(true);
          expect(k.schrift, `${k.id}: Teamnamen deutlich größer als bisher (3,6 % der Bildhöhe)`).toBeGreaterThanOrEqual(1.1 * 0.036 * p.height);
          expect(k.zeitBreite, `${k.id}: keine breite Spalte neben der Uhrzeit`).toBeLessThan(9.2 * k.schrift);
          expect(k.unten, `${k.id}: im Bild`).toBeLessThanOrEqual(p.height);
          if (k.war !== null) { expect(k.warUnterUhr, `${k.id}: „(war …)“ unter der Uhrzeit`).toBe(true); }
        }
        expect(new Set(kaesten.map((k) => k.schrift)).size, 'alle Zeilen dieselbe Schrift (@ZM-187)').toBe(1);
        expect(new Set(kaesten.map((k) => Math.round(k.zeitBreite))).size, 'alle Zeilen dieselbe Zeitspalte (@ZM-187)').toBe(1);
        expect(kaesten.some((k) => k.war !== null), verschoben ? 'verschobene Spiele tragen „(war …)“' : '').toBe(verschoben);
        await ctx.close();
      });
    }
  }
});

test.describe('Finalrunde in „Alle Tabellen“ blättert nach gemessener Höhe (@ZM-185, @ZM-187, @ZM-105)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const anzahl of [4, 6]) {
    for (const namen of ['kurz', 'lang'] as const) {
      for (const p of PROFILE) {
        for (const rand of RAENDER) {
          test(`${String(anzahl)} Finalspiele, Namen ${namen}, ${p.name}, Rand ${String(rand)} %: alle Zeilen und Zusätze ganz im Bild, jedes Spiel einmal, mit Überschrift, ohne „voraussichtlich“`, async ({ browser }, testInfo) => {
            test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
            const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
            const page = await ctx.newPage();
            const url = (seite: number) => `/tests/e2e/harness/listen-folien-monitor.html?szene=finale&seite=${String(seite)}&namen=${namen}&rand=${String(rand)}&finale=${String(anzahl)}`;
            await page.goto(url(1));
            await expect(page.getByTestId('monitor-slide')).toBeVisible();
            const seiten = Number(await page.getByTestId('monitor-slide').getAttribute('data-pages'));
            const ordner = process.env.LISTEN_FOLIEN_BILDER ?? testInfo.outputDir;
            mkdirSync(ordner, { recursive: true });
            const gesehen: string[] = [];
            for (let seite = 1; seite < seiten; seite += 1) {
              if (seite > 1) { await page.goto(url(seite)); }
              await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
              await page.screenshot({ path: join(ordner, `finale${String(anzahl)}-${namen}-${p.name}-rand${String(rand)}-s${String(seite)}.png`) });
              const kaesten = await zeilen(page);
              expect(kaesten.length).toBeGreaterThan(0);
              for (const k of kaesten) {
                expect(k.unten, `${k.id}: Unterkante im Bild`).toBeLessThanOrEqual(p.height);
                expect(k.zusatzUnten, `${k.id}: Zusätze in der Zeile`).toBeLessThanOrEqual(k.unten + 0.5);
                expect(k.labelProbleme, `${k.id}: Zwischenzeile`).toEqual([]);
            expect(k.blockAbweichung, `${k.id}: Höhe von Zwischenzeile plus Karte = Zeilenhöhe aus dem Modell (± 1 px)`).toBeLessThanOrEqual(1);
              }
              const hinweis = page.getByText(`Seite ${String(seite + 1)} / ${String(seiten)}`);
              await expect(hinweis).toBeVisible();
              const h = await hinweis.boundingBox();
              expect(h!.y + h!.height, 'Seitenhinweis im Bild').toBeLessThanOrEqual(p.height);
              await expect(page.getByTestId('monitor-match-label')).toHaveCount(kaesten.length);
              await expect(page.getByText('voraussichtlich')).toHaveCount(0);
              gesehen.push(...kaesten.map((k) => k.id));
            }
            expect(gesehen, 'jedes Finalspiel genau einmal').toHaveLength(anzahl);
            expect(new Set(gesehen).size).toBe(anzahl);
            await ctx.close();
          });
        }
      }
    }
  }
});

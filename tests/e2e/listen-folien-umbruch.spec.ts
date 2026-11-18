/**
 * @ZM-211 Kein Name bricht erst durch die größere Schrift neu um – gemessen an der GERENDERTEN Breite (Prüfstand listen-folien-monitor.html), nicht
 * am Modell: Für jeden Namen wird die schmale Aufteilung (Zeitspalte, größere Schrift) gerendert und derselbe Name in einer Probe mit der Breite
 * und Schrift der bisherigen Aufteilung (Zeitspalte 9,6 em, Stufe `team`) im selben Browser gesetzt. Die Zeilenzahl der Folie ist nie größer als die der Probe.
 * Namen mit 15, 19, 23, 25, 27, 36 und 50 Zeichen, dazu Namen mit Zeichen außerhalb der Zeichentabelle (Ł, İ, ş, ’ …) und lange Bindestrich-Wörter
 * (Review PR #559); 1920×1080 und 1280×720 (die Sondernamen auch 1600×1000), Rand 0, 5 und 10 %, „Nächste Spiele“ und „Spielplan“.
 * Die Probe setzt die Bindestrich-Wörter nach der Regel von main (zusammen, wenn höchstens so viele Zeichen wie `nameCharsPerLine`).
 * Nur am Dev-Server (gehört nicht in den Build).
 */
import { test, expect } from '@playwright/test';

const NAMEN = [
  ['Eintracht Aigen', 'SG Taching/Tengling', 'Fortuna Bad Reichenhall', 'Sportvereinigung Nordheim', 'Wacker Burghausen Nachwuchs', 'Mannschaftsgemeinschaft Chiemgau Ost'],
  ['Mannschaftsgemeinschaft Oberweiler Unterweiler Nor', 'Eintracht Aigen', 'SG Taching/Tengling', 'Fortuna Bad Reichenhall', 'Sportvereinigung Nordheim', 'Wacker Burghausen Nachwuchs'],
  // Zeichen außerhalb der Zeichentabelle des Modells und Apostroph (Review PR #559, R1a): die Bremse darf nie durch ein fremdes Zeichen eine Zeile mehr zulassen
  ['Młodzieżowy Klub Sportowy', 'İstanbul Başakşehir Gençlik', 'Fenerbahçe Işıkları Freilassing', 'SV Kirchanschöring', 'Łódź Żółtaki 1923', 'Café O’Brien Jugend'],
  // lange Bindestrich-Wörter, Ziffern, Schrägstrich, ß (Review PR #559, R1b): main entscheidet das Zusammenhalten nach Zeichenzahl
  ['SpVgg Garmisch-Partenkirchen II', 'Sportfreunde Hohenstein-Ernstthal', 'FC Königs Wusterhausen-Süd', 'Eintracht Oberweiler-Niederstetten 1919', 'SG Taching/Tengling', 'Schwarz-Weiß Straße-Ost 1/2'],
] as const;
/** Jeder Namensatz reihum verschoben: jeder Name steht mit jedem anderen im selben Spiel (ein langer Name darf einen kurzen nicht verdecken). */
const DREHUNGEN = [0, 1, 2, 3, 4, 5];
const drehe = (liste: readonly string[], n: number): string[] => [...liste.slice(n), ...liste.slice(0, n)];
const PROFILE = [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }] as const;
/** Zweites Seitenverhältnis (16:10) für die Namensätze mit Sonderzeichen und Bindestrichen */
const PROFILE_ZUSATZ = [{ w: 1600, h: 1000 }] as const;
const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;

interface Befund { name: string; folie: number; probe: number; schrift: number; probeSchrift: number }

test.describe('Listen-Folien: Namensumbruch an gerenderter Breite (@ZM-211)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');

  for (const szene of ['plan', 'naechste'] as const) {
    for (const p of [...PROFILE, ...PROFILE_ZUSATZ]) {
      for (const rand of [0, 5, 10]) {
        for (const [i, basis] of NAMEN.entries()) {
         if (i < 2 && p.w === 1600) { continue; }
         for (const drehung of DREHUNGEN) {
          const liste = drehe(basis, drehung);
          test(`${szene}, ${String(p.w)}×${String(p.h)}, Rand ${String(rand)} %, Namensatz ${String(i + 1)}, Drehung ${String(drehung)}: nie mehr Zeilen als in der Probe der bisherigen Breite`, async ({ browser }, testInfo) => {
            test.skip(testInfo.project.name !== 'desktop', 'nur Projekt desktop (setzt das Fenster selbst)');
            const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, colorScheme: 'dark', serviceWorkers: 'block', locale: 'de-DE' });
            const page = await ctx.newPage();
            await page.goto(`/tests/e2e/harness/listen-folien-monitor.html?szene=${szene}&rand=${String(rand)}&anzahl=5&namenliste=${encodeURIComponent(liste.join('|'))}`);
            await expect(page.getByTestId('monitor-slide')).toBeVisible();
            await page.evaluate(() => document.fonts.ready.then(() => new Promise((res) => { requestAnimationFrame(() => { requestAnimationFrame(res); }); })));
            const befunde = await page.evaluate((): Befund[] => {
              const zeilen = (el: Element): number => {
                const r = document.createRange();
                r.selectNodeContents(el);
                return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
              };
              const stufe = 0.036 * window.innerHeight;
              return [...document.querySelectorAll<HTMLElement>('[data-testid="monitor-match-row"]')].flatMap((zeile) => {
                const zeit = zeile.querySelector<HTMLElement>('[data-testid="monitor-match-time"]')!.getBoundingClientRect().width;
                const stand = zeile.querySelector<HTMLElement>('[data-testid="monitor-match-separator"]')!.getBoundingClientRect().width;
                return [...zeile.querySelectorAll<HTMLElement>('[data-teamname]')].map((el) => {
                  const schrift = parseFloat(getComputedStyle(el).fontSize);
                  // Breite der Namensspalte in der bisherigen Aufteilung: Zeitspalte 9,6 em und Standspalte 4,6 em der Stufe statt der heutigen Maße
                  const bisher = el.getBoundingClientRect().width + (zeit + stand - (9.6 + 4.6) * stufe) / 2;
                  const probe = el.cloneNode(false) as HTMLElement;
                  // Text wie auf main: Bindestrich-Wörter bleiben zusammen, wenn sie höchstens so viele Zeichen haben, wie `nameCharsPerLine` Zeichen je Zeile fasst; Umbruchstelle nach „/“
                  const jeZeile = Number(document.querySelector('[data-testid="monitor-slide"]')!.getAttribute('data-namechars'));
                  probe.innerHTML = (el.textContent ?? '').split(/(\s+)/).map((wort) => {
                    const stueck = wort.split(/(?<=\/)/).join('<wbr>');
                    return wort.includes('-') && [...wort].length <= jeZeile ? `<span style="white-space:nowrap">${stueck}</span>` : stueck;
                  }).join('');
                  probe.style.cssText = `${el.style.cssText};position:absolute;visibility:hidden;flex:none;width:${String(bisher)}px;font-size:${String(stufe)}px`;
                  el.parentElement!.appendChild(probe);
                  const ergebnis = { name: el.textContent ?? '', folie: zeilen(el), probe: zeilen(probe), schrift, probeSchrift: stufe };
                  probe.remove();
                  return ergebnis;
                });
              });
            });
            expect(befunde.length).toBeGreaterThan(0);
            for (const b of befunde) {
              expect(b.schrift, `${b.name}: Schrift nie kleiner als bisher`).toBeGreaterThanOrEqual(b.probeSchrift - 0.01);
              expect(b.folie, `${b.name}: Zeilen auf der Folie (${String(b.folie)}) höchstens so viele wie in der bisherigen Breite (${String(b.probe)})`).toBeLessThanOrEqual(b.probe);
            }
            await ctx.close();
          });
         }
        }
      }
    }
  }
});

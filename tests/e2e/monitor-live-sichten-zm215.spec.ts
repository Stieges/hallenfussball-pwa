/**
 * Live-Folie der Monitore ohne Profil („Spielfeld (fern)“) am fertigen Bild (@ZM-215, @ZM-151; Regel T2-UI): gemessen an der echten Monitor-Seite (lokaler Stand,
 * Saat `monitor-halle`, Monitor `mon-fern`, keine Produktion) bei 1920×1080 und 1280×720, je mit Bildrand 0 und 5 %.
 * - kein Wort „Restzeit“; ein Wort neben der Uhr nur bei Abweichung („angehalten“, „Pause · Halbzeit“, „Zeit abgelaufen“)
 * - Feld und Gruppe nur, wenn das Turnier mehr als eins davon hat
 * - Zeitbalken mindestens 5 % der Höhe der Folie, läuft wie die Restzeit herunter (links verankert, 3 von 9 Minuten gespielt: zwei Drittel gefüllt), die abgelaufene
 *   Strecke bleibt als Bahn sichtbar, nie rot, angehalten grau, Schlussphase violett
 * - Uhr größer als vorher (Schrift der Uhr mindestens 13,9 % der Höhe statt 11 %), Torzahlen nicht kleiner (mindestens 22,4 %)
 * - Ergebniskästen in jedem Zustand gleich groß und gleich gelegen (@ZM-151); nichts überlappt, nichts ragt aus der Folie
 * Die Zeit der Seite steht fest (`setFixedTime`): dieselbe Restzeit in jedem Lauf. Keine festen Wartezeiten. Nur Profil `desktop` (setzt das Fenster selbst).
 */
import type { Browser, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { animationenFertig } from './helpers/animationenFertig';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
});

const GROESSEN = [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }] as const;
const RAENDER = [0, 5] as const;
const TOLERANZ_PX = 1.5;

interface Rahmen { l: number; t: number; r: number; b: number; w: number; h: number }
interface Messung {
  H: number;
  folie: Rahmen;
  digitPx: number;
  uhrPx: number;
  teile: Record<string, Rahmen>;
  balken: { balken: Rahmen; fuellung: Rahmen; anteil: string | null; ton: string | null; fuellungFarbe: string; bahnFarbe: string; hintergrund: { bild: string; flaeche: Rahmen } } | null;
  wort: string | null;
  kopfInfo: string | null;
  kopfGruppe: string | null;
  seiteText: string;
  seitenUeberlauf: boolean;
}

interface Opt { neunMinuten?: boolean; schlussphase?: boolean; abgelaufen?: boolean; thema?: 'dark' | 'light' }
type SaatDatei = { datenbanken: { store: string; eintraege: { tournaments?: Array<Record<string, unknown> & { id: string; matches: Array<Record<string, unknown>> }> } }[] };

/** Saat des Falls; `neunMinuten`: Spielzeit 9 Minuten, 3 gespielt (Restzeit 6:00); `schlussphase`: Uhr-Art mit angehaltener Schlussphase, 19:30 gespielt. */
function saatFuer(fall: string, o: Opt): SaatDatei {
  const saat = structuredClone(leseSaat('monitor-halle')) as SaatDatei;
  const turnier = saat.datenbanken.find((d) => d.store === 'cache')?.eintraege.tournaments?.find((t) => t.id === fall);
  const spiel = turnier?.matches.find((m) => m.matchStatus === 'running' || m.matchStatus === 'paused');
  if (turnier === undefined || spiel === undefined) { return saat; }
  const live = spiel.liveState as Record<string, unknown>;
  if (o.neunMinuten === true) { live.sectionSeconds = 540; live.durationSeconds = 540; live.anchorAt = '@jetzt-ms-180000'; spiel.timerStartTime = '@jetzt-180s'; }
  if (o.schlussphase === true) {
    turnier.matchCockpitSettings = { clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 1 };
    live.anchorAt = '@jetzt-ms-1170000'; spiel.timerStartTime = '@jetzt-1170s';
  }
  if (o.thema !== undefined) { (turnier.monitors as Array<{ theme?: string }>).forEach((m) => { m.theme = o.thema; }); }
  return saat;
}

/** Öffnet den Fall in einem eigenen Kontext (jede Saat nur dort), mit fester Zeit, und misst. */
async function messeFall(browser: Browser, baseURL: string | undefined, fall: string, w: number, h: number, rand: number, o: Opt = {}): Promise<Messung> {
  const kontext = await browser.newContext({ baseURL, viewport: { width: w, height: h } });
  try {
    const page = await kontext.newPage();
    const start = Date.now();
    await page.clock.setFixedTime(start);
    await installiereSaat(kontext, saatFuer(fall, o));
    await page.goto(`/#/display/${fall}/mon-fern?rand=${String(rand)}`);
    await expect(page.locator('[data-testid="live-slide-area"], [data-testid="next-slide-area"]').first()).toBeVisible({ timeout: 25000 });
    await animationenFertig(page);
    await schriftenGeladen(page);
    if (o.abgelaufen === true) {
      // Die Seitenzeit springt über das Ende des Abschnitts hinaus, ohne dass abgepfiffen wird
      await page.clock.setFixedTime(start + 8 * 60 * 1000);
      await expect(page.getByTestId('clock-label'), 'Zeit abgelaufen steht wirklich am Bild').toHaveText('Zeit abgelaufen');
    }
    await namenEingepasst(page);
    return await messe(page);
  } finally { await kontext.close(); }
}

async function schriftenGeladen(page: Page): Promise<void> {
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 30000 });
}

/** Beide Namen stehen in derselben Größe und ändern sich zwischen zwei Messungen mit je zwei Bildern Abstand nicht mehr. */
async function namenEingepasst(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const lies = (): string[] => [...document.querySelectorAll('[data-teamname]')].map((e) => getComputedStyle(e).fontSize);
    const a = lies();
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const b = lies();
    return a.length > 0 && a.join('|') === b.join('|') && new Set(b).size === 1;
  }, null, { timeout: 30000 });
}

async function messe(page: Page): Promise<Messung> {
  return page.evaluate(() => {
    const rahmen = (e: Element | null, name = '?'): Rahmen => {
      if (e === null) { throw new Error(`Element fehlt: ${name}`); }
      const b = e.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
    };
    const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
    const px = (e: Element | null): number => (e === null ? 0 : parseFloat(getComputedStyle(e).fontSize));
    const folieEl = q('live-slide-area') ?? q('next-slide-area');
    if (folieEl === null) { throw new Error('Folie fehlt'); }
    // Die Folienfläche innerhalb des Bildrands ist der Inhaltsbereich des Größen-Containers (der Bildrand ist sein Innenabstand): Bezug aller Anteile (cqh)
    const stil = getComputedStyle(folieEl);
    const fb = folieEl.getBoundingClientRect();
    const [pl, pr, pt, pb] = [stil.paddingLeft, stil.paddingRight, stil.paddingTop, stil.paddingBottom].map((v) => parseFloat(v) || 0);
    const folie = { getBoundingClientRect: () => ({ left: fb.left + pl, right: fb.right - pr, top: fb.top + pt, bottom: fb.bottom - pb, width: fb.width - pl - pr, height: fb.height - pt - pb }) } as unknown as Element;
    const uhr = q('monitor-clock')?.querySelector('span') ?? q('kickoff-time');
    const teile: Record<string, Rahmen> = {};
    for (const [name, e] of Object.entries({ 'live-box-home': q('live-box-home'), 'live-box-away': q('live-box-away'), 'live-header': q('live-header'), uhr, 'clock-label': q('clock-label') ?? q('kickoff-label'), balken: q('monitor-zeitbalken') })) {
      if (e !== null && e !== undefined) { teile[name] = rahmen(e, name); }
    }
    const balken = q('monitor-zeitbalken');
    const fuellung = balken?.firstElementChild ?? null;
    return {
      H: rahmen(folie, 'Folie').h,
      folie: rahmen(folie, 'Folie'),
      digitPx: px(q('live-box-home-digits')),
      uhrPx: px(uhr),
      teile,
      balken: balken === null || fuellung === null ? null : {
        balken: rahmen(balken), fuellung: rahmen(fuellung), anteil: balken.getAttribute('data-anteil'), ton: balken.getAttribute('data-ton'),
        fuellungFarbe: getComputedStyle(fuellung).backgroundColor, bahnFarbe: getComputedStyle(balken).backgroundColor,
        // der Verlauf des Themas liegt auf der Fläche der Folie (nächster Vorfahre mit Verlauf)
        hintergrund: (() => {
          let a: Element | null = balken.parentElement;
          while (a !== null && !getComputedStyle(a).backgroundImage.startsWith('linear-gradient')) { a = a.parentElement; }
          return { bild: a === null ? '' : getComputedStyle(a).backgroundImage, flaeche: rahmen(a ?? document.body) };
        })(),
      },
      wort: q('clock-label')?.textContent ?? null,
      kopfInfo: q('live-info')?.textContent ?? null,
      kopfGruppe: q('live-group')?.textContent ?? null,
      seiteText: document.body.innerText,
      seitenUeberlauf: document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight,
    };
  });
}

const schneiden = (a: Rahmen, b: Rahmen): number => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
const innerhalb = (a: Rahmen, aussen: Rahmen, spiel = TOLERANZ_PX): boolean => a.l >= aussen.l - spiel && a.r <= aussen.r + spiel && a.t >= aussen.t - spiel && a.b <= aussen.b + spiel;
const anteil = (px: number, H: number): number => (px / H) * 100;

/** Nichts überlappt (Kästen, Kopfzeile, Uhr, Wort, Balken) und nichts ragt aus der Folie. */
function pruefeLage(m: Messung): void {
  const ids = Object.keys(m.teile).filter((id) => id !== 'live-header');
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) { expect(schneiden(m.teile[ids[i]], m.teile[ids[j]]), `${ids[i]} überlappt ${ids[j]}`).toBeLessThanOrEqual(1); }
  }
  for (const [id, r] of Object.entries(m.teile)) { expect(innerhalb(r, m.folie), `${id} liegt innerhalb der Folie`).toBe(true); }
  expect(m.seitenUeberlauf, 'die Seite scrollt nicht').toBe(false);
}

for (const { w, h } of GROESSEN) {
  for (const rand of RAENDER) {
    test.describe(`@ZM-215 Live-Folie „Spielfeld (fern)“, ${String(w)}×${String(h)}, Bildrand ${String(rand)} %`, () => {
      test('läuft: Uhr groß (≥ 13,9 % der Höhe), Torzahl nicht kleiner (≥ 22,4 %), Balken ≥ 5 %, kein Wort „Restzeit“, kein Wort neben der Uhr', async ({ browser, baseURL }) => {
        const m = await messeFall(browser, baseURL, 'halle-laeuft', w, h, rand);
        expect(anteil(m.uhrPx, m.H), 'Uhr in % der Höhe').toBeGreaterThanOrEqual(13.9);
        expect(anteil(m.digitPx, m.H), 'Torzahl in % der Höhe').toBeGreaterThanOrEqual(22.4);
        expect(anteil(m.balken!.balken.h, m.H), 'Balken in % der Höhe').toBeGreaterThanOrEqual(4.95);
        expect(m.seiteText, 'kein Wort „Restzeit“').not.toContain('Restzeit');
        expect(m.wort, 'läuft: kein Wort neben der Uhr').toBeNull();
        pruefeLage(m);
      });

      test('Gegenbeispiel Feld und Gruppe: ein Feld und eine Gruppe → nur „Spiel 3“; zwei Felder und zwei Gruppen → „Feld 1 — Spiel 1“ und „Gruppe A“', async ({ browser, baseURL }) => {
        const eins = await messeFall(browser, baseURL, 'halle-laeuft', w, h, rand);
        expect(eins.kopfInfo).toBe('Spiel 3');
        expect(eins.kopfGruppe).toBe('');
        expect(eins.seiteText).not.toMatch(/Feld \d/i);
        const zwei = await messeFall(browser, baseURL, 'halle-zwei-felder', w, h, rand);
        expect(zwei.kopfInfo).toBe('Feld 1 — Spiel 1');
        expect(zwei.kopfGruppe).toBe('Gruppe A');
        pruefeLage(zwei);
      });

      test('Ergebniskästen in jedem Zustand gleich groß und gleich gelegen (@ZM-151): läuft, angehalten, Halbzeitpause, Zeit abgelaufen, vor dem Anpfiff, zwei Felder, lange Namen', async ({ browser, baseURL }) => {
        const lauf = await messeFall(browser, baseURL, 'halle-laeuft', w, h, rand);
        const faelle: Array<[string, string, Opt]> = [
          ['angehalten', 'halle-angehalten', {}], ['Halbzeitpause', 'halle-halbzeit', {}], ['Zeit abgelaufen', 'halle-laeuft', { abgelaufen: true }],
          ['vor dem Anpfiff', 'halle-vor', {}], ['zwei Felder mit Gruppen', 'halle-zwei-felder', {}], ['lange Namen', 'halle-lang25', {}],
        ];
        for (const [name, fall, o] of faelle) {
          const m = await messeFall(browser, baseURL, fall, w, h, rand, o);
          for (const id of ['live-box-home', 'live-box-away']) {
            for (const kante of ['l', 't', 'w', 'h'] as const) { expect(Math.abs(m.teile[id][kante] - lauf.teile[id][kante]), `${id}.${kante} im Zustand „${name}“ gegen „läuft“`).toBeLessThanOrEqual(TOLERANZ_PX); }
          }
          expect(anteil(m.uhrPx, m.H), `Uhr im Zustand „${name}“`).toBeGreaterThanOrEqual(13.9);
          pruefeLage(m);
        }
      });

      test('Wort neben der Uhr nur bei Abweichung: angehalten, Pause · Halbzeit, Zeit abgelaufen; links neben der Uhr, nie ein „Restzeit“', async ({ browser, baseURL }) => {
        const faelle: Array<[string, string, Opt, string]> = [['angehalten', 'halle-angehalten', {}, 'angehalten'], ['Pause', 'halle-halbzeit', {}, 'Pause · Halbzeit'], ['Zeit abgelaufen', 'halle-laeuft', { abgelaufen: true }, 'Zeit abgelaufen']];
        for (const [name, fall, o, wort] of faelle) {
          const m = await messeFall(browser, baseURL, fall, w, h, rand, o);
          expect(m.wort, `Wort im Zustand „${name}“`).toBe(wort);
          expect(m.teile['clock-label'].r, `Wort „${wort}“ steht links neben der Uhr`).toBeLessThanOrEqual(m.teile.uhr.l + 1);
          expect(m.seiteText).not.toContain('Restzeit');
        }
      });

      test('@ZM-215 Zeitbalken: mindestens 5 % der Höhe, die Uhr läuft mit 3 von 9 Minuten gespielt bei zwei Dritteln, links verankert, die abgelaufene Strecke bleibt als Bahn', async ({ browser, baseURL }) => {
        const m = await messeFall(browser, baseURL, 'halle-laeuft', w, h, rand, { neunMinuten: true });
        const b = m.balken!;
        expect(anteil(b.balken.h, m.H), 'Balkenhöhe in % der Höhe der Folie').toBeGreaterThanOrEqual(4.95);
        expect(b.fuellung.l, 'die Füllung ist links verankert').toBeCloseTo(b.balken.l, 0);
        expect(b.fuellung.w / b.balken.w, 'zwei Drittel gefüllt (feste Zeit: genau 6:00)').toBeCloseTo(2 / 3, 2);
        expect(b.fuellung.w, 'rechts bleibt die abgelaufene Strecke als Bahn sichtbar').toBeLessThan(b.balken.w - 20);
        expect(b.ton).toBe('gruen');
      });
    });
  }
}

test.describe('@ZM-215 Zeitbalken nach Zustand (1920×1080, Bildrand 5 %)', () => {
  test('angehalten: grau und stehend; Halbzeitpause: gedämpft; Zeit abgelaufen: leer mit sichtbarer Bahn; nie rot', async ({ browser, baseURL }) => {
    const nichtRot = (farbe: string): boolean => { const [r, g, b] = (farbe.match(/\d+/g) ?? []).map(Number); return !(r > g + 40 && r > b + 40); };
    const angehalten = await messeFall(browser, baseURL, 'halle-angehalten', 1920, 1080, 5);
    expect(angehalten.balken?.ton).toBe('grau');
    const pause = await messeFall(browser, baseURL, 'halle-halbzeit', 1920, 1080, 5);
    expect(pause.balken?.ton).toBe('gedaempft');
    const aus = await messeFall(browser, baseURL, 'halle-laeuft', 1920, 1080, 5, { abgelaufen: true });
    expect(aus.balken?.fuellung.w, 'bei abgelaufener Zeit ist der Balken leer').toBeLessThan(2);
    expect(aus.balken?.balken.w, 'die Bahn bleibt sichtbar').toBeGreaterThan(1000);
    for (const m of [angehalten, pause, aus]) { expect(nichtRot(m.balken?.fuellungFarbe ?? ''), 'Füllung nicht rot').toBe(true); expect(nichtRot(m.balken?.bahnFarbe ?? ''), 'Bahn nicht rot').toBe(true); }
  });

  test('Gegenbeispiel: in der Schlussphase ist die Füllung violett, nie rot; vor dem Anpfiff gibt es keinen Balken, aber die Anstoßzeit steht groß', async ({ browser, baseURL }) => {
    const schluss = await messeFall(browser, baseURL, 'halle-laeuft', 1920, 1080, 5, { schlussphase: true });
    expect(schluss.balken?.ton).toBe('violett');
    const [r, g, b] = (schluss.balken?.fuellungFarbe.match(/\d+/g) ?? []).map(Number);
    expect(b, 'Blauanteil über Grünanteil').toBeGreaterThan(g);
    expect(r > b, 'nicht rot').toBe(false);
    const vor = await messeFall(browser, baseURL, 'halle-vor', 1920, 1080, 5);
    expect(vor.balken).toBeNull();
    expect(anteil(vor.uhrPx, vor.H), 'Anstoßzeit steht wie die Uhr').toBeGreaterThanOrEqual(13.9);
  });

  test('Bahn gegen Hintergrund (an der Stelle des Balkens) und Füllung gegen Bahn, dunkles UND helles Thema: Füllung gegen Bahn ≥ 3 : 1, Bahn gegen Hintergrund dunkel ≥ 2,9 : 1, hell ≥ 2,0 : 1', async ({ browser, baseURL }) => {
    type Farbe = [number, number, number, number];
    const lies = (rgb: string): Farbe => { const m = (rgb.match(/[\d.]+/g) ?? []).map(Number); return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1]; };
    const lum = (c: Farbe): number => {
      const [r, g, b] = c.slice(0, 3).map((x) => { const q = x / 255; return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const verhaeltnis = (a: Farbe, b: Farbe): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const hintergrundAn = (b: NonNullable<Messung['balken']>, y: number): Farbe => {
      const stopps = (b.hintergrund.bild.match(/rgba?\([^)]*\)/g) ?? []).map(lies);
      const f = Math.min(1, Math.max(0, (y - b.hintergrund.flaeche.t) / b.hintergrund.flaeche.h));
      const [von, bis] = [stopps[0] ?? [0, 0, 0, 1], stopps[1] ?? [0, 0, 0, 1]];
      return [0, 1, 2, 3].map((i) => von[i] * (1 - f) + bis[i] * f) as unknown as Farbe;
    };
    const zustaende: Array<[string, Opt, string]> = [['halle-laeuft', {}, 'gruen'], ['halle-angehalten', {}, 'grau'], ['halle-laeuft', { schlussphase: true }, 'violett'], ['halle-halbzeit', {}, 'gedaempft']];
    for (const thema of ['dark', 'light'] as const) {
      for (const [fall, o, ton] of zustaende) {
        const b = (await messeFall(browser, baseURL, fall, 1920, 1080, 5, { ...o, thema })).balken;
        expect(b, `${fall}/${thema}: Balken vorhanden`).not.toBeNull();
        expect(b?.ton).toBe(ton);
        for (const y of [b!.balken.t, b!.balken.b]) {
          expect(verhaeltnis(lies(b!.bahnFarbe), hintergrundAn(b!, y)), `${thema}/${ton}: Bahn ${b!.bahnFarbe} gegen den Hintergrund auf Höhe ${String(Math.round(y))}`).toBeGreaterThanOrEqual(thema === 'dark' ? 2.9 : 2.0);
        }
        expect(verhaeltnis(lies(b!.fuellungFarbe), lies(b!.bahnFarbe)), `${thema}/${ton}: Füllung ${b!.fuellungFarbe} gegen Bahn ${b!.bahnFarbe}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

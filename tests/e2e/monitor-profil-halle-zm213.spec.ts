/**
 * Profil „Halle (sehr fern)“ am fertigen Bild (@ZM-213, @ZM-214, @ZM-215, @ZM-151; Regel T2-UI): gemessen an der echten Monitor-Seite (lokaler Stand, Saat `monitor-halle`,
 * keine Produktion) bei 1920×1080, 1280×720 und 1920×940, je mit Bildrand 0 und 5 %.
 * - Mindestanteile der Höhe der Folienfläche: Torzahl ≥ 34 %, Restzeit ≥ 26 % (nach @ZM-215 über 29,3 %), Namen je Beispielzeile (20 / 15 / 12,5 / 7,5 %)
 * - nichts überlappt (Begrenzungsrahmen von Namen, Torzahlen, Uhrband-Teilen), nichts abgeschnitten (Namen, Uhrband innerhalb der Folie)
 * - Torzahl in jedem Zustand an derselben Stelle (@ZM-151)
 * - Zeitbalken mindestens 6 % der Höhe, läuft wie die Restzeit herunter (links verankert: 3 von 9 Minuten gespielt → zwei Drittel gefüllt), Bahn sichtbar
 * - Englisch: der Text in der Mitte („4 : 3 on penalties“, „Final score“) verdrängt die Seitenspalten nie. Die Monitor-Sprache ist heute fest Deutsch (@ZM-126 später);
 *   die Spec setzt deshalb die echten englischen Sprachwerte in die laufende Seite ein und löst das Einpassen über die Fenstergröße aus.
 * Keine festen Wartezeiten: gewartet wird auf Zustände (Namen eingepasst, Animationen fertig). Nur Profil `desktop` (setzt das Fenster selbst).
 */
import type { Browser, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../scripts/visual-metrics/saat/lader.mjs';
import { animationenFertig } from './helpers/animationenFertig';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Echte englische Sprachwerte der App (Datei der Sprachdateien, kein eingebauter Text). */
const lies = <T,>(datei: string): T => JSON.parse(readFileSync(join(process.cwd(), 'src/i18n/locales/en', datei), 'utf8')) as T;
const enMonitor = lies<{ liveMatch: { finalScore: string; hall: { afterShootout: string }; clock: { ended: string; stopped: string } } }>('monitor.json');
const enTournament = lies<{ matchClock: { section: { secondHalf: string; sectionOfN: string } } }>('tournament.json');
const enSport = lies<{ phases: { afterPenalties: string } }>('sport.json');

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
});

const GROESSEN = [{ w: 1920, h: 1080 }, { w: 1280, h: 720 }, { w: 1920, h: 940 }] as const;
const RAENDER = [0, 5] as const;
const TOLERANZ_PX = 1.5;

interface Rahmen { l: number; t: number; r: number; b: number; w: number; h: number }
interface Messung {
  H: number;
  folie: Rahmen;
  digits: number[];
  clockPx: number | null;
  /** Schrift der beiden Seitenspalten (links, rechts) */
  seitenPx: number[];
  names: { text: string; px: number; rahmen: Rahmen; scrollW: number; clientW: number; feld: Rahmen; flaeche: Rahmen }[];
  teile: Record<string, Rahmen>;
  balken: { balken: Rahmen; fuellung: Rahmen; anteil: string | null; ton: string | null; fuellungFarbe: string; bahnFarbe: string } | null;
  seitenUeberlauf: boolean;
}

type SaatDatei = { datenbanken: { store: string; eintraege: { tournaments?: Array<Record<string, unknown> & { id: string; matches: Array<Record<string, unknown>> }> } }[] };

interface SaatOptionen {
  neunMinuten?: boolean;
  schlussphase?: boolean;
  /** Restzeit knapp unter 15:00 (zweistellige Minuten, fünfstellige Uhr) */
  zehnMinuten?: boolean;
  /** Restzeit in Sekunden bei Abschnittslänge 20 Minuten (z. B. 1080 = „18:00“: vierstellige Zeit macht die Seitenspalten schmal) */
  rest?: number;
  /** Thema des Monitors */
  thema?: 'dark' | 'light';
  /** Verlängerung läuft (Restzeit 4:00) */
  verlaengerung?: boolean;
}

/** Saat des Falls; `neunMinuten`: Spielzeit 9 Minuten, 3 gespielt (Restzeit 6:00); `schlussphase`: Uhr-Art mit angehaltener Schlussphase, 19:30 gespielt. */
function saatFuer(fall: string, optionen: SaatOptionen = {}): SaatDatei {
  const saat = structuredClone(leseSaat('monitor-halle')) as SaatDatei;
  const turnier = saat.datenbanken.find((d) => d.store === 'cache')?.eintraege.tournaments?.find((t) => t.id === fall);
  const spiel = turnier?.matches.find((m) => m.matchStatus === 'running' || m.matchStatus === 'paused');
  if (turnier === undefined || spiel === undefined) { return saat; }
  const live = spiel.liveState as Record<string, unknown>;
  if (optionen.neunMinuten === true) {
    live.sectionSeconds = 540; live.durationSeconds = 540; live.anchorAt = '@jetzt-ms-180000'; spiel.timerStartTime = '@jetzt-180s';
  }
  if (optionen.schlussphase === true) {
    turnier.matchCockpitSettings = { clockMode: 'durchlaufend-letzte-minute-angehalten', finalPhaseMinutes: 1 };
    live.anchorAt = '@jetzt-ms-1170000'; spiel.timerStartTime = '@jetzt-1170s';
  }
  if (optionen.thema !== undefined) { (turnier.monitors as Array<{ theme?: string }>).forEach((m) => { m.theme = optionen.thema; }); }
  if (optionen.zehnMinuten === true) { live.anchorAt = '@jetzt-ms-300000'; spiel.timerStartTime = '@jetzt-300s'; }
  if (optionen.rest !== undefined) {
    const gespielt = (1200 - optionen.rest) * 1000;
    Object.assign(live, { sectionSeconds: 1200, durationSeconds: 1200, elapsedMs: live.status === 'paused' ? gespielt : 0, ...(live.status === 'paused' ? {} : { anchorAt: `@jetzt-ms-${String(gespielt)}` }) });
  }
  if (optionen.verlaengerung === true) {
    Object.assign(live, { phase: 'overtime', playPhase: 'overtime', section: 2, sections: 1, overtimeSeconds: 300, sectionSeconds: 1200, elapsedMs: 0, anchorAt: '@jetzt-ms-60000' });
  }
  return saat;
}

async function oeffne(page: Page, fall: string, w: number, h: number, rand: number, optionen: Parameters<typeof saatFuer>[1] = {}, monitor = 'mon-halle'): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await installiereSaat(page.context(), saatFuer(fall, optionen));
  await page.goto(`/#/display/${fall}/${monitor}?rand=${String(rand)}`);
  await expect(page.locator('[data-testid="hall-display"], [data-testid="live-slide-area"]').first()).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
  await namenEingepasst(page);
}

/**
 * Namen eingepasst: die Schriften sind geladen (ein spätes Neumessen nach dem Laden von Inter ist ausgeschlossen) und beide Namen stehen in derselben Größe,
 * zwei Messungen mit je zwei Bildern Abstand sind gleich. Bleiben die Namen ungleich, läuft die Wartezeit ab und der Fall schlägt fehl (kein Verstecken eines Fehlers).
 */
async function namenEingepasst(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const lies = (): string[] => [...document.querySelectorAll('[data-teamname]')].map((e) => getComputedStyle(e).fontSize);
    if (document.fonts.status !== 'loaded') { return false; }
    const a = lies();
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const b = lies();
    return a.length > 0 && a.join('|') === b.join('|') && new Set(b).size === 1;
  }, null, { timeout: 30000 });
}

/**
 * Zustand „Ende“ wie im echten Betrieb: der Monitor sieht das Spiel zuerst laufen und hält es nach dem Abpfiff (Ende-Folie); danach schreibt die Spec den
 * beendeten Stand in den lokalen Zwischenspeicher, den die Seite von selbst nachlädt.
 */
async function oeffneEnde(page: Page, fall: string, w: number, h: number, rand: number): Promise<void> {
  const saat = structuredClone(leseSaat('monitor-halle')) as SaatDatei;
  const turniere = saat.datenbanken.find((d) => d.store === 'cache')?.eintraege.tournaments ?? [];
  const fertig = structuredClone(turniere.find((t) => t.id === fall));
  const lauf = turniere.find((t) => t.id === 'halle-laeuft')?.matches.find((m) => m.label === '1. Halbfinale');
  const stufe = turniere.find((t) => t.id === fall)?.matches.find((m) => m.label === '1. Halbfinale');
  if (lauf === undefined || stufe === undefined || fertig === undefined) { throw new Error('Saat ohne Halbfinale'); }
  // Vorstufe: dasselbe Spiel läuft noch (ohne Entscheidung)
  const ohneEntscheidung = new Set(['decidedBy', 'finishedAt', 'penaltyScoreA', 'penaltyScoreB', 'overtimeScoreA', 'overtimeScoreB']);
  for (const k of Object.keys(stufe)) { if (ohneEntscheidung.has(k)) { Reflect.deleteProperty(stufe, k); } }
  Object.assign(stufe, { matchStatus: 'running', scoreA: 1, scoreB: 0, timerStartTime: '@jetzt-850s', timerElapsedSeconds: 0, scheduledTime: '@jetzt-850s', liveState: lauf.liveState });
  // nur dieses Turnier, ohne die lokalen Spielkopien der Engine (sonst gälte das Spiel dort schon als beendet)
  const nurFall = saat.datenbanken.map((d) => (d.store === 'cache' ? { ...d, eintraege: { tournaments: [turniere.find((t) => t.id === fall)] } } : { ...d, eintraege: {} }));
  await page.setViewportSize({ width: w, height: h });
  await installiereSaat(page.context(), { ...saat, datenbanken: nurFall });
  await page.goto(`/#/display/${fall}/mon-halle?rand=${String(rand)}`);
  await expect(page.getByTestId('hall-clock')).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
  await page.evaluate(async (t) => {
    const jetzt = Date.now();
    const loese = (wert: unknown): unknown => {
      if (typeof wert === 'string') {
        if (wert === '@heute') { const d = new Date(jetzt); return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
        const iso = /^@jetzt([+-]\d+)s$/.exec(wert);
        if (iso) { return new Date(jetzt + Number(iso[1]) * 1000).toISOString(); }
        const ms = /^@jetzt-ms([+-]\d+)$/.exec(wert);
        return ms ? jetzt + Number(ms[1]) : wert;
      }
      if (Array.isArray(wert)) { return wert.map(loese); }
      if (wert !== null && typeof wert === 'object') { return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, loese(v)])); }
      return wert;
    };
    await new Promise<void>((ok, fehler) => {
      const a = indexedDB.open('hallenfussball');
      a.onerror = () => { fehler(a.error ?? new Error('IndexedDB')); };
      a.onsuccess = () => {
        const db = a.result;
        const tx = db.transaction('cache', 'readwrite');
        tx.objectStore('cache').put({ key: 'tournaments', value: [loese(t)] });
        tx.oncomplete = () => { db.close(); ok(); };
      };
    });
  }, fertig);
  await expect(page.locator('[data-testid="hall-endstand"], [data-testid="hall-shootout-result"]')).toBeVisible({ timeout: 25000 });
  // die Tor-Einblendung (bestehende Einblendung über der Folie) ist vorbei, bevor gemessen wird
  await expect(page.locator('[data-testid="goal-icon"]')).toHaveCount(0, { timeout: 15000 });
  await animationenFertig(page);
  await namenEingepasst(page);
}

/** Öffnet und misst in einem eigenen Kontext: die Saat-Skripte eines Kontexts gelten für jede Seite darin, ein weiterer Zustand braucht eine eigene Saat. */
async function messeInNeuemKontext(browser: Browser, baseURL: string | undefined, oeffnen: (seite: Page) => Promise<void>): Promise<Messung> {
  const kontext = await browser.newContext({ baseURL });
  try {
    const seite = await kontext.newPage();
    await oeffnen(seite);
    return await messe(seite);
  } finally { await kontext.close(); }
}

/** Misst die Folie an der echten Seite (Pixel der Begrenzungsrahmen, Schriftgrößen in px). */
async function messe(page: Page): Promise<Messung> {
  return page.evaluate(() => {
    const rahmen = (e: Element | null, name = '?'): Rahmen => {
      if (e === null) { throw new Error(`Element fehlt: ${name}`); }
      const b = e.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
    };
    const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
    const px = (e: Element | null): number | null => (e === null ? null : parseFloat(getComputedStyle(e).fontSize));
    // die Folienfläche innerhalb des Bildrands ist die Fläche des Größen-Containers: `hall-display` (Bezug aller Anteile, @ZM-213)
    const folie = q('hall-display');
    const teile: Record<string, Rahmen> = {};
    for (const id of ['hall-teamname-home', 'hall-teamname-away', 'hall-digits-home', 'hall-digits-away', 'hall-zeitbalken', 'hall-clock', 'hall-kickoff', 'hall-endstand', 'hall-shootout-result', 'hall-shootout']) {
      const e = q(id);
      if (e !== null) { teile[id] = rahmen(e); }
    }
    // wegfallende Zeilen (`display: none`, niedrigste Rangfolge bei zu wenig Höhe) haben keine Fläche und zählen nicht
    [...document.querySelectorAll('[data-testid="hall-side-left"] > *, [data-testid="hall-side-right"] > *')].filter((e) => e.getClientRects().length > 0).forEach((e, i) => { teile[`seite-${String(i)}-${e.getAttribute('data-testid') ?? 'abzeichen'}`] = rahmen(e); });
    const balken = q('hall-zeitbalken');
    const fuellung = balken?.firstElementChild ?? null;
    return {
      H: rahmen(folie, 'hall-display').h,
      folie: rahmen(folie, 'hall-display'),
      digits: ['hall-digits-home', 'hall-digits-away'].map((id) => px(q(id))).filter((v): v is number => v !== null),
      clockPx: px(q('hall-clock') ?? q('hall-kickoff')),
      seitenPx: ['hall-side-left', 'hall-side-right'].map((id) => px(q(id)) ?? 0),
      names: ['home', 'away'].map((s) => {
        const e = q(`hall-teamname-${s}`);
        if (e === null) { throw new Error('Name fehlt'); }
        return { text: e.textContent ?? '', px: parseFloat(getComputedStyle(e).fontSize), rahmen: rahmen(e), scrollW: e.scrollWidth, clientW: e.clientWidth, feld: rahmen(q(`hall-name-${s}`), `hall-name-${s}`), flaeche: rahmen(q(`hall-panel-${s}`), `hall-panel-${s}`) };
      }),
      teile,
      balken: balken === null || fuellung === null ? null : {
        balken: rahmen(balken), fuellung: rahmen(fuellung), anteil: balken.getAttribute('data-anteil'), ton: balken.getAttribute('data-ton'),
        fuellungFarbe: getComputedStyle(fuellung).backgroundColor, bahnFarbe: getComputedStyle(balken).backgroundColor,
      },
      seitenUeberlauf: document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight,
    };
  });
}

const schneiden = (a: Rahmen, b: Rahmen): number => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
const innerhalb = (a: Rahmen, aussen: Rahmen, spiel = TOLERANZ_PX): boolean => a.l >= aussen.l - spiel && a.r <= aussen.r + spiel && a.t >= aussen.t - spiel && a.b <= aussen.b + spiel;
const anteil = (px: number, H: number): number => (px / H) * 100;

/** Nichts überlappt: je zwei der gemessenen Teile haben keine gemeinsame Fläche (Namen, Torzahlen, Balken, Uhr/Wort in der Mitte, Seitenangaben). */
function pruefeUeberlappung(m: Messung): void {
  const ids = Object.keys(m.teile);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      expect(schneiden(m.teile[ids[i]], m.teile[ids[j]]), `${ids[i]} überlappt ${ids[j]}`).toBeLessThanOrEqual(1);
    }
  }
}

/** Die Seitenangaben bleiben Nah-Information: mindestens 7,08 % der Höhe (@ZM-213), auch wenn die Zeilen in der Höhe zusammenrücken müssen. */
function pruefeSeitenschrift(m: Messung): void {
  for (const px of m.seitenPx) { expect(anteil(px, m.H), 'Schrift der Seitenangaben in % der Höhe').toBeGreaterThanOrEqual(7.08); }
}

/** Nichts abgeschnitten: Namen in ihrer Fläche und ihrem Namensfeld, Uhrband-Teile innerhalb der Folie, kein Scrollen. */
function pruefeAbgeschnitten(m: Messung): void {
  for (const n of m.names) {
    expect(n.scrollW, `Name „${n.text}“ ragt über seinen Rand`).toBeLessThanOrEqual(n.clientW + 1);
    expect(innerhalb(n.rahmen, n.flaeche), `Name „${n.text}“ liegt in seiner Fläche`).toBe(true);
    expect(n.rahmen.h, `Name „${n.text}“ ist nicht höher als sein Namensfeld`).toBeLessThanOrEqual(n.feld.h + TOLERANZ_PX);
  }
  for (const [id, r] of Object.entries(m.teile)) { expect(innerhalb(r, m.folie), `${id} liegt innerhalb der Folie`).toBe(true); }
  expect(m.seitenUeberlauf, 'die Seite scrollt nicht').toBe(false);
}

const NAMEN_FAELLE = [
  { fall: 'halle-team34', mindest: 20, zeile: 'Team 3 / Team 4' },
  { fall: 'halle-djk', mindest: 15, zeile: 'TSV Fridolfing / DJK Otting' },
  { fall: 'halle-laeuft', mindest: 12.5, zeile: 'TSV Fridolfing / SG Taching/Tengling' },
  { fall: 'halle-lang25', mindest: 7.5, zeile: 'zwei Namen mit 25 Zeichen' },
] as const;

for (const { w, h } of GROESSEN) {
  for (const rand of RAENDER) {
    test.describe(`@ZM-213 Halle (sehr fern), ${String(w)}×${String(h)}, Bildrand ${String(rand)} %`, () => {
      test('@ZM-213 Mindestanteile: Torzahl ≥ 34 %, Restzeit über 29,3 % (@ZM-215, mindestens 26 %), Namen je Beispielzeile; Namen gleich groß', async ({ page }) => {
        for (const { fall, mindest, zeile } of NAMEN_FAELLE) {
          await oeffne(page, fall, w, h, rand);
          const m = await messe(page);
          for (const d of m.digits) { expect(anteil(d, m.H), `Torzahl, ${zeile}`).toBeGreaterThanOrEqual(34); }
          expect(anteil(m.clockPx ?? 0, m.H), `Restzeit, ${zeile}`).toBeGreaterThan(29.3);
          for (const n of m.names) { expect(anteil(n.px, m.H), `Namen „${n.text}“, ${zeile}: mindestens ${String(mindest)} %`).toBeGreaterThanOrEqual(mindest - 0.05); }
          expect(Math.abs(m.names[0].px - m.names[1].px), `beide Namen gleich groß, ${zeile}`).toBeLessThanOrEqual(0.6);
        }
      });

      test('@ZM-213 nichts überlappt und nichts ist abgeschnitten: läuft, 25-Zeichen-Namen, zweistellig, zwei Felder, Abschnitt, Gruppe + Abschnitt, „Abschnitt 3 von 3“ angehalten mit Gruppe und breiter Uhr, zweistellige Minuten („14:5x“), Verlängerung, vor dem Anpfiff, Halbzeit, angehalten', async ({ browser, baseURL }) => {
        test.setTimeout(120000);
        const faelle: Array<[string, SaatOptionen]> = [
          ['halle-laeuft', {}], ['halle-lang25', {}], ['halle-zweistellig', {}], ['halle-zwei-felder', {}], ['halle-abschnitt', {}], ['halle-angehalten', {}], ['halle-halbzeit', {}], ['halle-vor', {}],
          ['halle-voll', {}], ['halle-voll-3', {}], ['halle-voll-3', { rest: 1080 }], ['halle-laeuft', { zehnMinuten: true }], ['halle-laeuft', { verlaengerung: true }],
        ];
        // je Fall ein eigener Kontext: ein Wechsel nur der Adresse nach „#“ lädt die Seite nicht neu, die Saat-Skripte (und damit die Abwandlung des Falls) liefen sonst nicht
        for (const [fall, optionen] of faelle) {
          const m = await messeInNeuemKontext(browser, baseURL ?? undefined, async (seite) => {
            await oeffne(seite, fall, w, h, rand, optionen);
            // die Zustände sind wirklich da (kein stilles Ausweichen auf „läuft“)
            if (optionen.verlaengerung === true) { await expect(seite.getByTestId('match-status-badge')).toHaveText(/Verlängerung/); }
            if (optionen.zehnMinuten === true || optionen.rest !== undefined) { await expect(seite.getByTestId('hall-clock')).toHaveText(/^\d\d:\d\d$/); }
          });
          pruefeUeberlappung(m);
          pruefeAbgeschnitten(m);
          pruefeSeitenschrift(m);
        }
      });

      test('@ZM-214 nichts überlappt am Ende (deutsch): Endstand und „4 : 3 i. E.“; Torzahl wie im laufenden Spiel an derselben Stelle', async ({ browser, baseURL }) => {
        const messeIn = (oeffnen: (seite: Page) => Promise<void>): Promise<Messung> => messeInNeuemKontext(browser, baseURL ?? undefined, oeffnen);
        const lauf = await messeIn((seite) => oeffne(seite, 'halle-laeuft', w, h, rand));
        for (const fall of ['halle-ende', 'halle-ende-strafstoss']) {
          const ende = await messeIn((seite) => oeffneEnde(seite, fall, w, h, rand));
          pruefeUeberlappung(ende);
          pruefeAbgeschnitten(ende);
          for (const id of ['hall-digits-home', 'hall-digits-away'] as const) {
            for (const kante of ['l', 't', 'w', 'h'] as const) { expect(Math.abs(ende.teile[id][kante] - lauf.teile[id][kante]), `${id}.${kante} im Fall ${fall}`).toBeLessThanOrEqual(TOLERANZ_PX); }
          }
        }
      });

      test('@ZM-213 Torzahl an derselben Stelle in zwei Zuständen (@ZM-151): läuft, vor dem Anpfiff, Halbzeit gleich', async ({ page }) => {
        await oeffne(page, 'halle-laeuft', w, h, rand);
        const lauf = await messe(page);
        for (const fall of ['halle-vor', 'halle-halbzeit', 'halle-angehalten']) {
          await oeffne(page, fall, w, h, rand);
          const anders = await messe(page);
          for (const id of ['hall-digits-home', 'hall-digits-away'] as const) {
            for (const kante of ['l', 't', 'w', 'h'] as const) {
              expect(Math.abs(anders.teile[id][kante] - lauf.teile[id][kante]), `${id}.${kante} im Fall ${fall} gegen „läuft“`).toBeLessThanOrEqual(TOLERANZ_PX);
            }
          }
          expect(anteil(anders.digits[0], anders.H)).toBeCloseTo(anteil(lauf.digits[0], lauf.H), 1);
        }
      });

      test('@ZM-215 Zeitbalken: mindestens 6 % der Höhe, über die ganze Breite der Folie (Rand abgezogen), Bahn sichtbar', async ({ page }) => {
        await oeffne(page, 'halle-laeuft', w, h, rand);
        const m = await messe(page);
        expect(m.balken).not.toBeNull();
        const b = m.balken!;
        expect(anteil(b.balken.h, m.H), 'Balkenhöhe in % der Folienhöhe').toBeGreaterThanOrEqual(5.95);
        expect(b.balken.w / m.folie.w, 'Balken über (fast) die ganze Breite').toBeGreaterThan(0.9);
        expect(b.fuellung.w, 'die Füllung ist kürzer als die Bahn: der abgelaufene Rest bleibt als Bahn zu sehen').toBeLessThan(b.balken.w - 20);
        expect(b.fuellung.l, 'die Füllung ist links verankert').toBeCloseTo(b.balken.l, 0);
      });
    });
  }
}

test.describe('@ZM-215 Zeitbalken läuft herunter (1920×1080)', () => {
  test('3 von 9 Minuten gespielt: „6:00“ steht für sich, zwei Drittel gefüllt, links verankert, grün', async ({ page }) => {
    await oeffne(page, 'halle-laeuft', 1920, 1080, 5, { neunMinuten: true });
    await expect(page.getByTestId('hall-clock')).toHaveText(/^[56]:\d\d$/);
    await expect(page.getByText('Restzeit')).toHaveCount(0);
    const m = await messe(page);
    const b = m.balken!;
    const gefuellt = b.fuellung.w / b.balken.w;
    expect(gefuellt, `Füllanteil ${gefuellt.toFixed(3)} (Soll zwei Drittel, mit Lauf der Uhr etwas darunter)`).toBeGreaterThan(2 / 3 - 0.05);
    expect(gefuellt).toBeLessThan(2 / 3 + 0.01);
    expect(b.fuellung.l).toBeCloseTo(b.balken.l, 0);
    expect(b.ton).toBe('gruen');
  });

  test('Gegenbeispiel: angehalten wird die Füllung grau und bleibt stehen, nie rot', async ({ page }) => {
    await oeffne(page, 'halle-angehalten', 1920, 1080, 5);
    const m = await messe(page);
    expect(m.balken?.ton).toBe('grau');
    const [r, g, bl] = (m.balken?.fuellungFarbe.match(/\d+/g) ?? []).map(Number);
    expect(r > g + 40 && r > bl + 40, `Füllung ${m.balken?.fuellungFarbe} ist nicht rot`).toBe(false);
  });

  test('Gegenbeispiel: in der Schlussphase ist die Füllung violett, nie rot', async ({ page }) => {
    await oeffne(page, 'halle-laeuft', 1920, 1080, 5, { schlussphase: true });
    const m = await messe(page);
    expect(m.balken?.ton).toBe('violett');
    const [r, g, bl] = (m.balken?.fuellungFarbe.match(/\d+/g) ?? []).map(Number);
    expect(bl, `Füllung ${m.balken?.fuellungFarbe} hat Blauanteil`).toBeGreaterThan(g);
    expect(r > bl, 'nicht rot').toBe(false);
  });

  test('Gegenbeispiel: nach dem Ende und vor dem Anpfiff gibt es keinen Zeitbalken', async ({ page }) => {
    await oeffne(page, 'halle-vor', 1920, 1080, 5);
    await expect(page.getByTestId('hall-zeitbalken')).toHaveCount(0);
    await expect(page.getByTestId('hall-kickoff')).toBeVisible();
  });

  test('Bahn gegen Hintergrund und Füllung gegen Bahn (dunkles UND helles Thema): jeweils mindestens 3 : 1 für grün (läuft), grau (angehalten), violett (Schlussphase) und gedämpft (Pause)', async ({ browser, baseURL }) => {
    type Farbe = [number, number, number, number];
    const lies = (rgb: string): Farbe => { const m = (rgb.match(/[\d.]+/g) ?? []).map(Number); return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1]; };
    const lum = (c: Farbe): number => {
      const [r, g, b] = c.slice(0, 3).map((x) => { const q = x / 255; return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const verhaeltnis = (a: Farbe, b: Farbe): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    // Hintergrund des Themas: Anfang und Ende des Verlaufs der Folie
    const HINTERGRUND = { dark: ['rgb(30, 41, 59)', 'rgb(15, 23, 42)'], light: ['rgb(255, 255, 255)', 'rgb(226, 232, 240)'] } as const;
    const zustaende: Array<[string, SaatOptionen, string]> = [['halle-laeuft', {}, 'gruen'], ['halle-angehalten', {}, 'grau'], ['halle-laeuft', { schlussphase: true }, 'violett'], ['halle-halbzeit', {}, 'gedaempft']];
    for (const thema of ['dark', 'light'] as const) {
      for (const [fall, optionen, ton] of zustaende) {
        const b = (await messeInNeuemKontext(browser, baseURL, (seite) => oeffne(seite, fall, 1920, 1080, 5, { ...optionen, thema }))).balken;
        expect(b, `${fall}/${thema}: Balken vorhanden`).not.toBeNull();
        expect(b?.ton).toBe(ton);
        for (const hintergrund of HINTERGRUND[thema]) { expect(verhaeltnis(lies(b?.bahnFarbe ?? ''), lies(hintergrund)), `${thema}/${ton}: Bahn ${b?.bahnFarbe} gegen Hintergrund ${hintergrund}`).toBeGreaterThanOrEqual(3); }
        expect(verhaeltnis(lies(b?.fuellungFarbe ?? ''), lies(b?.bahnFarbe ?? '')), `${thema}/${ton}: Füllung ${b?.fuellungFarbe} gegen Bahn ${b?.bahnFarbe}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

/** Setzt die englischen Sprachwerte in die laufende Seite ein und löst das Einpassen aus (die Monitor-Sprache ist heute fest Deutsch). */
async function englisch(page: Page, texte: Record<string, string>): Promise<void> {
  await page.evaluate((t) => {
    for (const [id, text] of Object.entries(t)) {
      const e = document.querySelector(`[data-testid="${id}"]`);
      if (e !== null) { e.textContent = text; }
    }
    window.dispatchEvent(new Event('resize'));
  }, texte);
  await animationenFertig(page);
}

const mitte = (m: Messung): Rahmen => m.teile['hall-shootout-result'] ?? m.teile['hall-endstand'] ?? m.teile['hall-clock'];

for (const { w, h } of GROESSEN) {
  for (const rand of RAENDER) {
    test.describe(`@ZM-213 Englisch: der Text in der Mitte verdrängt die Seitenspalten nie, ${String(w)}×${String(h)}, Bildrand ${String(rand)} %`, () => {
      test('„4 : 3 on penalties“ nach Strafstoßschießen: überlappt weder „Ende“ noch Feld/Gruppe, nichts abgeschnitten', async ({ page }) => {
        const wort = enMonitor.liveMatch.hall.afterShootout.replace('{{home}}', '4').replace('{{away}}', '3').replace('$t(sport:phases.afterPenalties)', enSport.phases.afterPenalties);
        expect(wort).toBe('4 : 3 on penalties');
        await oeffneEnde(page, 'halle-ende-strafstoss', w, h, rand);
        await englisch(page, { 'hall-shootout-result': wort });
        const m = await messe(page);
        expect(await page.getByTestId('hall-shootout-result').textContent()).toBe(wort);
        pruefeUeberlappung(m);
        pruefeAbgeschnitten(m);
        // die Mitte lässt links und rechts Platz für die Seitenangaben
        expect(mitte(m).l, 'links neben der Mitte bleibt Platz').toBeGreaterThan(m.folie.l);
        expect(mitte(m).r, 'rechts neben der Mitte bleibt Platz').toBeLessThan(m.folie.r);
        // und die Namen und Torzahlen bleiben, wo sie waren
        for (const d of m.digits) { expect(anteil(d, m.H)).toBeGreaterThanOrEqual(34); }
      });

      test('„Final score“: nichts überlappt, nichts abgeschnitten', async ({ page }) => {
        await oeffneEnde(page, 'halle-ende', w, h, rand);
        await englisch(page, { 'hall-endstand': enMonitor.liveMatch.finalScore });
        const ende = await messe(page);
        expect(await page.getByTestId('hall-endstand').textContent()).toBe('Final score');
        pruefeUeberlappung(ende);
        pruefeAbgeschnitten(ende);
      });

      test('englisches Uhrband (Field, Group, 2nd half): nichts überlappt, nichts abgeschnitten', async ({ page }) => {
        await oeffne(page, 'halle-zwei-felder', w, h, rand);
        await englisch(page, { 'hall-field': 'Field 1', 'hall-group': 'Group A' });
        const laeuft = await messe(page);
        pruefeUeberlappung(laeuft);
        pruefeAbgeschnitten(laeuft);
        await oeffne(page, 'halle-abschnitt', w, h, rand);
        await englisch(page, { 'hall-section': '2nd half' });
        const abschnitt = await messe(page);
        pruefeUeberlappung(abschnitt);
        pruefeAbgeschnitten(abschnitt);
      });

      test('englisch mit Gruppe, Abschnitt und Wort zugleich („Group A“, „2nd half“, „Time up“; „Period 3 of 3“, „stopped“): nichts ragt in den Balken oder aus der Folie', async ({ page }) => {
        await oeffne(page, 'halle-voll', w, h, rand);
        await englisch(page, { 'hall-field': 'Field 1', 'hall-group': 'Group A', 'hall-section': enTournament.matchClock.section.secondHalf, 'hall-phase-text': enMonitor.liveMatch.clock.ended });
        const abgelaufen = await messe(page);
        pruefeUeberlappung(abgelaufen);
        pruefeAbgeschnitten(abgelaufen);
        await oeffne(page, 'halle-voll-3', w, h, rand);
        await englisch(page, { 'hall-field': 'Field 1', 'hall-group': 'Group A', 'hall-section': enTournament.matchClock.section.sectionOfN.replace('{{section}}', '3').replace('{{sections}}', '3'), 'hall-phase-text': enMonitor.liveMatch.clock.stopped });
        const angehalten = await messe(page);
        pruefeUeberlappung(angehalten);
        pruefeAbgeschnitten(angehalten);
      });
    });
  }
}

test.describe('@ZM-213 Abschnitt und @ZM-215 Wort/Feld/Gruppe am fertigen Bild (1920×1080)', () => {
  test('zwei Halbzeiten: rechts neben der Restzeit „2. Halbzeit“; ein Feld und eine Gruppe: weder Feld noch Gruppe, kein „Restzeit“', async ({ page }) => {
    await oeffne(page, 'halle-abschnitt', 1920, 1080, 5);
    await expect(page.getByTestId('hall-section')).toHaveText('2. Halbzeit');
    await expect(page.getByTestId('hall-field')).toHaveCount(0);
    await expect(page.getByText('Restzeit')).toHaveCount(0);
    const m = await messe(page);
    const abschnitt = m.teile[Object.keys(m.teile).find((k) => k.endsWith('hall-section')) ?? ''];
    const uhr = m.teile['hall-clock'];
    expect(abschnitt.l, 'der Abschnitt steht rechts neben der Restzeit').toBeGreaterThan(uhr.r);
  });

  test('Gegenbeispiel: bei einem Abschnitt steht kein Abschnitt; bei zwei Feldern und zwei Gruppen stehen Feld und Gruppe', async ({ page }) => {
    await oeffne(page, 'halle-laeuft', 1920, 1080, 5);
    await expect(page.getByTestId('hall-section')).toHaveCount(0);
    await oeffne(page, 'halle-zwei-felder', 1920, 1080, 5);
    await expect(page.getByTestId('hall-field')).toHaveText('Feld 1');
    await expect(page.getByTestId('hall-group')).toHaveText('Gruppe A');
  });
});

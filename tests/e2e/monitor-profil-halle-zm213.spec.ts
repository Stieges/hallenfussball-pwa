/**
 * Profil „Halle (sehr fern)“ am fertigen Bild (@ZM-213, @ZM-214, @ZM-215, @ZM-151; Regel T2-UI): gemessen an der echten Monitor-Seite (lokaler Stand, Saat `monitor-halle`,
 * keine Produktion) bei 1920×1080, 1280×720 und 1920×940, je mit Bildrand 0 und 5 %.
 * - Mindestanteile der Höhe der Folienfläche: Torzahl ≥ 34 %, Restzeit ≥ 26 % (nach @ZM-215 über 29,3 %), Namen je Beispielzeile (20 / 15 / 12,5 / 7,5 %)
 * - nichts überlappt (Begrenzungsrahmen von Namen, Torzahlen, Uhrband-Teilen), nichts abgeschnitten (Namen, Uhrband innerhalb der Folie)
 * - Torzahl in jedem Zustand an derselben Stelle (@ZM-151)
 * - Zeitbalken mindestens 6 % der Höhe, läuft wie die Restzeit herunter (links verankert: 3 von 9 Minuten gespielt → zwei Drittel gefüllt), Bahn sichtbar
 * - Symbole statt Wörter im Uhrband (Daniel 2026-11-19, @ZM-215); Seitenschrift in jeder Lage mindestens 7,08 % der Bildschirmhöhe, die Notlösung nie unter 5,5 % (@ZM-213)
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
const enMonitor = lies<{ liveMatch: { finalScore: string; hall: { afterShootout: string } } }>('monitor.json');
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
  /** `data-schrift` der Seitenspalten (verkleinert | notloesung | leer) und Höhe des Fensters */
  seitenArt: Array<string | null>;
  fensterH: number;
  names: { text: string; px: number; rahmen: Rahmen; scrollW: number; clientW: number; feld: Rahmen; flaeche: Rahmen }[];
  teile: Record<string, Rahmen>;
  balken: { balken: Rahmen; fuellung: Rahmen; anteil: string | null; ton: string | null; fuellungFarbe: string; bahnFarbe: string; hintergrund: { bild: string; fläche: Rahmen } } | null;
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
  /** Zeit abgelaufen: nach dem Laden läuft die Uhr der Seite (`page.clock`) über das Ende des Abschnitts hinaus, ohne dass abgepfiffen wird */
  abgelaufen?: boolean;
  /** Thema des Monitors */
  thema?: 'dark' | 'light';
  /** Verlängerung läuft (Restzeit 4:00) */
  verlaengerung?: boolean;
  /** Drittes von drei Abschnitten läuft (Abschnitt zu 400 s, 190 s gespielt); mit `abgelaufen` läuft die Zeit des Abschnitts ab, ohne dass abgepfiffen wird */
  dreiAbschnitte?: boolean;
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
    // angehalten steht die gespielte Zeit des Spiels in `elapsedMs`, der aktuelle Abschnitt beginnt bei `sectionStartMs`
    const gespielt = (1200 - optionen.rest) * 1000;
    const abschnittStart = Number(live.sectionStartMs ?? 0);
    Object.assign(live, { sectionSeconds: 1200, durationSeconds: 1200, elapsedMs: live.status === 'paused' ? abschnittStart + gespielt : 0, ...(live.status === 'paused' ? {} : { anchorAt: `@jetzt-ms-${String(gespielt)}` }) });
  }
  if (optionen.dreiAbschnitte === true) {
    Object.assign(live, { section: 3, sections: 3, sectionSeconds: 400, durationSeconds: 1200, elapsedMs: 800000, sectionStartMs: 800000, anchorAt: '@jetzt-ms-190000' });
  }
  if (optionen.verlaengerung === true) {
    Object.assign(live, { phase: 'overtime', playPhase: 'overtime', section: 2, sections: 1, overtimeSeconds: 300, sectionSeconds: 1200, elapsedMs: 0, anchorAt: '@jetzt-ms-60000' });
  }
  return saat;
}

/** Je Kontext und Inhalt nur ein Saat-Skript: `installiereSaat` hängt je Aufruf ein weiteres Init-Skript an, das bei jedem späteren Laden mitläuft. */
const INSTALLIERT = new WeakMap<object, Set<string>>();
async function saatEinmal(page: Page, saat: SaatDatei): Promise<void> {
  const kontext = page.context();
  const schluessel = JSON.stringify(saat);
  const schon = INSTALLIERT.get(kontext) ?? new Set<string>();
  if (schon.has(schluessel)) { return; }
  await installiereSaat(kontext, saat);
  INSTALLIERT.set(kontext, schon.add(schluessel));
}

async function oeffne(page: Page, fall: string, w: number, h: number, rand: number, optionen: Parameters<typeof saatFuer>[1] = {}, monitor = 'mon-halle'): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await saatEinmal(page, saatFuer(fall, optionen));
  // Ein Wechsel nur der Adresse nach „#“ lädt nicht neu: die Namen der Seite davor würden als „eingepasst“ gelten, während die Seite schon auf das nächste Spiel umschaltet
  // (in der CI gemessen: 0,8 px Unterschied der Namen). Über eine leere Seite wird jeder Fall frisch geladen.
  if (page.url() !== 'about:blank') { await page.goto('about:blank'); }
  await page.goto(`/#/display/${fall}/${monitor}?rand=${String(rand)}`);
  await expect(page.locator('[data-testid="hall-display"], [data-testid="live-slide-area"]').first()).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
  await namenEingepasst(page);
  if (optionen.abgelaufen === true) {
    // Die Uhr der Seite folgt der Rechnerzeit: nach dem Einpassen der Namen läuft sie (nur die Seitenuhr, `page.clock`) über das Ende des Abschnitts hinaus
    await page.clock.install({ time: await page.evaluate(() => Date.now()) });
    await page.clock.fastForward(8 * 60 * 1000);
    await page.clock.runFor(3000);
    // @ZM-215 (Daniel 2026-11-19): „Zeit abgelaufen“ steht als Pfeife mit dem Wort als zugänglichem Namen
    await expect(page.getByTestId('hall-phase-text').getByRole('img', { name: 'Zeit abgelaufen' }), 'Zeit abgelaufen steht wirklich am Bild').toBeVisible();
  }
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
      seitenArt: ['hall-side-left', 'hall-side-right'].map((id) => q(id)?.getAttribute('data-schrift') ?? null),
      fensterH: window.innerHeight,
      names: ['home', 'away'].map((s) => {
        const e = q(`hall-teamname-${s}`);
        if (e === null) { throw new Error('Name fehlt'); }
        return { text: e.textContent ?? '', px: parseFloat(getComputedStyle(e).fontSize), rahmen: rahmen(e), scrollW: e.scrollWidth, clientW: e.clientWidth, feld: rahmen(q(`hall-name-${s}`), `hall-name-${s}`), flaeche: rahmen(q(`hall-panel-${s}`), `hall-panel-${s}`) };
      }),
      teile,
      balken: balken === null || fuellung === null ? null : {
        balken: rahmen(balken), fuellung: rahmen(fuellung), anteil: balken.getAttribute('data-anteil'), ton: balken.getAttribute('data-ton'),
        fuellungFarbe: getComputedStyle(fuellung).backgroundColor, bahnFarbe: getComputedStyle(balken).backgroundColor,
        // der Verlauf des Themas liegt auf der Fläche der Folie (nächster Vorfahre mit Verlauf): daran wird der Hintergrund AN DER STELLE DES BALKENS bestimmt
        hintergrund: (() => {
          let a: Element | null = balken.parentElement;
          while (a !== null && !getComputedStyle(a).backgroundImage.startsWith('linear-gradient')) { a = a.parentElement; }
          return { bild: a === null ? '' : getComputedStyle(a).backgroundImage, fläche: rahmen(a ?? document.body) };
        })(),
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

/**
 * Die Seitenangaben bleiben Nah-Information: mindestens 7,08 % der BILDSCHIRMhöhe (@ZM-213, 12 Bogenminuten aus 10 m), auch mit Bildrand. Nur als gekennzeichnete
 * Notlösung (`data-schrift="notloesung"`, eine Lage, in der die Zeilen auch verkleinert nicht in das Uhrband passen) darf sie darunter liegen, nie unter der Zahl aus dem
 * Gherkin von @ZM-213: 5,5 % der BILDSCHIRMhöhe (Review PR #563 B1: bisher prüfte die Spec die 5,6 % der Folie aus dem Token). Mit den Symbolen statt Text (@ZM-215, Daniel 2026-11-19)
 * braucht keine Lage die Notlösung mehr; `notloesungErlaubt` ist deshalb in allen Aufrufen aus.
 */
function pruefeSeitenschrift(m: Messung, notloesungErlaubt = false): void {
  m.seitenPx.forEach((px, i) => {
    const anteilBildschirm = (px / m.fensterH) * 100;
    if (m.seitenArt[i] === 'notloesung') {
      expect(notloesungErlaubt, `Notlösung der Seitenschrift in einem Fall, der sie nicht braucht (${anteilBildschirm.toFixed(2)} %)`).toBe(true);
      expect(anteilBildschirm, 'Notlösung nie unter 5,5 % der Bildschirmhöhe (@ZM-213)').toBeGreaterThanOrEqual(5.5 - 0.02);
    } else {
      expect(anteilBildschirm, 'Schrift der Seitenangaben in % der Bildschirmhöhe').toBeGreaterThanOrEqual(7.08 - 0.02);
    }
  });
}

/** Alle erwarteten Angaben stehen sichtbar da (nichts fällt still weg, nichts hat die Fläche 0). */
function pruefeSichtbar(m: Messung, erwartet: readonly string[]): void {
  for (const id of erwartet) {
    const schluessel = Object.keys(m.teile).find((k) => k.endsWith(id));
    expect(schluessel, `„${id}“ ist sichtbar (nicht ausgeblendet)`).toBeDefined();
    const r = m.teile[schluessel ?? ''];
    expect(r.w * r.h, `„${id}“ hat eine Fläche`).toBeGreaterThan(0);
  }
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

      test('@ZM-213 nichts überlappt, nichts ist abgeschnitten, Seitenschrift ≥ 7,08 % des Bildschirms: läuft, 25-Zeichen-Namen, zweistellig, zwei Felder, Abschnitt, vor dem Anpfiff, Halbzeit, angehalten', async ({ page }) => {
        // Fälle ohne Abwandlung teilen sich eine Seite und eine Saat; jeder Fall lädt über eine leere Seite neu (siehe `oeffne`)
        for (const fall of ['halle-laeuft', 'halle-lang25', 'halle-zweistellig', 'halle-zwei-felder', 'halle-abschnitt', 'halle-angehalten', 'halle-halbzeit', 'halle-vor']) {
          await oeffne(page, fall, w, h, rand);
          const m = await messe(page);
          pruefeUeberlappung(m);
          pruefeAbgeschnitten(m);
          pruefeSeitenschrift(m);
        }
      });

      test('@ZM-213 Lagen mit Feld, Gruppe, Abschnitt und Symbol: alle Angaben sichtbar, nichts überlappt, Seitenschrift ohne Notlösung (≥ 7,08 %); „Zeit abgelaufen“, „Abschnitt 3 von 3“, zweistellige Minuten, Verlängerung', async ({ browser, baseURL }) => {
        test.setTimeout(120000);
        interface Lage { fall: string; optionen: SaatOptionen; sichtbar: string[] }
        const lagen: Lage[] = [
          { fall: 'halle-voll', optionen: {}, sichtbar: ['hall-field', 'hall-group', 'hall-section'] },
          { fall: 'halle-voll', optionen: { abgelaufen: true }, sichtbar: ['hall-field', 'hall-group', 'hall-section', 'hall-phase-text'] },
          { fall: 'halle-voll-3', optionen: {}, sichtbar: ['hall-field', 'hall-group', 'hall-section', 'hall-phase-text'] },
          { fall: 'halle-voll-3', optionen: { rest: 1080 }, sichtbar: ['hall-field', 'hall-group', 'hall-section', 'hall-phase-text'] },
          // N14 (Review PR #563 B1): drei Abschnitte, Gruppe, Feld und „Zeit abgelaufen“ zugleich – mit Symbolen steht jede Angabe in einer Zeile, die Untergrenze 5,5 % aus @ZM-213 gilt ohne Notlösung
          { fall: 'halle-voll', optionen: { dreiAbschnitte: true, abgelaufen: true }, sichtbar: ['hall-field', 'hall-group', 'hall-section', 'hall-phase-text'] },
          { fall: 'halle-laeuft', optionen: { zehnMinuten: true }, sichtbar: [] },
          { fall: 'halle-laeuft', optionen: { verlaengerung: true }, sichtbar: ['hall-phase-text'] },
        ];
        // je Lage ein eigener Kontext: eine Abwandlung der Saat greift nur beim Neuladen
        for (const { fall, optionen, sichtbar } of lagen) {
          const m = await messeInNeuemKontext(browser, baseURL ?? undefined, async (seite) => {
            await oeffne(seite, fall, w, h, rand, optionen);
            // die Zustände sind wirklich da (kein stilles Ausweichen auf „läuft“)
            // @ZM-215 (Daniel 2026-11-19): die Verlängerung steht nur an der Uhr (Kreis mit Plus), das Abzeichen bleibt „Live“
            if (optionen.verlaengerung === true) {
              await expect(seite.getByTestId('hall-phase-text').getByRole('img', { name: 'Verlängerung' })).toBeVisible();
              await expect(seite.getByTestId('match-status-badge')).toHaveText('Live');
            }
            if (optionen.zehnMinuten === true) { await expect(seite.getByTestId('hall-clock')).toHaveText(/^\d\d:\d\d$/); }
            if (optionen.rest !== undefined) { await expect(seite.getByTestId('hall-clock')).toHaveText('18:00'); }
            if (optionen.dreiAbschnitte === true) { await expect(seite.getByTestId('hall-section')).toHaveAttribute('aria-label', 'Abschnitt 3 von 3'); }
          });
          pruefeSichtbar(m, sichtbar);
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

  test('Bahn gegen Hintergrund und Füllung gegen Bahn (dunkles UND helles Thema): Füllung gegen Bahn mindestens 3 : 1 für grün (läuft), grau (angehalten), violett (Schlussphase) und gedämpft (Pause), Bahn gegen den Hintergrund an der Stelle des Balkens dunkel 2,9 : 1, hell 2,0 : 1', async ({ browser, baseURL }) => {
    type Farbe = [number, number, number, number];
    const lies = (rgb: string): Farbe => { const m = (rgb.match(/[\d.]+/g) ?? []).map(Number); return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1]; };
    const lum = (c: Farbe): number => {
      const [r, g, b] = c.slice(0, 3).map((x) => { const q = x / 255; return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const verhaeltnis = (a: Farbe, b: Farbe): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    // Hintergrund an der Stelle des Balkens: der senkrechte Verlauf des Themas (zwei Farbstopps) an der Ober- und Unterkante des Balkens
    const hintergrundAn = (b: NonNullable<Messung['balken']>, kante: 't' | 'b'): Farbe => {
      const stopps = (b.hintergrund.bild.match(/rgba?\([^)]*\)/g) ?? []).map(lies);
      const y = kante === 't' ? b.balken.t : b.balken.b;
      const f = Math.min(1, Math.max(0, (y - b.hintergrund.fläche.t) / b.hintergrund.fläche.h));
      const [von, bis] = [stopps[0] ?? [0, 0, 0, 1], stopps[1] ?? [0, 0, 0, 1]];
      return [0, 1, 2, 3].map((i) => von[i] * (1 - f) + bis[i] * f) as unknown as Farbe;
    };
    const zustaende: Array<[string, SaatOptionen, string]> = [['halle-laeuft', {}, 'gruen'], ['halle-angehalten', {}, 'grau'], ['halle-laeuft', { schlussphase: true }, 'violett'], ['halle-halbzeit', {}, 'gedaempft']];
    for (const thema of ['dark', 'light'] as const) {
      for (const [fall, optionen, ton] of zustaende) {
        const b = (await messeInNeuemKontext(browser, baseURL, (seite) => oeffne(seite, fall, 1920, 1080, 5, { ...optionen, thema }))).balken;
        expect(b, `${fall}/${thema}: Balken vorhanden`).not.toBeNull();
        expect(b?.ton).toBe(ton);
        for (const kante of ['t', 'b'] as const) {
          const hintergrund = hintergrundAn(b!, kante);
          expect(verhaeltnis(lies(b?.bahnFarbe ?? ''), hintergrund), `${thema}/${ton}: Bahn ${b?.bahnFarbe} gegen Hintergrund ${hintergrund.map(Math.round).join(',')} (${kante === 't' ? 'Oberkante' : 'Unterkante'} des Balkens)`).toBeGreaterThanOrEqual(thema === 'dark' ? 2.9 : 2.0);
        }
        // hell: die Füllung ist der kräftige (dunklere) Teil, die Bahn der blassere; dunkel umgekehrt
        expect(lum(lies(b?.fuellungFarbe ?? '')) < lum(lies(b?.bahnFarbe ?? '')), `${thema}/${ton}: Füllung ${thema === 'light' ? 'dunkler' : 'heller'} als die Bahn`).toBe(thema === 'light');
        expect(verhaeltnis(lies(b?.fuellungFarbe ?? ''), lies(b?.bahnFarbe ?? '')), `${thema}/${ton}: Füllung ${b?.fuellungFarbe} gegen Bahn ${b?.bahnFarbe}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

/** Setzt die englischen Sprachwerte in die laufende Seite ein und löst das Einpassen aus (die Monitor-Sprache ist heute fest Deutsch). */
async function englisch(page: Page, texte: Record<string, string>): Promise<void> {
  const fehlend = await page.evaluate((t) => {
    const fehlt: string[] = [];
    for (const [id, text] of Object.entries(t)) {
      const e = document.querySelector(`[data-testid="${id}"]`);
      if (e === null) { fehlt.push(id); } else { e.textContent = text; }
    }
    window.dispatchEvent(new Event('resize'));
    return fehlt;
  }, texte);
  // kein stilles Überspringen: ein Text für ein Element, das es im Fall nicht gibt, ist ein Fehler der Spec
  expect(fehlend, 'alle Elemente, deren Text ersetzt wird, stehen im Fall da').toEqual([]);
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

      // Seit @ZM-215 (Daniel 2026-11-19: Symbole statt Text) stehen im Uhrband keine Wörter mehr: Feld, Gruppe, Abschnitt und Uhr-Zustand sind Symbole, die Sprache ändert ihre Größe nicht.
      // Die englischen Wörter stehen nur noch in den zugänglichen Namen (Vorlesetext), nicht im Bild.
      test('Uhrband mit Symbolen (Feld, Gruppe, Abschnitt, Zustand): sprachunabhängig, nichts überlappt, nichts abgeschnitten, Seitenschrift ≥ 7,08 %', async ({ browser, baseURL }) => {
        const erwartet = ['hall-field', 'hall-group', 'hall-section', 'hall-phase-text'];
        const abgelaufen = await messeInNeuemKontext(browser, baseURL ?? undefined, async (seite) => {
          await oeffne(seite, 'halle-voll', w, h, rand, { abgelaufen: true });
          await expect(seite.getByTestId('hall-side-right').getByText(/Group|Gruppe|half|Halbzeit|Zeit abgelaufen/)).toHaveCount(0); // kein Wort im Bild
        });
        pruefeSichtbar(abgelaufen, erwartet);
        pruefeUeberlappung(abgelaufen);
        pruefeAbgeschnitten(abgelaufen);
        pruefeSeitenschrift(abgelaufen);
        const angehalten = await messeInNeuemKontext(browser, baseURL ?? undefined, async (seite) => { await oeffne(seite, 'halle-voll-3', w, h, rand); });
        pruefeSichtbar(angehalten, erwartet);
        pruefeUeberlappung(angehalten);
        pruefeAbgeschnitten(angehalten);
        pruefeSeitenschrift(angehalten);
      });
    });
  }
}

test.describe('@ZM-213 Abschnitt und @ZM-215 Wort/Feld/Gruppe am fertigen Bild (1920×1080)', () => {
  test('zwei Halbzeiten: rechts neben der Restzeit zwei gefüllte Punkte („2. Halbzeit“ als Name); ein Feld und eine Gruppe: weder Feld noch Gruppe, kein „Restzeit“', async ({ page }) => {
    await oeffne(page, 'halle-abschnitt', 1920, 1080, 5);
    await expect(page.getByTestId('hall-section')).toHaveAttribute('aria-label', '2. Halbzeit');
    await expect(page.getByTestId('hall-section')).toHaveText('');
    await expect(page.getByTestId('hall-section').locator('[data-gefuellt="ja"]')).toHaveCount(2);
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
    await expect(page.getByTestId('hall-field')).toHaveAttribute('aria-label', 'Feld 1'); // @ZM-215: Spielfeld-Symbol mit der Nummer 1
    await expect(page.getByTestId('hall-field')).toHaveText('1');
    await expect(page.getByTestId('hall-group')).toHaveAttribute('aria-label', 'Gruppe A'); // Buchstabe im Kasten
    await expect(page.getByTestId('hall-group')).toHaveText('A');
  });
});

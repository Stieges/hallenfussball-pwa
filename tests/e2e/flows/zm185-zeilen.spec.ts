/**
 * @ZM-185 Zeilen der Monitor-Folien: jedes Logo an einem festen Platz, kein Teamname bricht mitten im Wort (Nikolaus-Turnier, 1920×1080).
 * @ZM-157 (Monitor) Logo bzw. Initialen mittig über dem Namen, direkt unter dem Kasten – Live-Folie und Endstand.
 *
 * Gemessen wird am gerenderten Bild (Bounding-Boxen, Textläufe), nicht am Quelltext. Gegenbeispiele: Team ohne Logo (Initialen im gleich großen
 * Kreis an derselben Stelle), breites und hohes Schild (ganz im Kreis), Turnier ohne K.-o. (schmale Abzeichen-Spalte).
 * Bilder: Ordner aus ZM185_BILDER. Läuft nur im Projekt `desktop`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { NIKOLAUS, MIT_KO, TEAMS, nikolausTurnier, saeen, oeffneMonitor } from './zm185-helfer';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.ZM185_BILDER;
const FULL_HD = { width: 1920, height: 1080 };
const TOL = 1.5;
/** Das lange Wort der Probe: „Sportgemeinschaft“ kürzt der Monitor zu „SG“ (Kürzungsliste), darum ein Wort, das nicht gekürzt wird */
const LANGWORT = 'Fußballgemeinschaft';

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

interface R { l: number; t: number; r: number; b: number; cx: number; cy: number; w: number; h: number }
interface Seite {
  avatar: R; name: R; text: R | null; hatBild: boolean; initialen: string; wortInEinerZeile: boolean | null; ellipse: boolean;
  bild: { box: R; natW: number; natH: number } | null;
}
interface Zeile { id: string; status: R | null; sep: R; row: R; home: Seite; away: Seite }

/** Misst alle Zeilen der Folie: Rechtecke von Abzeichen, Trenner, Avataren, Namen und Textlauf, das lange Wort in einer Zeile? */
async function messeZeilen(page: Page): Promise<Zeile[]> {
  return page.evaluate((langwort) => {
    const rect = (el: Element): R => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width, h: b.height }; };
    const seite = (row: Element, side: string): Seite => {
      const wurzel = row.querySelector(`[data-testid="monitor-match-team-${side}"]`)!;
      const avatar = wurzel.querySelector(`[data-testid="monitor-match-team-${side}-avatar"]`)!;
      const name = wurzel.querySelector('[data-teamname]')!;
      const knoten = name.firstChild!;
      const lauf = document.createRange(); lauf.selectNodeContents(knoten);
      const laeufe = Array.from(lauf.getClientRects());
      const text = laeufe.length > 0 ? { l: Math.min(...laeufe.map((x) => x.left)), t: Math.min(...laeufe.map((x) => x.top)), r: Math.max(...laeufe.map((x) => x.right)), b: Math.max(...laeufe.map((x) => x.bottom)) } : null;
      const inhalt = knoten.textContent ?? '';
      const start = inhalt.indexOf(langwort);
      let wortInEinerZeile: boolean | null = null;
      if (start >= 0) {
        const wort = document.createRange(); wort.setStart(knoten, start); wort.setEnd(knoten, start + langwort.length);
        wortInEinerZeile = new Set(Array.from(wort.getClientRects()).map((x) => Math.round(x.top))).size === 1;
      }
      const img = avatar.querySelector('img');
      return {
        avatar: rect(avatar), name: rect(name),
        text: text === null ? null : { ...text, cx: (text.l + text.r) / 2, cy: (text.t + text.b) / 2, w: text.r - text.l, h: text.b - text.t },
        hatBild: img !== null && getComputedStyle(img).opacity !== '0',
        initialen: avatar.querySelector('[data-initialen]')?.textContent ?? '',
        wortInEinerZeile, ellipse: inhalt.includes('…') || getComputedStyle(name).textOverflow === 'ellipsis',
        bild: img === null ? null : { box: rect(img), natW: img.naturalWidth, natH: img.naturalHeight },
      };
    };
    return Array.from(document.querySelectorAll('[data-testid="monitor-match-row"]')).map((row) => ({
      id: row.getAttribute('data-match-id') ?? '',
      status: row.querySelector('[data-testid="monitor-match-status"]') ? rect(row.querySelector('[data-testid="monitor-match-status"]')!) : null,
      sep: rect(row.querySelector('[data-testid="monitor-match-separator"]')!), row: rect(row),
      home: seite(row, 'home'), away: seite(row, 'away'),
    }));
  }, LANGWORT);
}

const alleSeiten = (z: Zeile[]) => z.flatMap((x) => [x.home, x.away]);
const gleich = (werte: number[], tol = TOL) => Math.max(...werte) - Math.min(...werte) <= tol;

/** Liegt das eingepasste Bild (Seitenverhältnis erhalten) mit allen vier Ecken im Kreis des Avatars? */
function bildGanzImKreis(s: Seite): { ok: boolean; abstand: number; radius: number } {
  const b = s.bild!;
  const massstab = Math.min(b.box.w / b.natW, b.box.h / b.natH);
  const hw = (b.natW * massstab) / 2;
  const hh = (b.natH * massstab) / 2;
  const abstand = Math.hypot(hw, hh) + Math.hypot(b.box.cx - s.avatar.cx, b.box.cy - s.avatar.cy);
  const radius = s.avatar.w / 2;
  return { ok: abstand <= radius + 0.5, abstand, radius };
}

/** Wortbruch- und Ellipsen-Prüfung für alle Namen, die das lange Wort tragen */
function keinWortbruch(z: Zeile[]) {
  const betroffen = alleSeiten(z).filter((s) => s.wortInEinerZeile !== null);
  expect(betroffen.length, 'mindestens eine Zeile mit dem langen Wort').toBeGreaterThan(0);
  for (const s of betroffen) { expect(s.wortInEinerZeile, 'langes Wort in einer Zeile').toBe(true); }
  for (const s of alleSeiten(z)) { expect(s.ellipse, 'kein „…“').toBe(false); }
}

/** Abzeichen-Wörter beider Sprachen je Zustand */
const WOERTER = (['de', 'en'] as const).flatMap((l) => Object.entries((JSON.parse(readFileSync(`src/i18n/locales/${l}/tournament.json`, 'utf8')) as { matchBadge: Record<string, string> }).matchBadge).map(([zustand, wort]) => ({ l, zustand, wort })));
const MIT_PAUSENSYMBOL = new Set(['pause', 'halftime']);

/**
 * Passt jedes Wort der Zustandsmenge in die Spalte? Probe an einer Kopie des echten Abzeichens, die das echte ersetzt: die Zelle darf nicht
 * wachsen (sonst rutschten die Kästen dieser Zeile, @ZM-151) und der Inhalt liegt innerhalb des Polsters (scrollWidth erfasst den Überlauf
 * einer zentrierten Zeile nach links nicht).
 */
async function wortPasst(page: Page, zustaende: string[]): Promise<Array<{ l: string; zustand: string; wort: string; passt: boolean }>> {
  const wahl = WOERTER.filter((w) => zustaende.includes(w.zustand));
  return page.evaluate((woerter) => {
    const zelle = document.querySelector<HTMLElement>('[data-testid="monitor-match-status"]')!;
    const vorlage = zelle.firstElementChild as HTMLElement;
    const breite = zelle.getBoundingClientRect().width;
    return woerter.map((w) => {
      const k = vorlage.cloneNode(true) as HTMLElement;
      k.replaceChildren();
      if (w.pausenSymbol) { const g = document.createElement('span'); g.style.cssText = 'display:inline-block;width:1em;height:1em'; k.appendChild(g); }
      k.appendChild(document.createTextNode(w.wort));
      vorlage.style.display = 'none';
      zelle.appendChild(k);
      const lauf = document.createRange(); lauf.selectNodeContents(k);
      const inhalt = lauf.getBoundingClientRect();
      const aussen = k.getBoundingClientRect();
      const cs = getComputedStyle(k);
      const passt = Math.abs(zelle.getBoundingClientRect().width - breite) <= 0.5
        && inhalt.left >= aussen.left + parseFloat(cs.paddingLeft) - 0.5 && inhalt.right <= aussen.right - parseFloat(cs.paddingRight) + 0.5;
      k.remove();
      vorlage.style.display = '';
      return { l: w.l, zustand: w.zustand, wort: w.wort, passt };
    });
  }, wahl.map((w) => ({ ...w, pausenSymbol: MIT_PAUSENSYMBOL.has(w.zustand) })));
}

const GRUPPE = ['live', 'pause', 'halftime', 'ended', 'cancelled'];
const ALLE = [...GRUPPE, 'overtime', 'shootout'];

test.describe('@ZM-185 Spielplan eines Felds (Nikolaus-Turnier, 1920×1080)', () => {
  test.use({ viewport: FULL_HD });
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });

  test('@ZM-185 Logo jedes Teams mittig über dem Namen, in jeder Zeile an derselben Stelle; Initialen im gleich großen Kreis', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    await bild(page, 'plan-feld-seite1');
    const zeilen = await messeZeilen(page);
    expect(zeilen).toHaveLength(4);
    for (const s of alleSeiten(zeilen)) {
      const mitte = s.text!.cx;
      expect(Math.abs(s.avatar.cx - mitte), 'Avatar mittig zum Namen').toBeLessThanOrEqual(TOL);
      expect(s.avatar.b, 'Avatar über dem Namen').toBeLessThanOrEqual(s.text!.t + 1);
    }
    expect(gleich(zeilen.map((z) => z.home.avatar.cx)), 'Heim-Avatar in jeder Zeile an derselben Stelle').toBe(true);
    expect(gleich(zeilen.map((z) => z.away.avatar.cx)), 'Gast-Avatar in jeder Zeile an derselben Stelle').toBe(true);
    expect(gleich(zeilen.map((z) => z.home.avatar.t - z.row.t)), 'Avatar-Höhe in der Zeile gleich').toBe(true);
    expect(gleich(alleSeiten(zeilen).map((s) => s.avatar.w), 0.5), 'alle Avatare gleich groß (Logo und Initialen)').toBe(true);
    const ohneLogo = alleSeiten(zeilen).filter((s) => !s.hatBild);
    expect(ohneLogo.length, 'Initialen kommen vor').toBeGreaterThan(0);
    for (const s of ohneLogo) { expect(s.initialen.length).toBeGreaterThan(0); }
  });

  test('@ZM-185 Logo ganz im Kreis: breites und hohes Schild, keine Ecke und keine Spitze abgeschnitten', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    const mitBild = alleSeiten(await messeZeilen(page)).filter((s) => s.bild !== null && s.bild.natW > 0);
    expect(new Set(mitBild.map((s) => Math.sign(s.bild!.natW - s.bild!.natH))).size, 'breit und hoch kommen vor').toBe(2);
    for (const s of mitBild) {
      const r = bildGanzImKreis(s);
      expect(r.ok, `Bild-Ecke ${r.abstand.toFixed(1)} px vom Mittelpunkt, Kreis ${r.radius.toFixed(1)} px`).toBe(true);
    }
  });

  test('@ZM-185 das lange Wort („Sportgemeinschaft“-Fall) steht in einer Zeile, ohne Trennung mitten im Wort und ohne „…“', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    keinWortbruch(await messeZeilen(page));
  });

  test('@ZM-185 4 Spiele je Seite: 15 Spiele ergeben „Seite 1 / 4“ bis „Seite 4 / 4“, die letzte Seite zeigt 3', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await page.clock.install();
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    const ids: string[] = [];
    for (let seite = 1; seite <= 4; seite += 1) {
      await expect(page.getByText(`Seite ${seite} / 4`)).toBeVisible();
      const zeilen = await messeZeilen(page);
      expect(zeilen).toHaveLength(seite < 4 ? 4 : 3);
      ids.push(...zeilen.map((z) => z.id));
      if (seite < 4) { await page.clock.runFor(60_000); }
    }
    expect(new Set(ids).size, 'jedes Spiel auf genau einer Seite').toBe(15);
  });

  test('@ZM-185 @ZM-151 Abzeichen-Spalte ohne K.-o.: gleich breit in jeder Zeile und auf allen Seiten, jedes mögliche Wort (de, en) passt', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await page.clock.install();
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    const erste = await messeZeilen(page);
    const spalte = erste.map((z) => z.status!);
    expect(gleich(spalte.map((s) => s.w), 0.5) && gleich(spalte.map((s) => s.l), 0.5), 'Spalte in jeder Zeile gleich').toBe(true);
    expect(gleich(erste.map((z) => z.sep.cx)), 'Kästen an derselben Stelle').toBe(true);
    for (const r of await wortPasst(page, GRUPPE)) { expect(r.passt, `„${r.wort}“ (${r.l}) passt in die Spalte`).toBe(true); }
    await page.clock.runFor(180_000);
    await expect(page.getByText('Seite 4 / 4')).toBeVisible();
    const letzte = await messeZeilen(page);
    expect(Math.abs(letzte[0].status!.w - spalte[0].w), 'Seite 4 gleich breit wie Seite 1').toBeLessThanOrEqual(0.5);
    expect(Math.abs(letzte[0].sep.cx - erste[0].sep.cx), 'Kästen auf Seite 4 an derselben Stelle').toBeLessThanOrEqual(TOL);
  });

  test('@ZM-185 Gegenbeispiel mit K.-o.-Spielen: Spalte fasst „Strafstoßschießen“ und „Extra time“, und ist breiter als ohne K.-o.', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    const ohne = (await messeZeilen(page))[0].status!.w;
    await oeffneMonitor(page, MIT_KO, 'mon-plan');
    const mit = (await messeZeilen(page))[0].status!.w;
    expect(mit, 'mit K.-o. breiter').toBeGreaterThan(ohne + 20);
    for (const r of await wortPasst(page, ALLE)) { expect(r.passt, `„${r.wort}“ (${r.l}) passt in die Spalte`).toBe(true); }
  });
});

test.describe('@ZM-185 Spielplan eines Felds mit langen Namen: bis zu 4, hier 3 Spiele je Seite', () => {
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });
  const LANG = [{ name: 'Eintracht Oberweiler-Niederstetten 1919' }, ...TEAMS.slice(1)];
  const AUFLOESUNGEN = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 960, height: 540 }] as const;

  for (const aufloesung of AUFLOESUNGEN) {
    test(`@ZM-185 Name über zwei Zeilen: 3 Spiele je Seite (15 Spiele: „Seite 1 / 5“), auch mit 4-zeiligen Namen nichts unter dem Bildrand (${aufloesung.width}×${aufloesung.height})`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize(aufloesung);
      await seedIndexedDB({ tournaments: [nikolausTurnier('z185-lang', { theme: 'dark', beendet: 2, teams: LANG })] });
      await oeffneMonitor(page, 'z185-lang', 'mon-plan');
      await expect(page.getByText('Seite 1 / 5')).toBeVisible();
      const zeilen = await messeZeilen(page);
      expect(zeilen).toHaveLength(3);
      // Langtext-Lage des Messwerkzeugs: jeder Name 50 Zeichen (vier Zeilen) – die drei Zeilen bleiben im Bild (Rand 5 %)
      await page.evaluate(() => document.querySelectorAll('[data-teamname]').forEach((e) => { e.textContent = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921'; }));
      await page.waitForTimeout(300);
      const unten = await page.evaluate(() => {
        const letzte = Array.from(document.querySelectorAll('[data-testid="monitor-match-row"]')).pop()!.getBoundingClientRect().bottom;
        const hinweis = Array.from(document.querySelectorAll('[data-testid="monitor-slide"] *')).filter((el) => /^Seite \d+ \/ \d+$/.test(el.textContent ?? '') && el.children.length === 0).pop();
        return { letzte, hinweis: hinweis?.getBoundingClientRect().bottom ?? 0, hoehe: window.innerHeight };
      });
      expect(unten.letzte, 'letzte Zeile über dem unteren Bildrand (5 %)').toBeLessThanOrEqual(unten.hoehe * 0.95);
      expect(unten.hinweis, 'Seitenhinweis über dem unteren Bildrand (5 %)').toBeLessThanOrEqual(unten.hoehe * 0.95 + 1);
    });
  }

  test('@ZM-185 Gegenbeispiel: normale Namen (Nikolaus) bleiben bei 4 Spielen je Seite, „Seite 1 / 4“', async ({ page, seedIndexedDB }) => {
    await page.setViewportSize(FULL_HD);
    await saeen(seedIndexedDB);
    await oeffneMonitor(page, NIKOLAUS, 'mon-plan');
    await expect(page.getByText('Seite 1 / 4')).toBeVisible();
    expect(await messeZeilen(page)).toHaveLength(4);
  });
});

test.describe('@ZM-185 Nächste Spiele (Nikolaus-Turnier, 1920×1080)', () => {
  test.use({ viewport: FULL_HD });
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });

  test('@ZM-185 gespiegelt: Heimlogo hinter dem Heimnamen, Gastlogo vor dem Gastnamen, beide direkt am Strich und in jeder Zeile an derselben Stelle', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await oeffneMonitor(page, NIKOLAUS, 'mon-naechste');
    const zeilen = await messeZeilen(page);
    expect(zeilen.length).toBeGreaterThan(3);
    for (const z of zeilen) {
      expect(z.home.avatar.l, 'Heimlogo hinter dem Heimnamen').toBeGreaterThanOrEqual(z.home.text!.r - 1);
      expect(z.away.avatar.r, 'Gastlogo vor dem Gastnamen').toBeLessThanOrEqual(z.away.text!.l + 1);
      expect(z.sep.l - z.home.avatar.r, 'Heimlogo am Strich').toBeLessThan(FULL_HD.height * 0.04);
      expect(z.away.avatar.l - z.sep.r, 'Gastlogo am Strich').toBeLessThan(FULL_HD.height * 0.04);
    }
    expect(gleich(zeilen.map((z) => z.sep.l - z.home.avatar.r)), 'Abstand Heimlogo zum Strich in jeder Zeile gleich').toBe(true);
    expect(gleich(zeilen.map((z) => z.away.avatar.l - z.sep.r)), 'Abstand Gastlogo zum Strich in jeder Zeile gleich').toBe(true);
    expect(gleich(alleSeiten(zeilen).map((s) => s.avatar.w), 0.5), 'Initialen im gleich großen Kreis wie das Logo').toBe(true);
    expect(alleSeiten(zeilen).some((s) => !s.hatBild && s.initialen.length > 0), 'Team ohne Logo: Initialen').toBe(true);
    for (const s of alleSeiten(zeilen).filter((x) => x.bild !== null)) { expect(bildGanzImKreis(s).ok, 'Logo ganz im Kreis').toBe(true); }
    await bild(page, 'naechste-spiele');
  });

  test('@ZM-185 das lange Wort in einer Zeile, ohne „…“; jede Paarung auf genau einer Seite', async ({ page, seedIndexedDB }) => {
    await saeen(seedIndexedDB);
    await page.clock.install();
    await oeffneMonitor(page, NIKOLAUS, 'mon-naechste');
    const ids: string[] = [];
    const erste = await messeZeilen(page);
    keinWortbruch(erste);
    ids.push(...erste.map((z) => z.id));
    await page.clock.runFor(60_000);
    const zweite = await messeZeilen(page);
    keinWortbruch(zweite);
    ids.push(...zweite.map((z) => z.id));
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size, 'jede Paarung genau einmal').toBe(10);
  });
});

// ---- @ZM-157 Live-Folie und Endstand am Monitor: Logo bzw. Initialen mittig über dem Namen, direkt unter dem Kasten ----
const FINALE = '00000003-0000-4000-8000-000000000016';
const FINALE_ENDE = { matchStatus: 'finished', timerStartTime: undefined, timerElapsedSeconds: 600, scoreA: 1, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' };
const MONITORE = [{ breite: 1280, hoehe: 720 }, { breite: 1920, hoehe: 1080 }] as const;

async function oeffneLive(page: Page, breite: number, hoehe: number) {
  await page.setViewportSize({ width: breite, height: hoehe });
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto('/#/display/hallencup-messlauf/mon-live');
  await expect(page.getByTestId('live-box-home')).toBeVisible({ timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Ändert das Finale in der lokalen Kopie; der Monitor liest sie beim nächsten Abruf (wie `spielanzeige-monitor.spec.ts`). */
async function aendereFinale(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(({ id, w }) => new Promise<void>((fertig, fehler) => {
    const auf = indexedDB.open('hallenfussball', 1);
    auf.onerror = () => fehler(new Error('IndexedDB'));
    auf.onsuccess = () => {
      const tx = auf.result.transaction('cache', 'readwrite');
      const speicher = tx.objectStore('cache');
      const lesen = speicher.get('tournaments');
      lesen.onsuccess = () => {
        const eintrag = lesen.result as { key: string; value: Array<{ id: string; matches: Array<Record<string, unknown>> }> };
        const spiel = eintrag.value.find((t) => t.id === 'hallencup-messlauf')?.matches.find((m) => m.id === id);
        if (!spiel) { fehler(new Error('Finale fehlt')); return; }
        Object.assign(spiel, w);
        speicher.put(eintrag);
      };
      tx.oncomplete = () => fertig();
      tx.onerror = () => fehler(new Error('Schreiben'));
    };
  }), { id: FINALE, w: patch });
}

/** Lage von Kasten, Avatar, Name und Uhr je Seite der Live-Folie */
async function messeLive(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null) => { if (!el) { return null; } const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, cx: b.left + b.width / 2 }; };
    const seite = (s: string) => {
      const name = document.querySelector(`[data-testid="live-name-${s}"] [data-teamname]`)!;
      const lauf = document.createRange(); lauf.selectNodeContents(name);
      const rs = Array.from(lauf.getClientRects());
      return {
        box: r(document.querySelector(`[data-testid="live-box-${s}"]`)), avatar: r(document.querySelector(`[data-testid="live-team-${s}-avatar"]`)),
        text: { l: Math.min(...rs.map((x) => x.left)), r: Math.max(...rs.map((x) => x.right)), t: Math.min(...rs.map((x) => x.top)), b: Math.max(...rs.map((x) => x.bottom)) },
        bild: document.querySelector(`[data-testid="live-team-${s}-avatar"] img`) !== null,
      };
    };
    const flaeche = document.querySelector('[data-testid="live-slide-area"]')!;
    const uhr = document.querySelector('[data-monitor="uhr"]');
    const kopf = document.querySelector('[data-testid="live-badge"]');
    return {
      kopf: r(kopf), unten: r(document.querySelector('[data-testid="live-lower"]')), rahmen: r(flaeche.firstElementChild),
      home: seite('home'), away: seite('away'), uhr: r(uhr), flaeche: r(flaeche),
      abgeschnitten: flaeche.scrollHeight > flaeche.clientHeight + 1 || flaeche.scrollWidth > flaeche.clientWidth + 1,
      hoehe: window.innerHeight,
    };
  });
}

test.describe('@ZM-157 Hallenmonitor Feld 1: Logo bzw. Initialen mittig über dem Namen, direkt unter dem Kasten', () => {
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop', 'läuft nur im Projekt desktop'); });

  for (const { breite, hoehe } of MONITORE) {
    for (const zustand of ['läuft', 'Endstand nach Strafstoßschießen'] as const) {
      test(`@ZM-157 ${zustand} (${breite}×${hoehe}): Heimlogo und Gastinitialen mittig über ihrem Namen, unter dem Kasten, Uhr und Balken unverdrängt`, async ({ page }) => {
        await oeffneLive(page, breite, hoehe);
        if (zustand !== 'läuft') {
          await aendereFinale(page, FINALE_ENDE);
          await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-fill', /./, { timeout: 20000 });
          await expect.poll(async () => page.getByTestId('live-team-home-addon-0').textContent(), { timeout: 20000 }).not.toBe('');
        }
        await bild(page, `live-${zustand === 'läuft' ? 'laeuft' : 'ende'}-${breite}`);
        const m = await messeLive(page);
        for (const s of [m.home, m.away]) {
          const mitte = (s.text.l + s.text.r) / 2;
          expect(Math.abs(s.avatar!.cx - mitte), 'Avatar mittig über dem Namen').toBeLessThanOrEqual(TOL);
          expect(s.avatar!.t, 'Avatar unter dem Kasten').toBeGreaterThanOrEqual(s.box!.b - 1);
          expect(s.avatar!.t - s.box!.b, 'direkt unter dem Kasten').toBeLessThan(hoehe * 0.06);
          expect(s.avatar!.b, 'Avatar über dem Namen').toBeLessThanOrEqual(s.text.t + 1);
        }
        expect(m.home.bild, 'Heimteam hat ein Logo').toBe(true);
        expect(m.away.bild, 'Gast zeigt Initialen').toBe(false);
        expect(m.home.avatar!.cx, 'Heimlogo links der Mitte').toBeLessThan(breite / 2);
        expect(m.away.avatar!.cx, 'Gastinitialen rechts der Mitte').toBeGreaterThan(breite / 2);
        expect(m.abgeschnitten, 'Folie schneidet nichts ab').toBe(false);
        expect(m.kopf!.t, 'Kopfzeile nicht über den oberen Rand der Folie hinaus').toBeGreaterThanOrEqual(m.rahmen!.t - 0.5);
        expect(m.unten!.b, 'unterer Bereich (Uhr, Balken, Hinweise) nicht über den unteren Rand hinaus').toBeLessThanOrEqual(m.rahmen!.b + 0.5);
        expect(m.flaeche!.b, 'Folie endet im Bild').toBeLessThanOrEqual(hoehe + 1);
        if (m.uhr) {
          const namenUnten = Math.max(m.home.text.b, m.away.text.b);
          expect(m.uhr.t, 'Uhr unter den Namen, nicht verdrängt').toBeGreaterThanOrEqual(namenUnten - 1);
          expect(m.uhr.b, 'Uhr im Bild').toBeLessThanOrEqual(hoehe);
        }
      });
    }
  }
});

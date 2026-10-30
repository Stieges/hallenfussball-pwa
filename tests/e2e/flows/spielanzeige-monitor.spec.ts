/**
 * Spielanzeige S3 (Aufgabe 3.2) – Monitor 1280×720: Kästen in der getragenen Farbe, Weste, Ecken, Logo/Initialen, Zusätze.
 * Saat `hallencup-messlauf`: das Finale läuft auf Feld 1 (ohne Teamfarben: Standardfarben Blau/Rot, Heim mit Logo, Gast mit Initialen);
 * die Werte des Gherkins (Rot/Weiß, gelbe Leibchen, Finale 2:2 n. V. mit Strafstoß 4:3) setzt der Test über die lokale Kopie des Turniers,
 * wie `zm151-kaesten.spec.ts`. Gemessen wird am gerenderten Bild: Kontrast, Überdeckung, Überlappung, Kastengröße.
 * Bilder: Ordner aus S3_BILDER. Läuft nur im Projekt `desktop`.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { getContrastRatio } from '../../../src/design-tokens/display';
import { palette } from '../../../src/design-tokens/colors/palette';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.S3_BILDER;
const MONITOR = { width: 1280, height: 720 };
const FINALE = '00000003-0000-4000-8000-000000000016';
const ROT = palette.kit.red;
const WEISS = palette.neutral[0];
const GELB = palette.yellow[400];
const TOLERANZ_PX = 1;

interface Rechteck { l: number; t: number; r: number; b: number }

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}.png`), fullPage: false });
}

async function oeffne(page: Page, monitor: string, erwarte: string, turnier = 'hallencup-messlauf') {
  await page.setViewportSize(MONITOR);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(`/#/display/${turnier}/${monitor}`);
  await expect(page.getByTestId(erwarte).first()).toBeVisible({ timeout: 25000 });
}

/** Ändert das Finale in der lokalen Kopie (wie nach Papier-Leitung bzw. anderer Trikotwahl); der Monitor liest sie beim nächsten Abruf. */
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

const beendet = { matchStatus: 'finished', timerStartTime: undefined, timerElapsedSeconds: 600 };
const FINALE_ENDE = { ...beendet, scoreA: 1, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' };

/** Mittelpunkt der Ziffer: das oberste Element dort gehört zur Ziffer (nichts liegt darüber) */
async function nichtsUeberZiffer(page: Page, seite: 'home' | 'away') {
  return page.evaluate((s) => {
    const z = document.querySelector(`[data-testid="live-box-${s}-digits"]`)?.getBoundingClientRect();
    if (!z) { throw new Error('Ziffer fehlt'); }
    const oben = document.elementFromPoint(z.left + z.width / 2, z.top + z.height / 2);
    return oben?.closest(`[data-testid="live-box-${s}-digits"]`) !== null;
  }, seite);
}

async function farbe(page: Page, id: string) {
  return page.getByTestId(id).evaluate((el) => ({
    flaeche: getComputedStyle(el).backgroundColor, ziffer: getComputedStyle(el).color, rahmen: parseFloat(getComputedStyle(el).borderTopWidth),
    daten: (el as HTMLElement).dataset.color ?? '', rahmenArt: (el as HTMLElement).dataset.frame ?? '',
  }));
}
const hex = (rgb: string): string => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) { throw new Error(`Farbe ${rgb}`); }
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
};

test.describe('@ZM-160 @ZM-161 Live-Folie Feld 1 (1280×720)', () => {
  test('@ZM-160 Live-Folie Feld 1: Kästen Rot/Weiß, Ziffern ≥ 4,5 : 1, Kasten ≥ 3 : 1 oder Rahmen, nichts über einer Ziffer', async ({ page }) => {
    await oeffne(page, 'mon-live', 'live-box-home');
    await aendereFinale(page, { kit: { a: ROT, b: WEISS } });
    await expect.poll(async () => (await farbe(page, 'live-box-away')).daten, { timeout: 20000 }).toBe(WEISS);
    const heim = await farbe(page, 'live-box-home');
    const gast = await farbe(page, 'live-box-away');
    expect(heim.daten).toBe(ROT);
    for (const k of [heim, gast]) {
      expect(getContrastRatio(hex(k.flaeche), hex(k.ziffer)), 'Ziffer zur Kastenfarbe').toBeGreaterThanOrEqual(4.5);
    }
    const hintergrund = await page.getByTestId('live-slide-area').evaluate((el) => getComputedStyle(el.firstElementChild ?? el).backgroundColor);
    for (const k of [heim, gast]) {
      const kasten = getContrastRatio(hex(k.flaeche), hex(hintergrund === 'rgba(0, 0, 0, 0)' ? 'rgb(15, 23, 42)' : hintergrund));
      expect(kasten >= 3 || k.rahmenArt === 'strong', `Kasten ${kasten.toFixed(2)} : 1 oder kräftiger Rahmen`).toBe(true);
    }
    expect(await nichtsUeberZiffer(page, 'home')).toBe(true);
    expect(await nichtsUeberZiffer(page, 'away')).toBe(true);
    await bild(page, 'monitor-1280-live-rot-weiss');
  });

  test('@ZM-161 Live-Folie: Weste sichtbar (Gelb mit Streifen), Leibchen-Zeichen verdeckt die Zahl nicht, kein „in Leibchen“', async ({ page }) => {
    await oeffne(page, 'mon-live', 'live-box-home');
    await aendereFinale(page, { kit: { a: GELB, bibSide: 'a' } });
    await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-fill', 'vest', { timeout: 20000 });
    const heim = page.getByTestId('live-box-home');
    await expect(heim).toHaveAttribute('data-fill', 'vest');
    await expect(heim).toHaveAttribute('data-color', GELB);
    const bildHintergrund = await heim.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bildHintergrund).toContain('linear-gradient');
    await expect(page.getByTestId('live-box-home-bib')).toBeVisible();
    const lage = await page.evaluate(() => {
      const r = (id: string) => { const b = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect(); return b ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
      return { zeichen: r('live-box-home-bib'), ziffer: r('live-box-home-digits') };
    });
    const schneidet = (a: Rechteck, b: Rechteck) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    expect(schneidet(lage.zeichen!, lage.ziffer!), 'Leibchen-Zeichen überdeckt die Zahl').toBe(false);
    expect(await nichtsUeberZiffer(page, 'home')).toBe(true);
    await expect(page.getByTestId('live-grid')).not.toContainText('in Leibchen');
    await expect(page.getByTestId('live-box-away')).toHaveAttribute('data-fill', 'solid');
    await expect(page.getByTestId('live-box-away-bib')).toHaveCount(0);
    await bild(page, 'monitor-1280-live-weste');
  });

  test('@ZM-138 nach dem Anpfiff stehen Logo bzw. Initialen klein vor dem Namen', async ({ page }) => {
    await oeffne(page, 'mon-live', 'live-box-home');
    for (const seite of ['home', 'away']) {
      const lage = await page.evaluate((s) => {
        const a = document.querySelector(`[data-testid="live-team-${s}-avatar"]`)?.getBoundingClientRect();
        const n = document.querySelector(`[data-testid="live-name-${s}"] [data-teamname]`)?.getBoundingClientRect();
        const k = document.querySelector(`[data-testid="live-box-${s}"]`)?.getBoundingClientRect();
        return a && n && k ? { a: { l: a.left, r: a.right, t: a.top, b: a.bottom }, n: { l: n.left }, k: { b: k.bottom } } : null;
      }, seite);
      expect(lage, `Avatar ${seite}`).not.toBeNull();
      expect(lage!.a.r, 'Avatar steht vor dem Namen').toBeLessThanOrEqual(lage!.n.l + TOLERANZ_PX);
      expect(lage!.a.t, 'Avatar liegt unter dem Kasten').toBeGreaterThanOrEqual(lage!.k.b - TOLERANZ_PX);
    }
  });
});

test.describe('@ZM-160 Folie „Spielplan eines Felds (Feld 1)“', () => {
  test('@ZM-160 Folie „Spielplan eines Felds (Feld 1)“: das laufende Spiel mit Kästen in der getragenen Farbe', async ({ page }) => {
    await oeffne(page, 'mon-plan-feld', 'monitor-match-row');
    const zeile = page.locator('[data-testid="monitor-match-row"]', { has: page.getByTestId('monitor-match-box-home') }).last();
    await expect(zeile).toBeVisible();
    const heim = zeile.getByTestId('monitor-match-box-home');
    const gast = zeile.getByTestId('monitor-match-box-away');
    for (const kasten of [heim, gast]) {
      const k = await kasten.evaluate((el) => ({ flaeche: getComputedStyle(el).backgroundColor, ziffer: getComputedStyle(el).color }));
      expect(getContrastRatio(hex(k.flaeche), hex(k.ziffer))).toBeGreaterThanOrEqual(4.5);
    }
    // Die Zeile bleibt in ihrer Höhe: die Kästen liegen vollständig innerhalb der Zeile
    const lage = await page.evaluate(() => {
      const zeilen = [...document.querySelectorAll('[data-testid="monitor-match-row"]')].filter((z) => z.querySelector('[data-testid="monitor-match-box-home"]'));
      const z = zeilen[zeilen.length - 1];
      const rz = z.getBoundingClientRect();
      return [...z.querySelectorAll('[data-testid^="monitor-match-box-"]')]
        .filter((e) => e.getAttribute('data-testid') === 'monitor-match-box-home' || e.getAttribute('data-testid') === 'monitor-match-box-away')
        .map((e) => { const b = e.getBoundingClientRect(); return { oben: b.top - rz.top, unten: rz.bottom - b.bottom }; });
    });
    for (const l of lage) { expect(l.oben).toBeGreaterThanOrEqual(0); expect(l.unten).toBeGreaterThanOrEqual(0); }
    await bild(page, 'monitor-1280-plan-feld');
  });
});

test.describe('@ZM-157 Finale beendet (1280×720)', () => {
  test('@ZM-157 Finale 1280×720: kein Element überlappt ein anderes, kein Name endet mit „…“, Kästen so groß wie während des Spiels', async ({ page }) => {
    await oeffne(page, 'mon-live', 'live-box-home');
    const waehrend = await page.evaluate(() => ['home', 'away'].map((s) => { const b = document.querySelector(`[data-testid="live-box-${s}"]`)!.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }));
    await aendereFinale(page, { ...FINALE_ENDE, kit: { a: GELB, bibSide: 'a' } });
    await expect(page.getByTestId('live-penalty')).toHaveText('Strafstoßschießen 4 : 3', { timeout: 20000 });
    await expect(page.getByTestId('live-box-home-cup')).toBeVisible();
    await expect(page.getByTestId('live-box-home-bib')).toBeVisible();
    await expect(page.getByTestId('live-winner')).toContainText('gewinnt');
    const nachher = await page.evaluate(() => ['home', 'away'].map((s) => { const b = document.querySelector(`[data-testid="live-box-${s}"]`)!.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }));
    for (let i = 0; i < 2; i += 1) { for (let k = 0; k < 4; k += 1) { expect(Math.abs(nachher[i][k] - waehrend[i][k]), `Kasten ${i} Wert ${k}`).toBeLessThanOrEqual(TOLERANZ_PX); } }

    const rechtecke = await page.evaluate(() => {
      const ids: Array<[string, string]> = [
        ['Kasten Heim', '[data-testid="live-box-home"]'], ['Kasten Gast', '[data-testid="live-box-away"]'],
        ['Avatar Heim', '[data-testid="live-team-home-avatar"]'], ['Avatar Gast', '[data-testid="live-team-away-avatar"]'],
        ['Name Heim', '[data-testid="live-name-home"] [data-teamname]'], ['Name Gast', '[data-testid="live-name-away"] [data-teamname]'],
        ['Zusatz', '[data-testid$="-addon-0"]'], ['Strafstoß', '[data-testid="live-penalty-block"]'], ['Doppelpunkt', '[data-testid="live-separator"]'],
        ['Siegerzeile', '[data-testid="live-winner"]'], ['Pokal', '[data-testid="live-box-home-cup"]'], ['Leibchen-Zeichen', '[data-testid="live-box-home-bib"]'],
      ];
      const aus: Array<{ name: string; l: number; t: number; r: number; b: number }> = [];
      for (const [name, sel] of ids) {
        const el = document.querySelector(sel);
        if (!el) { continue; }
        const b = el.getBoundingClientRect();
        aus.push({ name, l: b.left, t: b.top, r: b.right, b: b.bottom });
      }
      return { aus, namen: [...document.querySelectorAll('[data-teamname]')].map((e) => e.textContent ?? '') };
    });
    const schneidet = (a: Rechteck, b: Rechteck) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    const ueberlappungen: string[] = [];
    for (let i = 0; i < rechtecke.aus.length; i += 1) {
      for (let j = i + 1; j < rechtecke.aus.length; j += 1) {
        const eigen = new Set(['Kasten Heim']);
        const paar = [rechtecke.aus[i].name, rechtecke.aus[j].name];
        // Pokal und Leibchen-Zeichen sitzen an der Ecke ihres Kastens (außerhalb der Ziffernfläche): dort ist die Berührung gewollt
        if (paar.some((n) => n === 'Pokal' || n === 'Leibchen-Zeichen') && paar.some((n) => eigen.has(n))) { continue; }
        if (schneidet(rechtecke.aus[i], rechtecke.aus[j])) { ueberlappungen.push(`${rechtecke.aus[i].name} ↔ ${rechtecke.aus[j].name}`); }
      }
    }
    expect(ueberlappungen).toEqual([]);
    for (const name of rechtecke.namen) { expect(name.endsWith('…')).toBe(false); }
    expect(await nichtsUeberZiffer(page, 'home')).toBe(true);
    await bild(page, 'monitor-1280-live-ende-finale');
  });
});

/**
 * Befund S3-1 (Platz in der Höhe): Pokal und Leibchen-Zeichen ragen je rund 2,8 % der Folienhöhe über den Kasten (Mockup `top:-2.6cqh`);
 * zwischen Kopfzeile und Kasten liegen nur `headerGap` = 1,5 %. Mit zwei freigehaltenen Zusatzzeilen und zwei Namenszeilen bleibt in der
 * Höhe kein Platz für mehr Abstand (siehe Report). Der Gherkin @ZM-157 verlangt „kein Element überlappt ein anderes“ – rot, bis der Controller
 * entscheidet (Kastenhöhe wie im Mockup 24 % statt 41 %, oder Zeichen innerhalb des Kastenrands).
 */
test.describe('@ZM-157 Befund S3-1', () => {
  test.fail(true, 'Befund S3-1: Leibchen-Zeichen berührt das Abzeichen in der Kopfzeile (kein Platz in der Höhe)');
  test('@ZM-157 Leibchen-Zeichen und Pokal überlappen die Kopfzeile nicht', async ({ page }) => {
    await oeffne(page, 'mon-live', 'live-box-home');
    await aendereFinale(page, { ...FINALE_ENDE, kit: { a: GELB, bibSide: 'a' } });
    await expect(page.getByTestId('live-box-home-cup')).toBeVisible({ timeout: 20000 });
    const r = await page.evaluate(() => {
      const box = (sel: string) => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
      return { kopf: [box('[data-testid="live-badge"] > *'), box('[data-testid="live-info"]'), box('[data-testid="live-group"]')], zeichen: [box('[data-testid="live-box-home-bib"]'), box('[data-testid="live-box-home-cup"]')] };
    });
    const schneidet = (a: Rechteck | null, b: Rechteck | null) => a !== null && b !== null && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
    for (const z of r.zeichen) { for (const k of r.kopf) { expect(schneidet(z, k)).toBe(false); } }
  });
});

/** Controller-Info (R5 PR 2): über der Uhr steht ein Text („Restzeit“, „Pause · Halbzeit“ …); Namen und Zusatzzeilen enden darüber, in jedem Zustand. */
test.describe('@ZM-157 Namen bleiben über dem Bereich der Uhr', () => {
  const zustaende = [
    { name: 'läuft mit langem Namen', turnier: 'hallencup-messlauf' },
    { name: 'Halbzeitpause', turnier: 'hallencup-phase-halbzeit' },
    { name: 'Verlängerung', turnier: 'hallencup-phase-verlaengerung' },
    { name: 'Strafstoßschießen', turnier: 'hallencup-phase-strafstoss' },
  ];
  for (const z of zustaende) {
    test(`@ZM-157 ${z.name}: Name, Avatar und Zusätze liegen über dem unteren Bereich (Uhr, Text über der Uhr)`, async ({ page }) => {
      await oeffne(page, 'mon-live', 'live-box-home', z.turnier);
      const r = await page.evaluate(() => {
        const lower = document.querySelector('[data-testid="live-lower"]')!.getBoundingClientRect().top;
        const unten = [...document.querySelectorAll('[data-testid^="live-team-"], [data-testid^="live-name-"] [data-teamname]')].map((e) => e.getBoundingClientRect().bottom);
        return { lower, hoechster: Math.max(...unten) };
      });
      expect(r.hoechster, 'unterste Kante der Namen-Reihe').toBeLessThanOrEqual(r.lower + TOLERANZ_PX);
      await bild(page, `monitor-1280-name-ueber-uhr-${z.turnier}`);
    });
  }
});

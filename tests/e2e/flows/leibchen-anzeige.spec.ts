/**
 * Leibchen-Anzeige Schritt 1 (Monitor, Zuschauer-Seite): @ZM-161 (Trainingsleibchen), @ZM-157 (Zeichen oben links), @ZM-192 (Zeitstrafen-Kreis
 * berührt kein Zeichen), @ZM-195 (Folie „Nächstes Spiel“ mit Kästen „0 : 0“ in Größe und Lage wie im Spiel), @ZM-159 (Fall D2 ohne Ausweichfarbe),
 * @ZM-151 (Kästen in jedem Zustand gleich), @ZM-158 (kleiner Kasten am Handy). Saat: `helpers/leibchenSaat.ts` (Mockup `leibchen-anzeige`).
 * Cockpit (@SL-176): Kasten mit der Form, der flache Kopf behält die Streifen (Befund im Bericht). Bilder: LEIBCHEN_BILDER=<Ordner> (Vorsatz LEIBCHEN_PHASE, Vorgabe „nachher“); die Messungen laufen nur im Projekt `desktop`.
 * Der Test „Bilder“ macht nur Aufnahmen (er läuft auch gegen den alten Stand, `-g Bilder`).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';
import { displayLayout } from '../../../src/design-tokens';
import { cup, NAMEN, NAME_50, anpfeifen } from '../helpers/laptopCup';
import { GELB, LEIBCHEN_MONITOR_ID, LEIBCHEN_SHARE_CODE, LEIBCHEN_TURNIER_ID, ROT, SPIEL_2_ID, leibchenSaat, type Szene } from '../helpers/leibchenSaat';

const BILDER = process.env.LEIBCHEN_BILDER;
const PHASE = process.env.LEIBCHEN_PHASE ?? 'nachher';
const MONITORE = [{ name: '1080', width: 1920, height: 1080 }, { name: '540', width: 960, height: 540 }];

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

interface Box { l: number; t: number; w: number; h: number }

async function oeffneMonitor(page: Page, szene: Szene, groesse: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(groesse);
  await installiereSaat(page.context(), leibchenSaat(szene));
  await page.goto(`/#/display/${LEIBCHEN_TURNIER_ID}/${LEIBCHEN_MONITOR_ID}`);
  await expect(page.getByTestId('live-grid')).toBeVisible({ timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
}

async function oeffneZuschauer(page: Page, szene: Szene): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await installiereSaat(page.context(), leibchenSaat(szene));
  await page.goto(`/#/live/${LEIBCHEN_SHARE_CODE}`);
  const karte = page.locator('.mobile-view [data-match-card]').first();
  await expect(karte).toBeVisible({ timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
  await karte.scrollIntoViewIfNeeded(); // die Karte steht im Bild (Aufnahmen)
}

/** Cockpit-Cup mit Blau gegen Navy (zu ähnlich): Tom bestätigt die Karte und pfeift an; Kasten und Kopf zeigen die Weste (@SL-176). */
async function oeffneCockpit(page: Page, groesse: { width: number; height: number }, heimName: string): Promise<void> {
  await page.setViewportSize(groesse);
  const namen = [heimName, ...NAMEN.slice(1)];
  await installiereSaat(page.context(), {
    formatVersion: 1, name: 'cockpit', localStorage: { 'app:consent': { errorTracking: false, sessionReplay: false, timestamp: 1794643200000, version: 1 } },
    datenbanken: [{ name: 'hallenfussball', version: 1, store: 'cache', eintraege: { tournaments: [cup({ namen, farben: ['#1565C0', '#0D1B4C', '#2E8B57', '#C0392B'] })] } }],
  });
  await anpfeifen(page, { leibchen: true }); // Tom bestätigt die Karte, dann der Anpfiff (@SL-206, @SL-210)
  await page.evaluate(() => document.fonts.ready);
}

/** Spiel 2 wird abgepfiffen (1 : 0), wie nach dem Abpfiff im Cockpit: nur das Ergebnis steht im Turnier. */
async function beendeSpiel2(page: Page): Promise<void> {
  await page.evaluate(({ turnier, id }) => new Promise<void>((fertig, fehler) => {
    const auf = indexedDB.open('hallenfussball', 1);
    auf.onerror = () => fehler(new Error('IndexedDB'));
    auf.onsuccess = () => {
      const tx = auf.result.transaction('cache', 'readwrite');
      const speicher = tx.objectStore('cache');
      const lesen = speicher.get('tournaments');
      lesen.onsuccess = () => {
        const eintrag = lesen.result as { key: string; value: Array<{ id: string; matches: Array<Record<string, unknown>> }> };
        const spiel = eintrag.value.find((t) => t.id === turnier)?.matches.find((m) => m.id === id);
        if (!spiel) { fehler(new Error('Spiel 2 fehlt')); return; }
        Object.assign(spiel, { matchStatus: 'finished', timerStartTime: undefined, timerElapsedSeconds: 600, scoreA: 1, scoreB: 0, decidedBy: 'regular', liveState: undefined });
        speicher.put(eintrag);
      };
      tx.oncomplete = () => fertig();
      tx.onerror = () => fehler(new Error('Schreiben'));
    };
  }), { turnier: LEIBCHEN_TURNIER_ID, id: SPIEL_2_ID });
}

const box = (page: Page, selektor: string): Promise<Box> => page.evaluate((s) => {
  const b = document.querySelector(s)?.getBoundingClientRect();
  if (!b) { throw new Error(`${s} fehlt`); }
  return { l: b.left, t: b.top, w: b.width, h: b.height };
}, selektor);

const schneiden = (a: Box, b: Box): boolean => a.l < b.l + b.w && b.l < a.l + a.w && a.t < b.t + b.h && b.t < a.t + a.h;

async function bild(page: Page, name: string): Promise<void> {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${PHASE}-${name}.png`), fullPage: false });
}

test.describe('Leibchen-Anzeige Bilder', () => {
  test('Bilder: Monitor und Zuschauer-Seite in allen Zuständen des Mockups', async ({ browser }) => {
    test.skip(!BILDER, 'nur mit LEIBCHEN_BILDER');
    test.setTimeout(240000);
    const ansichten: Array<{ szene: Szene; name: string }> = [
      { szene: 'vor-gleiche-farbe', name: 'n-1b' }, { szene: 'laeuft', name: 'n-3' },
      { szene: 'ende', name: 'n-4' }, { szene: 'laeuft-orange', name: 'n-5' }, { szene: 'kontrolle-laeuft', name: 'n-6' },
      { szene: 'kontrolle-vor', name: 'n-6b' }, { szene: 'laeuft-zweistellig', name: 'n-10' },
    ];
    for (const a of ansichten) {
      for (const g of MONITORE) {
        const ctx = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin', deviceScaleFactor: g.name === '540' ? 2 : 1 });
        const seite = await ctx.newPage();
        await oeffneMonitor(seite, a.szene, g);
        if (a.szene === 'ende') {
          await beendeSpiel2(seite);
          await expect(seite.locator('[data-position="home"]')).toHaveAttribute('data-outcome', 'winner', { timeout: 20000 });
        }
        await bild(seite, `m-${a.name}-${g.name}`);
        await ctx.close();
      }
    }
    for (const a of [{ szene: 'vor-gleiche-farbe' as Szene, name: 'z-n-2' }, { szene: 'laeuft' as Szene, name: 'z-n-3' }, { szene: 'laeuft-zweistellig' as Szene, name: 'z-n-10' }]) {
      const ctx = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin', deviceScaleFactor: 2, colorScheme: 'dark' });
      const seite = await ctx.newPage();
      await oeffneZuschauer(seite, a.szene);
      await bild(seite, `${a.name}-dark`);
      await ctx.close();
    }
  });
});

for (const g of MONITORE) {
  test.describe(`Leibchen-Anzeige Monitor ${g.name}`, () => {
    test(`@ZM-161 @ZM-157 @ZM-192 Spiel läuft: Trainingsleibchen mit Zeichen oben links, Zeitstrafen-Kreis unten links, nichts berührt sich (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'laeuft', g);
      const kasten = page.getByTestId('live-box-away');
      await expect(kasten).toHaveAttribute('data-fill', 'vest');
      await expect(kasten).toHaveAttribute('data-color', GELB);
      await expect(kasten).toHaveAttribute('data-stripes', ROT);
      await expect(kasten.locator('[data-teil]')).toHaveCount(3);
      await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-fill', 'solid'); // Team 2 bleibt ganz Rot, ohne Zeichen
      await expect(page.getByTestId('live-box-home-bib')).toHaveCount(0);
      const bib = await box(page, '[data-testid="live-box-away-bib"]');
      const strafe = await box(page, '[data-testid="live-penalties-away"] [data-zeitstrafe]');
      const ziffer = await box(page, '[data-testid="live-box-away-digits"]');
      const k = await box(page, '[data-testid="live-box-away"]');
      expect(schneiden(bib, strafe), 'Zeichen und Zeitstrafen-Kreis berühren sich nicht').toBe(false);
      expect(schneiden(bib, ziffer), 'das Zeichen liegt nicht über der Ziffer').toBe(false);
      expect(schneiden(strafe, ziffer), 'der Kreis liegt nicht über der Ziffer').toBe(false);
      expect(bib.t, 'Zeichen oben').toBeLessThan(k.t + k.h / 2);
      expect(bib.l, 'Zeichen links').toBeLessThan(k.l + k.w / 2);
      expect(strafe.t, 'Kreis unten').toBeGreaterThan(k.t + k.h / 2);
      await bild(page, `m-laeuft-${g.name}`);
    });

    test(`@ZM-161 zweistelliger Stand: die Ziffer steht ganz auf der Leibchenfarbe, nie auf Trikot oder Hals (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'laeuft-zweistellig', g);
      const innen = await page.evaluate(() => {
        const kasten = document.querySelector('[data-testid="live-box-away"]')!;
        const k = kasten.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(kasten.querySelector('[data-testid="live-box-away-digits"]')!);
        const z = r.getBoundingClientRect();
        return { links: (z.left - k.left) / k.width, rechts: (k.right - z.right) / k.width };
      });
      const kante = displayLayout.scoreArea.vest.large.edge / 100;
      expect(innen.links, 'links von der Ziffer beginnt das Leibchen (Seitenkante)').toBeGreaterThanOrEqual(kante);
      expect(innen.rechts, 'rechts von der Ziffer endet das Leibchen (Seitenkante)').toBeGreaterThanOrEqual(kante);
      await expect(page.getByTestId('live-box-away')).toHaveAttribute('data-digit-color', '#000000');
      await bild(page, `m-zweistellig-${g.name}`);
    });

    test(`@ZM-195 @ZM-159 Folie „Nächstes Spiel“: Kästen „0 : 0“, Abzeichen links, Anstoßzeit an der Stelle der Uhr, Gast ohne Ausweichfarbe (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'vor-gleiche-farbe', g);
      await expect(page.getByTestId('live-badge')).toContainText('Nächstes Spiel');
      await expect(page.getByTestId('live-box-home-digits')).toHaveText('0');
      await expect(page.getByTestId('live-box-away-digits')).toHaveText('0');
      await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-color', ROT);
      await expect(page.getByTestId('live-box-away')).toHaveAttribute('data-color', ROT); // @ZM-159 Fall D2: Rot gegen Rot ohne Leibchen → jeder Kasten seine echte Trikotfarbe
      await expect(page.getByTestId('live-box-away-bib')).toHaveCount(0);
      await expect(page.getByTestId('monitor-kickoff')).toContainText('08:40');
      await bild(page, `m-vor-${g.name}`);
    });

    test(`@ZM-195 @ZM-151 die Kästen vor dem Anpfiff stehen genau wie im Spiel (Größe, Lage), die Anstoßzeit an der Stelle der Uhr (${g.name})`, async ({ browser }) => {
      const messe = async (szene: Szene): Promise<{ heim: Box; gast: Box; uhr: Box }> => {
        const ctx = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        const seite = await ctx.newPage();
        await oeffneMonitor(seite, szene, g);
        const r = { heim: await box(seite, '[data-testid="live-block-home"]'), gast: await box(seite, '[data-testid="live-block-away"]'), uhr: await box(seite, '[data-testid="monitor-clock"]') };
        await ctx.close();
        return r;
      };
      const vor = await messe('vor-gleiche-farbe');
      const laeuft = await messe('laeuft');
      for (const k of ['l', 't', 'w', 'h'] as const) {
        expect(Math.abs(vor.heim[k] - laeuft.heim[k]), `Heim ${k}`).toBeLessThanOrEqual(1);
        expect(Math.abs(vor.gast[k] - laeuft.gast[k]), `Gast ${k}`).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(vor.uhr.t - laeuft.uhr.t), 'Uhr-Lage').toBeLessThanOrEqual(2);
    });

    // Die Weste vor dem Anpfiff (@SL-201, @ZM-195 mit festgelegtem Leibchen) braucht Schritt 2 (Festlegen vor dem Anpfiff schreibt zum Server): hier gilt vor dem Anpfiff die Trikotfarbe.
    test(`@ZM-195 Gegenbeispiel: vor dem Anpfiff (Schritt 1) steht kein Leibchen-Zeichen und keine Form, auch wenn das Spiel später Leibchen bekommt (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'vor-gleiche-farbe', g);
      await expect(page.locator('[data-teil]')).toHaveCount(0);
      await expect(page.getByTestId('live-box-away-bib')).toHaveCount(0);
    });

    test(`@ZM-161 Gegenbeispiel Kontrollfall: Weiß gegen Grün ohne Leibchen – keine Form, kein Zeichen, im Spiel und davor (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'kontrolle-laeuft', g);
      await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-fill', 'solid');
      await expect(page.getByTestId('live-box-away')).toHaveAttribute('data-fill', 'solid');
      await expect(page.locator('[data-teil]')).toHaveCount(0);
      await expect(page.getByTestId('live-box-home-bib')).toHaveCount(0);
      await expect(page.getByTestId('live-box-away-bib')).toHaveCount(0);
    });

    test(`@ZM-204 @ZM-161 Team 1 ohne Trikotfarbe mit Leibchen Orange: Form über dem grauen Streifenmuster (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'laeuft-orange', g);
      const kasten = page.getByTestId('live-box-home');
      await expect(kasten).toHaveAttribute('data-fill', 'vest');
      await expect(kasten).toHaveAttribute('data-color', '#EF6C00');
      await expect(kasten).toHaveAttribute('data-shirt-unknown', 'true');
      await expect(page.getByTestId('live-box-away')).toHaveAttribute('data-fill', 'solid');
      await bild(page, `m-orange-${g.name}`);
    });

    test(`@ZM-161 @ZM-151 abgepfiffen: Sieger mit Ring, gedämpftes Leibchen behält Form und Zeichen, kein Zeitstrafen-Kreis (${g.name})`, async ({ page }) => {
      await oeffneMonitor(page, 'ende', g);
      await beendeSpiel2(page);
      await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-outcome', 'winner', { timeout: 20000 });
      const verlierer = page.getByTestId('live-box-away');
      await expect(verlierer).toHaveAttribute('data-outcome', 'loser');
      await expect(verlierer).toHaveAttribute('data-fill', 'vest');
      await expect(page.getByTestId('live-box-away-bib')).toBeVisible();
      await expect(page.locator('[data-zeitstrafe]')).toHaveCount(0);
      await expect(page.getByTestId('live-box-home')).toHaveAttribute('data-outcome', 'winner');
      await bild(page, `m-ende-${g.name}`);
    });
  });
}

test.describe('Leibchen-Anzeige Zuschauer-Seite 390', () => {
  test('@ZM-158 @ZM-161 Läuft gerade: kleiner Kasten mit Weste und Zeichen oben links, Zeitstrafen-Zeile bleibt', async ({ page }) => {
    await oeffneZuschauer(page, 'laeuft');
    // Das laufende Spiel steht zweimal da: im Kopfblock (Paket Z2, @ZM-141) und als Karte im Spielplan; hier die Karte, der Kopf darunter
    const plan = page.locator('.mobile-view');
    const kopfGast = page.getByTestId('public-current').getByTestId(/^match-box-.*-away$/);
    await expect(kopfGast).toHaveAttribute('data-fill', 'vest');
    await expect(page.getByTestId('public-current').getByTestId(/^match-box-.*-away-bib$/)).toBeVisible();
    const gast = plan.getByTestId(/^match-box-.*-away$/);
    await expect(gast).toHaveAttribute('data-fill', 'vest');
    await expect(gast.locator('[data-teil]')).toHaveCount(3);
    await expect(plan.getByTestId(/^match-box-.*-away-bib$/)).toBeVisible();
    await expect(plan.getByTestId(/^match-box-.*-home$/)).toHaveAttribute('data-fill', 'solid');
    await expect(plan.getByTestId(/^match-box-.*-home-bib$/)).toHaveCount(0);
    await expect(plan.getByTestId(/^match-time-penalty-.*-away$/).first()).toContainText('5');
    await bild(page, 'z-laeuft');
  });

  test('@ZM-158 @ZM-195 Als Nächstes: Kästen mit „0“ in der echten Trikotfarbe statt Strich (Rot gegen Rot: beide Rot, keine Ausweichfarbe, @ZM-159 Fall D2)', async ({ page }) => {
    await oeffneZuschauer(page, 'vor-gleiche-farbe');
    // Das nächste Spiel steht im Kopfblock und als Karte im Spielplan; gemessen wird die Karte, der Kopf trägt dieselben Farben
    const plan = page.locator('.mobile-view');
    await expect(page.getByTestId('public-current').getByTestId(/^match-box-.*-away$/)).toHaveAttribute('data-color', ROT);
    await expect(plan.getByTestId(/^match-box-.*-home-digits$/)).toHaveText('0');
    await expect(plan.getByTestId(/^match-box-.*-home$/)).toHaveAttribute('data-color', ROT);
    await expect(plan.getByTestId(/^match-box-.*-away$/)).toHaveAttribute('data-color', ROT);
    await expect(plan.getByTestId(/^match-box-.*-away$/)).toHaveAttribute('data-fill', 'solid');
    // Gegenbeispiel: Spiel 5 (später, Weiß gegen Grün) ist nicht das nächste Spiel des Felds → Zahl ohne Kasten wie bisher
    await expect(page.locator('.mobile-view [data-testid^="match-box-"][data-testid$="-home"]')).toHaveCount(1);
    await expect(page.locator('.mobile-view [data-testid^="match-goals-"]').first()).toBeVisible();
    await bild(page, 'z-vor');
  });

  // @ZM-160: „Jede Spielanzeige zeigt den Stand in Kästen“ – auch die Karte eines beendeten Gruppenspiels im Spielplan der Zuschauer-Seite. Heute zeigt sie die nackte Zahl
  // (Entscheidung Mockup 08.11.: Spielliste bleibt wie heute). Rot, bis der Befund C-ZUSCHAUER-KARTEN-OHNE-KASTEN entschieden ist.
  test.fail('C-ZUSCHAUER-KARTEN-OHNE-KASTEN @ZM-160 die Karte eines beendeten Gruppenspiels zeigt die Torzahlen in Kästen in Teamfarbe', async ({ page }) => {
    await oeffneZuschauer(page, 'beendet');
    const karteSpiel2 = page.locator('.mobile-view [data-match-card]').first();
    await expect(karteSpiel2.getByTestId(/^match-box-.*-home$/)).toBeVisible({ timeout: 3000 });
  });

  // Das beendete Finale (Ring, Pokal, Weste am Handy) prüft `ZM-158-karte-kasten.test.tsx` bis in die Finalrunde der Zuschauer-Seite: die Saat der App regeneriert
  // die Finalrunde aus der Gruppenphase, ein vorgefertigtes Finale erscheint hier nicht als Finalkarte.
});

const COCKPITS = [{ name: 'laptop', width: 1280, height: 720 }, { name: 'handy', width: 390, height: 844 }];
for (const g of COCKPITS) {
  test.describe(`Leibchen-Anzeige Cockpit ${g.name}`, () => {
    for (const [lang, heim] of [['kurz', NAMEN[0]], ['lang', NAME_50]] as const) {
      test(`@SL-176 @ZM-161 Cockpit-Kasten zeigt die Form des Trainingsleibchens, der flache Team-Kopf behält die Streifen, Name ${lang} (${g.name})`, async ({ page }) => {
        await oeffneCockpit(page, g, heim);
        await bild(page, `c-${g.name}-${lang}`);
        const kasten = page.getByTestId('scoreboard-box-links');
        await expect(kasten).toHaveAttribute('data-fill', 'vest');
        await expect(kasten.locator('[data-teil]')).toHaveCount(3);
        // Der flache Kopf behält die Streifen: die Form des Trainingsleibchens trägt dort nicht (Bilder `kopf-versuch-*`, Bericht)
        const kopf = page.getByTestId('team-head-home');
        await expect(kopf).toHaveAttribute('data-fill', 'vest');
        // …am Handy als zwei schmale Streifen am Rand neben dem Text (@SL-225), am Laptop als ganze Fläche; nie mit Hals- und Schulterteilen des Kastens
        await expect(kopf.locator('[data-teil="streifen"]')).toHaveCount(g.name === 'handy' ? 2 : 0);
        await expect(kopf.locator('[data-teil]:not([data-teil="streifen"])')).toHaveCount(0);
      });
    }
  });
}

/** Cockpit-Stufen: Handy, Laptop knapp (< 720 px Fensterhöhe), normal, groß (ab 800 px). */
const STUFEN = [
  { name: 'handy', width: 390, height: 844 }, { name: 'knapp', width: 1280, height: 680 },
  { name: 'normal', width: 1280, height: 760 }, { name: 'gross', width: 1280, height: 900 },
];
for (const g of STUFEN) {
  test(`@SL-176 @ZM-161 Cockpit-Kasten: die Oberkante der großen Ziffer liegt unter dem Halsausschnitt, die Ziffer steht ganz auf der Leibchenfarbe (${g.name})`, async ({ page }) => {
    await oeffneCockpit(page, g, NAMEN[0]);
    const gemessen = await page.evaluate(() => {
      const kasten = document.querySelector('[data-testid="scoreboard-box-links"]')!;
      const k = kasten.getBoundingClientRect();
      const ziffer = kasten.querySelector('[data-testid="scoreboard-box-links-digits"]')!;
      const rect = ziffer.getBoundingClientRect();
      const stil = getComputedStyle(ziffer);
      // Tintenoberkante der Ziffer „0“: Grundlinie der Zeile minus tatsächliche Zeichenhöhe (Schriftmaße der Zeichenfläche)
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
      const m = ctx.measureText('0');
      const zeile = parseFloat(stil.fontSize) * (stil.lineHeight === 'normal' ? 1 : parseFloat(stil.lineHeight) / parseFloat(stil.fontSize));
      const grundlinie = rect.top + (zeile - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      const tinteOben = grundlinie - m.actualBoundingBoxAscent;
      const hals = kasten.querySelectorAll('[data-teil]')[2].getBoundingClientRect();
      return { tinteOben, halsUnten: hals.bottom, tintenHoehe: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, kastenOben: k.top };
    });
    expect(gemessen.tinteOben, `Ziffer (Oberkante ${gemessen.tinteOben.toFixed(1)}) unter dem Hals (Unterkante ${gemessen.halsUnten.toFixed(1)})`).toBeGreaterThanOrEqual(gemessen.halsUnten);
    expect(gemessen.tintenHoehe, 'Ziffernhöhe bleibt ≥ 11 mm (≈ 41 px)').toBeGreaterThanOrEqual(41);
    await bild(page, `c-${g.name}-hals-fix1`);
  });
}

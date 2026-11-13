/**
 * Leibchen-Karte im Cockpit (Leibchen 2b-2, Lage B) – Playwright über die lokale Saat `leibchen-vor-anpfiff` (Spiel 3 TSV Waging 1 gegen TSV Petting,
 * beide Blau, Feld 1; Gastkonto, nichts geht zum Server). Szenarien: @SL-206 (Karte über der Daumenleiste), @SL-211 (K-1 Tipps bis zum Anpfiff),
 * @SL-218 (K-2/K-8 Tipp-Zähler), @SL-221 (K-4 nichts springt), @SL-223 (K-5 untere zwei Drittel, Lage), @SL-224 (K-6 Tippziele, gleich große Tasten),
 * @SL-215 (ohne Scrollen im Bild). Gezählt wird vom ersten Tipp bis einschließlich „Bestätigen“. Fenster: 360×640 (Handy), 390×844, Tablet hochkant, Laptop;
 * die Messungen laufen in jedem Projekt, die Fenstergröße setzt der Test selbst.
 * Die Zählregel steht auch als Verhaltenstest in `LeibchenKarte.test.tsx`; hier zählen echte Klicks und gemessene Bildpunkte.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const SPIEL_3 = '0000000b-0000-4000-9000-000000000003';
const FENSTER = [
  { name: 'mobile-sm 360×640', width: 360, height: 640, handy: true },
  { name: 'mobile-md 390×844', width: 390, height: 844, handy: true },
  { name: 'tablet-portrait 768×1024', width: 768, height: 1024, handy: false },
  { name: 'desktop 1440×900', width: 1440, height: 900, handy: false },
] as const;

/** Wartet, bis alle endlichen Animationen (Blatt, Einblendungen) fertig sind; die endlose „Live“-Pulsanimation zählt nicht. */
async function animationenFertig(page: Page): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished)));
}

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
// Die Fenstergröße setzt jeder Test selbst: ein Projekt genügt (sonst läuft dieselbe Messung 4 × je Fenster).
test.beforeEach(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
  test.skip(testInfo.project.name !== 'desktop', 'Fenstergröße setzt der Test selbst, nur im Projekt „desktop“.');
});
/** Der Schutz gegen Doppeltipp (@SL-221) schluckt ein „Ändern“ in der ersten Sekunde nach „Bestätigen“: antippen, bis die Karte offen ist (keine feste Wartezeit). */
async function aendernOeffnen(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByTestId('leibchen-aendern').click({ timeout: 1000 });
    await expect(page.getByTestId('leibchen-vorschlag')).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 10000 });
}

const SPIEL_2 = '0000000b-0000-4000-9000-000000000002';

/** Endstand von Spiel 2 (eben beendet, 2:1, 9:00 gespielt, Engine-Kopie der Saat); `ohneKarte`: Petting spielt Rot, dann braucht Spiel 3 keine Karte. */
async function oeffneEndstand(page: Page, fenster: { width: number; height: number }, ohneKarte = false): Promise<void> {
  await page.setViewportSize({ width: fenster.width, height: fenster.height });
  const saat = leseSaat('leibchen-vor-anpfiff');
  if (ohneKarte) {
    for (const t of saat.datenbanken[0].eintraege.tournaments as Array<{ id: string; teams: Array<{ name: string; colors?: { primary: string } }> }>) {
      for (const team of t.teams) { if (team.name === 'TSV Petting') { team.colors = { primary: '#C62828' }; } }
    }
  }
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/tournament/leibchen-endstand/live?matchId=${SPIEL_2}`, { waitUntil: 'commit' }).catch(() => undefined);
  await expect(page.getByTestId('match-next-button')).toBeVisible({ timeout: 25000 });
  await animationenFertig(page);
}

/** Wie weit der Teamkopf unten über den Rand der Fläche ragt, die ihn zeigt (> 0: von einer rollenden oder abgeschnittenen Fläche gekappt). */
async function kopfRagtUeber(page: Page): Promise<number> {
  return page.getByTestId('team-head-home').evaluate((el) => {
    const r = el.getBoundingClientRect();
    let schlimmster = Number.NEGATIVE_INFINITY;
    for (let p = el.parentElement; p !== null; p = p.parentElement) {
      if (getComputedStyle(p).overflowY !== 'visible') { schlimmster = Math.max(schlimmster, r.bottom - p.getBoundingClientRect().bottom); }
    }
    return schlimmster;
  });
}

interface Box { x: number; y: number; width: number; height: number }

async function box(el: Locator): Promise<Box> {
  const b = await el.boundingBox();
  if (b === null) { throw new Error('Element ohne Lage'); }
  return b;
}

async function oeffne(page: Page, fenster: { width: number; height: number }, hallenFarben?: readonly string[] | null, turnier = 'leibchen-7a', unbestaetigt = false, ohneKarte = false): Promise<{ tippe: (el: Locator) => Promise<void>; zaehle: () => void; tipps: () => number }> {
  await page.setViewportSize({ width: fenster.width, height: fenster.height });
  const saat = leseSaat('leibchen-vor-anpfiff');
  if (hallenFarben !== undefined) {
    // andere Hallenfarben des Turniers (@SL-219: Gelb und Orange / Gelb und Grün / keine eingetragen)
    for (const t of saat.datenbanken[0].eintraege.tournaments as Array<Record<string, unknown>>) {
      if (hallenFarben === null) { delete t.bibColors; delete t.bibColor; } else { t.bibColors = [...hallenFarben]; t.bibColor = hallenFarben[0]; }
    }
  }
  if (ohneKarte) {
    // Gegenbeispiel: verschiedene Trikotfarben, also keine Karte
    for (const t of saat.datenbanken[0].eintraege.tournaments as Array<{ teams: Array<{ name: string; colors?: { primary: string } }> }>) {
      for (const team of t.teams) { if (team.name === 'TSV Petting') { team.colors = { primary: '#C62828' }; } }
    }
  }
  if (unbestaetigt) {
    // die Wahl von Spiel 3 ist noch offen: die Karte steht statt der Zeile
    for (const t of saat.datenbanken[0].eintraege.tournaments as Array<{ matches: Array<Record<string, unknown>> }>) {
      for (const m of t.matches) { if (m.matchNumber === 3) { delete m.kitDecision; delete m.kit; } }
    }
  }
  await installiereSaat(page.context(), saat);
  // Die App ersetzt beim Start einmal die Adresse; ein dadurch abgebrochenes `goto` ist kein Fehler, entscheidend ist die Karte im Bild
  await page.goto(`/#/tournament/${turnier}/live?matchId=${SPIEL_3}`, { waitUntil: 'commit' }).catch(() => undefined);
  await expect(page.locator(ohneKarte ? '[data-testid="match-start-button"]' : '[data-testid="leibchen-karte"],[data-testid="leibchen-zeile"]').first()).toBeVisible({ timeout: 25000 });
  await page.evaluate(() => document.fonts.ready);
  let n = 0;
  return { tippe: async (el) => { n += 1; await el.click(); }, zaehle: () => { n += 1; }, tipps: () => n };
}

for (const f of FENSTER) {
  test.describe(`Leibchen-Karte ${f.name}`, () => {
    test(`@SL-206 @SL-215 @SL-224 die Karte steht ohne Scrollen im Bild direkt über „Anpfeifen“, Tippziele 44/56, beide Tasten gleich groß und umrandet (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      const karte = await box(page.getByTestId('leibchen-karte'));
      const anpfiff = await box(page.getByTestId('match-start-button'));
      expect(karte.y).toBeGreaterThanOrEqual(0);
      expect(anpfiff.y + anpfiff.height).toBeLessThanOrEqual(f.height + 1);
      expect(karte.y + karte.height).toBeLessThanOrEqual(anpfiff.y + 1); // die Karte liegt über der Leiste, nichts darunter
      const best = await box(page.getByTestId('leibchen-bestaetigen'));
      const keine = await box(page.getByTestId('leibchen-keine'));
      expect(best.height).toBeGreaterThanOrEqual(56); // K-6: Haupttasten 56
      expect(best.width).toBeGreaterThanOrEqual(44);
      expect(Math.abs(best.width - keine.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(best.height - keine.height)).toBeLessThanOrEqual(1);
      const vorschlag = await box(page.getByTestId('leibchen-vorschlag'));
      expect(vorschlag.height).toBeGreaterThanOrEqual(44);
      expect(vorschlag.width).toBeGreaterThanOrEqual(44);
      // beide Tasten nur umrandet (keine gefüllt)
      for (const id of ['leibchen-bestaetigen', 'leibchen-keine']) {
        expect(await page.getByTestId(id).evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      }
    });

    test(`@SL-223 die Mitte von „Bestätigen“, „Keine Leibchen“ und dem Vorschlag liegt im unteren Zweidrittel des Fensters (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      for (const id of ['leibchen-bestaetigen', 'leibchen-keine', 'leibchen-vorschlag']) {
        const b = await box(page.getByTestId(id));
        expect(b.y + b.height / 2).toBeGreaterThanOrEqual(f.height / 3);
      }
    });

    test(`@SL-211 @SL-218 K-1/K-2: Tipps bis zum Anpfiff und beim Ändern (${f.name})`, async ({ page }) => {
      const o = await oeffne(page, f);
      // K-1: „Bestätigen“ und „Anpfeifen“ = 2 Tipps, das Spiel läuft
      await o.tippe(page.getByTestId('leibchen-bestaetigen'));
      await expect(page.getByTestId('leibchen-zeile')).toContainText('TSV Waging 1 zieht Gelb');
      await o.tippe(page.getByTestId('match-start-button'));
      await expect(page.getByTestId('match-pause-button')).toBeVisible();
      expect(o.tipps()).toBe(2);
    });

    test(`@SL-218 K-2: Team ändern und bestätigen = 3 Tipps, Team und Farbe = 4 Tipps, Aufgeben = 2 Tipps (${f.name})`, async ({ page }) => {
      const o = await oeffne(page, f);
      await o.tippe(page.getByTestId('leibchen-vorschlag'));
      await o.tippe(page.getByTestId('leibchen-team-gast'));
      await o.tippe(page.getByTestId('leibchen-bestaetigen'));
      await expect(page.getByTestId('leibchen-zeile')).toContainText('TSV Petting zieht Gelb');
      expect(o.tipps()).toBe(3);
      // K-8: eine Wahl wieder aufgeben („Ändern“, „Keine Leibchen“) = 2 Tipps
      const davor = o.tipps();
      await aendernOeffnen(page);
      o.zaehle(); // der erfolgreiche Tipp auf „Ändern“ zählt einmal (die vom Schutz geschluckten zählen nicht)
      await o.tippe(page.getByTestId('leibchen-keine'));
      await expect(page.getByTestId('leibchen-zeile')).toContainText('Keine Leibchen');
      expect(o.tipps() - davor).toBe(2);
    });

    test(`@SL-221 K-4: beim Schrumpfen der Karte zur Zeile und beim Aufklappen der Wahl ändert „Anpfeifen“ seine Lage um höchstens 1 Bildpunkt (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      const vorher = await box(page.getByTestId('match-start-button'));
      await page.getByTestId('leibchen-vorschlag').click();
      const offen = await box(page.getByTestId('match-start-button'));
      expect(Math.abs(offen.y - vorher.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(offen.height - vorher.height)).toBeLessThanOrEqual(1);
      if (f.handy) {
        // am Handy weichen Tafel und Einträge, solange die Wahl offen ist (@SL-221)
        await expect(page.getByTestId('scoreboard')).toBeHidden();
        await expect(page.getByTestId('leibchen-wahl')).toBeInViewport();
        await expect(page.getByTestId('match-start-button')).toBeInViewport();
      } else {
        // auf Tablet und Laptop bleibt alles stehen
        await expect(page.getByTestId('scoreboard')).toBeVisible();
      }
      await page.getByTestId('leibchen-vorschlag').click(); // zuklappen: alles kommt zurück
      await expect(page.getByTestId('scoreboard')).toBeVisible();
      await page.getByTestId('leibchen-bestaetigen').click();
      const nachher = await box(page.getByTestId('match-start-button'));
      expect(Math.abs(nachher.y - vorher.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(nachher.height - vorher.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(nachher.x - vorher.x)).toBeLessThanOrEqual(1);
    });

    test(`@SL-237 @SL-221 Vorschlag öffnen, dann „Anpfeifen“: das Spiel läuft, Tafel und Tor-Tasten sind wieder da (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      await expect(page.getByTestId('leibchen-ueberschrift')).toContainText('Leibchen für dieses Spiel · Spiel 3'); // @SL-215 Z2: Überschrift immer
      await page.getByTestId('leibchen-vorschlag').click();
      if (f.handy) { await expect(page.getByTestId('scoreboard')).toBeHidden(); }
      await page.getByTestId('match-start-button').click();
      await expect(page.getByTestId('match-pause-button')).toBeVisible();
      await expect(page.getByTestId('scoreboard')).toBeVisible();
      await expect(page.getByTestId('goal-button-home')).toBeVisible(); // Tor-Taste nicht versteckt (die offene Wahl endet mit der Karte)
    });

    const HALLEN = [
      { name: 'Gelb und Orange', farben: ['#FFCC00', '#FF6600'] as const, erwartet: ['gelb', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz'] },
      { name: 'Gelb und Grün', farben: ['#FFCC00', '#009933'] as const, erwartet: ['gelb', 'gruen', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz'] },
      { name: 'keine eingetragen', farben: null, erwartet: ['gelb', 'orange', 'neongruen', 'pink', 'rot', 'blau', 'weiss', 'schwarz'] },
    ] as const;
    for (const h of HALLEN) {
      test(`@SL-219 @OB-083 @SL-221 „Andere Farbe …“ bei Hallenfarben ${h.name}: Hallenfarben zuerst, alle Farbfelder und „X“ stehen im Fenster, nichts überlappt, nichts rollt, Ziele mindestens 44 px (${f.name})`, async ({ page }) => {
        await oeffne(page, f, h.farben);
        await page.getByTestId('leibchen-vorschlag').click();
        await page.getByTestId('leibchen-andere').click();
        const blatt = page.getByTestId('leibchen-andere-blatt');
        await expect(blatt).toBeVisible();
        await animationenFertig(page);
        const felder = await page.locator('[data-testid="leibchen-andere-blatt"] [data-testid^="leibchen-farbe-"]').all();
        const namen: string[] = [];
        for (const el of felder) { namen.push(((await el.getAttribute('data-testid')) ?? '').replace('leibchen-farbe-', '')); }
        expect(namen, 'Hallenfarben zuerst, darunter die Grundauswahl').toEqual([...h.erwartet]);
        const boxen: Box[] = [];
        for (const el of felder) { boxen.push(await box(el)); }
        const schliessen = await box(page.getByTestId('leibchen-andere-schliessen'));
        for (const b of [...boxen, schliessen]) {
          expect(b.height).toBeGreaterThanOrEqual(44);
          expect(b.width).toBeGreaterThanOrEqual(44);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.y + b.height).toBeLessThanOrEqual(f.height);
          expect(b.x + b.width).toBeLessThanOrEqual(f.width);
        }
        for (let i = 0; i < boxen.length; i++) {
          for (let j = i + 1; j < boxen.length; j++) {
            const a = boxen[i]; const c = boxen[j];
            expect(a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height, `Felder ${String(i)} und ${String(j)} überlappen nicht`).toBe(false);
          }
        }
        expect(await blatt.evaluate((el) => [el, ...el.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).length), 'nichts rollt im Blatt').toBe(0);
        if (h.farben !== null && h.farben[1] === '#FF6600') {
          // eine Farbe antippen: das Blatt schließt, die Karte zeigt die Wahl (im Browser geprüft: die Wahl darf beim Schließen nicht verloren gehen)
          await page.getByTestId('leibchen-farbe-pink').click();
          await expect(blatt).toBeHidden();
          await expect(page.getByTestId('leibchen-vorschlag')).toContainText('Pink');
        }
      });
    }

    test(`@SL-219 @SL-150 Nachtragen im laufenden Spiel: nichts rollt, „X“ und „Speichern“ stehen im Fenster, „Andere Farbe …“ öffnet dasselbe Blatt mit allen Feldern im Fenster (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      await page.getByTestId('leibchen-bestaetigen').click();
      await page.getByTestId('match-start-button').click();
      await expect(page.getByTestId('match-pause-button')).toBeVisible();
      await page.getByTestId('cockpit-more-button').click();
      await page.getByTestId('mehr-leibchen-nachtragen').click();
      const nachtragen = page.getByTestId('leibchen-nachtragen');
      await expect(nachtragen).toBeVisible();
      await animationenFertig(page);
      // streng (@SL-150/@SL-219): nichts rollt im Blatt, „X“ oben und „Speichern“ unten stehen im Fenster
      expect(await nachtragen.evaluate((el) => [el, ...el.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).length), 'nichts rollt im Nachtragen-Blatt').toBe(0);
      const schliessen = await box(page.getByTestId('nachtrag-schliessen'));
      expect(schliessen.y).toBeGreaterThanOrEqual(0);
      expect(schliessen.height).toBeGreaterThanOrEqual(44);
      const speichern = await box(page.getByTestId('nachtrag-speichern'));
      expect(speichern.y + speichern.height).toBeLessThanOrEqual(f.height);
      await page.getByTestId('nachtrag-andere').click();
      const felder = await page.locator('[data-testid="nachtrag-andere-blatt"] [data-testid^="nachtrag-farbe-"]').all();
      expect(felder).toHaveLength(8);
      const blatt = page.getByTestId('nachtrag-andere-blatt');
      expect(await blatt.evaluate((el) => [el, ...el.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).length), 'nichts rollt im Blatt „Andere Farbe“').toBe(0);
      for (const el of felder) {
        const b = await box(el);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(f.height);
        expect(b.x + b.width).toBeLessThanOrEqual(f.width);
      }
    });

    if (f.name.startsWith('desktop')) {
      test(`@SL-218 am Laptop liegt die Karte unten rechts über der Leiste, nicht über die ganze Breite (${f.name})`, async ({ page }) => {
        await oeffne(page, f);
        const karte = await box(page.getByTestId('leibchen-karte'));
        const anpfiff = await box(page.getByTestId('match-start-button'));
        expect(karte.x, 'rechte Hälfte').toBeGreaterThanOrEqual(f.width / 2);
        expect(karte.x + karte.width, 'bis zum rechten Rand').toBeGreaterThanOrEqual(f.width - 40);
        expect(karte.width, 'höchstens ein Drittel der Breite').toBeLessThanOrEqual(f.width * 0.36);
        expect(karte.y + karte.height, 'über der Leiste').toBeLessThanOrEqual(anpfiff.y + 1);
      });
    }

    test(`@SL-240 Endstand mit Karte: ${f.handy ? 'kein großer Uhr-Bereich, „gespielt 9:00“ in der Quittungszeile, Teamnamen und „Nächstes:“ vollständig, nichts von der Karte überdeckt' : 'der Uhr-Bereich bleibt wie in @SL-169 (Tablet und Laptop)'} (${f.name})`, async ({ page }) => {
      await oeffneEndstand(page, f);
      await expect(page.getByTestId('leibchen-karte')).toBeVisible();
      const quittung = page.getByTestId('scoreboard-quittung');
      if (f.handy) {
        await expect(page.getByTestId('scoreboard-clock')).toHaveText(''); // kein Uhr-Bereich mehr
        await expect(page.getByTestId('scoreboard-clock-rest')).toHaveCount(0);
        await expect(quittung).toContainText('Abgepfiffen · 2:1 gespeichert · gespielt 9:00');
        const karte = await box(page.getByTestId('leibchen-karte'));
        for (const id of ['team-name-home', 'team-name-away', 'cockpit-naechstes']) {
          const b = await box(page.getByTestId(id));
          expect(b.y, `${id} beginnt im Fenster`).toBeGreaterThanOrEqual(0);
          expect(b.y + b.height, `${id} endet über der Karte`).toBeLessThanOrEqual(karte.y + 1);
          expect(b.x + b.width, `${id} ganz in der Breite`).toBeLessThanOrEqual(f.width);
        }
        const q = await box(quittung);
        expect(q.y + q.height, 'Quittungszeile über der Karte').toBeLessThanOrEqual(karte.y + 1);
        // der Satz bricht nicht mitten im Wort: nichts läuft seitlich über
        expect(await quittung.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      } else {
        await expect(page.getByTestId('scoreboard-clock')).toContainText('Gespielt');
        await expect(quittung).not.toContainText('gespielt 9:00');
      }
    });

    if (f.handy) {
      test(`@SL-240 @SL-208 Endstand am Handy: nach „Bestätigen“ (Zeile statt Karte) springt die Tafel nicht, die Uhr bleibt klein (${f.name})`, async ({ page }) => {
        await oeffneEndstand(page, f);
        const messen = async (): Promise<{ tafelOben: number; tafelHoehe: number; kopfOben: number; weiter: number }> => ({
          tafelOben: (await box(page.getByTestId('scoreboard'))).y, tafelHoehe: (await box(page.getByTestId('scoreboard'))).height,
          kopfOben: (await box(page.getByTestId('team-head-home'))).y, weiter: (await box(page.getByTestId('match-next-button'))).y,
        });
        const vorher = await messen();
        await page.getByTestId('leibchen-bestaetigen').click();
        await expect(page.getByTestId('leibchen-zeile')).toBeVisible();
        await animationenFertig(page);
        const nachher = await messen();
        expect(Math.abs(nachher.tafelHoehe - vorher.tafelHoehe), 'Tafel gleich hoch').toBeLessThanOrEqual(1);
        expect(Math.abs(nachher.kopfOben - vorher.kopfOben), 'Teamköpfe an derselben Stelle').toBeLessThanOrEqual(1);
        expect(Math.abs(nachher.weiter - vorher.weiter), '„Weiter“ springt nicht').toBeLessThanOrEqual(1);
        await expect(page.getByTestId('scoreboard-clock-rest')).toHaveCount(0);
      });
    }

    test(`@SL-240 Gegenbeispiel: Endstand ohne Karte (kein Leibchen nötig) behält den großen Uhr-Bereich „Gespielt 9:00“ wie in @SL-169 (${f.name})`, async ({ page }) => {
      await oeffneEndstand(page, f, true);
      await expect(page.getByTestId('leibchen-karte')).toHaveCount(0);
      await expect(page.getByTestId('scoreboard-clock')).toContainText('Gespielt');
      await expect(page.getByTestId('scoreboard-clock-rest')).toHaveText('9:00');
      await expect(page.getByTestId('scoreboard-quittung')).not.toContainText('gespielt');
    });

    test(`@OB-021 @SL-208 Teamname mit 50 Zeichen: der Name im Kopf steht vollständig über der Zeile, nichts ist abgeschnitten (${f.name})`, async ({ page }) => {
      await oeffne(page, f, undefined, 'leibchen-lang');
      const name = page.getByTestId('team-name-home');
      await expect(name).toBeVisible();
      const zeile = await box(page.getByTestId('leibchen-zeile'));
      const n = await name.evaluate((el) => { const r = el.getBoundingClientRect(); return { unten: r.bottom, oben: r.top, ueberlauf: el.scrollHeight - el.clientHeight, breite: el.scrollWidth - el.clientWidth }; });
      expect(n.oben).toBeGreaterThanOrEqual(0);
      expect(n.unten, 'der Name endet über der Zeile').toBeLessThanOrEqual(zeile.y + 1);
      expect(n.ueberlauf).toBeLessThanOrEqual(0);
      expect(n.breite).toBeLessThanOrEqual(0);
      // der Kopf (nicht nur der Name) steht ganz im sichtbaren Bereich der Fläche über der Zeile
      const kopf = await page.getByTestId('team-head-home').evaluate((el) => el.getBoundingClientRect().bottom);
      expect(kopf).toBeLessThanOrEqual(zeile.y + 1);
    });

    for (const [fall, turnier, unbestaetigt] of [['normalen Namen', 'leibchen-7a', false], ['50-Zeichen-Namen', 'leibchen-lang', true]] as const) {
      test(`@SL-241 @OB-021 @SL-206 Karte offen, ${fall}: der Teamkopf steht vollständig über der Karte, nichts ist gekappt (${f.name})`, async ({ page }) => {
        await oeffne(page, f, undefined, turnier, unbestaetigt);
        await expect(page.getByTestId('leibchen-karte')).toBeVisible();
        await animationenFertig(page);
        const karte = await box(page.getByTestId('leibchen-karte'));
        const kopf = await page.getByTestId('team-head-home').evaluate((el) => el.getBoundingClientRect().bottom);
        const kopfAway = await page.getByTestId('team-head-away').evaluate((el) => el.getBoundingClientRect().bottom);
        const name = await page.getByTestId('team-name-home').evaluate((el) => el.scrollHeight - el.clientHeight);
        expect(name).toBeLessThanOrEqual(0);
        expect(kopf, 'der Kopf endet über der Karte').toBeLessThanOrEqual(karte.y + 1);
        expect(kopfAway, 'der Gast-Kopf endet über der Karte').toBeLessThanOrEqual(karte.y + 1);
        expect(await kopfRagtUeber(page), 'keine rollende oder abgeschnittene Fläche kappt den Kopf').toBeLessThanOrEqual(0);
        expect(karte.y + karte.height).toBeLessThanOrEqual(f.height);
      });
    }

    test(`@SL-241 vor dem Anpfiff mit Karte: ${f.handy ? 'keine große Spielzeit, die Kopfzeile nennt „Spielzeit 9:00“' : 'Gegenbeispiel Tablet/Laptop: die Spielzeit bleibt groß wie in @SL-197'} (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      await animationenFertig(page);
      if (f.handy) {
        await expect(page.getByTestId('scoreboard-clock-rest')).toHaveCount(0);
        await expect(page.getByTestId('scoreboard-clock-sub')).toHaveText(/^Anstoß\s\d{2}:\d{2}\s·\sSpiel\s3\s·\sFeld\s\d+\s·\sSpielzeit\s\d+:\d{2}$/);
        // sauberer Umbruch: nur an „ · “, nie mitten in einer Angabe (jede Angabe steht in einer Zeile)
        const umbrueche = await page.getByTestId('scoreboard-clock-sub').evaluate((el) => {
          const bereich = document.createRange(); const text = el.firstChild as Text; const zeilen = new Set<number>();
          const stellen = [...text.data.matchAll(/[^ ·]+(?:\u00A0[^ ·]+)*/g)];
          for (const m of stellen) { bereich.setStart(text, m.index ?? 0); bereich.setEnd(text, (m.index ?? 0) + m[0].length); zeilen.add(bereich.getClientRects().length); }
          return [...zeilen];
        });
        expect(umbrueche, 'jede Angabe („Spiel 3“, „Spielzeit 9:00“) steht in einer Zeile').toEqual([1]);
      } else {
        await expect(page.getByTestId('scoreboard-clock-rest')).toHaveText('9:00');
        await expect(page.getByTestId('scoreboard-clock')).toContainText('Spielzeit');
      }
    });

    if (f.handy) {
      test(`@SL-241 nach „Bestätigen“ bleibt die Tafel, wie sie ist: Höhe, Köpfe und „Anpfeifen“ springen nicht, die Spielzeit bleibt klein (${f.name})`, async ({ page }) => {
        await oeffne(page, f);
        await animationenFertig(page);
        const messe = async () => ({
          tafel: (await box(page.getByTestId('scoreboard'))).height, kopf: (await box(page.getByTestId('team-head-home'))).y,
          anpfiff: (await box(page.getByTestId('match-start-button'))).y,
        });
        const vorher = await messe();
        await page.getByTestId('leibchen-bestaetigen').click();
        await expect(page.getByTestId('leibchen-zeile')).toBeVisible();
        await animationenFertig(page);
        const nachher = await messe();
        expect(Math.abs(nachher.tafel - vorher.tafel), 'Tafelhöhe').toBeLessThanOrEqual(1);
        expect(Math.abs(nachher.anpfiff - vorher.anpfiff), '„Anpfeifen“').toBeLessThanOrEqual(1);
        await expect(page.getByTestId('scoreboard-clock-rest')).toHaveCount(0);
        await expect(page.getByTestId('scoreboard-clock-sub')).toContainText('Spielzeit');
        expect(await kopfRagtUeber(page)).toBeLessThanOrEqual(0);
        expect(nachher.kopf).toBeGreaterThanOrEqual(0);
      });

      test(`@SL-241 Gegenbeispiel ohne Karte (verschiedene Trikotfarben): die Spielzeit steht groß wie in @SL-197 (${f.name})`, async ({ page }) => {
        await oeffne(page, f, undefined, 'leibchen-7a', false, true);
        await animationenFertig(page);
        await expect(page.getByTestId('leibchen-karte')).toHaveCount(0);
        await expect(page.getByTestId('scoreboard-clock-rest')).toHaveText('9:00');
      });

      test(`@SL-241 nach dem Anpfiff läuft die große Uhr wie sonst, nichts ist verdeckt (${f.name})`, async ({ page }) => {
        await oeffne(page, f);
        await page.getByTestId('leibchen-bestaetigen').click();
        await page.getByTestId('match-start-button').click();
        await expect(page.getByTestId('match-pause-button')).toBeVisible();
        await animationenFertig(page);
        await expect(page.getByTestId('scoreboard-clock-rest')).toBeVisible();
        expect(await kopfRagtUeber(page)).toBeLessThanOrEqual(0);
      });
    }

    test(`@SL-224 „Ändern“ in der Zeile und jede Farbe der Wahl sind mindestens 44×44 groß (${f.name})`, async ({ page }) => {
      await oeffne(page, f);
      await page.getByTestId('leibchen-bestaetigen').click();
      const aendern = await box(page.getByTestId('leibchen-aendern'));
      expect(aendern.height).toBeGreaterThanOrEqual(44);
      expect(aendern.width).toBeGreaterThanOrEqual(44);
      await aendernOeffnen(page);
      await page.getByTestId('leibchen-vorschlag').click();
      await page.getByTestId('leibchen-andere').click();
      for (const el of await page.locator('[data-testid^="leibchen-farbe-"], [data-testid^="leibchen-team-"]').all()) {
        const b = await box(el);
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.width).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

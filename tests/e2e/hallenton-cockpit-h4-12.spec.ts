/**
 * H4-12 (@HT-009, @HT-034, @HT-035, @HT-036, @HT-039, @HT-040, @HT-050, C-TON-TURNIERWEIT): Hinweise zum Hallen-Lautsprecher im echten Live-Cockpit und
 * „Ton dieses Geräts“ im Cockpit-Dialog am Prüfstand tests/e2e/harness/cockpit-hallenton.html (echtes `LiveCockpit`, echte Leitung mit gefälschtem
 * Server-Aufruf, echter Speicher des Geräts), bei 360×640 und 1280×720, hell und dunkel. Je Fall: die Wortlaute des Records stehen da, der Kasten
 * verdeckt weder Uhr noch Stand noch Tor-Tasten (Messung der Rechtecke), keine Taste unter 44 px, nichts läuft über, kein HART-Befund von
 * `npm run visual:metrics`. Bilder: Ordner aus H412_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { GERAETE, hartBefunde, speichereBild } from './helpers/hallentonPruefstand';

const FAELLE = ['kein-netz', 'lautsprecher-aus', 'ausgang-geaendert', 'halbzeit', 'anpfiff', 'uhr'] as const;
type Fall = (typeof FAELLE)[number];
const KASTEN: Record<Fall, { id: string; text: RegExp }> = {
  'kein-netz': { id: 'cockpit-hall-kein-netz', text: /Kein Netz – Halle zeigt alten Stand/ },
  'lautsprecher-aus': { id: 'cockpit-hall-aus', text: /Hallen-Lautsprecher aus – Ende selbst anzeigen\s*Grund: meldet sich nicht \(zuletzt \d\d:\d\d\)/ },
  anpfiff: { id: 'cockpit-hall-aus', text: /Hallen-Lautsprecher aus – Ende selbst anzeigen\s*Grund: Ton nicht aktiviert/ },
  halbzeit: { id: 'cockpit-hall-aus', text: /Hallen-Lautsprecher aus – Ende selbst anzeigen\s*Grund: Ton nicht aktiviert/ },
  'ausgang-geaendert': { id: 'cockpit-hall-ausgang-geaendert', text: /Hallenton-Ausgang geändert/ },
  uhr: { id: 'cockpit-hall-uhr', text: /Uhr nicht abgeglichen – Hallenton kann abweichen/ },
};
/** Vor dem Anpfiff: das Spiel ist noch nicht angepfiffen (Kasten kommt aus dem Server-Stand, @HT-039). */
const VOR_ANPFIFF: readonly Fall[] = ['anpfiff', 'uhr'];

type Rechteck = { x: number; y: number; width: number; height: number };
const schneiden = (a: Rechteck, b: Rechteck): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function rechteck(page: Page, testid: string): Promise<Rechteck> {
  const box = await page.getByTestId(testid).first().boundingBox();
  expect(box, testid).not.toBeNull();
  return box as Rechteck;
}

/** Wartet, bis alle endlichen Animationen und Übergänge fertig sind (endlose bleiben außen vor). */
async function animationenFertig(page: Page): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
}

test.describe('@HT-009 @HT-034 @HT-036 @HT-039 @HT-040 @HT-050 H4-12 Cockpit-Hinweise (Prüfstand)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    // Fehler der Seite sichtbar machen (ein leerer Prüfstand heißt meist: Baustein wirft beim Aufbau)
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const fall of FAELLE) {
    for (const g of GERAETE) {
      for (const thema of ['light', 'dark'] as const) {
        test(`${fall} ${g.name}, ${thema}: Wortlaut, nichts verdeckt, Tasten ≥ 44 px, kein Überlauf`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width: g.width, height: g.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0)); // die Geräteuhr steht vor dem Anstoß um 14:02 (Mockup): kein „überfällig“
          await page.goto(`/tests/e2e/harness/cockpit-hallenton.html?fall=${fall}`);
          const kasten = page.getByTestId(KASTEN[fall].id);
          await expect(kasten).toBeVisible({ timeout: 15_000 });
          await expect(kasten).toContainText(KASTEN[fall].text);
          await expect(page.getByTestId('cockpit-hall-hinweise')).toBeVisible();
          // „Kein Netz“ steht schon nach dem ersten gescheiterten Versuch, nicht erst nach 15 s (der Prüfstand wartet höchstens 15 s)
          // ruhig: die Zeile „Ausgang geändert“ hat keine Taste
          if (fall === 'ausgang-geaendert') {
            await expect(kasten.getByRole('button')).toHaveCount(0);
          }
          // nichts verdeckt: Uhr, Stand und Tor-Tasten liegen frei und im Bild (@HT-040)
          const k = await rechteck(page, KASTEN[fall].id);
          const uhr = await rechteck(page, 'scoreboard-clock');
          expect(schneiden(k, uhr), 'Kasten überdeckt die Uhr nicht').toBe(false);
          if (fall === 'halbzeit') {
            await expect(page.getByTestId('scoreboard')).toContainText(/Pause\s*0:40\s*bis Wiederanpfiff/);
          } else if (!VOR_ANPFIFF.includes(fall)) {
            await expect(page.getByTestId('scoreboard')).toContainText('4:32');
            await expect(page.getByTestId('scoreboard')).toContainText('2. Halbzeit');
            for (const seite of ['home', 'away']) {
              const tor = await rechteck(page, `goal-button-${seite}`);
              expect(schneiden(k, tor), `Kasten überdeckt die Tor-Taste ${seite} nicht`).toBe(false);
              expect(tor.y + tor.height, `Tor-Taste ${seite} liegt im Bild`).toBeLessThanOrEqual(g.height);
            }
            for (const stand of ['scoreboard-box-home', 'scoreboard-box-away']) {
              const s = page.getByTestId(stand);
              if (await s.count()) {
                expect(schneiden(k, (await s.first().boundingBox()) as Rechteck), `Kasten überdeckt ${stand} nicht`).toBe(false);
              }
            }
          }
          if (VOR_ANPFIFF.includes(fall)) {
            await expect(page.getByTestId('match-start-button')).toBeEnabled();
            const start = await rechteck(page, 'match-start-button');
            expect(schneiden(k, start), 'Kasten überdeckt „Anpfiff“ nicht').toBe(false);
            expect(start.height, 'Haupttaste ≥ 56 px').toBeGreaterThanOrEqual(56);
          }
          // genau der Kasten des Falls: ohne abgeglichene Uhr nur die Uhr-Zeile, sonst nie (@HT-036), und keine zweite Zeile daneben
          await expect(page.getByTestId('cockpit-hall-uhr')).toHaveCount(fall === 'uhr' ? 1 : 0);
          if (fall === 'uhr') {
            await expect(page.getByTestId('cockpit-hall-aus')).toHaveCount(0);
          }
          for (const t of await page.locator('[data-testid="cockpit-hall-hinweise"] button').all()) {
            expect((await t.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
          const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="cockpit-hall-hinweise"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
          expect(ueberlauf, 'kein Überlauf im Kasten').toEqual([]);
          await animationenFertig(page);
          for (const b of await hartBefunde(page, g.art)) {
            testInfo.annotations.push({ type: 'befund-gesamt', description: b });
          }
          await speichereBild(page, testInfo.outputDir, 'H412_BILDER', `h4-12-cockpit-${fall}-${g.name}-${thema}`);
          if (fall === 'anpfiff') {
            // @HT-039: Tom pfeift trotzdem an – die Leitung antwortet erst im nächsten Takt, der Kasten bleibt in dieser Zeit und danach stehen
            await page.getByTestId('match-start-button').click();
            await expect(kasten).toBeVisible();
            await page.waitForFunction(() => (window as unknown as { __hallentonPruefstand?: { leitungAntworten: number } }).__hallentonPruefstand?.leitungAntworten !== undefined
              && (window as unknown as { __hallentonPruefstand: { leitungAntworten: number } }).__hallentonPruefstand.leitungAntworten >= 1, undefined, { timeout: 15_000 });
            await expect(kasten).toBeVisible();
            await expect(kasten).toContainText(KASTEN.anpfiff.text);
            await expect(page.getByTestId('match-start-button')).toHaveCount(0);
          }
        });
      }
    }
  }

  for (const g of GERAETE) {
    for (const thema of ['light', 'dark'] as const) {
      test(`@HT-009 Cockpit-Dialog ${g.name}, ${thema}: nur Ton an/aus und Lautstärke dieses Geräts, Tasten ≥ 44 px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: thema });
        await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=dialog');
        await page.getByTestId('cockpit-more-button').click();
        await page.getByTestId('mehr-einstellungen').click();
        const abschnitt = page.getByTestId('cockpit-geraet-ton');
        await expect(abschnitt).toBeVisible();
        await expect(abschnitt).toContainText('Ton dieses Geräts');
        await expect(page.getByTestId('settings-end-sound-select'), 'keine Tonwahl des Turniers im Dialog').toHaveCount(0);
        await expect(page.getByTestId('cockpit-ton-regler')).toHaveValue('100');
        for (const id of ['cockpit-ton-schalter', 'cockpit-ton-anhoeren']) {
          expect((await rechteck(page, id)).height, id).toBeGreaterThanOrEqual(44);
        }
        expect((await rechteck(page, 'cockpit-ton-regler')).height).toBeGreaterThanOrEqual(44);
        // Rand: 100 % bricht nicht um, die Beschreibung läuft nicht über
        const beschreibung = abschnitt.getByText(/Lautstärke dieses Geräts: 100 %/);
        await expect(beschreibung).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="cockpit-geraet-ton"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
        expect(ueberlauf).toEqual([]);
        // K1: zwischen der vorigen Karte und „Ton dieses Geräts“ liegt Abstand (die Karten stoßen nicht aneinander)
        await animationenFertig(page);
        await abschnitt.scrollIntoViewIfNeeded();
        const davor = await abschnitt.locator('xpath=preceding-sibling::*[1]').boundingBox();
        const eigene = await rechteck(page, 'cockpit-geraet-ton');
        expect(davor).not.toBeNull();
        expect(eigene.y - ((davor as Rechteck).y + (davor as Rechteck).height), 'Abstand zwischen den Karten').toBeGreaterThanOrEqual(16);
        await speichereBild(page, testInfo.outputDir, 'H412_BILDER', `h4-12-cockpit-dialog-${g.name}-${thema}`, false); // der Dialog liegt über dem Fenster und scrollt in sich: nur der sichtbare Ausschnitt
        // ausschalten gilt nur auf diesem Gerät: der Regler verschwindet, der Wert steht im Speicher dieses Geräts
        await page.getByTestId('cockpit-ton-schalter').click();
        await expect(page.getByTestId('cockpit-ton-regler')).toHaveCount(0);
        expect(JSON.parse(await page.evaluate(() => window.localStorage.getItem('cockpit:ton') ?? 'null'))).toMatchObject({ an: false });
        await page.getByTestId('cockpit-ton-schalter').click();
      });

      test(`@HT-009 Admin „Match Cockpit“ ${g.name}, ${thema}: Tonwahl bleibt, Ein/Aus und Lautstärke sind weg`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: g.width, height: g.height });
        await page.emulateMedia({ colorScheme: thema });
        await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=admin');
        await expect(page.getByTestId('settings-end-sound-select')).toBeVisible();
        await expect(page.locator('input[type="range"]')).toHaveCount(0);
        await expect(page.getByTestId('settings-volume-listen')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await animationenFertig(page);
        await speichereBild(page, testInfo.outputDir, 'H412_BILDER', `h4-12-admin-match-cockpit-${g.name}-${thema}`);
      });
    }
  }
});

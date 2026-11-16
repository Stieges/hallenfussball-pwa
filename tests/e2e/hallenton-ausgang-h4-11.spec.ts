/**
 * H4-11 (@HT-047, @HT-049, @HT-053, @HT-054, @HT-055, @HT-039): die Zeile „Ausgang“ in „Dieses Gerät“, der Mikrofon-Hinweis, „Ausgang verloren“, „Ausgang
 * bestätigen“ und „🔈? Prüfen“ am Prüfstand tests/e2e/harness/hallenton-dieses-geraet.html (echte Seitenleiste, echte Seitenansicht, echter Hook und
 * echter Wächter für den Ausgang mit gefälschten `mediaDevices`/`AudioContext`; „Ändern“, Mikrofon und Wahl klickt der Test wie Olli), bei 360×640 und
 * 1280×720, hell und dunkel, Deutsch und Englisch. Je Fall: die Wortlaute des Records stehen da, jede Taste ≥ 44 px (die Haupttaste „Ausgang bestätigen“
 * ≥ 56 px), nichts läuft über, kein HART-Befund von `npm run visual:metrics`, weder Name noch Kennung eines Ausgangs in einem Attribut. Rückwärts-
 * verträglichkeit: ohne gespeicherte Wahl 0 Aufrufe von `enumerateDevices`, Mikrofon, `permissions.query` beim Öffnen des Unterpunkts. Bilder: Ordner aus
 * H411_BILDER (sonst Testausgabe). Läuft nur im Projekt `desktop` am Dev-Server.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { GERAETE, hartBefunde, speichereBild } from './helpers/hallentonPruefstand';

type Sprache = 'de' | 'en';
interface Fall {
  name: string;
  /** Fall des Prüfstands (`?fall=`). */
  fall: string;
  extra?: string;
  /** Klicks wie Olli, danach die Prüfung. */
  ablauf: (page: Page, sprache: Sprache) => Promise<void>;
  sprachen?: readonly Sprache[];
}

const T = {
  de: { standard: 'Standard (Ausgang des Systems)', aendern: 'Ändern', bestaetigen: 'Ausgang bestätigen', erlauben: 'Mikrofon erlauben', nichtVerbunden: 'nicht verbunden', virtuell: 'virtuell' },
  en: { standard: 'Default (system output)', aendern: 'Change', bestaetigen: 'Confirm output', erlauben: 'Allow microphone', nichtVerbunden: 'not connected', virtuell: 'virtual' },
} as const;
const KENNUNGEN = ['kennung-dock-91c2', 'kennung-mac-17d0', 'kennung-poly-52e8', 'kennung-lg-83b6', 'kennung-teams-2c71', 'gruppe-dock-44b1', 'gruppe-mac-7f3a', 'gruppe-poly-0a9c', 'gruppe-lg-6d25', 'gruppe-teams-b840'];
const NAMEN = ['ThinkPad Thunderbolt 3 Dock USB Audio', 'MacBook Pro-Lautsprecher', 'Poly VFOCUS2 Series (Bluetooth)', 'LG Ultra HD (DisplayPort)', 'Microsoft Teams Audio Device (Virtual)'];

const aufruf = (page: Page) => page.evaluate(() => {
  const m = window.__ausgangPruefstand!.medien;
  return { lesen: m.leseAufrufe, mikrofon: m.mikrofonAnfragen, erlaubnis: m.erlaubnisAbfragen };
});

const FAELLE: readonly Fall[] = [
  {
    name: 'ausgang-standard', fall: 'ausgangStandard', async ablauf(page, s) {
      await expect(page.getByTestId('ausgang-zeile')).toContainText(T[s].standard);
      await expect(page.getByTestId('ausgang-aendern')).toHaveText(T[s].aendern);
      // Rückwärtsverträglichkeit: Unterpunkt offen, nichts gelesen, kein Mikrofon-Dialog
      expect(await aufruf(page)).toEqual({ lesen: 0, mikrofon: 0, erlaubnis: 0 });
    },
  },
  {
    name: 'ausgang-gewaehlt', fall: 'ausgangGewaehlt', async ablauf(page) {
      await expect(page.getByTestId('ausgang-name')).toHaveText('ThinkPad Thunderbolt 3 Dock USB Audio');
      await expect(page.getByTestId('ausgang-bestaetigen')).toHaveCount(0);
    },
  },
  {
    name: 'ausgang-mikrofon-hinweis', fall: 'ausgangMikrofon', async ablauf(page, s) {
      await page.getByTestId('ausgang-aendern').click();
      await expect(page.getByTestId('ausgang-mikrofon-hinweis')).toBeVisible();
      await expect(page.getByTestId('ausgang-mikrofon-hinweis')).toContainText(s === 'de' ? 'Bei Besuchen dieser Website erlauben' : 'Allow on every visit');
      await expect(page.getByTestId('mikrofon-erlauben')).toHaveText(T[s].erlauben);
      await expect(page.getByRole('radio')).toHaveCount(1);
      expect((await aufruf(page)).mikrofon, 'ohne Tipp kein Mikrofon-Dialog').toBe(0);
    },
  },
  {
    name: 'ausgang-laedt', fall: 'ausgangMikrofon', extra: '&lesenHaengt=1', sprachen: ['de'], async ablauf(page) {
      await page.getByTestId('ausgang-aendern').click();
      await expect(page.getByTestId('ausgang-laedt')).toContainText('Ausgänge werden gelesen');
      await expect(page.getByTestId('ausgang-mikrofon-hinweis')).toHaveCount(0); // kein Aufblitzen des Hinweises
    },
  },
  {
    name: 'ausgang-mikrofon-abgelehnt', fall: 'ausgangMikrofon', extra: '&ablehnen=1', sprachen: ['de'], async ablauf(page) {
      await page.getByTestId('ausgang-aendern').click();
      await page.getByTestId('mikrofon-erlauben').click();
      await expect(page.getByTestId('ausgang-mikrofon-blockiert')).toContainText('Das Mikrofon ist für diese Website blockiert.');
      await expect(page.getByTestId('mikrofon-erlauben')).toBeVisible();
    },
  },
  {
    name: 'ausgang-liste', fall: 'ausgangMikrofon', async ablauf(page, s) {
      await page.getByTestId('ausgang-aendern').click();
      await page.getByTestId('mikrofon-erlauben').click();
      await expect(page.getByRole('radio')).toHaveCount(6);
      await page.getByRole('radio').filter({ hasText: 'ThinkPad' }).click();
      await expect(page.getByRole('radio').filter({ hasText: 'ThinkPad' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('radio').last()).toContainText(T[s].virtuell);
      await expect(page.getByRole('radio').filter({ hasText: 'Poly' })).toContainText(s === 'de' ? 'Bluetooth: Ton kann verzögert kommen – Kabel empfohlen' : 'Bluetooth: the tone may arrive late – a cable is recommended');
      await expect(page.getByTestId('ausgang-testton-empfehlung')).toBeVisible();
      await expect(page.getByTestId('ausgang-mikrofon-frei')).toBeVisible();
      const spur = await page.evaluate(() => window.__ausgangPruefstand!.medien.spuren.every((x) => x.gestoppt));
      expect(spur, 'das Mikrofon ist sofort wieder frei').toBe(true);
    },
  },
  {
    name: 'ausgang-verloren', fall: 'ausgangVerloren', async ablauf(page, s) {
      const zustand = page.locator('[data-zustand][data-ton]');
      await expect(zustand).toContainText(s === 'de' ? 'Grund: Ausgang verloren' : 'Reason: output lost');
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText(s === 'de' ? 'nicht bereit – Ausgang verloren' : 'not ready – output lost');
      await expect(page.getByRole('radio').filter({ hasText: 'ThinkPad' })).toContainText(T[s].nichtVerbunden);
      await expect(page.getByTestId('ausgang-verloren-hinweis')).toBeVisible();
    },
  },
  {
    name: 'ausgang-bestaetigen', fall: 'ausgangBestaetigen', async ablauf(page, s) {
      await expect(page.locator('[data-zustand][data-ton]')).toContainText(s === 'de' ? 'Grund: Ausgang bestätigen' : 'Reason: confirm output');
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText(s === 'de' ? 'nicht bereit – Ausgang bestätigen' : 'not ready – confirm output');
      await expect(page.getByTestId('ausgang-bestaetigen-taste')).toHaveText(T[s].bestaetigen);
      expect((await page.getByTestId('ausgang-bestaetigen-taste').boundingBox())?.height ?? 0, 'Haupttaste ≥ 56 px').toBeGreaterThanOrEqual(56);
      expect((await aufruf(page)).mikrofon, 'kein Mikrofon-Dialog ohne Tipp').toBe(0);
    },
  },
  {
    name: 'ausgang-bestaetigen-abgelehnt', fall: 'ausgangBestaetigen', extra: '&ablehnen=1', sprachen: ['de'], async ablauf(page) {
      await page.getByTestId('ausgang-bestaetigen-taste').click();
      await expect(page.getByTestId('ausgang-oder-standard')).toHaveText('Oder ‚Standard‘ wählen');
      await expect(page.getByTestId('ausgang-bestaetigen-taste')).toBeVisible();
      expect(await page.evaluate(() => window.__ausgangPruefstand!.aktivieren), 'der Tipp war zugleich „Ton aktivieren“').toBe(1);
    },
  },
  {
    // H4-11b: die Lage, die in H4-11 kein Bild hatte – „Standard“ gewählt, der Wechsel dorthin hat nicht geklappt (@HT-053, @HT-055)
    name: 'ausgang-standard-gescheitert', fall: 'ausgangStandardGescheitert', async ablauf(page, s) {
      await expect(page.locator('[data-zustand][data-ton]')).toContainText(s === 'de' ? 'Grund: Ausgang bestätigen' : 'Reason: confirm output');
      await expect(page.getByTestId('ausgang-bestaetigen')).toContainText(s === 'de' ? 'Der Wechsel auf „Standard“ hat nicht geklappt.' : 'Switching to “Default” did not work.');
      await expect(page.getByTestId('ausgang-bestaetigen-taste')).toHaveText(T[s].bestaetigen);
      expect((await page.getByTestId('ausgang-bestaetigen-taste').boundingBox())?.height ?? 0, 'Haupttaste ≥ 56 px').toBeGreaterThanOrEqual(56);
      expect(await aufruf(page), 'ohne Tipp nichts gelesen, kein Mikrofon-Dialog').toEqual({ lesen: 0, mikrofon: 0, erlaubnis: 0 });
    },
  },
  {
    name: 'ausgang-standard-gescheitert-getippt', fall: 'ausgangStandardGescheitert', sprachen: ['de'], async ablauf(page) {
      await page.getByTestId('ausgang-bestaetigen-taste').click();
      await expect(page.getByTestId('ausgang-bestaetigen')).toHaveCount(0); // ein Tipp versucht den Wechsel erneut und er gelingt
      expect((await aufruf(page)).mikrofon, 'bei „Standard“ ist kein Mikrofon nötig').toBe(0);
      expect(await page.evaluate(() => window.__ausgangPruefstand!.aktivieren), 'der Tipp war zugleich „Ton aktivieren“').toBe(1);
    },
  },
  {
    name: 'ausgang-ohne-wahl', fall: 'ausgangOhneWahl', async ablauf(page, s) {
      await expect(page.getByTestId('ausgang-ohne-wahl')).toContainText(s === 'de' ? 'Dieser Browser kann den Ausgang nicht wählen. Lege den Ausgang in den Einstellungen des Systems fest.' : 'This browser cannot choose the output.');
      await expect(page.getByTestId('ausgang-aendern')).toHaveCount(0);
    },
  },
  {
    name: 'ausgang-lang', fall: 'ausgangLang', sprachen: ['de'], async ablauf(page) {
      await expect(page.getByTestId('ausgang-name')).toContainText('Hallen 2');
      await page.getByTestId('ausgang-aendern').click();
      await expect(page.getByRole('radio').filter({ hasText: 'Hallen 2' })).toHaveAttribute('aria-checked', 'true');
    },
  },
  {
    name: 'pruefen-pille', fall: 'pruefenPille', async ablauf(page) {
      await expect(page.getByTestId('lautsprecher-feld-1-pruefen')).toContainText(/Prüfen|Check/);
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText(/bereit|ready/);
    },
  },
  {
    name: 'pruefen-frage', fall: 'pruefenPille', async ablauf(page, s) {
      await page.getByTestId('lautsprecher-feld-1-pruefen').click();
      await expect(page.getByTestId('ausgang-rueckfrage')).toContainText(s === 'de' ? 'Gespielt 14:02' : 'Played 14:02');
      await expect(page.getByTestId('ausgang-gehoert')).toBeVisible();
      await expect(page.getByTestId('ausgang-nicht-gehoert')).toBeVisible();
    },
  },
  {
    name: 'pruefen-pruefpunkte', fall: 'pruefenPille', async ablauf(page, s) {
      await page.getByTestId('lautsprecher-feld-1-pruefen').click();
      await page.getByTestId('ausgang-nicht-gehoert').click();
      await expect(page.getByTestId('ausgang-pruefpunkte').locator('li')).toHaveCount(3);
      await expect(page.getByTestId('ausgang-nochmal')).toBeVisible();
      await expect(page.getByTestId('lautsprecher-feld-1-zustand')).toContainText(s === 'de' ? 'bereit' : 'ready');
    },
  },
];

async function keineAttributeMitAusgang(page: Page): Promise<void> {
  const treffer = await page.evaluate(([kennungen, namen]) => {
    const funde: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const a of Array.from(el.attributes)) {
        if ([...kennungen, ...namen].some((g) => a.value.includes(g))) { funde.push(`${a.name}=${a.value}`); }
      }
    }
    return funde;
  }, [KENNUNGEN, NAMEN] as const);
  expect(treffer, 'Name und Kennung eines Ausgangs stehen in keinem Attribut').toEqual([]);
}

test.describe('@HT-047 @HT-049 @HT-053 @HT-054 @HT-055 @HT-039 H4-11 Ausgang (Prüfstand)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstand nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const f of FAELLE) {
    for (const sprache of f.sprachen ?? ['de', 'en']) {
      for (const g of GERAETE) {
        for (const thema of ['light', 'dark'] as const) {
          test(`${f.name} ${sprache} ${g.name}, ${thema}: Wortlaute, Tasten ≥ 44 px, nichts läuft über, kein Attribut mit Ausgangsnamen`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width: g.width, height: g.height });
            await page.emulateMedia({ colorScheme: thema });
            await page.goto(`/tests/e2e/harness/hallenton-dieses-geraet.html?fall=${f.fall}&lang=${sprache}${f.extra ?? ''}`);
            await expect(page.getByTestId('hallenton-seite')).toBeVisible();
            await expect(page.getByTestId('ausgang-zeile')).toBeVisible();
            await f.ablauf(page, sprache);
            await keineAttributeMitAusgang(page);
            for (const k of await page.locator('[data-testid="hallenton-seite"] button').all()) {
              if (await k.isVisible()) {
                expect((await k.boundingBox())?.height ?? 0, `Taste ${await k.textContent()}`).toBeGreaterThanOrEqual(44);
              }
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'kein waagerechtes Scrollen').toBe(true);
            const ueberlauf = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="hallenton-seite"] *')).filter((el) => el.scrollWidth - el.clientWidth > 1).map((el) => el.textContent));
            expect(ueberlauf, 'kein Überlauf').toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0)); // die Messung gilt der Seite von oben, nicht dem Stand nach den Klicks
            await page.waitForTimeout(300);
            await page.addStyleTag({ content: 'aside { visibility: hidden; }' });
            expect(await hartBefunde(page, g.art), 'kein HART-Befund der visuellen Messung (Seite ohne Seitenleiste)').toEqual([]);
            await page.addStyleTag({ content: 'aside { visibility: visible; }' });
            await speichereBild(page, testInfo.outputDir, 'H411_BILDER', `h4-11-${f.name}-${sprache}-${g.name}-${thema}`);
          });
        }
      }
    }
  }
});

/**
 * @OB-087 @OB-088 Hinweise tragen die Taste, die das Problem löst – Fälle ohne Datenbank, an Prüfständen mit den echten Bausteinen
 * (tests/e2e/harness/hinweise-taste*.html, cockpit-hallenton.html, live-info.html), bei 360×640 (Handy) und 1280×720 (Desktop), hell und dunkel:
 *  - OB-088 Zeile 2: die Zuschauer-Seite lädt bei Netzrückkehr von selbst; „Erneut versuchen“ ruft nur den Abruf wieder auf (die Seite wird NICHT neu geladen).
 *  - OB-087 Zeile 8: „Zum Cockpit“ am laufenden Spiel.
 *  - OB-087 Zeile 1: „Verbinden“ im Kasten „Kein Netz – Halle zeigt alten Stand“ (echtes Live-Cockpit, echte Leitung mit gefälschtem Server).
 *  - OB-087 Zeile 5: „Ton aktivieren“ im Kasten nur am eigenen Gerät (Gegenbeispiel: ein anderes Gerät).
 *  - OB-087 Zeile 3: „Anmelden“ am Hinweis „Bitte neu anmelden“; Zeile 4: „Jetzt aktualisieren“ an der Meldung; Zeilen 6 und 7: „Erneut versuchen“.
 * Jede Taste ist mindestens 44 px hoch und nichts läuft über. Keine festen Wartezeiten: es wird auf Zustände gewartet. Läuft nur im Projekt `desktop` am Dev-Server.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { GERAETE } from '../helpers/hallentonPruefstand';
import { animationenFertig } from '../helpers/animationenFertig';

type Fenster = typeof GERAETE[number];
const THEMEN = ['light', 'dark'] as const;
const HINWEISE = '/tests/e2e/harness/hinweise-taste.html';
const HINWEISE_NEU = '/tests/e2e/harness/hinweise-taste-neu.html';

type Zaehler = Record<string, number | boolean>;
/** Liest einen Zähler des Prüfstands (`window.__hinweise`). */
const lies = (page: Page, schluessel: string): Promise<number | boolean> =>
  page.evaluate((k) => (window as unknown as { __hinweise: Zaehler }).__hinweise[k], schluessel);
/** Stellt einen Schalter des Prüfstands und meldet danach das Netz zurück (`online`), wenn verlangt. */
const stelle = (page: Page, schluessel: string, wert: boolean, onlineMelden = false): Promise<void> =>
  page.evaluate(([k, v, o]) => {
    (window as unknown as { __hinweise: Zaehler }).__hinweise[k] = v;
    if (o) { window.dispatchEvent(new Event('online')); }
  }, [schluessel, wert, onlineMelden] as const);

async function richteEin(page: Page, g: Fenster, thema: 'light' | 'dark'): Promise<void> {
  await page.setViewportSize({ width: g.width, height: g.height });
  await page.emulateMedia({ colorScheme: thema });
}

/** Die Taste ist sichtbar, mindestens 44 px hoch und steht ganz im Fenster. */
async function pruefeTaste(page: Page, taste: Locator): Promise<void> {
  await expect(taste).toBeVisible();
  const box = await taste.boundingBox();
  expect(box, 'Taste hat ein Rechteck').not.toBeNull();
  expect(box!.height, 'Taste ≥ 44 px hoch').toBeGreaterThanOrEqual(44);
  expect(box!.x, 'Taste links im Bild').toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, 'Taste rechts im Bild').toBeLessThanOrEqual(page.viewportSize()!.width);
  const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ueberlauf, 'kein waagerechter Überlauf').toBeLessThanOrEqual(0);
}

test.describe('@OB-087 @OB-088 Hinweise mit Taste (Prüfstände)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstände nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const g of GERAETE) {
    for (const thema of THEMEN) {
      const wo = `${g.name}, ${thema}`;

      test(`@OB-088 Zeile 2 Zuschauer-Seite ${wo}: Netz zurück lädt von selbst; „Erneut versuchen“ lädt die Seite nicht neu`, async ({ page }) => {
        await richteEin(page, g, thema);
        await page.goto(`${HINWEISE}?fall=zuschauer`);
        const taste = page.getByTestId('public-error-retry');
        await expect(page.getByRole('heading', { name: 'Fehler beim Laden' })).toBeVisible();
        await pruefeTaste(page, taste);
        await page.evaluate(() => { (window as unknown as { __marke: number }).__marke = 1; }); // geht bei einem Neuladen der Seite verloren

        // Tipp ohne Netz: nur der Abruf wird wiederholt, der Hinweis bleibt, die Seite wird nicht neu geladen
        const vorher = Number(await lies(page, 'abrufe'));
        await taste.click();
        await expect.poll(async () => Number(await lies(page, 'abrufe'))).toBeGreaterThan(vorher);
        await expect(page.getByRole('heading', { name: 'Fehler beim Laden' })).toBeVisible();
        await expect(taste).not.toHaveAttribute('aria-busy', 'true');
        expect(await page.evaluate(() => (window as unknown as { __marke?: number }).__marke), 'die Seite wurde nicht neu geladen').toBe(1);

        // Netz kommt zurück: die Seite lädt von selbst, ohne Tipp, ohne Neuladen
        await stelle(page, 'netz', true, true);
        await expect(page.getByTestId('zuschauer-geladen')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Fehler beim Laden' })).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { __marke?: number }).__marke)).toBe(1);
      });
    }

    test(`@OB-088 Zeile 2 Zuschauer-Seite ${g.name}: mit zurückgekehrtem Netz lädt auch ein Tipp auf „Erneut versuchen“ den Spielplan`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.goto(`${HINWEISE}?fall=zuschauer`);
      await expect(page.getByTestId('public-error-retry')).toBeVisible();
      await stelle(page, 'netz', true);
      await page.getByTestId('public-error-retry').click();
      await expect(page.getByTestId('zuschauer-geladen')).toBeVisible();
    });

    test(`@OB-087 Zeile 8 Spielplan ${g.name}: am laufenden Spiel steht „Zum Cockpit“, der Tipp öffnet das Cockpit`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.goto('/tests/e2e/harness/live-info.html');
      const taste = page.getByTestId('goto-cockpit-btn');
      await pruefeTaste(page, taste);
      await expect(taste).toHaveText('Zum Cockpit');
      await taste.click();
      expect(await page.evaluate(() => (window as unknown as { __zumCockpit: number }).__zumCockpit)).toBe(1);
    });

    test(`@OB-087 Zeile 3 ${g.name}: „Bitte neu anmelden“ trägt „Anmelden“; der Tipp öffnet die Anmeldung`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.goto(`${HINWEISE}?fall=anmelden`);
      await expect(page.getByTestId('outbox-notice')).toHaveAttribute('data-kind', 'authRequired');
      const taste = page.getByTestId('outbox-notice-login');
      await pruefeTaste(page, taste);
      await expect(taste).toHaveText('Anmelden');
      await taste.click();
      await expect(page).toHaveURL(/#\/login$/);
      expect(await lies(page, 'zumAnmelden')).toBe(1);
    });

    test(`@OB-087 Zeile 3 Gegenbeispiel ${g.name}: ohne die Anmelde-Funktion (Stand ohne Taste) bleibt es beim Text`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.goto(`${HINWEISE}?fall=anmelden&phase=vorher`);
      await expect(page.getByTestId('outbox-notice')).toBeVisible();
      await expect(page.getByTestId('outbox-notice-login')).toHaveCount(0);
    });

    test(`@OB-087 Zeile 4 ${g.name}: die Meldung „App aktualisieren“ trägt „Jetzt aktualisieren“`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.goto(`${HINWEISE}?fall=aktualisieren`);
      await expect(page.getByRole('alert')).toContainText('App aktualisieren');
      const taste = page.getByRole('button', { name: 'Jetzt aktualisieren' });
      await animationenFertig(page); // die Meldung gleitet von rechts ein
      await pruefeTaste(page, taste);
      await taste.click();
      expect(await lies(page, 'aktualisiert')).toBe(1);
      // nach dem Tipp bleibt der Hinweis stehen: die Taste ist gesperrt und zeigt die Arbeitsanzeige; ein zweiter Tipp löst nichts doppelt aus
      await expect(page.getByTestId('toast-action')).toBeDisabled();
      await expect(page.getByTestId('toast-action')).toHaveText('Lade...');
      await expect(page.getByRole('alert')).toHaveCount(1);
    });

    test(`@OB-087 Zeile 4 ${g.name}: ist das Gerät bereiter Hallen-Lautsprecher, steht nach dem Tipp der Grund statt der Arbeitsanzeige`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.goto(`${HINWEISE}?fall=aktualisieren&tor=blockiert`);
      await animationenFertig(page);
      await page.getByRole('button', { name: 'Jetzt aktualisieren' }).click();
      await expect(page.getByTestId('toast-action-note')).toContainText('Hallen-Lautsprecher');
      await expect(page.getByTestId('toast-action')).toBeEnabled();
      await expect(page.getByTestId('toast-action')).toHaveText('Jetzt aktualisieren');
      await expect(page.getByRole('alert')).toHaveCount(1);
    });

    for (const [fall, testid, zeile] of [['veroeffentlichen', 'publish-error-retry', 6], ['sichtbarkeit', 'visibility-error-retry', 7]] as const) {
      test(`@OB-087 Zeile ${zeile} ${g.name}: der Fehlerhinweis trägt „Erneut versuchen“`, async ({ page }) => {
        await richteEin(page, g, 'light');
        await page.goto(`${HINWEISE_NEU}?fall=${fall}`);
        const taste = page.getByTestId(testid);
        await pruefeTaste(page, taste);
        await expect(taste).toHaveText('Erneut versuchen');
        await taste.click();
        expect(await lies(page, 'erneut')).toBe(1);
      });
      test(`@OB-087 Zeile ${zeile} ${g.name}: während des Versuchs ist die Taste gesperrt und zeigt, dass sie arbeitet`, async ({ page }) => {
        await richteEin(page, g, 'light');
        await page.goto(`${HINWEISE_NEU}?fall=${fall}&laeuft=1`);
        const taste = page.getByTestId(testid);
        await expect(taste).toHaveAttribute('aria-busy', 'true');
        await taste.click({ force: true });
        expect(await lies(page, 'erneut'), 'gesperrt: der Tipp löst nichts aus').toBe(0);
      });
    }

    for (const thema of THEMEN) {
      const wo = `${g.name}, ${thema}`;
      test(`@OB-087 Zeile 1 Cockpit ${wo}: im Kasten „Kein Netz – Halle zeigt alten Stand“ steht „Verbinden“; während des Versuchs gesperrt`, async ({ page }) => {
        await richteEin(page, g, thema);
        await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
        await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=kein-netz');
        const kasten = page.getByTestId('cockpit-hall-kein-netz');
        await expect(kasten).toBeVisible({ timeout: 15_000 });
        const taste = kasten.getByTestId('cockpit-hall-verbinden');
        await pruefeTaste(page, taste);
        await expect(taste).toHaveText('Verbinden');
        await taste.click();
        await expect(taste).toHaveAttribute('aria-busy', 'true');
        await expect(taste).toHaveText('Verbinde …');
        await expect(taste).not.toHaveAttribute('aria-busy', 'true'); // der Versuch ist zu Ende, die Taste ist wieder frei
        await expect(taste).toHaveText('Verbinden');
      });

      test(`@OB-087 Zeile 5 Cockpit ${wo}: ist dieses Gerät der Lautsprecher des Felds, trägt der Kasten „Ton aktivieren“`, async ({ page }) => {
        await richteEin(page, g, thema);
        await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
        await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=ton-aktivieren');
        const kasten = page.getByTestId('cockpit-hall-aus');
        await expect(kasten).toBeVisible({ timeout: 15_000 });
        await expect(kasten).toContainText('Grund: Ton nicht aktiviert');
        const taste = kasten.getByTestId('cockpit-hall-ton-aktivieren');
        await pruefeTaste(page, taste);
        await expect(taste).toHaveText('Ton aktivieren');
      });
    }

    test(`@OB-087 Zeile 5 Gegenbeispiel ${g.name}: auf einem anderen Gerät steht derselbe Kasten ohne „Ton aktivieren“`, async ({ page }) => {
      await richteEin(page, g, 'light');
      await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
      await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=halbzeit'); // gleicher Grund, dieses Gerät ist nicht der Lautsprecher
      const kasten = page.getByTestId('cockpit-hall-aus');
      await expect(kasten).toBeVisible({ timeout: 15_000 });
      await expect(kasten).toContainText('Grund: Ton nicht aktiviert');
      await expect(page.getByTestId('cockpit-hall-ton-aktivieren')).toHaveCount(0);
    });
  }
});

/**
 * @OB-087 @OB-088 Hinweise tragen die Taste, die das Problem löst – Fälle ohne Datenbank, an Prüfständen mit den echten Bausteinen
 * (tests/e2e/harness/hinweise-taste*.html, cockpit-hallenton.html, live-info.html), bei 360×640 (Handy) und 1280×720 (Desktop), hell und dunkel:
 *  - OB-088 Zeile 2: die Zuschauer-Seite lädt bei Netzrückkehr von selbst; „Erneut versuchen“ ruft nur den Abruf wieder auf (die Seite wird NICHT neu geladen).
 *  - OB-087 Zeile 8: „Zum Cockpit“ am laufenden Spiel.
 *  - OB-087 Zeile 1: „Verbinden“ im Kasten „Kein Netz – Halle zeigt alten Stand“ (echtes Live-Cockpit, echte Leitung mit gefälschtem Server).
 *  - OB-087 Zeile 5: „Ton aktivieren“ im Kasten nur am eigenen Gerät (Gegenbeispiel: ein anderes Gerät).
 *  - OB-087 Zeile 3: „Anmelden“ am Hinweis „Bitte neu anmelden“; Zeile 4: „Jetzt aktualisieren“ an der Meldung; Zeilen 6 und 7: „Erneut versuchen“.
 *  - Lage („A ist besser“): die Taste steht rechtsbündig in DERSELBEN ZEILE wie der Text, passt sie nicht daneben, rechtsbündig UNTER dem Text; sie ist ≥ 44 px
 *    hoch, ≥ 144 px breit, und Text und Taste überschneiden sich nie (Bounding-Boxen, Handy 390×844 und 360×640).
 * Jede Taste ist mindestens 44 px hoch und nichts läuft über. Keine festen Wartezeiten: es wird auf Zustände gewartet. Läuft nur im Projekt `desktop` am Dev-Server.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { GERAETE } from '../helpers/hallentonPruefstand';
import { animationenFertig } from '../helpers/animationenFertig';

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

async function richteEin(page: Page, g: { width: number; height: number }, thema: 'light' | 'dark'): Promise<void> {
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

type Rechteck = { x: number; y: number; width: number; height: number };
const schneiden = (a: Rechteck, b: Rechteck): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
async function rechteck(l: Locator): Promise<Rechteck> {
  const b = await l.first().boundingBox();
  expect(b, 'Rechteck vorhanden').not.toBeNull();
  return b as Rechteck;
}

/** Lage der Taste im Hinweis: rechtsbündig im Kasten; `zeile` = rechts neben dem Text, auf Höhe der Zeile; `darunter` = unter dem Text, nicht volle Breite. Immer: ≥ 44 px hoch, ≥ `minBreite` breit (144 px; im Cockpit auf dem kleinen Handy schmaler), keine Überschneidung. */
async function pruefeLage(kasten: Locator, text: Locator, taste: Locator, wo: 'zeile' | 'darunter', minBreite = 144): Promise<void> {
  const [k, t, b] = [await rechteck(kasten), await rechteck(text), await rechteck(taste)];
  expect(b.height, 'Taste ≥ 44 px hoch').toBeGreaterThanOrEqual(44);
  expect(b.width, `Taste ≥ ${String(minBreite)} px breit`).toBeGreaterThanOrEqual(minBreite - 0.5);
  expect(await taste.first().evaluate((n) => n.scrollWidth <= n.clientWidth), 'volle Beschriftung, nichts abgeschnitten').toBe(true);
  expect(schneiden(t, b), 'Text und Taste überschneiden sich nicht').toBe(false);
  expect(b.x + b.width, 'Taste rechtsbündig (Abstand zum rechten Rand ≤ Innenabstand + Rand)').toBeGreaterThan(k.x + k.width - 24);
  expect(b.x + b.width, 'Taste im Kasten').toBeLessThanOrEqual(k.x + k.width);
  expect(b.y, 'Taste im Kasten (oben)').toBeGreaterThanOrEqual(k.y);
  expect(b.y + b.height, 'Taste im Kasten (unten)').toBeLessThanOrEqual(k.y + k.height);
  if (wo === 'zeile') {
    expect(b.x, 'Taste rechts neben dem Text').toBeGreaterThanOrEqual(t.x + t.width - 0.5);
    expect(b.y < t.y + t.height && b.y + b.height > t.y, 'Taste auf Höhe des Textes (gleiche Zeile)').toBe(true);
  } else {
    expect(b.y, 'Taste unter dem Text').toBeGreaterThanOrEqual(t.y + t.height - 0.5);
    expect(b.width, 'nicht volle Breite').toBeLessThan(k.width - 64);
  }
}

/**
 * Wo die Taste steht, folgt dem Platz: passt sie (mit 8 px Abstand) neben eine Textspalte von mindestens 9,5 rem (152 px), steht sie in der Zeile, sonst rechtsbündig darunter.
 * Gemessene freie Breite neben der Taste (Innenbreite des Kastens − Taste − Abstand) in Klammern.
 *  390×844: Cockpit 194 px, „Bitte neu anmelden“ 194 px, Sichtbarkeit 322 − 157 − 8 = 157 px, Helfer ohne Netz 170 px → Zeile; Veröffentlichen (Taste 282 px mit „Schließen“: 32 px) → darunter.
 *  360×640: Cockpit 212 px (Taste 96–117 px) und „Bitte neu anmelden“ 164 px → Zeile; Veröffentlichen (2 px), Sichtbarkeit (127 px), Helfer (140 px) → darunter.
 * Die Meldung „App aktualisieren“ (Toast) hat ein eigenes Gitter: auf dem Handy immer darunter.
 */
const LAGEN = [
  { name: '390×844', width: 390, height: 844, wo: { cockpit: 'zeile', anmelden: 'zeile', toast: 'darunter', veroeffentlichen: 'darunter', sichtbarkeit: 'zeile', helfer: 'zeile' } },
  { name: '360×640', width: 360, height: 640, wo: { cockpit: 'zeile', anmelden: 'zeile', toast: 'darunter', veroeffentlichen: 'darunter', sichtbarkeit: 'darunter', helfer: 'darunter' } },
] as const;

test.describe('@OB-087 Lage der Taste im Hinweis („A“: rechts in der Zeile, sonst rechtsbündig darunter)', () => {
  test.beforeEach(({ browserName, page }, testInfo) => {
    page.on('pageerror', (e) => { testInfo.annotations.push({ type: 'seitenfehler', description: e.message.slice(0, 300) }); });
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
    test.skip(!!process.env.CI_E2E_USE_PREVIEW, 'Prüfstände nur am Dev-Server (im gebauten Stand nicht vorhanden)');
  });

  for (const l of LAGEN) {
    for (const thema of THEMEN) {
      for (const [fall, kasten, taste, was] of [
        ['kein-netz', 'cockpit-hall-kein-netz', 'cockpit-hall-verbinden', 'cockpit'],
        ['ton-aktivieren', 'cockpit-hall-aus', 'cockpit-hall-ton-aktivieren', 'cockpit'],
      ] as const) {
        test(`Cockpit „${fall}“ ${l.name}, ${thema}: Lage der Taste (${l.wo[was]})`, async ({ page }) => {
          await page.setViewportSize({ width: l.width, height: l.height });
          await page.emulateMedia({ colorScheme: thema });
          await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
          await page.goto(`/tests/e2e/harness/cockpit-hallenton.html?fall=${fall}`);
          const k = page.getByTestId(kasten);
          await expect(k).toBeVisible({ timeout: 15_000 });
          await animationenFertig(page);
          // kleines Handy (≤ 480 × 700 px): die Taste im Cockpit darf schmaler sein als 144 px, aber nie niedriger als 44 px und mit voller Beschriftung
          await pruefeLage(k, k.locator('[data-hinweis="kopf"]'), k.getByTestId(taste), l.wo[was], l.height <= 700 ? 88 : 144);
          // nichts verdeckt: die Tor-Tasten liegen unter dem Kasten, nicht darüber
          for (const seite of ['home', 'away']) {
            expect(schneiden(await rechteck(k), await rechteck(page.getByTestId(`goal-button-${seite}`)))).toBe(false);
          }
        });
      }
    }

    // @OB-087 (Zeile „im Cockpit bleiben auch auf einem Handy mit 360×640 …“): mit dem Hinweis bleiben die Tor-Tasten und die Reihe „Foul · Zeitstrafe · Karte“
    // ganz im Bild, ohne Rollen – die Tastenfläche des Cockpits rollt nur, wo der Platz nicht reicht; hier darf sie es nicht müssen
    for (const [fall, kasten] of [['kein-netz', 'cockpit-hall-kein-netz'], ['ton-aktivieren', 'cockpit-hall-aus']] as const) {
      test(`Cockpit „${fall}“ ${l.name}: Tor-Tasten und Reihe Foul · Zeitstrafe · Karte stehen ganz im Bild, ohne Rollen`, async ({ page }) => {
        await page.setViewportSize({ width: l.width, height: l.height });
        await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
        await page.goto(`/tests/e2e/harness/cockpit-hallenton.html?fall=${fall}`);
        await expect(page.getByTestId(kasten)).toBeVisible({ timeout: 15_000 });
        await animationenFertig(page);
        const flaeche = await rechteck(page.getByTestId('cockpit-tastenflaeche'));
        for (const id of ['goal-button-home', 'goal-button-away', 'team-row3-home', 'team-row3-away']) {
          const b = await rechteck(page.getByTestId(id));
          expect(b.y, `${id}: oben im sichtbaren Bereich der Tastenfläche`).toBeGreaterThanOrEqual(flaeche.y - 0.5);
          expect(b.y + b.height, `${id}: unten im sichtbaren Bereich der Tastenfläche (ohne Rollen)`).toBeLessThanOrEqual(flaeche.y + flaeche.height + 0.5);
          expect(b.y + b.height, `${id}: im Fenster`).toBeLessThanOrEqual(l.height);
        }
        expect(await page.getByTestId('cockpit-tastenflaeche').evaluate((n) => n.scrollTop), 'die Fläche ist nicht gerollt').toBe(0);
        // die Anweisung an den Spielleiter bleibt immer vollständig stehen
        if (fall === 'ton-aktivieren') {
          await expect(page.getByTestId(kasten)).toContainText('Hallen-Lautsprecher aus – Ende selbst anzeigen');
          await expect(page.getByTestId(kasten).getByTestId('cockpit-hall-ton-aktivieren')).toHaveText('Ton aktivieren');
          // der Grund entfällt nur auf dem kleinen Handy, wo die Taste dasselbe sagt
          const grund = page.getByTestId(kasten).getByText('Grund: Ton nicht aktiviert');
          if (l.height <= 700) { await expect(grund).toBeHidden(); } else { await expect(grund).toBeVisible(); }
        }
      });
    }

    test(`Gegenbeispiel Cockpit ${l.name}: auf einem anderen Gerät (ohne Taste) bleibt der Grund stehen`, async ({ page }) => {
      await page.setViewportSize({ width: l.width, height: l.height });
      await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
      await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=halbzeit');
      const kasten = page.getByTestId('cockpit-hall-aus');
      await expect(kasten).toBeVisible({ timeout: 15_000 });
      await expect(kasten).toContainText('Hallen-Lautsprecher aus – Ende selbst anzeigen');
      await expect(kasten.getByText('Grund: Ton nicht aktiviert')).toBeVisible();
    });

    test(`Gegenbeispiel Cockpit ${l.name}: der Kasten OHNE Aktion („Uhr nicht abgeglichen“) trägt keine Taste und hat denselben Rahmen wie ein Kasten mit Taste`, async ({ page }) => {
      await page.setViewportSize({ width: l.width, height: l.height });
      await page.clock.setFixedTime(new Date(2026, 10, 21, 14, 0));
      await page.goto('/tests/e2e/harness/cockpit-hallenton.html?fall=kombi'); // vor dem Anpfiff: „Ton aktivieren“ UND „Uhr nicht abgeglichen“ untereinander
      const mit = page.getByTestId('cockpit-hall-aus');
      const ohne = page.getByTestId('cockpit-hall-uhr');
      await expect(mit).toBeVisible({ timeout: 15_000 });
      await expect(ohne).toBeVisible();
      await expect(ohne.getByRole('button')).toHaveCount(0);
      await animationenFertig(page);
      const [a, b] = [await rechteck(mit), await rechteck(ohne)];
      expect(a.x, 'gleicher linker Rand').toBeCloseTo(b.x, 0);
      expect(a.width, 'gleiche Breite').toBeCloseTo(b.width, 0);
      const rand = (el: Locator) => el.evaluate((n) => { const c = getComputedStyle(n); return `${c.borderTopWidth} ${c.borderTopColor} ${c.borderRadius}`; });
      expect(await rand(ohne), 'gleicher Rand wie der Kasten mit Taste').toBe(await rand(mit));
    });

    for (const [fall, kasten, taste] of [
      ['anmelden', 'outbox-notice', 'outbox-notice-login'],
    ] as const) {
      test(`„Bitte neu anmelden“ ${l.name}: Lage der Taste (${l.wo.anmelden})`, async ({ page }) => {
        await richteEin(page, l, 'light');
        await page.goto(`${HINWEISE}?fall=${fall}`);
        const k = page.getByTestId(kasten);
        await expect(k).toBeVisible();
        await pruefeLage(k.locator('[role="status"]'), k.locator('[data-hinweis="kopf"]'), k.getByTestId(taste), l.wo.anmelden);
      });
    }

    test(`„App aktualisieren“ (Meldung) ${l.name}: Lage der Taste (${l.wo.toast}), Text und Taste überschneiden sich nie`, async ({ page }) => {
      await richteEin(page, l, 'light');
      await page.goto(`${HINWEISE}?fall=aktualisieren`);
      const meldung = page.getByRole('alert');
      await expect(meldung).toContainText('App aktualisieren');
      await animationenFertig(page);
      await pruefeLage(meldung, meldung.locator('> span').nth(1), page.getByTestId('toast-action'), l.wo.toast);
      // Schließen steht oben rechts, nicht unter oder über der Taste
      const schliessen = await rechteck(meldung.getByRole('button', { name: 'Hinweis schließen' }));
      expect(schneiden(schliessen, await rechteck(page.getByTestId('toast-action'))), 'Schließen und Taste überschneiden sich nicht').toBe(false);
    });

    for (const [fall, kasten, taste, was] of [
      ['veroeffentlichen', 'publish-error-notice', 'publish-error-retry', 'veroeffentlichen'],
      ['sichtbarkeit', 'visibility-error', 'visibility-error-retry', 'sichtbarkeit'],
      ['helfer-offline', 'needs-network', 'needs-network-verbinden', 'helfer'],
    ] as const) {
      test(`${fall} ${l.name}: Lage der Taste (${l.wo[was]})`, async ({ page }) => {
        await richteEin(page, l, 'light');
        await page.goto(`${HINWEISE_NEU}?fall=${fall}`);
        const k = page.getByTestId(kasten);
        await expect(k).toBeVisible();
        await pruefeLage(k, k.locator('[data-hinweis="kopf"]'), k.getByTestId(taste), l.wo[was]);
      });
    }

    test(`„Jetzt aktualisieren“ ${l.name}: nach der Frist steht der Satz am Hinweis, die Taste ist wieder frei und überschneidet nichts`, async ({ page }) => {
      await richteEin(page, l, 'light');
      await page.goto(`${HINWEISE}?fall=aktualisieren&frist=1500`);
      const taste = page.getByTestId('toast-action');
      await animationenFertig(page);
      await taste.click();
      await expect(taste).toBeDisabled(); // Arbeitsanzeige
      await expect(page.getByTestId('toast-action-note')).toHaveText('Neue Fassung ist noch nicht da – bitte gleich noch einmal tippen.');
      await expect(taste).toBeEnabled();
      await expect(taste).toHaveText('Jetzt aktualisieren');
      const [n, b] = [await rechteck(page.getByTestId('toast-action-note')), await rechteck(taste)];
      expect(schneiden(n, b), 'Satz und Taste überschneiden sich nicht').toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
});

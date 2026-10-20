/**
 * Aufgabe 2.3 (Spielanzeige): Einstellung „Anzeige für Zuschauer“ und ihre Wirkung am Hallenmonitor Feld 1.
 * @ZM-153 Olli stellt Gast auf Navy: Hinweis, speichern, Monitor zeigt den Gast-Kasten weiß · @ZM-154 Teamfarben aus: Blau/Rot,
 * Kästen gleich groß · @ZM-159 Fälle A, B, C am Monitor Feld 1 · @ZM-152 Vorbelegung und Vorschau.
 *
 * Saat `hallencup-messlauf`: das Finale (Feld 1, läuft 2:1) ist das gezeigte Spiel; die Saat-Teams tragen keine Farbe. Getragene Farben
 * setzt der Test über `match.kit` (beim Anpfiff festgehalten, @W3-028) in einer Kopie der Saat. Läuft im Projekt `desktop`.
 * Bilder: SA23_BILDER (Vorsatz SA23_PHASE).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';
import { palette } from '../../../src/design-tokens/colors/palette';

const BILDER = process.env.SA23_BILDER;
const PHASE = process.env.SA23_PHASE ?? 'nachher';
const FINALE = '00000003-0000-4000-8000-000000000016';
const ADMIN = '/#/tournament/hallencup-messlauf/admin/visibility';
const MONITOR = '/#/display/hallencup-messlauf/mon-live';

const BLAU = 'rgb(21, 101, 192)';
const ROT = 'rgb(198, 40, 40)';
const GELB = 'rgb(250, 204, 21)';
const WEISS = 'rgb(255, 255, 255)';

interface Kit { a?: string; b?: string; bibSide?: 'a' | 'b' }
interface Saat { datenbanken: Array<{ eintraege: { tournaments: Array<{ id: string; matches: Array<{ id: string; kit?: Kit }> }> } }> }

/** Saat mit getragenen Farben im Finale (leer = keine Seite trägt eine Farbe). */
function saatMitKit(kit: Kit | undefined): Saat {
  const saat = leseSaat('hallencup-messlauf') as Saat;
  const spiel = saat.datenbanken[0].eintraege.tournaments.find((t) => t.id === 'hallencup-messlauf')?.matches.find((m) => m.id === FINALE);
  if (!spiel) { throw new Error('Finale fehlt in der Saat'); }
  if (kit !== undefined) { spiel.kit = kit; }
  return saat;
}

async function starte(page: Page, kit?: Kit) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installiereSaat(page.context(), saatMitKit(kit));
}

async function zeigeMonitor(page: Page) {
  await page.goto(MONITOR);
  await expect(page.getByTestId('live-block-home')).toBeVisible({ timeout: 25000 });
}

async function zeigeEinstellung(page: Page) {
  await page.goto(ADMIN);
  await expect(page.getByTestId('spectator-display-preview')).toBeVisible({ timeout: 25000 });
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${PHASE}-${name}.png`), fullPage: false });
}

/** Wählt in der Farbauswahl „Standardfarbe <seite>“ die Voreinstellung `hex` (wie die Farbauswahl der Teams). */
async function waehle(page: Page, seite: 'home' | 'away', hex: string) {
  await page.getByTestId(`spectator-display-${seite}-color`).getByRole('button').first().click();
  await page.getByRole('option', { name: `Farbe ${hex}` }).click();
}

const kasten = (page: Page, seite: 'home' | 'away') => page.locator(`[data-testid="live-block-${seite}"] [data-position]`);
const flaeche = (page: Page, seite: 'home' | 'away') => kasten(page, seite).evaluate((el) => getComputedStyle(el).backgroundColor);
const groesse = (page: Page, seite: 'home' | 'away') => kasten(page, seite).evaluate((el) => {
  const b = el.getBoundingClientRect();
  return { l: b.left, t: b.top, w: b.width, h: b.height };
});

test.describe('@ZM-152 @ZM-153 Anzeige für Zuschauer in den Einstellungen', () => {
  test('@ZM-152 Vorbelegung: Teamfarben an, Heim Blau, Gast Rot, Vorschau mit zwei Kästen, kein Hinweis', async ({ page }) => {
    await starte(page);
    await zeigeEinstellung(page);
    await expect(page.getByRole('switch', { name: /Teamfarben in den Ergebniskästen/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('spectator-display-home-color')).toContainText('Blau');
    await expect(page.getByTestId('spectator-display-away-color')).toContainText('Rot');
    await expect(page.getByTestId('spectator-display-preview').getByRole('img')).toHaveCount(2);
    await expect(page.getByTestId('spectator-display-similar-hint')).toHaveCount(0);
  });

  test('@ZM-153 Olli stellt Gast auf Navy: Hinweis, speichern, Monitor Feld 1 zeigt den Gast-Kasten weiß', async ({ page }) => {
    await starte(page);
    await zeigeEinstellung(page);
    await waehle(page, 'away', palette.kit.navy);
    await expect(page.getByTestId('spectator-display-similar-hint')).toContainText('Diese beiden Farben sehen sich zu ähnlich.');
    await page.getByTestId('spectator-display-save').click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await zeigeMonitor(page);
    // der Monitor übernimmt die gespeicherte Einstellung spätestens beim nächsten Abruf (Poll-Takt)
    await expect.poll(() => flaeche(page, 'away'), { timeout: 30000 }).toBe(WEISS);
    expect(await flaeche(page, 'home')).toBe(BLAU);
  });

  test('@ZM-153 Gegenbeispiel Blau/Rot gespeichert: Monitor zeigt Rot, nicht Weiß', async ({ page }) => {
    await starte(page);
    await zeigeEinstellung(page);
    await page.getByTestId('spectator-display-save').click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await zeigeMonitor(page);
    expect(await flaeche(page, 'away')).toBe(ROT);
  });
});

test.describe('@ZM-154 Teamfarben aus', () => {
  test('@ZM-154 Teamfarben aus: Monitor Feld 1 zeigt Blau/Rot, die Kästen sind gleich groß wie bei „an“', async ({ page }) => {
    await starte(page, { a: '#2E7D32', b: palette.kit.black, bibSide: 'b' });
    await zeigeMonitor(page);
    const grossAn = [await groesse(page, 'home'), await groesse(page, 'away')];
    expect(await flaeche(page, 'home')).toBe('rgb(46, 125, 50)');
    await zeigeEinstellung(page);
    await page.getByRole('switch', { name: /Teamfarben in den Ergebniskästen/ }).click();
    await page.getByTestId('spectator-display-save').click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await zeigeMonitor(page);
    // der Monitor zeigt bis zum nächsten Abruf noch den Stand von eben (Poll-Takt, Profil des Monitors)
    await expect.poll(() => flaeche(page, 'home'), { timeout: 30000 }).toBe(BLAU);
    expect(await flaeche(page, 'away')).toBe(ROT);
    const grossAus = [await groesse(page, 'home'), await groesse(page, 'away')];
    for (const i of [0, 1]) {
      for (const k of ['l', 't', 'w', 'h'] as const) {
        expect(Math.abs(grossAn[i][k] - grossAus[i][k]), `Kasten ${i} ${k}`).toBeLessThanOrEqual(1);
      }
    }
    await bild(page, 'monitor-teamfarben-aus');
  });
});

test.describe('@ZM-159 Farbe der Kästen am Monitor Feld 1', () => {
  const faelle: Array<{ name: string; kit: Kit | undefined; heim: string; gast: string }> = [
    { name: 'A keine Farbe / keine Farbe', kit: undefined, heim: BLAU, gast: ROT },
    { name: 'B keine Farbe / Gelb', kit: { b: palette.yellow[400] }, heim: BLAU, gast: GELB },
    { name: 'C Gelb / Blau', kit: { a: palette.yellow[400], b: palette.kit.blue }, heim: GELB, gast: BLAU },
  ];
  for (const fall of faelle) {
    test(`@ZM-159 Fall ${fall.name}`, async ({ page }) => {
      await starte(page, fall.kit);
      await zeigeMonitor(page);
      expect(await flaeche(page, 'home')).toBe(fall.heim);
      expect(await flaeche(page, 'away')).toBe(fall.gast);
      await bild(page, `monitor-fall-${fall.name.charAt(0).toLowerCase()}`);
    });
  }
});

/** T2-UI: die Einstellung in beiden Formaten (Handy 360×640, Laptop 1280×720) und beiden Themen; jedes Bild aus einem frischen Seitenaufruf. */
test.describe('T2-UI Bilder der Einstellung', () => {
  test.skip(!BILDER, 'nur mit SA23_BILDER');
  const formate = [{ id: '360x640', width: 360, height: 640 }, { id: '1280x720', width: 1280, height: 720 }];
  for (const format of formate) {
    for (const thema of ['light', 'dark'] as const) {
      for (const navy of [false, true]) {
        test(`Bild ${navy ? 'Navy' : 'Vorbelegung'} ${format.id} ${thema}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: thema });
          await installiereSaat(page.context(), saatMitKit(undefined));
          await page.setViewportSize({ width: format.width, height: format.height });
          await zeigeEinstellung(page);
          if (navy) {
            await waehle(page, 'away', palette.kit.navy);
            await expect(page.getByTestId('spectator-display-similar-hint')).toBeVisible();
          }
          // Bereich an den oberen Rand, unter die feste Kopfzeile der Seite (Mockup zeigt Titel und Vorschau oben)
          await page.getByTestId('spectator-display-section').evaluate((el) => {
            el.scrollIntoView({ block: 'start' });
            for (let p = el.parentElement; p !== null; p = p.parentElement) {
              if (p.scrollTop > 0) { p.scrollTop -= 72; break; }
            }
          });
          await bild(page, `einstellung-${navy ? 'navy' : 'vorbelegung'}-${format.id}-${thema === 'light' ? 'hell' : 'dunkel'}`);
        });
      }
    }
  }
});

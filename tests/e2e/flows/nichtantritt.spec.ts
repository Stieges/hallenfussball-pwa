/**
 * E2E: Nichtantritt in der Oberfläche (B-12, Regel T2-UI). Das Turnier legt der Test selbst an (Wegwerf-Turnier im lokalen
 * Speicher, Gast = Turnierleitung), es läuft ohne Server.
 *
 * Szenarien (Gherkin wörtlich, docs/anforderungen/2026-10-02_spiel-leiten.md):
 * - @SL-174 Dialog: Vorschau „<Gegner> gewinnt 2:0 (Wertung)“, „nur dieses Spiel“ vorgewählt, daneben „Team ist abgereist –
 *   auch alle restlichen Spiele werten“, erst „Wertung eintragen“ speichert, „Abbrechen“ lässt das Spiel unverändert; im
 *   Spielplan und unter „Mehr“ im Cockpit derselbe Dialog.
 * - @SL-175 Gegenbeispiel: nach dem Anpfiff steht unter „Mehr“ kein „Nicht angetreten“.
 * - @W2A-022 gewertet, @W2A-026 Wertung zurücknehmen.
 * Bildschirmprüfung (T2-UI): bei 360×640 und 1280×720 liegt „Wertung eintragen“ ohne Scrollen im Bild, alle Tasten ≥ 44 px.
 * Screenshots nur, wenn `NICHTANTRITT_BILDER` auf einen Ordner zeigt.
 *
 * Der Helfer-Gegenbeispiel (@SL-118) braucht eine Anmeldung mit Rolle; er ist in `ScheduleTab.nichtantritt.test.tsx` und
 * `LiveCockpit.nichtAngetreten.test.tsx` belegt.
 */
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { cup, NAMEN } from '../helpers/laptopCup';

const ID = 'e2e-nichtantritt-cup';
const BILDER = process.env.NICHTANTRITT_BILDER ?? '';
// Spiel 1: FC Nord (Heim) gegen SV Süd (Gast), Wertung 2:0 (Vorgabe)
const SPIEL_1 = '00000000-0000-4000-8000-000000000910';
const HEIM = NAMEN[0];
const GAST = NAMEN[1];

function nichtantrittCup() {
  return { ...cup(), id: ID, title: 'Nichtantritt-Cup' };
}

/** Spielplan rendert Handy- und Desktop-Karte; nur die sichtbare zählt. */
function sichtbar(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`).first();
}

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === '') { return; }
  await page.mouse.move(0, 0);
  // Übergänge der Tasten (Farbe nach dem Antippen) abwarten, sonst zeigt das Bild einen Zwischenstand
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  writeFileSync(`${BILDER}/${name}.png`, await page.screenshot());
}

async function spielplan(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}`);
  await expect(page.locator('[data-match-card]:visible').first()).toBeVisible({ timeout: 15000 });
}

/** Spielkarte von Spiel 1 aufklappen und „Nicht angetreten“ antippen. */
async function dialogAusSpielplan(page: Page): Promise<void> {
  await spielplan(page);
  const karte = page.locator('[data-match-card]:visible').filter({ hasText: HEIM }).first();
  await karte.getByText(HEIM).first().click();
  await sichtbar(page, `forfeit-mark-${SPIEL_1}`).click();
  await expect(page.getByTestId('forfeit-dialog')).toBeVisible();
}

async function hintergrund(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor);
}

async function unterkante(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return box.y + box.height;
}

test.describe('B-12 Nichtantritt (Turnierleitung, lokal)', () => {
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [nichtantrittCup()] });
  });

  // @SL-174 „Dann zeigt der Dialog vor dem Eintragen ‚TSV West gewinnt 2:0 (Wertung)‘“ (SG Mitte, das Heimteam, fehlt).
  // Befund: der Dialog zeigt „SV Süd gewinnt 0:2 (Wertung)“ – den Stand aus Sicht des Heimteams statt des Siegers.
  test('@SL-174 Vorschau: fehlt das Heimteam, zeigt der Dialog „<Gast> gewinnt 2:0 (Wertung)“', async ({ page }) => {
    test.fail(true, 'Befund B-12-VORSCHAU: Vorschau zeigt den Stand aus Heimsicht („gewinnt 0:2“) statt „gewinnt 2:0“');
    await dialogAusSpielplan(page);
    await page.getByTestId('forfeit-choice-A').click();
    await expect(page.getByTestId('forfeit-summary')).toHaveText(`${GAST} gewinnt 2:0 (Wertung)`, { timeout: 3000 });
  });

  test('@SL-174 Gegenprobe: fehlt das Gastteam, zeigt der Dialog „<Heim> gewinnt 2:0 (Wertung)“', async ({ page }) => {
    await dialogAusSpielplan(page);
    await page.getByTestId('forfeit-choice-B').click();
    await expect(page.getByTestId('forfeit-summary')).toHaveText(`${HEIM} gewinnt 2:0 (Wertung)`);
  });

  test('@SL-174 „nur dieses Spiel“ vorgewählt, „Abbrechen“ lässt das Spiel unverändert, erst „Wertung eintragen“ speichert (@W2A-022, @W2A-026)', async ({ page }) => {
    await dialogAusSpielplan(page);
    await expect(page.getByTestId('forfeit-confirm')).toBeDisabled();
    await page.getByTestId('forfeit-choice-A').click();
    await expect(page.getByTestId('forfeit-scope-rest')).toHaveText('Team ist abgereist – auch alle restlichen Spiele werten');
    // vorgewählt: „Nur dieses Spiel“ ist hervorgehoben wie die gewählte Team-Taste, „abgereist“ nicht
    await page.mouse.move(0, 0); // kein Hover-Ton auf der zuletzt getippten Taste
    await expect.poll(async () => (await hintergrund(page, 'forfeit-scope-this')) === (await hintergrund(page, 'forfeit-choice-A'))).toBe(true);
    expect(await hintergrund(page, 'forfeit-scope-rest')).not.toBe(await hintergrund(page, 'forfeit-scope-this'));
    await expect(page.getByTestId('forfeit-rest-hint')).toHaveCount(0);

    // Abbrechen: nichts gespeichert, auch nach dem Neuladen nicht
    await page.getByTestId('forfeit-cancel').click();
    await expect(page.getByTestId('forfeit-dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-match-card]:visible').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('gewertet')).toHaveCount(0);

    // Eintragen: Spiel 1 ist gewertet, auch nach dem Neuladen
    await dialogAusSpielplan(page);
    await page.getByTestId('forfeit-choice-A').click();
    await page.getByTestId('forfeit-confirm').click();
    await expect(page.getByTestId('forfeit-dialog')).toHaveCount(0);
    await expect(page.getByText('gewertet').filter({ visible: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('gewertet').filter({ visible: true }).first()).toBeVisible({ timeout: 15000 });

    // @W2A-026 zurücknehmen: Spiel wieder offen, „Nicht angetreten“ wieder da
    const karte = page.locator('[data-match-card]:visible').filter({ hasText: HEIM }).first();
    await karte.getByText(HEIM).first().click();
    await sichtbar(page, `forfeit-revoke-${SPIEL_1}`).click();
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveText('Wertung zurücknehmen');
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByText('gewertet')).toHaveCount(0);
    await expect(sichtbar(page, `forfeit-mark-${SPIEL_1}`)).toBeVisible();
  });

  test('@SL-174 im Cockpit öffnet „Mehr“ → „Nicht angetreten“ denselben Dialog; @SL-175 nach dem Anpfiff steht er dort nicht', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/live`);
    await page.getByTestId('cockpit-more-button').click({ timeout: 15000 });
    await page.getByTestId('mehr-nicht-angetreten').click();
    await expect(page.getByTestId('forfeit-dialog')).toBeVisible();
    await expect(page.getByTestId('forfeit-choice-A')).toHaveText(`${HEIM} nicht angetreten`);
    await expect(page.getByTestId('forfeit-choice-B')).toHaveText(`${GAST} nicht angetreten`);
    await page.getByTestId('forfeit-cancel').click();
    await expect(page.getByTestId('forfeit-dialog')).toHaveCount(0);

    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await page.getByTestId('cockpit-more-button').click();
    await expect(page.getByTestId('mehr-schliessen')).toBeVisible();
    await expect(page.getByTestId('mehr-nicht-angetreten')).toHaveCount(0);
  });
});

test.describe('B-12 Nichtantritt – Bildschirmprüfung (T2-UI)', () => {
  for (const groesse of [{ width: 360, height: 640 }, { width: 1280, height: 720 }]) {
    test(`Dialog bei ${groesse.width}×${groesse.height}: „Wertung eintragen“ ohne Scrollen sichtbar, Tasten ≥ 44 px`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize(groesse);
      await seedIndexedDB({ tournaments: [nichtantrittCup()] });
      await spielplan(page);
      const karte = page.locator('[data-match-card]:visible').filter({ hasText: HEIM }).first();
      await karte.getByText(HEIM).first().click();
      const taste = sichtbar(page, `forfeit-mark-${SPIEL_1}`);
      await expect(taste).toBeVisible();
      expect((await taste.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await bild(page, `karte-${groesse.width}`);
      await taste.click();
      await expect(page.getByTestId('forfeit-dialog')).toBeVisible();

      // höchster Zustand: Team gewählt, „abgereist“ gewählt (Vorschau, Umfang und Hinweis sichtbar)
      for (const schritt of ['anfang', 'team', 'abgereist'] as const) {
        if (schritt === 'team') { await page.getByTestId('forfeit-choice-A').click(); }
        if (schritt === 'abgereist') { await page.getByTestId('forfeit-scope-rest').click(); await expect(page.getByTestId('forfeit-rest-hint')).toBeVisible(); }
        // das Blatt fährt am Handy von unten ein: warten, bis es steht
        await expect.poll(() => unterkante(page, 'forfeit-confirm'), { message: `${schritt}: „Wertung eintragen“ im Bild` }).toBeLessThanOrEqual(groesse.height);
        await expect(page.getByTestId('forfeit-confirm')).toBeInViewport({ ratio: 1 });
        await bild(page, `dialog-${groesse.width}-${schritt}`);
      }
      const tasten = ['forfeit-choice-A', 'forfeit-choice-B', 'forfeit-choice-both', 'forfeit-scope-this', 'forfeit-scope-rest', 'forfeit-cancel', 'forfeit-confirm'];
      for (const id of tasten) {
        expect((await page.getByTestId(id).boundingBox())?.height ?? 0, `${id} ≥ 44 px`).toBeGreaterThanOrEqual(44);
      }
      const mass = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(mass.w, 'kein waagrechtes Scrollen').toBeLessThanOrEqual(mass.iw);
    });
  }
});

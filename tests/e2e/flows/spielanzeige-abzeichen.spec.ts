/**
 * Aufgabe 1.2 (Spielanzeige): ein Abzeichen mit Wort auf Verwaltung, Zuschauer-Seite und Monitor (@OB-065, @OB-066).
 *
 * Saat `hallencup-messlauf` (scripts/visual-metrics/saat): das Finale läuft (Anpfiff vor 320 s), die Phasen-Turniere
 * stehen in der Halbzeitpause (Code PHASEH) und im Strafstoßschießen (Code PHASES), beide mit `live_state` am Spiel
 * (R-SA8). Werte und Wortlaut stammen aus dem Gherkin @OB-065/@OB-066. Läuft nur im Projekt `desktop` und `mobile-sm`
 * (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const HANDY = { width: 360, height: 640 };
const MONITOR = { width: 1280, height: 720 };
const FINALE = '00000003-0000-4000-8000-000000000015';
const KEINE_UHR = /^[^\d]*$/;

async function oeffne(page: Page, groesse: { width: number; height: number }, route: string, erwarte: string) {
  await page.setViewportSize(groesse);
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(route);
  await expect(page.locator(erwarte).first()).toBeAttached({ timeout: 25000 });
}

/** Hintergrund und Schrift des Abzeichens, wie der Browser sie rechnet. */
async function farben(page: Page, selektor: string) {
  return page.locator(selektor).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { hintergrund: s.backgroundColor, schrift: s.color };
  });
}

test.describe('@OB-065 Das Abzeichen „Live“ ist überall dasselbe', () => {
  test('@OB-065 Finale trägt „Live“ auf Spielplan (Verwaltung), Zuschauer-Seite und Monitor Feld 1 – überall ohne Uhrzeit, gleiche Farbe', async ({ page }) => {
    const abzeichen = `[data-testid="final-live-${FINALE}"]`;

    await oeffne(page, HANDY, '/#/tournament/hallencup-messlauf/schedule', abzeichen);
    await expect(page.locator(abzeichen)).toHaveText(/^Live$/);
    await expect(page.locator(abzeichen)).toHaveText(KEINE_UHR);
    const verwaltung = await farben(page, abzeichen);

    await page.goto('/#/live/MESS26');
    await expect(page.locator(abzeichen)).toBeAttached({ timeout: 25000 });
    await expect(page.locator(abzeichen)).toHaveText(/^Live$/);
    await expect(page.locator(abzeichen)).toHaveText(KEINE_UHR);
    // gleiche Farbe wie in der Verwaltung (Live-Rot, nicht das Rot einer Fehlermeldung)
    expect(await farben(page, abzeichen)).toEqual(verwaltung);

    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-live', '[data-testid="live-badge"]');
    await expect(page.locator('[data-testid="live-badge"]')).toHaveText(/^Live$/);
    await expect(page.locator('[data-testid="live-badge"]')).toHaveText(KEINE_UHR);
  });

  test('@OB-065 Gegenbeispiel: ein geplantes Spiel (Spiel um Platz 3) trägt kein Abzeichen', async ({ page }) => {
    await oeffne(page, HANDY, '/#/live/MESS26', '[data-testid^="final-card-"]');
    const platz3 = page.locator('[data-testid="final-card-00000003-0000-4000-8000-000000000016"]');
    await expect(platz3.locator('[data-testid^="final-live-"], [data-testid="match-status-badge"]')).toHaveCount(0);
  });
});

test.describe('@OB-066 Jeder Zustand hat sein Wort', () => {
  test('@OB-066 Spielplan-Folie Feld 1: das laufende Spiel trägt das Wort „Live“, kein Statuspunkt', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-messlauf/mon-plan-feld', '[data-testid="monitor-match-row"]');
    const laufend = page.locator(`[data-testid="monitor-match-row"][data-match-id="${FINALE}"]`);
    // das Finale steht auf einer späteren Seite der Folie (6 Zeilen je Seite)
    for (let versuch = 0; versuch < 4 && (await laufend.count()) === 0; versuch += 1) {
      await page.waitForTimeout(16000);
    }
    await expect(laufend).toHaveAttribute('data-status', 'running');
    await expect(laufend.locator('[data-testid="match-status-badge"]')).toHaveText('Live');
    // Gegenbeispiel: eine beendete Zeile trägt „Ende“, nie „Live“
    const beendet = page.locator('[data-testid="monitor-match-row"][data-status="finished"]').first();
    if (await beendet.count() > 0) { await expect(beendet.locator('[data-testid="match-status-badge"]')).toHaveText('Ende'); }
  });

  test('@OB-066 Strafstoßschießen: Monitor und Zuschauer-Seite zeigen „Strafstoßschießen“, nicht „Pause“', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-phase-strafstoss/mon-live', '[data-testid="live-badge"]');
    await expect(page.locator('[data-testid="live-badge"]')).toHaveText('Strafstoßschießen');
    await expect(page.locator('[data-testid="live-badge"]')).not.toContainText('Pause');

    await oeffne(page, HANDY, '/#/live/PHASES', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Strafstoßschießen');
  });

  test('@ZM-115 Halbzeit: „Halbzeit“ auf Monitor und Zuschauer-Seite', async ({ page }) => {
    await oeffne(page, MONITOR, '/#/display/hallencup-phase-halbzeit/mon-live', '[data-testid="live-badge"]');
    await expect(page.locator('[data-testid="live-badge"]')).toHaveText('Halbzeit');

    await oeffne(page, HANDY, '/#/live/PHASEH', '[data-testid^="final-live-"]');
    await expect(page.locator('[data-testid^="final-live-"]')).toHaveText('Halbzeit');
  });
});

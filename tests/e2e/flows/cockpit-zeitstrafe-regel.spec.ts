/**
 * E2E (Gast, lokal) R2 PR 4 – Spielregeln aus den Einstellungen (Record `2026-09-27_wizard-regelinhalte`).
 * @W2A-016: Zeitstrafe auf 1 Minute eingestellt → der Knopf im Cockpit nennt „Zeitstrafe 1 Min“, die Strafe läuft 1:00, eine
 *   Dauer wird nicht abgefragt (Tipp → Rückennummer → fertig).
 * @W2A-029: läuft das Spiel mit 2 Minuten und die Turnierleitung stellt auf 1 Minute um, nennt das laufende Spiel weiter 2 Min.
 * @W2A-012: Turnier-Einstellungen (Admin → Match Cockpit) ohne gespeicherte Schützenzahl zeigen 3.
 * Bilder nach `R2D_BILDER` (für die Bildprüfung), sonst keine. Läuft in den Offline-Projekten.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { cup, ID, anpfeifen } from '../helpers/laptopCup';
import { wartePicker } from '../helpers/cockpitNeu';

const BILDER = process.env.R2D_BILDER ?? '';

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === '') { return; }
  mkdirSync(BILDER, { recursive: true });
  writeFileSync(join(BILDER, `${name}.png`), await page.screenshot());
}

/** Cockpit-Cup mit eingestellter Zeitstrafe (Sekunden) und ohne gespeicherte Schützenzahl. */
function cupMitZeitstrafe(sekunden: number) {
  return { ...cup(), matchCockpitSettings: { timePenaltyDurationSeconds: sekunden } };
}

test.describe('Spielregeln aus den Einstellungen (@W2A-016, @W2A-029, @W2A-012)', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
  });

  test('@W2A-016 Zeitstrafe 1 Minute: Knopf „Zeitstrafe 1 Min“, Strafe läuft 1:00, keine Dauer-Auswahl', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cupMitZeitstrafe(60)] });
    await anpfeifen(page);
    const knopf = page.getByTestId('penalty-button-away');
    await expect(knopf).toContainText('Zeitstrafe 1 Min');
    await bild(page, `cockpit-zeitstrafe-1min-${testInfo.project.name}`);
    await knopf.click();
    await wartePicker(page);
    await expect(page.getByText(/Dauer/)).toHaveCount(0);
    await page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
    await expect(page.getByTestId('number-picker')).toBeHidden();
    // Handy: Marke „Nr. 5 · 1:00“ unter den Tasten der Team-Spalte; Laptop/Desktop (seit #386): Karte „<Team>, Nr. 5, Restzeit 1:00“
    // in der Strafen-Spalte (accessible name). Beide Wege nennen Team Gast, Nummer 5 und Restzeit 1:00 bzw. 0:5x.
    const gast = (await page.getByTestId('team-column-away').getAttribute('aria-label')) ?? '';
    expect(gast).not.toBe('');
    const marke = page.getByTestId('team-column-away').getByText(/^Nr\. 5 · (1:00|0:5\d)$/);
    const karte = page.getByRole('listitem', { name: new RegExp(`^${gast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, Nr\\. 5, Restzeit (1:00|0:5\\d)$`) });
    await expect(marke.or(karte)).toBeVisible();
    await bild(page, `cockpit-zeitstrafe-1min-laeuft-${testInfo.project.name}`);
  });

  test('@W2A-029 laufendes Spiel mit 2 Min: nach der Umstellung auf 1 Minute nennt der Knopf weiter 2 Min', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cupMitZeitstrafe(120)] });
    await anpfeifen(page);
    await expect(page.getByTestId('penalty-button-away')).toContainText('Zeitstrafe 2 Min');
    // Turnierleitung stellt in den Einstellungen (Admin → Match Cockpit) auf 1 Minute um
    await page.goto(`/#/tournament/${ID}/admin/match-cockpit`);
    const dauer = page.getByTestId('settings-time-penalty-duration');
    await expect(dauer).toBeVisible({ timeout: 15000 });
    await dauer.selectOption('60');
    await expect(dauer).toHaveValue('60');
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('penalty-button-away')).toContainText('Zeitstrafe 2 Min', { timeout: 15000 });
  });

  test('@W2A-012 Turnier-Einstellungen ohne gespeicherte Schützenzahl: vorbelegt 3', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cupMitZeitstrafe(120)] });
    await page.goto(`/#/tournament/${ID}/admin/match-cockpit`);
    const schuetzen = page.getByTestId('settings-penalty-shooters');
    await expect(schuetzen).toHaveValue('3', { timeout: 15000 });
    await schuetzen.scrollIntoViewIfNeeded();
    await bild(page, `einstellungen-schuetzen-3-${testInfo.project.name}`);
  });
});

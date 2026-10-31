/**
 * @TM-153 – Der Assistent zeigt bei mehreren Runden Spielzahl und Ende und warnt nur (Record 2026-10-01_turniermodi).
 *
 * Gegeben Olli legt ein Turnier „Jeder gegen jeden“ mit 6 Teams an, 10 Minuten je Spiel, ohne Pause zwischen den
 * Spielen, Beginn 16:30 (Record-Stand 31.10.; kein Hinweis „gegen Mitternacht“).
 * Wenn Olli <Rundenzahl> einstellt, dann zeigt der Assistent <Anzeige>.
 * Echter Bedienweg: Schritt 1 (Beginn) → Schritt 2 (klassisch) → Schritt 3 (Modus & Spielsystem).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';

const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

/** Stepper über seine Beschriftung: Wert lesen und mit −/+ auf das Ziel stellen. */
async function stelleStepper(page: Page, label: string, ziel: number): Promise<void> {
  const box = page.locator('label', { hasText: label }).first().locator('..');
  for (let i = 0; i < 30; i++) {
    const text = (await box.locator('div').filter({ hasNotText: label }).last().innerText()).trim();
    const wert = Number.parseInt(text, 10);
    if (wert === ziel) { return; }
    await box.getByRole('button', { name: wert < ziel ? '+' : '−', exact: true }).click();
  }
  throw new Error(`Stepper „${label}“ erreicht ${String(ziel)} nicht`);
}

async function zuSchrittSpielmodus(page: Page): Promise<void> {
  await page.goto('/#/tournament/new');
  await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();
  await page.locator(`input[placeholder*="${t('wizard:step3.tournamentNamePlaceholder')}"]`).first().fill('Nikolaus-Turnier');
  await page.locator('input[placeholder*="Sporthalle"]').first().fill('Halle Waging');
  await page.locator('input[type="date"]').first().fill(FUTURE_DATE);
  await page.locator('input[type="time"]').first().fill('16:30');
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\?step=2/);
  await page.locator('[data-testid="wizard-type-classic"]').click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page).toHaveURL(/\?step=3/);
  await expect(page.getByRole('heading', { name: t('wizard:step2.title') })).toBeVisible();

  await stelleStepper(page, t('wizard:step2.teamCount'), 6);
  await page.getByRole('button', { name: new RegExp(t('wizard:step2.timePlanning')) }).click();
  await stelleStepper(page, t('wizard:gameTimeConfig.gameDuration'), 10);
  await stelleStepper(page, t('wizard:gameTimeConfig.breakBetweenGames'), 0);
}

test.describe('@TM-153 Rundenzahl im Assistenten', () => {
  test('@TM-153 vorbelegt 1 Runde: „15 Spiele · Ende ca. 19:00“, kein Grenz-Hinweis', async ({ page }) => {
    await zuSchrittSpielmodus(page);

    await expect(page.getByTestId('wizard-round-count-input')).toHaveValue('1');
    await expect(page.getByTestId('wizard-round-summary')).toHaveText('15 Spiele · Ende ca. 19:00');
    await expect(page.getByTestId('wizard-round-count-hint')).toHaveText('');
  });

  test('@TM-153 3 Runden: „45 Spiele · Ende ca. 00:00“, Weiter bleibt möglich', async ({ page }) => {
    await zuSchrittSpielmodus(page);

    await page.getByTestId('wizard-round-count-input').fill('3');
    await expect(page.getByTestId('wizard-round-summary')).toHaveText('45 Spiele · Ende ca. 00:00');
    await expect(page.getByText(/Mitternacht/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page).toHaveURL(/\?step=4/);
  });

  test('@TM-153 11 Runden: „Höchstens 10 Runden“ und übernimmt 10', async ({ page }) => {
    await zuSchrittSpielmodus(page);

    await page.getByTestId('wizard-round-count-input').fill('11');
    await expect(page.getByTestId('wizard-round-count-hint')).toHaveText('Höchstens 10 Runden');
    await expect(page.getByTestId('wizard-round-count-input')).toHaveValue('10');
    await expect(page.getByTestId('wizard-round-summary')).toContainText('150 Spiele');
  });

  test('@TM-153 0 Runden: „Mindestens 1 Runde“ und übernimmt 1', async ({ page }) => {
    await zuSchrittSpielmodus(page);

    await page.getByTestId('wizard-round-count-input').fill('0');
    await expect(page.getByTestId('wizard-round-count-hint')).toHaveText('Mindestens 1 Runde');
    await expect(page.getByTestId('wizard-round-count-input')).toHaveValue('1');
    await expect(page.getByTestId('wizard-round-summary')).toHaveText('15 Spiele · Ende ca. 19:00');
  });
});

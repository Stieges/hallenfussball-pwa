/**
 * Visual Regression: Tournament Creation Wizard, Schritt 1 (Stammdaten) (Task T5)
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * `t('wizard:step3.title')` (nicht `step1.title`!) ist HIER korrekt, kein Copy-Paste-Fehler:
 * `TournamentCreationScreen.tsx:473` rendert bei `step === 1` die Komponente `Step3_Metadata`
 * (i18n-Namensraum-Titel "Stammdaten") -- die Nummerierung der Datei-/Komponenten-Namen
 * entspricht NICHT der sichtbaren Wizard-Schritt-Nummer (dasselbe Muster bei Schritt 5 =
 * `Step4_Teams` und Schritt 6 = `Step5_Overview`, siehe `wizard-overview.visual.spec.ts`).
 */

import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';
import { freezeClock, commonMasks } from './helpers';

test('Wizard Schritt 1: Stammdaten (leer)', async ({ page }) => {
  await freezeClock(page);

  await page.goto('/#/tournament/new');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();

  await expect(page).toHaveScreenshot('wizard-step1.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});

/**
 * Visual Regression: Tournament Creation Wizard, letzter Schritt (Übersicht/Zusammenfassung)
 * (Task T5, Ruling AD aus der Fixrunde-1-Vorgabe des Controllers nach `task-T5-review.md`,
 * Issue #2).
 * Siehe dashboard.visual.spec.ts für die allgemeine Erklärung (Container-Pflicht, Ruling Y).
 *
 * Ersetzt das ursprüngliche `wizard-step5.visual.spec.ts` (Step 5 = "Teams"). Plan-Absicht war
 * „erster und letzter Schritt" des Wizards -- der Wizard hat aber 6 Schritte
 * (`ProgressBar`-`stepLabels` in `src/screens/TournamentCreationScreen.tsx:453`: „Stammdaten,
 * Sportart, Modus, Gruppen & Felder, Teams, Übersicht"), der LETZTE Schritt ist deshalb Schritt 6
 * ("Übersicht"), nicht Schritt 5 ("Teams"). Direkter Deep-Link auf `?step=6` (wie
 * `tests/e2e/flows/wizard.spec.ts`, „Step 6: Turnier-Zusammenfassung und Veröffentlichen") --
 * rendert den Step direkt ohne die vorherigen Steps durchzuklicken (F-321-Fix, siehe
 * `wizard.spec.ts`). Ohne generierten Spielplan (frischer Deep-Link, kein `generatedSchedule`)
 * rendert `TournamentCreationScreen.tsx:569` `<Step5_OverviewDirect>` (Datei
 * `src/features/tournament-creation/Step5_Overview.tsx`) -- trotz des Dateinamens „Step5" der
 * Inhalt für Wizard-SCHRITT 6 (Nummerierungs-Versatz zwischen internem Komponenten-Namen und
 * sichtbarem Schritt, wie schon bei Step3_Metadata=Schritt 1 und Step4_Teams=Schritt 5,
 * siehe wizard-step1.visual.spec.ts).
 *
 * Wartebedingung (Review-Fix, Issue #2): NICHT auf ProgressBar-Text warten (die Step-Labels,
 * inkl. „Übersicht" selbst, werden SYNCHRON gerendert, TournamentCreationScreen.tsx:453 --
 * außerhalb von <Suspense>, TournamentCreationScreen.tsx:466). Stattdessen auf die Überschrift
 * `t('wizard:step5.title')` ("Zusammenfassung", Step5_Overview.tsx:20) UND den testid
 * `wizard-show-preview`-Button (Step5_Overview.tsx:128) -- beide kommen ausschließlich im
 * tatsächlich gerenderten Inhalt vor, keine Überschneidung mit der ProgressBar (deren Buttons
 * `role="tab"` sind, keine Headings).
 */

import { test, expect } from '../helpers/test-fixtures';
import { t } from '../helpers/i18n';
import { freezeClock, commonMasks } from './helpers';

test('Wizard letzter Schritt: Übersicht (leer)', async ({ page }) => {
  await freezeClock(page);

  await page.goto('/#/tournament/new?step=6');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: t('wizard:step5.title') })).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('wizard-show-preview')).toBeVisible({ timeout: 5000 });

  await expect(page).toHaveScreenshot('wizard-overview.png', {
    fullPage: true,
    mask: commonMasks(page),
  });
});

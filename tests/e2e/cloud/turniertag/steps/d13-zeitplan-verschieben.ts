/**
 * D13 Zeitplan verschieben. Besitzer: B-26 (gebaut).
 * Die Turnierleitung verschiebt im Spielplan-Reiter über „Zeiten verschieben“ (`schedule-shift-button`) ab dem nächsten
 * geplanten Spiel um 10 Minuten nach hinten: ab dem ersten Anpfiff mit Vorschau und Bestätigung (@ZP-012, @ZP-017).
 * Danach tragen die verschobenen Spiele „ursprünglich hh:mm“, auch nach dem Neuladen (Stand aus der Cloud).
 */
import { expect } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, openTurniertagPath } from './shared';
import type { StepContext, TurniertagStep } from './types';

/** Speichern geht über die Cloud (Warteschlange): großzügiger als der Soll-Marker. */
const SPEICHERN_MS = 15_000;

async function zeitplanVerschieben({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  await expectSollMarker(ownerPage, 'schedule-shift-button');
  const ursprunglich = ownerPage.locator('[data-testid^="match-original-"]:visible');
  await expect(ursprunglich, 'vor dem Verschieben steht nirgends „ursprünglich“').toHaveCount(0);
  await ownerPage.getByTestId('schedule-shift-button').click();
  const weiter = ownerPage.getByTestId('time-shift-proceed');
  const mitVorschau = (await weiter.innerText()).includes('Vorschau');
  await weiter.click();
  if (mitVorschau) {
    await expect(ownerPage.getByTestId('time-shift-preview')).toContainText('Noch nichts geändert');
    await ownerPage.getByTestId('time-shift-confirm').click();
  }
  await expect(ownerPage.getByTestId('time-shift-strip')).toContainText('Zeiten um 10 Min. verschoben', { timeout: SPEICHERN_MS });
  await expect(ursprunglich.first(), 'verschobene Spiele tragen „ursprünglich hh:mm“').toHaveText(/^ursprünglich \d{2}:\d{2}$/, { timeout: SPEICHERN_MS });
  await expect.poll(async () => {
    await ownerPage.reload();
    await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
    return ursprunglich.count();
  }, { message: 'nach dem Neuladen (Cloud-Stand) bleibt die Verschiebung', timeout: SPEICHERN_MS * 2 }).toBeGreaterThan(0);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D13', title: 'Zeitplan verschieben', scenarios: ['@ZP-012', '@ZP-017'], owner: 'B-26', expectedFail: false, run: zeitplanVerschieben },
];

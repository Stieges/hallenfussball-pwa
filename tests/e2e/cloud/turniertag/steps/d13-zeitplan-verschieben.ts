/**
 * D13 Zeitplan verschieben. Besitzer: B-26 (gebaut).
 * Die Turnierleitung verschiebt im Spielplan-Reiter über „Zeiten verschieben“ (`schedule-shift-button`) ab dem nächsten
 * geplanten Spiel um 10 Minuten nach hinten: ab dem ersten Anpfiff mit Vorschau und Bestätigung (@ZP-012, @ZP-017).
 * Danach tragen die verschobenen Spiele „(war hh:mm)“, auch nach dem Neuladen (Stand aus der Cloud).
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
  await expect(ursprunglich, 'vor dem Verschieben steht nirgends „(war …)“').toHaveCount(0);
  const diag: string[] = [];
  ownerPage.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { diag.push(`console ${m.type()}: ${m.text().slice(0, 600)}`); } });
  ownerPage.on('response', async (r) => { if (r.url().includes('/rest/v1/') && r.request().method() !== 'GET') { let b = ''; try { b = (await r.text()).slice(0, 400); } catch { b = '?'; } diag.push(`resp ${r.request().method()} ${r.status()} ${r.url().split('/rest/v1/')[1]?.slice(0, 160)} :: ${b}`); } });
  ownerPage.on('requestfailed', (r) => { if (r.url().includes('/rest/v1/')) { diag.push(`FAILED ${r.method()} ${r.failure()?.errorText ?? ''} ${r.url().split('/rest/v1/')[1]?.slice(0, 120)}`); } });
  ownerPage.on('framenavigated', (f) => { if (f === ownerPage.mainFrame()) { diag.push(`NAV ${new Date().toISOString()}`); } });
  await ownerPage.getByTestId('schedule-shift-button').click();
  const weiter = ownerPage.getByTestId('time-shift-proceed');
  const mitVorschau = (await weiter.innerText()).includes('Vorschau');
  await weiter.click();
  if (mitVorschau) {
    await expect(ownerPage.getByTestId('time-shift-preview')).toContainText('Noch nichts geändert');
    await ownerPage.getByTestId('time-shift-confirm').click();
  }
  await expect(ownerPage.getByTestId('time-shift-strip')).toContainText('Zeiten um 10 Minuten verschoben', { timeout: SPEICHERN_MS });
  await expect(ursprunglich.first(), 'verschobene Spiele tragen „(war hh:mm)“').toHaveText(/^\(war \d{2}:\d{2}\)$/, { timeout: SPEICHERN_MS });
  await expect.poll(async () => {
    await ownerPage.reload();
    await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
    return ursprunglich.count();
  }, { message: 'nach dem Neuladen (Cloud-Stand) bleibt die Verschiebung', timeout: SPEICHERN_MS * 2 }).toBeGreaterThan(0);
  const rejected = await ownerPage.getByText(/gestört|nicht übernommen|abgelehnt/).count();
  process.stdout.write(`\nDIAG-D13 rejectedText=${rejected}\n${diag.join('\n')}\nDIAG-D13-ENDE\n`);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D13', title: 'Zeitplan verschieben', scenarios: ['@ZP-012', '@ZP-017'], owner: 'B-26', expectedFail: false, run: zeitplanVerschieben },
];

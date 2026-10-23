/**
 * D7 Zuschauer live: @ZM-021 "Änderungen erscheinen ohne Neuladen nach höchstens 10 Sekunden" (Befund C-ZUSCHAUER-OHNE-NEULADEN,
 * behoben mit dem B-15-Anschluss: die Seite liest standardmäßig über public_tournament).
 * Besitzer: B-14 (Server `public_tournament`) / B-15 (Zuschauer-Seite). Soll: ein Tor, das die Turnierleitung einträgt, steht
 * nach höchstens 10 Sekunden auf der offenen Zuschauer-Seite, OHNE Neuladen, und die Seite holt es über die Server-Funktion
 * `public_tournament` (nicht mehr direkt aus den Tabellen).
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zuschauerLive({ anonPage }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const match = groupMatches[0]; // läuft seit D4
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await anonPage.waitForLoadState('networkidle');
  await anonPage.evaluate(() => { (window as unknown as { __ohneNeuladen?: boolean }).__ohneNeuladen = true; });
  const vorher = await anonPage.locator('body').innerText();
  const anfrage = anonPage.waitForRequest((req) => req.url().includes('/rpc/public_tournament'), { timeout: 10_000 });
  const start = Date.now() - 600_000;
  const tor = await appendOwner(match.id, [eventOf('GOAL', Date.now(), start, { teamId: match.team_b_id })]);
  expect(tor.results.map((r) => r.status), 'Tor der Turnierleitung wird angenommen').toEqual(['accepted']);
  // Ohne Neuladen innerhalb von 10 Sekunden (@ZM-021): die Seite hat sich verändert, ohne dass sie neu geladen wurde.
  await expect.poll(async () => (await anonPage.locator('body').innerText()) !== vorher, { message: 'Tor erscheint auf der Zuschauer-Seite', timeout: 10_000 }).toBe(true);
  expect(await anonPage.evaluate(() => (window as unknown as { __ohneNeuladen?: boolean }).__ohneNeuladen), 'Seite wurde nicht neu geladen').toBe(true);
  await expect(anfrage, 'Abfrage über public_tournament').resolves.toBeTruthy();
}

export const steps: readonly TurniertagStep[] = [
  {
    id: 'D7', title: 'Tor erscheint auf der Zuschauer-Seite ohne Neuladen innerhalb von 10 s', scenarios: ['@ZM-021'],
    owner: 'B-14/B-15 (gebaut, B-15-Anschluss #360)', expectedFail: false, run: zuschauerLive,
  },
];

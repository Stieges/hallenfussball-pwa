/**
 * D3b Helfer leitet ein Spiel auf seinem Feld, auf dem Handy (390 x 844, Touch). Besitzer: A-16/A-17/A-18, A-27.
 * Soll (@HE-082, @HE-083): der Helfer trägt auf seinem Feld ein Tor ein, ein fremdes Feld ist für ihn gesperrt.
 * Heute scheitert der Schritt am Zulassungs-Marker (kein Feld je Helfer).
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { enterGoal } from '../../helpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, mobileRolePage, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function helferLeitetSeinFeld({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const eigenes = groupMatches.find((m) => m.field === 1);
  const fremdes = groupMatches.find((m) => m.field === 2);
  expect(eigenes && fremdes, 'Spiele auf Feld 1 und Feld 2').toBeTruthy();
  const page = await mobileRolePage(browser, 'helper');
  try {
    await openCockpit(page, TURNIERTAG_ID, eigenes!.id);
    await expectPageAnchor(page.locator('[data-testid="team-name-home"]'), 'Cockpit auf dem Handy');
    expect(page.viewportSize()?.width, 'Handy-Ansicht').toBeLessThan(500);
    const vorher = (await fetchEngineRows(eigenes!.id)).filter((row) => row.type === 'GOAL').length;
    await enterGoal(page, 'home');
    await expect.poll(async () => (await fetchEngineRows(eigenes!.id)).filter((row) => row.type === 'GOAL').length, { timeout: 10000 }).toBe(vorher + 1);
    await openCockpit(page, TURNIERTAG_ID, fremdes!.id);
    await expectSollMarker(page, 'helper-field-locked');
  } finally {
    await page.context().close();
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D3b', title: 'Helfer leitet ein Spiel auf seinem Feld (Handy), fremdes Feld gesperrt', scenarios: ['@HE-082', '@HE-083'], owner: 'A-16/A-17/A-18, A-27', expectedFail: true, run: helferLeitetSeinFeld },
];

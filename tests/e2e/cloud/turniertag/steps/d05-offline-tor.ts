/**
 * D5 Tor offline, wieder online. Besitzer: A-06 (Ausgang/Wiederholung). Heute läuft der Weg:
 * die Turnierleitung geht offline, trägt ein Tor ein (ein Eintrag wartet), geht online, der
 * Ausgang leert sich und die DB hält das zweite Tor.
 */
import { expect } from '@playwright/test';
import { enterGoal } from '../../helpers';
import { expectEngineMatchRunningUi, fetchEngineRows, newRoleContext, openCockpit } from '../../engineHelpers';
import { fetchTurniertagBracket, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function offlineTor({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const first = groupMatches[0];
  const { context, page } = await newRoleContext(browser, 'owner');
  try {
    await openCockpit(page, TURNIERTAG_ID, first.id);
    await expectEngineMatchRunningUi(page);
    await context.setOffline(true);
    await enterGoal(page, 'home');
    await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '1', { timeout: 5000 });
    await context.setOffline(false);
    await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: 15000 });
    await expect.poll(async () => (await fetchEngineRows(first.id)).filter((row) => row.type === 'GOAL').length, { timeout: 10000 }).toBe(2);
  } finally {
    await context.close();
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D5', title: 'Tor offline eintragen, wieder online: nichts geht verloren', scenarios: ['@FU-013'], owner: 'A-06', expectedFail: false, run: offlineTor },
];

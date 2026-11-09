/**
 * D3b Helfer leitet ein Spiel auf seinem Feld, auf dem Handy (390 x 844, Touch). Besitzer: A-16/A-17/A-18, A-27.
 * Soll: der Helfer trägt auf seinem Feld ein Tor ein, ein fremdes Feld ist für ihn gesperrt. @HE-082/@HE-083 (Server-Grenzen: Gerät ohne
 * Zulassung bzw. außerhalb seines Turniers legt nichts an) prüft dieser Schritt nicht – sie sind in den Prüfskripten der Geräte-Rollen belegt.
 * Szenario: @HE-042 (Helfer auf seinem Feld: Tor eintragen gelingt, in der App und in der Datenbank). Die frühere Erwartung „fremdes Feld gesperrt“
 * (`helper-field-locked`) stammte aus dem entfallenen @HE-041; @HE-108 macht das Feld zur Vorauswahl ohne Sperre. Sie ist seit V1 (09.11.) aus dem
 * Schritt genommen: ein Schritt darf nicht an einer Erwartung rot bleiben, die keine Anforderung mehr stellt.
 */
import { expect } from '@playwright/test';
import { fetchEngineRows, openCockpit } from '../../engineHelpers';
import { enterGoal } from '../../helpers';
import { expectPageAnchor, fetchTurniertagBracket, mobileRolePage, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function helferLeitetSeinFeld({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const eigenes = groupMatches.find((m) => m.field === 1);
  expect(eigenes, 'ein Spiel auf Feld 1').toBeTruthy();
  const page = await mobileRolePage(browser, 'helper');
  try {
    await openCockpit(page, TURNIERTAG_ID, eigenes!.id);
    await expectPageAnchor(page.locator('[data-testid="team-name-home"]'), 'Cockpit auf dem Handy');
    expect(page.viewportSize()?.width, 'Handy-Ansicht').toBeLessThan(500);
    const vorher = (await fetchEngineRows(eigenes!.id)).filter((row) => row.type === 'GOAL').length;
    await enterGoal(page, 'home');
    await expect.poll(async () => (await fetchEngineRows(eigenes!.id)).filter((row) => row.type === 'GOAL').length, { timeout: 10000 }).toBe(vorher + 1);
  } finally {
    await page.context().close();
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D3b', title: 'Helfer trägt auf seinem Feld ein Tor ein (Handy), es steht in der Datenbank', scenarios: ['@HE-042'], owner: 'A-16/A-17/A-18, A-27 (gebaut)', expectedFail: false, run: helferLeitetSeinFeld },
];

/**
 * D4 Anpfiff / Tor / Karte im ersten Gruppenspiel. Besitzer: B-11 (Cockpit-Umbau, Spur B).
 * Heute geht der Weg über das Ereignisprotokoll bereits: die Turnierleitung pfeift an, trägt ein
 * Tor und eine Gelbe Karte ein; die DB hält genau diese drei Engine-Zeilen. B-11 baut das Cockpit
 * um, die Aussage bleibt.
 */
import { expect } from '@playwright/test';
import { enterGoal } from '../../helpers';
import { tippeKarte } from '../../../helpers/cockpitNeu';
import { expectEngineMatchRunningUi, fetchEngineRows, openCockpit } from '../../engineHelpers';
import { fetchTurniertagBracket, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function anpfiffTorKarte({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const first = groupMatches[0];
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, first.id);
  await ownerPage.locator('[data-testid="match-start-button"]').click();
  await expectEngineMatchRunningUi(ownerPage);
  await enterGoal(ownerPage, 'home');
  await expect(ownerPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1');
  await tippeKarte(ownerPage, 'away', 'Gelb');

  await expect.poll(async () => (await fetchEngineRows(first.id)).map((row) => row.type), { timeout: 10000 }).toEqual(['MATCH_START', 'GOAL', 'YELLOW_CARD']);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D4', title: 'Anpfiff, Tor und Karte im ersten Gruppenspiel', scenarios: [], owner: 'B-11', expectedFail: false, run: anpfiffTorKarte },
];

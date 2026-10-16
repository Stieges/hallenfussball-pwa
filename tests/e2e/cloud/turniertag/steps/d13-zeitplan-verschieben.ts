/**
 * D13 Zeitplan verschieben. Besitzer: B-26.
 * Besitzer: B-26 -- Soll-Marker: der Spielplan bietet "alle folgenden Spiele verschieben"
 * (`schedule-shift-button`).
 */
import { expect } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, openTurniertagPath, SOLL_TIMEOUT_MS } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zeitplanVerschieben({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  await expectSollMarker(ownerPage, 'schedule-shift-button');
  // Soll-Wirkung (sichtbar): nach "alle folgenden Spiele verschieben" ändern sich die Anstoßzeiten
  // in der Spielplan-Tabelle (Zeit-Spalte der Zeilen).
  const zeiten = async (): Promise<string> => (await ownerPage.locator('tr').evaluateAll((els) => els.map((tr) => (tr.querySelectorAll('td')[1] as HTMLElement | undefined)?.innerText.trim() ?? ''))).join('|');
  const before = await zeiten();
  await ownerPage.locator('[data-testid="schedule-shift-button"]').click();
  await expect.poll(zeiten, { message: 'Anstoßzeiten der Folgespiele haben sich verschoben', timeout: SOLL_TIMEOUT_MS }).not.toBe(before);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D13', title: 'Zeitplan verschieben', scenarios: [], owner: 'B-26', expectedFail: true, run: zeitplanVerschieben },
];

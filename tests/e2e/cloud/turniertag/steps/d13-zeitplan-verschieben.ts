/**
 * D13 Zeitplan verschieben. Besitzer: B-26.
 * Besitzer: B-26 -- Soll-Marker: der Spielplan bietet "alle folgenden Spiele verschieben"
 * (`schedule-shift-button`).
 */
import { expectSollMarker, openTurniertagPath } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zeitplanVerschieben({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectSollMarker(ownerPage, 'schedule-shift-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D13', title: 'Zeitplan verschieben', scenarios: [], owner: 'B-26', expectedFail: true, run: zeitplanVerschieben },
];

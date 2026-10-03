/**
 * D11 Abschluss + Sperre + Freigabe Bildschirm. Besitzer: A-21a / B-33 / B-20.
 * Besitzer: A-21a/B-33/B-20 -- Soll-Marker: die Turnierleitung schließt das Turnier ab
 * (`tournament-finish-button` im Admin-Center), danach sind Ergebnisse gesperrt und die
 * Bildschirme frei.
 */
import { expectSollMarker, openTurniertagPath } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function abschluss({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectSollMarker(ownerPage, 'tournament-finish-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D11', title: 'Turnier abschließen: Sperre, Bildschirm frei', scenarios: [], owner: 'A-21a/B-33/B-20', expectedFail: true, run: abschluss },
];

/**
 * D15 Zweites Turnier am selben Tag: Monitore aus Vorlage/Turnier übernehmen, Bildschirm neu
 * koppeln. Besitzer: B-22 / B-21.
 * Besitzer: B-22/B-21 -- Soll-Marker: die Monitor-Verwaltung bietet "Monitore übernehmen"
 * (`monitors-adopt-button`). Die Seite ist der Reiter "Monitore" (`/monitors`, nicht `/monitore`).
 */
import { expectPageAnchor, expectSollMarker, openTurniertagPath } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zweitesTurnier({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors');
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitors-adopt-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D15', title: 'Zweites Turnier am selben Tag: Monitore übernehmen, Bildschirm neu koppeln', scenarios: [], owner: 'B-22/B-21', expectedFail: true, run: zweitesTurnier },
];

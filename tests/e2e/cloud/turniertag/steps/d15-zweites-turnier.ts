/**
 * D15 Zweites Turnier am selben Tag: Monitore aus Vorlage/Turnier übernehmen, Bildschirm neu
 * koppeln. Besitzer: B-22 / B-21.
 * Besitzer: B-22/B-21 -- Soll-Marker: die Monitor-Verwaltung bietet "Monitore übernehmen"
 * (`monitors-adopt-button`). Die Seite ist der Reiter "Monitore" (`/monitors`, nicht `/monitore`).
 */
import { expect } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zweitesTurnier({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors');
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitors-adopt-button');
  // Soll-Wirkung (DB): nach "Monitore übernehmen" existieren die Monitore des Turniertag-Cups
  // (gleicher Name) auch in einem anderen Turnier.
  const own = await getRows<{ name: string }>(`monitors?tournament_id=eq.${TURNIERTAG_ID}&select=name`, 'Monitore des Turniertag-Cups');
  expect(own.length, 'Der Turniertag-Cup hat Monitore zum Übernehmen').toBeGreaterThan(0);
  const query = `monitors?tournament_id=neq.${TURNIERTAG_ID}&name=in.(${own.map((m) => `"${m.name}"`).join(',')})&select=id`;
  const before = (await getRows<{ id: string }>(query, 'übernommene Monitore vorher')).length;
  await ownerPage.locator('[data-testid="monitors-adopt-button"]').click();
  await expect.poll(async () => (await getRows<{ id: string }>(query, 'übernommene Monitore nachher')).length, {
    message: 'Monitore sind im zweiten Turnier angekommen', timeout: SOLL_TIMEOUT_MS,
  }).toBeGreaterThan(before);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D15', title: 'Zweites Turnier am selben Tag: Monitore übernehmen, Bildschirm neu koppeln', scenarios: [], owner: 'B-22/B-21', expectedFail: true, run: zweitesTurnier },
];

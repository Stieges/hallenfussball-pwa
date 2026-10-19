/**
 * D15 Zweites Turnier am selben Tag. Geteilt:
 *  - D15a "Monitore übernehmen" (B-22 gebaut, `monitors-transfer-open`, @ME-039): grün.
 *  - D15b "Bildschirm neu koppeln" (Besitzer B-20/B-21): rot, bis die Kopplung steht.
 * Die Seite ist der Reiter "Monitore" (`/monitors`, nicht `/monitore`).
 */
import { expect } from '@playwright/test';
import { E2E_ZWEITES_TURNIER_ID } from '../../testData';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function monitoreUebernehmen({ asRole }: StepContext): Promise<void> {
  // Vorbedingung: Monitore des Turniertag-Cups aus tournaments.config.monitors lesen.
  const own = await getRows<{ config: { monitors?: { name: string }[] } }>(
    `tournaments?id=eq.${TURNIERTAG_ID}&select=config`,
    'Turniertag-Cup config'
  );
  const monitors = own[0]?.config?.monitors ?? [];
  expect(monitors.length, 'Der Turniertag-Cup hat Monitore zum Übernehmen').toBeGreaterThan(0);
  // Zweites Turnier öffnen (eigener leerer Seed-Cup) und dort aus dem Turniertag-Cup übernehmen.
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors', E2E_ZWEITES_TURNIER_ID);
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await ownerPage.locator('[data-testid="monitors-transfer-open"]').click();
  await ownerPage.locator(`[data-testid="transfer-source-${TURNIERTAG_ID}"]`).click();
  await ownerPage.locator('[data-testid="transfer-confirm"]').click();
  await expect(ownerPage.locator('[data-testid="transfer-done"]')).toBeVisible({ timeout: 10000 });
  // Wirkung (DB): config.monitors des zweiten Turniers enthält den Monitor "Hallenbildschirm" des Turniertag-Cups.
  await expect.poll(async () => {
    const rows = await getRows<{ config: { monitors?: { name: string }[] } }>(
      `tournaments?id=eq.${E2E_ZWEITES_TURNIER_ID}&select=config`,
      'Zweites Turnier config'
    );
    return (rows[0]?.config?.monitors ?? []).some((m) => m.name === 'Hallenbildschirm');
  }, { message: 'Monitor "Hallenbildschirm" ist im zweiten Turnier angekommen', timeout: 10000 }).toBe(true);
}

async function bildschirmNeuKoppeln({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors', E2E_ZWEITES_TURNIER_ID);
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitor-pairing-code-input');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D15a', title: 'Zweites Turnier: Monitore übernehmen', scenarios: ['@ME-039'], owner: 'B-22 (gebaut)', expectedFail: false, run: monitoreUebernehmen },
  { id: 'D15b', title: 'Zweites Turnier: Bildschirm neu koppeln (Code eintippen)', scenarios: ['@ME-023', '@ME-051'], owner: 'B-20/B-21', expectedFail: true, run: bildschirmNeuKoppeln },
];

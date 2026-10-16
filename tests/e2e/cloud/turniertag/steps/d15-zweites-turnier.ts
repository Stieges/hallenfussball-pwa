/**
 * D15 Zweites Turnier am selben Tag: Monitore aus Vorlage/Turnier übernehmen, Bildschirm neu
 * koppeln. Besitzer: B-22 / B-21.
 * Besitzer: B-22/B-21 -- Soll-Marker: die Monitor-Verwaltung bietet "Monitore übernehmen"
 * (`monitors-adopt-button`). Die Seite ist der Reiter "Monitore" (`/monitors`, nicht `/monitore`).
 */
import { expect } from '@playwright/test';
import { E2E_ZWEITES_TURNIER_ID } from '../../testData';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zweitesTurnier({ asRole }: StepContext): Promise<void> {
  // Vorbedingung: Monitore des Turniertag-Cups aus tournaments.config.monitors lesen.
  const own = await getRows<{ config: { monitors?: { name: string }[] } }>(
    `tournaments?id=eq.${TURNIERTAG_ID}&select=config`,
    'Turniertag-Cup config'
  );
  const monitors = own[0]?.config?.monitors ?? [];
  expect(monitors.length, 'Der Turniertag-Cup hat Monitore zum Übernehmen').toBeGreaterThan(0);
  // Zweites Turnier öffnen (eigener leerer Seed-Cup) und dort übernehmen.
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors', E2E_ZWEITES_TURNIER_ID);
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitors-adopt-button');
  // Soll-Wirkung (DB): nach "Monitore übernehmen" enthält config.monitors des zweiten Turniers
  // den Monitor "Hallenbildschirm" des Turniertag-Cups.
  await ownerPage.locator('[data-testid="monitors-adopt-button"]').click();
  await expect.poll(async () => {
    const rows = await getRows<{ config: { monitors?: { name: string }[] } }>(
      `tournaments?id=eq.${E2E_ZWEITES_TURNIER_ID}&select=config`,
      'Zweites Turnier config'
    );
    return (rows[0]?.config?.monitors ?? []).some((m) => m.name === 'Hallenbildschirm');
  }, {
    message: 'Monitor "Hallenbildschirm" ist im zweiten Turnier angekommen', timeout: SOLL_TIMEOUT_MS,
  }).toBe(true);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D15', title: 'Zweites Turnier am selben Tag: Monitore übernehmen, Bildschirm neu koppeln', scenarios: [], owner: 'B-22/B-21', expectedFail: true, run: zweitesTurnier },
];

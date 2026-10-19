/**
 * D15 Zweites Turnier am selben Tag. Geteilt:
 *  - D15a "Monitore übernehmen" (B-22 gebaut, `monitors-transfer-open`, @ME-039): grün.
 *  - D15b "Bildschirm neu koppeln" (Besitzer B-20/B-21): rot, bis die Kopplung steht.
 * Die Seite ist der Reiter "Monitore" (`/monitors`, nicht `/monitore`).
 */
import { expect } from '@playwright/test';
import { MONITOR_OVERSCAN } from '../../../../../src/types/monitor';
import { E2E_ZWEITES_TURNIER_ID } from '../../testData';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function monitoreUebernehmen({ asRole }: StepContext): Promise<void> {
  // Vorbedingung: Monitore des Turniertag-Cups aus tournaments.config.monitors lesen.
  const own = await getRows<{ config: { monitors?: MonitorKonfig[] } }>(
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
  // Wirkung (DB, @ME-039): der Monitor "Hallenbildschirm" kommt im zweiten Turnier an, mit denselben Folien in derselben
  // Reihenfolge, Dauer und mit demselben Bildrand. Verglichen wird ohne IDs (Folien-/Monitor-IDs dürfen neu vergeben werden).
  const quelle = monitors.find((m) => m.name === 'Hallenbildschirm');
  expect(quelle, 'Quell-Monitor "Hallenbildschirm"').toBeDefined();
  await expect.poll(async () => {
    const rows = await getRows<{ config: { monitors?: MonitorKonfig[] } }>(
      `tournaments?id=eq.${E2E_ZWEITES_TURNIER_ID}&select=config`,
      'Zweites Turnier config'
    );
    const ziel = (rows[0]?.config?.monitors ?? []).find((m) => m.name === 'Hallenbildschirm');
    return ziel ? ohneIds(ziel) : null;
  }, { message: 'Monitor "Hallenbildschirm" ist im zweiten Turnier angekommen, mit denselben Folien, Reihenfolge, Dauer und Bildrand', timeout: 10000 }).toEqual(ohneIds(quelle!));
}

/** Monitor-Konfiguration, soweit @ME-039 sie vergleicht (Folien, Reihenfolge, Dauer, Bildrand). */
interface MonitorKonfig {
  name: string;
  defaultSlideDuration?: number;
  overscanPercent?: number;
  slides?: { type: string; config?: Record<string, unknown>; duration: number | null; order: number }[];
}

/** Die für die Übernahme maßgeblichen Eigenschaften ohne IDs und Zeitstempel; Folien nach `order` sortiert. */
function ohneIds(monitor: MonitorKonfig): unknown {
  return {
    name: monitor.name,
    defaultSlideDuration: monitor.defaultSlideDuration ?? null,
    // Ein Monitor ohne gesetzten Bildrand hat den vorbelegten (@ME-067); die Übernahme schreibt ihn aus.
    overscanPercent: monitor.overscanPercent ?? MONITOR_OVERSCAN.defaultPercent,
    folien: [...(monitor.slides ?? [])].sort((a, b) => a.order - b.order).map((f) => ({ type: f.type, dauer: f.duration, config: f.config ?? null })),
  };
}

async function bildschirmNeuKoppeln({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/monitors', E2E_ZWEITES_TURNIER_ID);
  await expectPageAnchor(ownerPage.getByRole('heading', { level: 2, name: 'Monitore konfigurieren' }), 'Reiter Monitore');
  await expectSollMarker(ownerPage, 'monitor-pairing-code-input');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D15a', title: 'Zweites Turnier: Monitore übernehmen (gleiche Folien, Reihenfolge, Dauer, Bildrand)', scenarios: ['@ME-039'], owner: 'B-22 (gebaut)', expectedFail: false, run: monitoreUebernehmen },
  { id: 'D15b', title: 'Zweites Turnier: Bildschirm neu koppeln (Code eintippen)', scenarios: ['@ME-023', '@ME-051'], owner: 'B-20/B-21', expectedFail: true, run: bildschirmNeuKoppeln },
];

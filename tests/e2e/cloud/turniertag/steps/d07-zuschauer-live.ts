/**
 * D7 Zuschauer live. Besitzer: B-15 (Zuschauer-Seite über `public_tournament`, Abfrage alle 10 s,
 * E-A2). Besitzer: B-15 -- Soll: die Zuschauer-Seite liest über die Server-Funktion
 * `public_tournament` (nicht mehr direkt aus den Tabellen).
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { expectPageAnchor, SOLL_TIMEOUT_MS } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zuschauerLive({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  const request = anonPage.waitForRequest((req) => req.url().includes('/rpc/public_tournament'), { timeout: SOLL_TIMEOUT_MS });
  await anonPage.reload();
  await expect(request).resolves.toBeTruthy();
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D7', title: 'Zuschauer sieht das Spiel live über public_tournament', scenarios: [], owner: 'B-15', expectedFail: true, run: zuschauerLive },
];

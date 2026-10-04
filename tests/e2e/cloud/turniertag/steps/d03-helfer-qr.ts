/**
 * D3 Helfer per QR (anonyme Gerätesitzung, Zulassung mit Feld). Besitzer: A-16 / A-17.
 * Besitzer: A-16/A-17 -- Soll-Marker: die Turnierleitung zeigt unter "Team & Helfer" einen
 * QR-Code zum Beitritt (`helper-join-qr`).
 */
import { expect } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function helferPerQr({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/team-helpers');
  await expectPageAnchor(ownerPage.getByText('Team & Helfer', { exact: true }).first(), 'Admin-Kategorie Team & Helfer');
  await expectSollMarker(ownerPage, 'helper-join-qr');
  // Soll-Wirkung (DB): nach dem Beitritt per QR gibt es eine Helfer-Mitgliedschaft mit Feldzulassung.
  await expect.poll(async () => (await getRows<{ id: string }>(
    `tournament_collaborators?tournament_id=eq.${TURNIERTAG_ID}&role=eq.helper&allowed_fields=not.is.null&accepted_at=not.is.null&select=id`,
    'Helfer-Mitgliedschaft'
  )).length, { message: 'Helfer-Mitgliedschaft mit allowed_fields im Turniertag-Cup', timeout: SOLL_TIMEOUT_MS }).toBeGreaterThan(0);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D3', title: 'Helfer tritt per QR bei, Zulassung mit Feld', scenarios: [], owner: 'A-16/A-17', expectedFail: true, run: helferPerQr },
];

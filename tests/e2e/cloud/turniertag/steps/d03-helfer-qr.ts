/**
 * D3 Helfer per QR (anonyme Gerätesitzung, Zulassung mit Feld). Besitzer: A-16 / A-17.
 * Besitzer: A-16/A-17 -- Soll-Marker: die Turnierleitung zeigt unter "Team & Helfer" einen
 * QR-Code zum Beitritt (`helper-join-qr`).
 */
import { expectSollMarker, openTurniertagPath } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function helferPerQr({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/team-helpers');
  await expectSollMarker(ownerPage, 'helper-join-qr');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D3', title: 'Helfer tritt per QR bei, Zulassung mit Feld', scenarios: [], owner: 'A-16/A-17', expectedFail: true, run: helferPerQr },
];

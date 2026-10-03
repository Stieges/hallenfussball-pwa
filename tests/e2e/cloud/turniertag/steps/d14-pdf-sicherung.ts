/**
 * D14 PDF + Sicherung. Besitzer: B-28a (PDF) / B-34 (Sicherung).
 * Besitzer: B-28a/B-34 -- Soll-Marker: die Turnierleitung lädt unter "Exporte" die Sicherung des
 * Turniers herunter (`backup-download-button`).
 */
import { expectSollMarker, openTurniertagPath } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function pdfSicherung({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/exports');
  await expectSollMarker(ownerPage, 'backup-download-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D14', title: 'PDF erzeugen und Turnier sichern', scenarios: [], owner: 'B-28a/B-34', expectedFail: true, run: pdfSicherung },
];

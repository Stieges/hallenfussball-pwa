/**
 * D14 PDF + Sicherung. Besitzer: B-28a (PDF) / B-34 (Sicherung).
 * Besitzer: B-28a/B-34 -- Soll-Marker: die Turnierleitung lädt unter "Exporte" die Sicherung des
 * Turniers herunter (`backup-download-button`).
 */
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function pdfSicherung({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/exports');
  await expectPageAnchor(ownerPage.getByText('Exporte', { exact: true }).first(), 'Admin-Kategorie Exporte');
  await expectSollMarker(ownerPage, 'backup-download-button');
  // Soll-Wirkung: der Klick lädt eine nicht leere Sicherung herunter, die dieses Turnier enthält.
  const download = ownerPage.waitForEvent('download', { timeout: SOLL_TIMEOUT_MS });
  await ownerPage.locator('[data-testid="backup-download-button"]').click();
  const path = await (await download).path();
  const inhalt = await readFile(path, 'utf8');
  expect(inhalt.length, 'Sicherung ist nicht leer').toBeGreaterThan(0);
  expect(inhalt, 'Sicherung enthält das Turnier').toContain(TURNIERTAG_ID);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D14', title: 'PDF erzeugen und Turnier sichern', scenarios: [], owner: 'B-28a/B-34', expectedFail: true, run: pdfSicherung },
];

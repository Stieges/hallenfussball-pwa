/**
 * D14 Sicherung mit Spiel-Einträgen (@TE-002, C-BACKUP-EREIGNISSE). Besitzer: B-34. Das PDF (Record drucken) ist gebaut und hat eigene Tests.
 * Besitzer: B-28a/B-34 -- Soll-Marker: die Turnierleitung lädt unter "Exporte" die Sicherung des
 * Turniers herunter (`backup-download-button`).
 */
import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { fetchEngineRows } from '../../engineHelpers';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
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
  // Geschärft (@TE-002, C-BACKUP-EREIGNISSE): die Sicherung enthält die Spiel-Einträge (alle Engine-Ereignisse) eines gespielten Spiels,
  // nicht nur das Turnierobjekt. Mit nur der testid würde der Schritt zu früh grün.
  const { groupMatches } = await fetchTurniertagBracket();
  const ereignisse = await fetchEngineRows(groupMatches[0].id);
  expect(ereignisse.length, 'das erste Gruppenspiel hat Engine-Ereignisse').toBeGreaterThan(0);
  for (const zeile of ereignisse) {
    expect(inhalt, `Sicherung enthält das Ereignis ${zeile.type} (${zeile.id})`).toContain(zeile.id);
  }
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D14', title: 'Turnier sichern: Datei enthält die Spiel-Einträge', scenarios: ['@TE-002'], befunde: ['C-BACKUP-EREIGNISSE'], owner: 'B-34 (Sicherung mit Spiel-Einträgen)', expectedFail: true, run: pdfSicherung },
];

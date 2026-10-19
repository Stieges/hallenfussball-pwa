/**
 * D8b-D10c: Regeln im Turnierablauf (Plan (b)): Gleichstand und Team ersetzen, eigene Halbfinal-Regel, Endstand, Absetzen.
 * Alle expectedFail; jeder Schritt prüft eine Soll-Wirkung, die der Besitzer baut.
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, findFinalByLabel, openTurniertagPath, SOLL_TIMEOUT_MS } from './shared';
import type { StepContext, TurniertagStep } from './types';

/** D8b: Team bei einer Absage ersetzen (Reiter Teams), Gleichstand-Entscheidung der Gruppe. */
async function teamErsetzen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/team-helpers');
  await expectPageAnchor(ownerPage.getByText('Team & Helfer', { exact: true }).first(), 'Admin-Kategorie Team & Helfer');
  await expectSollMarker(ownerPage, 'team-replace-button');
}

/** D9c: die eigene Halbfinal-Regel greift ohne manuelle Wahl: endet Halbfinale 1 unentschieden, entscheidet sofort das Strafstoßschießen. */
async function eigeneHalbfinalRegel(_ctx: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf1 = findFinalByLabel(finals, '1. Halbfinale');
  expect(hf1.phase, 'Halbfinale 1 trägt seine Phase aus dem Generator, nicht "final"').not.toBe('final');
  expect(hf1.phase).toBe('semifinal');
}

/** D10b: Endstand, Platzierungen und Torschützen sind auf Zuschauer-Seite und Monitor gleich (@ET-044, @ET-032). */
async function endstandAnzeige({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await expectSollMarker(anonPage, 'final-standings');
  await expect(anonPage.locator('[data-testid="scorers-list"]')).toBeVisible({ timeout: SOLL_TIMEOUT_MS });
}

/** D10c: ein abgesetztes Gruppenspiel wird wieder eingeplant (@FU-071, @FU-097). */
async function absetzenWiederEinplanen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  await expectSollMarker(ownerPage, 'match-skip-resume-button');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D8b', title: 'Team bei einer Absage ersetzen, Gleichstand in der Gruppe entscheiden', scenarios: ['@W5-010'], owner: 'GA4 / A-12c / B-02c', expectedFail: true, run: teamErsetzen },
  { id: 'D9c', title: 'Eigene Halbfinal-Regel greift ohne manuelle Wahl', scenarios: ['@SL-145'], befunde: ['C-FINALPHASE-AUS-ID'], owner: 'A-12a (Phase aus dem Generator), A-14b/c', expectedFail: true, run: eigeneHalbfinalRegel },
  { id: 'D10b', title: 'Endstand, Platzierungen und Torschützen auf Zuschauer-Seite und Monitor', scenarios: ['@ET-044', '@ET-032'], owner: 'A-19, A-20, B-23, B-29', expectedFail: true, run: endstandAnzeige },
  { id: 'D10c', title: 'Abgesetztes Gruppenspiel wieder einplanen', scenarios: ['@FU-071', '@FU-097'], befunde: ['C-T2UI-ABSETZEN-AUFGESCHOBEN'], owner: 'B-12', expectedFail: true, run: absetzenWiederEinplanen },
];

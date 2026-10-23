/**
 * D8b-D10c: Regeln im Turnierablauf (Plan (b)): Gleichstand und Team ersetzen, eigene Halbfinal-Regel, Endstand, Absetzen.
 * Die Reihenfolge steht im Spec (Fixrunde 1, A3): D8b/D9c nach D8, D10b nach dem Abschluss, D10c vor dem Gruppenabschluss.
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

/**
 * D9c: Halbfinale tragen in der Cloud die Phase Halbfinale (A-12a, C-FINALPHASE-AUS-ID behoben). Das ist die Grundlage der
 * eigenen Halbfinal-Regel (@W2A-007): Engine und Server wählen die Regel je Runde über `matches.phase`. Ob ein
 * unentschiedenes Halbfinale dann sofort ins Strafstoßschießen geht, prüft dieser Schritt nicht.
 */
async function eigeneHalbfinalRegel(_ctx: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const hf1 = findFinalByLabel(finals, '1. Halbfinale');
  expect(hf1.phase, 'Halbfinale 1 trägt seine Phase aus dem Generator, nicht "final"').not.toBe('final');
  expect(hf1.phase).toBe('semifinal');
}

/** D10b: Endstand, Platzierungen und Torschützen des abgeschlossenen Turniers stehen auf der Zuschauer-Seite (@ET-044, @ET-032). Läuft NACH dem Abschluss (D11). */
async function endstandAnzeige({ anonPage }: StepContext): Promise<void> {
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await expectSollMarker(anonPage, 'final-standings');
  await expect(anonPage.locator('[data-testid="scorers-list"]')).toBeVisible({ timeout: SOLL_TIMEOUT_MS });
}

/** D10c: ein abgesetztes Gruppenspiel wird wieder eingeplant (@FU-071, @FU-093). */
async function absetzenWiederEinplanen({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  await expectSollMarker(ownerPage, 'match-skip-resume-button');
}

/** Nach D8 im Halbfinal-Block. */
export const steps: readonly TurniertagStep[] = [
  { id: 'D8b', title: 'Team bei einer Absage ersetzen, Gleichstand in der Gruppe entscheiden', scenarios: ['@W5-010'], owner: 'GA4 / A-12c / B-02c', expectedFail: true, run: teamErsetzen },
  { id: 'D9c', title: 'Halbfinale tragen in der Cloud die Phase Halbfinale (Grundlage der eigenen Halbfinal-Regel)', scenarios: ['@W2A-007'], befunde: [], owner: 'A-12a (Phase aus dem Generator)', expectedFail: false, run: eigeneHalbfinalRegel },
];

/** Nach dem Abschluss (D11): der Endstand des abgeschlossenen Turniers. */
export const stepsEndstand: readonly TurniertagStep[] = [
  { id: 'D10b', title: 'Endstand, Platzierungen und Torschützen auf der Zuschauer-Seite', scenarios: ['@ET-044', '@ET-032'], owner: 'A-19, A-20, B-23, B-29', expectedFail: true, run: endstandAnzeige },
];

/** Vor dem Gruppenabschluss (Block D5-D7): ein abgesetztes Gruppenspiel wieder einplanen. */
export const stepsAbsetzen: readonly TurniertagStep[] = [
  { id: 'D10c', title: 'Abgesetztes Gruppenspiel wieder einplanen', scenarios: ['@FU-071', '@FU-093'], befunde: ['C-T2UI-ABSETZEN-AUFGESCHOBEN'], owner: 'B-12', expectedFail: true, run: absetzenWiederEinplanen },
];

/**
 * D11b-D18: Folgen des Abschlusses und Betrieb (Plan (b)). Alle expectedFail mit Besitzer.
 * Reihenfolge (Fixrunde 1, A3): D13b/D13c (Zeiten, Hallenton) gehören an den Turniertag VOR den Abschluss (Export `stepsNachZeitplan`,
 * im Spec vor D8); nach dem Abschluss ist das Turnier gesperrt.
 */
import { expect } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { expectPageAnchor, expectSollMarker, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
import type { StepContext, TurniertagStep } from './types';

/** D11b: nach dem Abschluss ist der Helfer-QR ungültig, das Dashboard zeigt "beendet" erst nach dem Abschluss (@HE-038, C-ZUSTAND-ABGELEITET). */
async function nachAbschluss({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  const status = (await getRows<{ status: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=status`, 'Turnierstatus'))[0]?.status;
  expect(status, 'Turnier ist abgeschlossen').toBe('completed');
  await expectSollMarker(ownerPage, 'helper-join-expired');
}

/** D13b: Zeiten ehrlich: bei Verzug steht die ursprüngliche Uhrzeit dabei (@ZP-004, @ZP-007). */
async function zeitenEhrlich({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  await expectSollMarker(ownerPage, 'match-original-time');
}

/** D13c: Hallenton an Abschnittsende und Spielende, Lautsprecher-Seite (@HT-001, @HT-004). */
async function hallenton({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'hall-speaker-start');
}

/** D17: Impressum und Datenschutz mit echtem Text, von der Zuschauer-Seite erreichbar, Fußzeile nicht verdeckt (@ZM-020, C-LEGAL). */
async function rechtstexte({ anonPage }: StepContext): Promise<void> {
  await anonPage.setViewportSize({ width: 390, height: 844 });
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await anonPage.getByRole('link', { name: /impressum/i }).first().click({ timeout: SOLL_TIMEOUT_MS });
  await expect(anonPage.locator('body'), 'echtes Impressum, kein Platzhalter').not.toHaveText(/platzhalter|TODO|Mustermann/i, { timeout: SOLL_TIMEOUT_MS });
  await expectSollMarker(anonPage, 'legal-text-complete');
}

/** D18: Lastmessung: ein Turniertag gegen den lokalen Stack, Verbrauch für beide Abrufwege (@FT-002, Paket 11b). */
async function lastmessung({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'load-test-report');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D11b', title: 'Nach dem Abschluss: Helfer-QR ungültig, Dashboard nicht vorzeitig beendet', scenarios: ['@HE-038'], befunde: ['C-ZUSTAND-ABGELEITET'], owner: 'A-21a, A-18, B-23', expectedFail: true, run: nachAbschluss },
];

/** Nach D13 (Zeitplan verschieben). */
export const stepsNachZeitplan: readonly TurniertagStep[] = [
  { id: 'D13b', title: 'Zeiten ehrlich: ursprüngliche Uhrzeit bei Verzug', scenarios: ['@ZP-004', '@ZP-007'], owner: 'B-26, B-27', expectedFail: true, run: zeitenEhrlich },
  { id: 'D13c', title: 'Hallenton an Abschnittsende und Spielende', scenarios: ['@HT-001', '@HT-004'], owner: 'B-46', expectedFail: true, run: hallenton },
];

/** Ende des Ablaufs (nach Sicherung und zweitem Turnier). D16 steht in der Vorbereitung (d00-vorbereitung.ts). */
export const stepsEnde: readonly TurniertagStep[] = [
  { id: 'D17', title: 'Impressum und Datenschutz mit echtem Text, Fußzeile erreichbar (Handy)', scenarios: ['@ZM-020'], befunde: ['C-LEGAL', 'C-FUSS-LINKS-UNTER-LEISTE'], owner: 'B-32 / Kleinfix', expectedFail: true, run: rechtstexte },
  { id: 'D18', title: 'Lastmessung: ein Turniertag gegen den lokalen Stack', scenarios: ['@FT-002'], owner: '11b (FT-Messlauf)', expectedFail: true, run: lastmessung },
];

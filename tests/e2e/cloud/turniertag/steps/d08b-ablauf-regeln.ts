/**
 * D8b-D10c: Regeln im Turnierablauf (Plan (b)): Gleichstand und Team ersetzen, eigene Halbfinal-Regel, Endstand, Absetzen.
 * Die Reihenfolge steht im Spec (Fixrunde 1, A3): D8b/D9c nach D8, D10b nach dem Abschluss, D10c vor dem Gruppenabschluss.
 * Alle expectedFail; jeder Schritt prüft eine Soll-Wirkung, die der Besitzer baut.
 */
import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, fetchTurniertagTeams, findFinalByLabel, getRows, openTurniertagPath, SOLL_TIMEOUT_MS, TURNIERTAG_ID } from './shared';
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

/** Torschützen-Schalter (`config.publicScorers`) am abgeschlossenen Turnier: nur als Datenbank-Eigentümer mit dem Server-Schalter (Zustandssperre, wie N7d). */
function setzeTorschuetzenSchalter(an: boolean): void {
  const sql = `BEGIN; SELECT set_config('app.lifecycle_write','on',true); UPDATE public.tournaments SET config = jsonb_set(coalesce(config,'{}'::jsonb), '{publicScorers}', '${an ? 'true' : 'false'}'::jsonb) WHERE id = '${TURNIERTAG_ID}'; COMMIT;`;
  execFileSync('docker', ['exec', '-i', 'supabase_db_hallenfussball-pwa', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

/** Das Turnier ist abgeschlossen (D11). Mit Finalrunde ist der Endstand bis Teil F vorläufig, D11 schließt dann nicht ab: hier scheitert der Schritt heute. */
async function turnierAbgeschlossen(): Promise<void> {
  const zeilen = await getRows<{ lifecycle_status: string }>(`tournaments?id=eq.${TURNIERTAG_ID}&select=lifecycle_status`, 'Zustand des Turniers');
  expect(zeilen[0]?.lifecycle_status, 'das Turnier ist abgeschlossen (D11; mit Finalrunde erst ab Teil F)').toBe('finished');
}

/** Torschützen mit Rückennummer aus den Spiel-Einträgen (Tore der Gruppenspiele, D8): „#<Nr> <Team>“ → Anzahl Tore. */
async function torschuetzenAusEintraegen(): Promise<Map<string, number>> {
  const { groupMatches, finals } = await fetchTurniertagBracket();
  const ids = [...groupMatches, ...finals].map((m) => m.id).join(',');
  const tore = await getRows<{ team_id: string | null; payload: { playerNumber?: number } | null; review_state: string | null }>(
    `match_events?match_id=in.(${ids})&type=eq.GOAL&event_format=not.is.null&select=team_id,payload,review_state`, 'Tore mit Rückennummer');
  const namen = new Map((await fetchTurniertagTeams()).map((t) => [t.id, t.name]));
  const anzahl = new Map<string, number>();
  for (const tor of tore.filter((t) => t.review_state === null && typeof t.payload?.playerNumber === 'number')) {
    const schluessel = `#${String(tor.payload?.playerNumber)} ${namen.get(tor.team_id ?? '') ?? '?'}`;
    anzahl.set(schluessel, (anzahl.get(schluessel) ?? 0) + 1);
  }
  return anzahl;
}

/** @ET-032: die Liste enthält je Rückennummer und Team einen Eintrag „#<Nr> <Team> – <n> Tore“ (gleiche Nummer, anderes Team = eigener Eintrag). */
async function pruefeTorschuetzen(seite: Page, erwartet: ReadonlyMap<string, number>, wo: string): Promise<void> {
  const liste = seite.getByTestId('final-scorers');
  await expect(liste, `${wo}: Torschützenliste`).toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  const siebener = [...erwartet.keys()].filter((k) => k.startsWith('#7 '));
  expect(siebener.length, 'Testdaten: die Nummer 7 trifft in zwei Teams (D8)').toBeGreaterThanOrEqual(2);
  for (const [eintrag, tore] of erwartet) {
    const zeile = liste.getByTestId('final-scorer-row').filter({ hasText: eintrag });
    await expect(zeile, `${wo}: genau ein Eintrag „${eintrag}“`).toHaveCount(1);
    await expect(zeile, `${wo}: „${eintrag} – ${tore} Tore“`).toContainText(`${tore} Tore`);
  }
}

/** Plätze des Endstands als „<Platz> <Team>“, in Anzeigereihenfolge. */
async function plaetze(seite: Page): Promise<string[]> {
  const zeilen = seite.getByTestId('final-standing-row');
  await expect(zeilen.first(), 'Endstand mit Plätzen').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  return zeilen.evaluateAll((els) => els.map((el) => `${el.getAttribute('data-place') ?? ''} ${el.querySelector<HTMLElement>('span:nth-child(2) span')?.innerText.trim() ?? ''}`));
}

/** Endstand in Ollis App: Reiter Tabellen → „Endstand“. */
async function endstandInDerApp(seite: Page): Promise<void> {
  await openTurniertagPath(seite, '/standings');
  await seite.getByTestId('tabellen-view-final').click({ timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('final-standings'), 'Endstand in der App').toHaveAttribute('data-state', 'stored', { timeout: SOLL_TIMEOUT_MS });
}

/**
 * D10b (Schalter an): Endstand und Torschützen des abgeschlossenen Turniers. @ET-032: in Ollis App stehen die Torschützen mit Rückennummer und
 * Team (#7 und #7 zweier Teams getrennt). @ET-044: die Zuschauer-Seite zeigt dieselben Teams auf denselben Plätzen wie Ollis App. Mit dem
 * Torschützen-Schalter an steht die Liste auch auf der Zuschauer-Seite. Läuft NACH dem Abschluss (D11).
 */
async function endstandMitTorschuetzen({ asRole, anonPage }: StepContext): Promise<void> {
  await turnierAbgeschlossen();
  const erwartet = await torschuetzenAusEintraegen();
  const olli = await asRole('owner');
  await endstandInDerApp(olli);
  const app = await plaetze(olli);
  await pruefeTorschuetzen(olli, erwartet, 'Ollis App');
  setzeTorschuetzenSchalter(true);
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await expect(anonPage.getByTestId('final-standings'), 'Endstand auf der Zuschauer-Seite').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  expect(await plaetze(anonPage), 'dieselben Teams auf denselben Plätzen wie in Ollis App').toEqual(app);
  await pruefeTorschuetzen(anonPage, erwartet, 'Zuschauer-Seite (Schalter an)');
}

/**
 * D10b2 (Schalter aus; Soll aus @ZM-012, Kennung erst mit Teil F am Schritt – @ZM-012 ist für Jeder gegen jeden anderswo grün und soll durch
 * den heute blockierten Abschluss mit Finalrunde nicht als rot zählen): nach dem Abschluss stehen auf der Zuschauer-Seite die Plätze des Endstands, aber keine Torschützenliste. */
async function endstandOhneTorschuetzen({ asRole, anonPage }: StepContext): Promise<void> {
  await turnierAbgeschlossen();
  setzeTorschuetzenSchalter(false);
  const olli = await asRole('owner');
  await endstandInDerApp(olli);
  const app = await plaetze(olli);
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  expect(await plaetze(anonPage), 'die Plätze des Endstands').toEqual(app);
  await expect(anonPage.getByTestId('final-scorers'), 'keine Torschützenliste').toHaveCount(0);
}

/** D10c: ein abgesetztes Gruppenspiel wird wieder eingeplant (@FU-093). Die Regel „nur erlaubte Schritte“ (@FU-071) prüft dieser Schritt nicht. */
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
  { id: 'D10b', title: 'Endstand: Torschützen mit Rückennummer in der App, Zuschauer-Seite gleich (Torschützen-Schalter an)', scenarios: ['@ET-044', '@ET-032'], befunde: ['C-FINALRUNDE-NICHT-ABSCHLIESSBAR'], owner: 'Teil F (Endstand mit Finalrunde: Abschluss D11); Anzeige gebaut (R3-5/R3-6)', expectedFail: true, run: endstandMitTorschuetzen },
  { id: 'D10b2', title: 'Endstand ohne Torschützen auf der Zuschauer-Seite (Torschützen-Schalter aus)', scenarios: [], befunde: ['C-FINALRUNDE-NICHT-ABSCHLIESSBAR'], owner: 'Teil F (Endstand mit Finalrunde: Abschluss D11); Anzeige gebaut (R3-6)', expectedFail: true, run: endstandOhneTorschuetzen },
];

/** Vor dem Gruppenabschluss (Block D5-D7): ein abgesetztes Gruppenspiel wieder einplanen. */
export const stepsAbsetzen: readonly TurniertagStep[] = [
  { id: 'D10c', title: 'Abgesetztes Gruppenspiel wieder einplanen', scenarios: ['@FU-093'], befunde: ['C-T2UI-ABSETZEN-AUFGESCHOBEN'], owner: 'B-12', expectedFail: true, run: absetzenWiederEinplanen },
];

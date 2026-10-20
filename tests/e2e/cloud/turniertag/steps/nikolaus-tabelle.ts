/**
 * N6 und N7: Tabelle nach BFV privat und Abschluss des Nikolaus-Turniers (Meilenstein M-T, Prüfschritte 2 bis 5). Alle 15 Spiele sind per
 * Turnierleitungs-RPC beendet (Vorbedingung; Ergebnisse in `NIKOLAUS_ERGEBNISSE`, auf die Szenarien zugeschnitten). Reihenfolge der Tabelle:
 * Kammer vor Waging rot (direktes Spiel zuerst, @ET-056), Petting und Otting gleichauf (@ET-055, @ET-025), Fridolfing, Waging blau.
 * Szenarien mit anderen Mannschaftsnamen (@W2A-041 bis @W2A-045) prüfen dieselben Regeln; diese Fälle liegen als Vitest-Tests in Paket TB.
 */
import { expect, type Page } from '@playwright/test';
import { vorbedingung, getRows, SOLL_TIMEOUT_MS } from './shared';
import { beendeAlleSpiele, NIKOLAUS, openNikolausPath } from './nikolaus-shared';
import { expectPageAnchor, expectSollMarker } from './shared';
import type { StepContext, TurniertagStep } from './types';

const KAMMER = 'DJK Kammer';
const ROT = 'TSV Waging rot';

/** Teamnamen der Gesamtplatzierung der Turnierleitung in Tabellenreihenfolge. */
async function tabelleTurnierleitung(seite: Page): Promise<string[]> {
  await openNikolausPath(seite, '/standings');
  await expectPageAnchor(seite.getByText('Gesamtplatzierung', { exact: true }).first(), 'Reiter Tabellen');
  await seite.getByText('Gesamtplatzierung', { exact: true }).first().click();
  const zeilen = seite.locator('tbody tr');
  await expect(zeilen).toHaveCount(6, { timeout: 10000 });
  return zeilen.evaluateAll((els) => els.map((tr) => (tr.querySelectorAll('td')[1] as HTMLElement).innerText.trim()));
}

/** N6a: bei Punktgleichheit entscheidet zuerst das direkte Spiel: Kammer (gewann 2:1) steht vor Waging rot (bessere Tordifferenz), ohne Strafstoßschießen (@ET-056). */
async function direktesSpielZuerst({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  const reihenfolge = await tabelleTurnierleitung(seite);
  expect(reihenfolge.indexOf(KAMMER), `Reihenfolge: ${reihenfolge.join(', ')}`).toBeLessThan(reihenfolge.indexOf(ROT));
  expect(reihenfolge.slice(0, 2), 'Kammer und Waging rot führen').toEqual([KAMMER, ROT]);
  // zweite Dann-Zeile: ein Strafstoßschießen ist zwischen Kammer und Waging rot nicht nötig (nur Petting und Otting sind markiert, N6c)
  const zeile = (name: string) => seite.locator('tbody tr', { hasText: name });
  await expect(zeile(KAMMER), 'Kammer: keine Markierung „Entscheidung nötig“').not.toContainText(/Entscheidung nötig|Strafstoß/);
  await expect(zeile(ROT), 'Waging rot: keine Markierung „Entscheidung nötig“').not.toContainText(/Entscheidung nötig|Strafstoß/);
}

/** N6b: alle Ansichten zeigen dieselbe Reihenfolge: auch die Zuschauer-Seite hat Kammer vor Waging rot (@W2A-049). */
async function zuschauerReihenfolge({ anonPage }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  await anonPage.goto(`/#/live/${NIKOLAUS.shareCode}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await anonPage.getByText('Tabellen', { exact: true }).first().click();
  await expect(anonPage.locator('body')).toContainText(KAMMER, { timeout: 10000 });
  const text = await anonPage.locator('body').innerText();
  expect(text.indexOf(KAMMER), 'Zuschauer-Seite: Kammer steht vor Waging rot').toBeLessThan(text.indexOf(ROT));
}

/** N6c: Petting und Otting sind nach allen Kriterien gleich: die Tabelle markiert beide als „gleichauf – Entscheidung nötig“ und nennt das Strafstoßschießen (@ET-025, @ET-055, @W2A-047). */
async function gleichstandMarkiert({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  expect(await tabelleTurnierleitung(seite)).toHaveLength(6);
  await expect(seite.getByText('gleichauf – Entscheidung nötig'), 'beide Teams sind markiert').toHaveCount(2, { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByText(/Strafstoßschießen/).first(), 'Hinweis auf das Strafstoßschießen').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
}

/** N6d: die Turnierleitung trägt das Strafstoßschießen zwischen Otting und Petting ein: der Sieger steht vor dem anderen, die Spielergebnisse bleiben (@ET-055). */
async function strafstossEintragen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  await tabelleTurnierleitung(seite);
  await expectSollMarker(seite, 'tie-shootout-entry');
  await seite.getByTestId('tie-shootout-entry').click();
  await seite.getByRole('button', { name: /DJK Otting/ }).click();
  await seite.getByRole('button', { name: /Speichern|Übernehmen/ }).click();
  await expect.poll(async () => (await tabelleTurnierleitung(seite)).slice(2, 4), { timeout: SOLL_TIMEOUT_MS }).toEqual(['DJK Otting', 'TSV Petting']);
}

/** N6e: ein neues Turnier ist für private Hallenturniere vorbelegt: „Punkte, direkter Vergleich, Tordifferenz, erzielte Tore“, alle aktiv (@W2A-046). */
async function vorbelegungPrivat({ asRole }: StepContext): Promise<void> {
  const seite = await asRole('owner');
  await seite.goto('/#/tournament/new?step=3');
  await seite.waitForLoadState('networkidle');
  await expectPageAnchor(seite.getByRole('button', { name: /Tabellenregeln/ }), 'Assistent, Abschnitt Tabellenregeln');
  await seite.getByRole('button', { name: /Tabellenregeln/ }).click();
  const kriterien = seite.getByRole('list', { name: 'Platzierungskriterien, sortierbar' }).getByRole('listitem');
  await expect(kriterien, 'vier Kriterien').toHaveCount(4, { timeout: SOLL_TIMEOUT_MS });
  const namen = await kriterien.evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') ?? '').replace(/, Position.*$/, '')));
  expect(namen, 'Reihenfolge bei Punktgleichheit').toEqual(['Punkte', 'Direkter Vergleich', 'Tordifferenz', 'Erzielte Tore']);
  await expect(seite.getByRole('button', { name: 'Kriterium deaktivieren' }), 'alle vier sind aktiv').toHaveCount(4);
}

/** N7a: der Abschluss der Gruppe: die App schlägt ihn vor, die Turnierleitung wählt „Gruppe abschließen“, der Gleichstand von Petting und Otting verlangt vorher eine Entscheidung (@TM-044, @TM-046, @TM-048). */
async function gruppeAbschliessen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  await openNikolausPath(seite, '/schedule');
  await expectPageAnchor(seite.getByRole('button', { name: 'Spielplan bearbeiten' }), 'Spielplan der Turnierleitung');
  await expectSollMarker(seite, 'group-close-suggestion');
  await seite.getByTestId('group-close-button-all').click({ timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('tie-decision-dialog'), 'der Gleichstand wird vor dem Abschluss entschieden').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
}

/** N7b: Turnier abschließen: danach ist es abgeschlossen und gesperrt (@LZ-030). */
async function turnierAbschliessen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  await openNikolausPath(seite, '/admin/dashboard');
  await expectPageAnchor(seite.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(seite, 'tournament-finish-button');
  await seite.getByTestId('tournament-finish-button').click();
  await expect.poll(async () => (await getRows<{ status: string }>(`tournaments?id=eq.${NIKOLAUS.tournamentId}&select=status`, 'Turnierstatus'))[0]?.status, { timeout: SOLL_TIMEOUT_MS }).toBe('completed');
}

/** N7c: Jeder gegen jeden: der Endstand ist die abgeschlossene Tabelle, Plätze 1 bis 6, kein Platz geteilt (@ET-022). */
async function endstand({ anonPage }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  await anonPage.goto(`/#/live/${NIKOLAUS.shareCode}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await expectSollMarker(anonPage, 'final-standings');
  const zeilen = anonPage.locator('[data-testid="final-standings"] tr, [data-testid="final-standings"] [role="row"]');
  const namen = await zeilen.evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
  expect(namen.slice(0, 2).join('|'), 'Platz 1 und 2').toMatch(/1.*Kammer.*\|2.*Waging rot/);
  expect(namen.slice(-2).join('|'), 'Platz 5 und 6').toMatch(/5.*Fridolfing.*\|6.*Waging blau/);
}

export const steps: readonly TurniertagStep[] = [
  { id: 'N6a', title: 'Tabelle: bei Punktgleichheit zuerst das direkte Spiel (Kammer vor Waging rot), kein Strafstoßschießen nötig – unter der BFV-privat-Reihenfolge (per Seed); Voreinstellung = N6e', scenarios: ['@ET-056'], owner: 'Reihenfolge der Kriterien aus dem Turnier (Seed: Punkte, direkter Vergleich, Tordifferenz, Tore)', expectedFail: false, run: direktesSpielZuerst },
  { id: 'N6b', title: 'Tabelle: Zuschauer-Seite zeigt die Tabelle von Jeder gegen jeden in derselben Reihenfolge', scenarios: ['@W2A-049'], owner: 'Zuschauer-Tabelle ohne Gruppen (gebaut, #295)', expectedFail: false, run: zuschauerReihenfolge },
  { id: 'N6c', title: 'Tabelle: völliger Gleichstand (Petting/Otting) als „Entscheidung nötig“ markiert, Strafstoßschießen genannt', scenarios: ['@ET-025', '@ET-055', '@W2A-047'], befunde: ['C-TABELLE-NICHT-BFV-PRIVAT'], owner: 'Paket TB', expectedFail: true, run: gleichstandMarkiert },
  { id: 'N6d', title: 'Tabelle: Strafstoßschießen eintragen, Sieger steht vorn', scenarios: ['@ET-055'], befunde: ['C-TABELLE-NICHT-BFV-PRIVAT'], owner: 'Paket TB', expectedFail: true, run: strafstossEintragen },
  { id: 'N6e', title: 'Assistent: Reihenfolge bei Punktgleichheit für private Hallenturniere vorbelegt', scenarios: ['@W2A-046'], owner: 'Paket TB (TB-2)', expectedFail: false, run: vorbelegungPrivat },
  { id: 'N7a', title: 'Gruppe abschließen: Vorschlag, Entscheidung des Gleichstands, abgeschlossen', scenarios: ['@TM-044', '@TM-046', '@TM-048'], owner: 'A-13 / Paket TB', expectedFail: true, run: gruppeAbschliessen },
  { id: 'N7b', title: 'Turnier abschließen: abgeschlossen und gesperrt', scenarios: ['@LZ-030'], befunde: ['C-ZUSTAND-ABGELEITET'], owner: 'A-21a / B-33', expectedFail: true, run: turnierAbschliessen },
  { id: 'N7c', title: 'Endstand = abgeschlossene Tabelle, Plätze 1 bis 6', scenarios: ['@ET-022'], owner: 'A-19 / A-20 / B-23', expectedFail: true, run: endstand },
];

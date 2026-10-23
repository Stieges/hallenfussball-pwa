/**
 * N6 und N7: Tabelle nach BFV privat und Abschluss des Nikolaus-Turniers (Meilenstein M-T, Prüfschritte 2 bis 5). Alle 15 Spiele sind per
 * Turnierleitungs-RPC beendet (Vorbedingung; Ergebnisse in `NIKOLAUS_ERGEBNISSE`, auf die Szenarien zugeschnitten). Reihenfolge der Tabelle:
 * Kammer vor Waging rot (direktes Spiel zuerst, @ET-056), Petting und Otting gleichauf (@ET-055, @ET-025), Fridolfing, Waging blau.
 * Szenarien mit anderen Mannschaftsnamen (@W2A-041 bis @W2A-045) prüfen dieselben Regeln; diese Fälle liegen als Vitest-Tests in Paket TB.
 */
import { expect, type Page } from '@playwright/test';
import { vorbedingung, getRows, SOLL_TIMEOUT_MS } from './shared';
import { getLocalServiceRoleClient } from '../../helpers';
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

/**
 * N6c: Petting und Otting sind nach allen Kriterien gleich; mit der Voreinstellung (nur Platz 1 muss ausgespielt werden) ist das eine Wahl:
 * beide Teams tragen „Gleichstand – Entscheidung nötig“, der Hinweis nennt beide Wege, die Haupttaste heißt „Gleichstand entscheiden“
 * (@ET-025, @ET-055, @W2A-047, @W2A-063, @W2A-067).
 */
async function gleichstandMarkiert({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  expect(await tabelleTurnierleitung(seite)).toHaveLength(6);
  await expect(seite.getByTestId('tie-marker').filter({ hasText: 'Gleichstand – Entscheidung nötig' }), 'beide Teams sind markiert').toHaveCount(2, { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('tie-hint-choice'), 'Hinweis nennt das Strafstoßschießen').toContainText(/Strafstoßschießen eintragen oder Ergebnis so akzeptieren/, { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('tie-decide-entry'), 'Haupttaste „Gleichstand entscheiden“').toHaveText('Gleichstand entscheiden', { timeout: SOLL_TIMEOUT_MS });
}

/**
 * N6d: die Turnierleitung trägt über „Gleichstand entscheiden“ → „Strafstoßschießen eintragen“ das Ergebnis 4:3 für DJK Otting ein: der Sieger steht vor dem
 * anderen, die Spielergebnisse bleiben (@ET-055). Die Zahlenfelder (`tie-shootout-score-*`) stehen in Tabellenreihenfolge, deshalb wird das Feld über die Beschriftung
 * des Teams gewählt.
 */
async function strafstossEintragen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  await tabelleTurnierleitung(seite);
  await expectSollMarker(seite, 'tie-decide-entry');
  await seite.getByTestId('tie-decide-entry').click();
  const dialog = seite.getByTestId('tie-decision-dialog');
  await dialog.getByTestId('tie-pick-shootout').click();
  await expect(dialog.locator('[data-testid^="tie-shootout-score-"]')).toHaveCount(2);
  await dialog.getByLabel(/DJK Otting/).fill('4');
  await dialog.getByLabel(/TSV Petting/).fill('3');
  await dialog.getByTestId('tie-decision-save').click();
  // Kein stiller Fehler: erst muss das Speichern sichtbar fertig sein (Dialog zu) – eine Ablehnung steht mit ihrem Text im Fehlschlag.
  const fehler = seite.getByTestId('tie-error');
  await expect.poll(async () => ((await fehler.count()) > 0 ? `Ablehnung: ${await fehler.innerText()}` : (await dialog.count()) === 0 ? 'gespeichert' : 'speichert'),
    { message: 'Strafstoßschießen 4:3 gespeichert, Dialog geschlossen', timeout: SOLL_TIMEOUT_MS }).toBe('gespeichert');
  await expect.poll(async () => (await tabelleTurnierleitung(seite)).slice(2, 4).map((n) => n.replace(/\s*Strafstoßschießen.*$/s, '').trim()), { timeout: SOLL_TIMEOUT_MS }).toEqual(['DJK Otting', 'TSV Petting']);
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
  // F8 (@W2A-056): die feste letzte Stufe steht außerhalb der Liste; @W2A-066: nur Platz 1 muss ausgespielt werden
  await expect(seite.getByTestId('placement-after-row')).toContainText('danach: Strafstoßschießen (Entscheidung der Turnierleitung)');
  await expect(seite.getByTestId('playout-place-1'), 'Platz 1 ist vorbelegt').toBeChecked();
  await expect(seite.getByTestId('playout-place-2'), 'Platz 2 nicht').not.toBeChecked();
}

/**
 * N6f: der öffentlich lesbare Datensatz nennt keine Person, keine Zeit und keinen Grund der Entscheidung (@W2A-072; Nachtrag 4): anonymer Abruf
 * ohne die App. Seit B-14 (`20261117_104`) liest anon die Tabelle `tournaments` nicht mehr; öffentlich ist nur die Antwort der
 * Server-Funktion `public_tournament` (Positivliste, @ZM-068). Ein Entscheidungsverlauf (`bracket_log`) ist für `anon` nicht lesbar.
 * Läuft nach N6d (dort entsteht die Entscheidung).
 */
async function entscheidungNichtOeffentlich(): Promise<void> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const anon = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
  const tabelle = await fetch(`${url}/rest/v1/tournaments?id=eq.${NIKOLAUS.tournamentId}&select=id,config`, { headers: anon });
  if (tabelle.ok) {
    expect(await tabelle.json(), 'anon liest die Tabelle tournaments nicht direkt (B-14)').toEqual([]);
  }
  const antwort = await fetch(`${url}/rest/v1/rpc/public_tournament`, {
    method: 'POST',
    headers: { ...anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_code: NIKOLAUS.shareCode, since_version: null }),
  });
  expect(antwort.ok, `anonymer Abruf: ${String(antwort.status)}`).toBe(true);
  const reply = (await antwort.json()) as { state: string; tournament?: { config?: { standingDecisions?: Array<Record<string, unknown>> } } };
  expect(reply.state, 'das Nikolaus-Turnier ist öffentlich lesbar (sonst beweist der Abruf nichts)').toBe('full');
  const zeilen = [{ config: reply.tournament?.config ?? {} }];
  const entscheidungen = zeilen[0].config.standingDecisions ?? [];
  expect(entscheidungen.length, 'N6d hat eine Entscheidung eingetragen').toBeGreaterThan(0);
  const erlaubt = new Set(['id', 'groupId', 'teamIds', 'order', 'kind', 'shootout', 'basis']);
  for (const entscheidung of entscheidungen) {
    expect(Object.keys(entscheidung).filter((k) => !erlaubt.has(k)), 'nur Reihenfolge und Ergebnis, nichts über Person, Zeit, Grund').toEqual([]);
  }
  const text = JSON.stringify(zeilen[0].config);
  expect(text, 'kein Hinweis auf Person oder Zeit').not.toMatch(/decidedBy|decidedAt|reason|userId|owner@|co-admin/i);
  // Ein Entscheidungsverlauf ist nicht anonym lesbar: Tabelle fehlt (404) oder verweigert (401/403) oder liefert nichts.
  const verlauf = await fetch(`${url}/rest/v1/bracket_log?select=*&limit=5`, { headers: anon });
  if (verlauf.ok) {
    expect(await verlauf.json(), 'anon liest keine Zeile des Entscheidungsverlaufs').toEqual([]);
  } else {
    expect([401, 403, 404]).toContain(verlauf.status);
  }
}

/**
 * N7a: der Abschluss der Gruppe (GA4 A-13c, Mockup A-13c): die App schlägt ihn im Spielplan vor (@TM-044), die Turnierleitung wählt „Gruppe abschließen“.
 * Der Gleichstand von Petting und Otting ist seit N6d entschieden (Strafstoßschießen 4:3): der Dialog fragt nicht erneut (@W2A-058), zeigt Tabelle und
 * Übergabe an den Endstand und schließt mit einer Taste ab (@TM-046, @TM-057). Danach zeigt die Tabelle „abgeschlossen“ und „Gruppe wieder öffnen“ (Test-ID
 * über `groupTestId`: `''` → `all`). Läuft erst nach dem Fenster am 10.11. (`complete_group` am Server) grün.
 */
async function gruppeAbschliessen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  await openNikolausPath(seite, '/schedule');
  await expectPageAnchor(seite.getByRole('button', { name: 'Spielplan bearbeiten' }), 'Spielplan der Turnierleitung');
  await expectSollMarker(seite, 'group-close-suggestion');
  await seite.getByTestId('group-close-button-all').click({ timeout: SOLL_TIMEOUT_MS });
  const dialog = seite.getByTestId('group-close-dialog');
  await expect(dialog, 'die Entscheidung aus N6d gilt: der Dialog fragt nicht erneut').toBeVisible({ timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('tie-decision-dialog')).toHaveCount(0);
  await expect(dialog.getByTestId('group-close-ranking').locator('li')).toHaveCount(6);
  await dialog.getByTestId('group-close-confirm').click();
  await openNikolausPath(seite, '/standings');
  await seite.getByText('Gesamtplatzierung', { exact: true }).first().click();
  await expect(seite.getByTestId('group-state-all'), 'Zustand „abgeschlossen“').toHaveText('abgeschlossen', { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('group-reopen-all')).toBeVisible();
  await expect(seite.getByTestId('tie-accept-withdraw'), 'nach dem Abschluss kein Zurücknehmen mehr (@W2A-070)').toHaveCount(0);
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
  { id: 'N6a', title: 'Tabelle: bei Punktgleichheit zuerst das direkte Spiel (Kammer vor Waging rot), kein Strafstoßschießen nötig – unter der BFV-privat-Reihenfolge; Voreinstellung = N6e', scenarios: ['@ET-056'], owner: 'Reihenfolge der Kriterien aus dem Turnier (Punkte, direkter Vergleich, Tordifferenz, Tore)', expectedFail: false, run: direktesSpielZuerst },
  { id: 'N6b', title: 'Tabelle: Zuschauer-Seite zeigt die Tabelle von Jeder gegen jeden in derselben Reihenfolge', scenarios: ['@W2A-049'], owner: 'Zuschauer-Tabelle ohne Gruppen (gebaut, #295)', expectedFail: false, run: zuschauerReihenfolge },
  { id: 'N6c', title: 'Tabelle: völliger Gleichstand (Petting/Otting) als „Gleichstand – Entscheidung nötig“ markiert, Taste „Gleichstand entscheiden“', scenarios: ['@ET-025', '@ET-055', '@W2A-047', '@W2A-067'], owner: 'Paket TB', expectedFail: false, run: gleichstandMarkiert },
  { id: 'N6d', title: 'Tabelle: Strafstoßschießen 4:3 für Otting über „Gleichstand entscheiden“ eintragen, Sieger steht vorn', scenarios: ['@ET-055', '@W2A-067'], owner: 'Paket TB', expectedFail: false, run: strafstossEintragen },
  { id: 'N6e', title: 'Assistent: Reihenfolge bei Punktgleichheit für private Hallenturniere vorbelegt', scenarios: ['@W2A-046'], owner: 'Paket TB (TB-2)', expectedFail: false, run: vorbelegungPrivat },
  { id: 'N6f', title: 'Entscheidung öffentlich ohne Person, Zeit und Grund; Entscheidungsverlauf nicht anonym lesbar', scenarios: ['@W2A-072'], owner: 'Paket TB (TB-3\')', expectedFail: false, run: entscheidungNichtOeffentlich },
  { id: 'N7a', title: 'Gruppe abschließen: Vorschlag, Dialog ohne erneute Frage nach der Entscheidung, abgeschlossen', scenarios: ['@TM-044', '@TM-046', '@TM-057', '@W2A-058'], owner: 'A-13c', expectedFail: true, run: gruppeAbschliessen },
  { id: 'N7b', title: 'Turnier abschließen: abgeschlossen und gesperrt', scenarios: ['@LZ-030'], befunde: ['C-ZUSTAND-ABGELEITET'], owner: 'A-21a / B-33', expectedFail: true, run: turnierAbschliessen },
  { id: 'N7c', title: 'Endstand = abgeschlossene Tabelle, Plätze 1 bis 6', scenarios: ['@ET-022'], owner: 'A-19 / A-20 / B-23', expectedFail: true, run: endstand },
];

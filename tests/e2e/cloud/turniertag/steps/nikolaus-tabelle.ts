/**
 * N6 und N7: Tabelle nach BFV privat und Abschluss des Nikolaus-Turniers (Meilenstein M-T, Prüfschritte 2 bis 5). Alle 15 Spiele sind per
 * Turnierleitungs-RPC beendet (Vorbedingung; Ergebnisse in `NIKOLAUS_ERGEBNISSE`, auf die Szenarien zugeschnitten). Reihenfolge der Tabelle:
 * Kammer vor Waging rot (direktes Spiel zuerst, @ET-056), Petting und Otting gleichauf (@ET-055, @ET-025), Fridolfing, Waging blau.
 * Szenarien mit anderen Mannschaftsnamen (@W2A-041 bis @W2A-045) prüfen dieselben Regeln; diese Fälle liegen als Vitest-Tests in Paket TB.
 */
import { expect, test, type Page } from '@playwright/test';
import { vorbedingung, getRows, SOLL_TIMEOUT_MS } from './shared';
import { getLocalServiceRoleClient } from '../../helpers';
import { beendeAlleSpiele, fetchNikolausSpiele, NIKOLAUS, openNikolausPath } from './nikolaus-shared';
import { appendAsRole, fetchEngineRows } from '../../engineHelpers';
import { eventOf } from './playViaRpc';
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
 * beide Teams tragen „Gleichstand – Entscheidung nötig“. Ansicht nach Daniel 23.10.: EIN Kasten oben mit EINER Haupttaste „Gleichstand
 * entscheiden“ und „Danach ist die Gruppe abgeschlossen.“, kein zweiter Hinweis-Kasten (@ET-025, @ET-055, @W2A-047, @W2A-063, @W2A-067).
 */
async function gleichstandMarkiert({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  expect(await tabelleTurnierleitung(seite)).toHaveLength(6);
  await expect(seite.getByTestId('tie-marker').filter({ hasText: 'Gleichstand – Entscheidung nötig' }), 'beide Teams sind markiert').toHaveCount(2, { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('group-close-button-all'), 'Haupttaste „Gleichstand entscheiden“').toHaveText('Gleichstand entscheiden', { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('group-close-then-all')).toHaveText('Danach ist die Gruppe abgeschlossen.');
  await expect(seite.getByTestId('tie-hint-choice'), 'kein zweiter Kasten').toHaveCount(0);
}

/**
 * N6d: die Turnierleitung trägt über „Gleichstand entscheiden“ → „Strafstoßschießen eintragen“ das Ergebnis 4:3 für DJK Otting ein: der Sieger steht vor dem
 * anderen, die Spielergebnisse bleiben (@ET-055), und die Gruppe ist danach abgeschlossen (Daniel 23.10.: die Entscheidung schließt in einem Zug ab). Die
 * Zahlenfelder (`tie-shootout-score-*`) stehen in Tabellenreihenfolge, deshalb wird das Feld über die Beschriftung des Teams gewählt.
 *
 * Zwei Geräte (R2 PR 2, Review #382 N1, @W2A-060 „die erste gilt“): Maria (Co-Admin, Konto `coadmin`) hat den Dialog schon offen und 5:4 für TSV Petting
 * eingetippt, als Olli 4:3 für Otting speichert. Danach speichert Maria: ihr Eintrag gilt nicht, und sie sieht, dass und von wem schon entschieden wurde
 * („Olli Owner hat schon …“). Ollis 4:3 bleibt.
 */
async function strafstossFuellen(seite: Page, otting: string, petting: string): Promise<ReturnType<Page['getByTestId']>> {
  await tabelleTurnierleitung(seite);
  await expectSollMarker(seite, 'group-close-button-all');
  await seite.getByTestId('group-close-button-all').click();
  const dialog = seite.getByTestId('tie-decision-dialog');
  await dialog.getByTestId('tie-pick-shootout').click();
  await expect(dialog.locator('[data-testid^="tie-shootout-score-"]')).toHaveCount(2);
  await dialog.getByLabel(/DJK Otting/).fill(otting);
  await dialog.getByLabel(/TSV Petting/).fill(petting);
  return dialog;
}

async function strafstossEintragen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const maria = await asRole('coadmin');
  const mariasDialog = await strafstossFuellen(maria, '4', '5'); // Maria tippt 5:4 für Petting, speichert noch nicht
  const seite = await asRole('owner');
  const dialog = await strafstossFuellen(seite, '4', '3');
  await dialog.getByTestId('group-close-confirm').click();
  // Kein stiller Fehler: erst muss das Speichern sichtbar fertig sein (Dialog zu) – eine Ablehnung steht mit ihrem Text im Fehlschlag.
  const fehler = seite.locator('[data-testid="tie-error"], [data-testid="group-close-error"]');
  await expect.poll(async () => ((await fehler.count()) > 0 ? `Ablehnung: ${await fehler.innerText()}` : (await dialog.count()) === 0 ? 'gespeichert' : 'speichert'),
    { message: 'Strafstoßschießen 4:3 gespeichert, Dialog geschlossen', timeout: SOLL_TIMEOUT_MS }).toBe('gespeichert');
  await expect(seite.getByTestId('group-close-dialog'), 'kein zweiter Abschluss-Dialog').toHaveCount(0);
  await expect.poll(async () => (await tabelleTurnierleitung(seite)).slice(2, 4).map((n) => n.replace(/\s*Strafstoßschießen.*$/s, '').trim()), { timeout: SOLL_TIMEOUT_MS }).toEqual(['DJK Otting', 'TSV Petting']);

  // @W2A-060: Maria speichert danach – nicht angenommen, der Hinweis nennt Olli; Ollis Eintrag gilt weiter
  await mariasDialog.getByTestId('group-close-confirm').click();
  // Je nachdem, ob Marias Gerät Ollis Entscheidung schon per Realtime kennt: der Dialog zeigt „Schon entschieden von …“ (`tie-seen`), sonst lehnt
  // der Server ab und der Hinweis nennt „… hat schon …“ – beides nennt Olli
  const hinweis = maria.locator('[data-testid="tie-seen"], [data-testid="group-conflict"], [data-testid="group-decided-elsewhere"], [data-testid="group-already"]');
  await expect(hinweis, 'Maria sieht, dass und von wem schon entschieden wurde').toContainText(/Schon entschieden von Olli Owner|Olli Owner hat schon/, { timeout: SOLL_TIMEOUT_MS });
  await expect.poll(async () => (await tabelleTurnierleitung(seite)).slice(2, 4).map((n) => n.replace(/\s*Strafstoßschießen.*$/s, '').trim()), { message: 'Ollis 4:3 gilt', timeout: SOLL_TIMEOUT_MS }).toEqual(['DJK Otting', 'TSV Petting']);
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
 * N7a: die Gruppe ist abgeschlossen (GA4 A-13c; Daniel 23.10.: die Entscheidung des Gleichstands in N6d hat die Gruppe in einem Zug abgeschlossen,
 * @TM-046, @TM-057): der Spielplan schlägt keinen Abschluss mehr vor (@TM-044), die Tabelle zeigt „abgeschlossen“ und „Gruppe wieder öffnen“, kein
 * Zurücknehmen der Entscheidung (@W2A-070). Test-ID über `groupTestId`: `''` → `all`.
 */
async function gruppeAbschliessen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  await openNikolausPath(seite, '/schedule');
  await expectPageAnchor(seite.getByRole('button', { name: 'Spielplan bearbeiten' }), 'Spielplan der Turnierleitung');
  await expect(seite.getByTestId('group-close-suggestion'), 'abgeschlossen: kein Vorschlag mehr').toHaveCount(0, { timeout: SOLL_TIMEOUT_MS });
  await openNikolausPath(seite, '/standings');
  await seite.getByText('Gesamtplatzierung', { exact: true }).first().click();
  await expect(seite.getByTestId('group-state-all'), 'Zustand „abgeschlossen“').toHaveText('abgeschlossen', { timeout: SOLL_TIMEOUT_MS });
  await expect(seite.getByTestId('group-reopen-all')).toBeVisible();
  await expect(seite.getByTestId('tie-accept-withdraw'), 'nach dem Abschluss kein Zurücknehmen mehr (@W2A-070)').toHaveCount(0);
}

/**
 * N7a2 (R2 PR 2, A-15b, Review #384 M2): Korrektur nach dem Abschluss → die Gruppe ist ohne Zutun erneut abgeschlossen (@TM-071 Z1–2,
 * @TM-150 Z2). Olli hat die Tabelle offen; ein Spiel, das TSV Petting gewonnen hat, wird um ein Tor für Petting korrigiert (Punkte
 * aller Teams bleiben, Platz 1 unberührt). Damit sind Petting und Otting nicht mehr gleich, Ollis Strafstoß-Entscheidung aus N6d
 * verfällt, Petting steht vor Otting. Erwartet: die Gruppe ist abgeschlossen mit der neuen Rangfolge, nicht mehr veraltet, kein
 * „Besetzung prüfen“, und genau EIN neuer Verlaufseintrag `complete_group` (auch nach weiterem Warten, M1).
 * Die Korrektur geht über die Turnierleitungs-RPC: der Einstieg „Korrigieren“ im Spielplan/Cockpit fehlt noch (D12/D12b, B-24/B-25).
 * Läuft als LETZTER Schritt: die Korrektur ändert ein Ergebnis, die Vorbedingung der übrigen Schritte (`beendeAlleSpiele`) prüft die
 * festen Ergebnisse. Steht vor N7b (Turnier abschließen): danach ist das Turnier gesperrt (R3-4).
 */
async function neuAbschlussNachKorrektur({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const petting = NIKOLAUS.teamId('TSV Petting');
  const abschluesse = async () => getRows<{ id: number }>(`bracket_log?tournament_id=eq.${NIKOLAUS.tournamentId}&kind=eq.complete_group&select=id`, 'Abschluss-Einträge');
  const vorher = (await abschluesse()).length;
  const seite = await asRole('owner');
  await tabelleTurnierleitung(seite); // Ollis Gerät ist offen (der Auslöser läuft dort)
  const spiel = (await fetchNikolausSpiele()).find((m) =>
    (m.team_a_id === petting && (m.score_a ?? 0) > (m.score_b ?? 0)) || (m.team_b_id === petting && (m.score_b ?? 0) > (m.score_a ?? 0)));
  expect(spiel, 'ein Spiel, das TSV Petting gewonnen hat').toBeDefined();
  if (spiel === undefined) { return; }
  const rows = await fetchEngineRows(spiel.id);
  const letzter = rows.filter((row) => ['GOAL', 'OWN_GOAL', 'CORRECTION', 'RESULT_ENTRY'].includes(row.type)).pop();
  const a = (spiel.score_a ?? 0) + (spiel.team_a_id === petting ? 1 : 0);
  const b = (spiel.score_b ?? 0) + (spiel.team_b_id === petting ? 1 : 0);
  const at = Date.now() - 1000;
  const korrektur = await appendAsRole('owner', spiel.id, [eventOf('CORRECTION', at, at - 5000, {
    payload: { scores: { [spiel.team_a_id]: a, [spiel.team_b_id]: b }, reason: 'Tor übersehen', basedOn: letzter?.id ?? null },
  })], { feldFreigeben: true });
  expect(korrektur.results.map((r) => r.status), 'Korrektur angenommen').toEqual(['accepted']);

  const stand = async () => (await getRows<{ stale: boolean; ranking: string[]; reopened_at: string | null }>(
    `group_completions?tournament_id=eq.${NIKOLAUS.tournamentId}&reopened_at=is.null&select=stale,ranking,reopened_at`, 'Gruppenabschluss'))[0];
  await expect.poll(async () => { const g = await stand(); return g ? `${String(g.stale)}|${String(g.ranking.indexOf(petting) < g.ranking.indexOf(NIKOLAUS.teamId('DJK Otting')))}` : 'fehlt'; },
    { message: 'ohne Zutun erneut abgeschlossen: nicht mehr veraltet, Petting vor Otting', timeout: 30_000 }).toBe('false|true'); // Realtime → Neuladen → Auslöser → Server
  await expect(seite.getByTestId('group-stale-all'), 'kein „Besetzung prüfen“').toHaveCount(0, { timeout: 15_000 });
  await expect(seite.getByTestId('group-state-all')).toHaveText('abgeschlossen');
  await seite.waitForTimeout(5000); // M1: auch danach kein zweiter erneuter Abschluss
  expect((await abschluesse()).length, 'genau ein neuer Verlaufseintrag „abgeschlossen“').toBe(vorher + 1);
}

/** Zustand des Nikolaus-Turniers am Server (Service-Rolle): `lifecycle_status` und `finished_at` (R3-4; die alte Spalte `status` sagt nichts über den Abschluss, C-E2E-N7B-SPALTE). */
const zustand = async (): Promise<{ lifecycle_status: string | null; finished_at: string | null }> =>
  (await getRows<{ lifecycle_status: string | null; finished_at: string | null }>(`tournaments?id=eq.${NIKOLAUS.tournamentId}&select=lifecycle_status,finished_at`, 'Zustand des Turniers'))[0];

/**
 * N6c2 (R3-4, @LZ-010, @LZ-013): „Turnier abschließen“, solange die Gruppe nicht abgeschlossen ist (Petting und Otting sind gleichauf, N6c): der Dialog nennt
 * den offenen Punkt („Gruppe noch nicht abgeschlossen“), der Tipp darauf führt zur Tabelle, es gibt keine Taste zum Abschließen, und das Turnier bleibt im
 * Zustand „Läuft“ (nichts wurde verändert). Steht VOR N6d (die Entscheidung des Gleichstands schließt die Gruppe ab).
 */
async function abschlussVerweigert({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const vorher = await zustand();
  expect(vorher.finished_at, 'noch nicht abgeschlossen').toBeNull();
  const seite = await asRole('owner');
  await openNikolausPath(seite, '/admin/dashboard');
  await expect(seite.getByTestId('finish-status'), 'etwas ist offen: kein Vorschlag, die Karte „Turnierstand“').toBeVisible({ timeout: 15_000 });
  await expect(seite.getByTestId('finish-suggestion')).toHaveCount(0);
  const t0 = Date.now();
  await seite.getByTestId('tournament-finish-open').click();
  const liste = seite.getByTestId('finish-open-list');
  // Messung der Prüfdauer (Stand „wird geprüft“ → Liste): die Zeit steht als Anmerkung im Bericht
  await expect(liste.or(seite.getByTestId('finish-error')), 'Liste der offenen Punkte (oder ein Fehlertext)').toBeVisible({ timeout: 60_000 });
  test.info().annotations.push({ type: 'Prüfdauer des Abschluss-Dialogs (ms)', description: String(Date.now() - t0) });
  await expect(liste, 'Liste der offenen Punkte').toBeVisible({ timeout: 1000 });
  await expect(liste.getByTestId('finish-open-item').filter({ hasText: /Gruppe.* noch nicht abgeschlossen/ }), '@LZ-013: Eintrag „Gruppe noch nicht abgeschlossen“').toHaveCount(1);
  await expect(seite.getByTestId('finish-back'), 'Haupttaste „Zurück zur Verwaltung“').toHaveText('Zurück zur Verwaltung');
  await expect(seite.getByTestId('tournament-finish-confirm'), 'kein gesperrter Abschließen-Knopf (Daniel 25.10.)').toHaveCount(0);
  await liste.getByTestId('finish-open-item').filter({ hasText: /Gruppe.* noch nicht abgeschlossen/ }).click();
  await expect(seite, 'der Tipp führt zur Tabelle der Gruppe').toHaveURL(/\/standings$/, { timeout: 10_000 });
  expect(await zustand(), 'das Turnier ist unverändert „Läuft“').toEqual(vorher);
}

/**
 * N7b (R3-4, @LZ-009, @LZ-030, @LZ-038, @LZ-039; Review #393 H-2): Olli schließt das Turnier ab. Die 15 Ergebnisse stehen über die Engine (Spiel 1 echt am
 * Handy gespielt, N3/N4) – die Anzeige trägt die Überlagerung der Spielsteuerung, der Dienst bekommt den rohen Cloud-Stand: der Dialog ist „bereit“, ohne
 * „Stand neu laden“. Nach dem Bestätigen zeigt die Verwaltung Zustand C, der Server steht auf `finished`, der Endstand ist gespeichert (Kammer vorn), und ein
 * danach gesendeter Eintrag zählt nicht: `review AFTER_FINISH`, Stand gleich, aufbewahrt unter „Nach dem Ende eingetroffen“.
 * (Die Nikolaus-Linie hat kein Helfer-Konto; der Eintrag kommt vom Konto der Turnierleitung – @LZ-040 nennt auch deren Korrektur.)
 */
async function turnierAbschliessen({ asRole }: StepContext): Promise<void> {
  await vorbedingung('alle 15 Spiele beenden', beendeAlleSpiele);
  const seite = await asRole('owner');
  const maria = await asRole('coadmin'); // zweites Gerät, schon offen: Abschluss auf einem anderen Gerät (Review #394 H-2)
  await openNikolausPath(maria, '/admin/dashboard');
  await expect(maria.getByTestId('finish-suggestion'), 'Maria sieht denselben Vorschlag').toBeVisible({ timeout: 15_000 });
  await openNikolausPath(seite, '/admin/dashboard');
  await expect(seite.getByTestId('finish-suggestion'), '@LZ-007: alles entschieden, der Vorschlag steht da').toBeVisible({ timeout: 15_000 });
  await seite.getByTestId('tournament-finish-open').click();
  const dialog = seite.getByTestId('finish-dialog');
  await expect(dialog.getByTestId('finish-ready'), 'Dialog „bereit“ – ohne „Stand neu laden“ (H-2)').toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('Stand neu laden')).toHaveCount(0);
  await expect(dialog.getByTestId('finish-winner')).toContainText(KAMMER);
  await expect(dialog.getByTestId('finish-places').getByRole('listitem'), 'Plätze 1 bis 3').toHaveCount(3);
  await expect(dialog.getByTestId('finish-facts')).toContainText('15 von 15');
  expect((await zustand()).lifecycle_status, 'vor dem Bestätigen ist das Turnier festgelegt, nicht abgeschlossen').toBe('fixed');

  await dialog.getByTestId('tournament-finish-confirm').click();
  await expect(seite.getByTestId('tournament-ended'), 'Verwaltung zeigt Zustand C').toBeVisible({ timeout: 20_000 });
  await expect(seite.getByTestId('tournament-ended')).toContainText('Wieder öffnen geht nur über den Betreiber.');
  await expect(seite.getByTestId('tournament-finish-open'), 'kein „Turnier abschließen“ mehr').toHaveCount(0);
  await expect(maria.getByTestId('tournament-ended'), 'Marias Gerät wechselt ohne Neuladen auf „abgeschlossen“ (Realtime, #394 H-2)').toBeVisible({ timeout: 30_000 });
  const nachher = await zustand();
  expect(nachher.lifecycle_status, 'Server: abgeschlossen').toBe('finished');
  expect(nachher.finished_at, 'Abschlusszeitpunkt gesetzt').not.toBeNull();
  const gespeichert = await getRows<{ snapshot: { ranking: Array<{ place: number; teamName: string }> } }>(`tournament_final_standings?tournament_id=eq.${NIKOLAUS.tournamentId}&select=snapshot`, 'gespeicherter Endstand');
  expect(gespeichert, 'genau ein gespeicherter Endstand').toHaveLength(1);
  expect(gespeichert[0].snapshot.ranking.find((row) => row.place === 1)?.teamName, 'Platz 1').toBe(KAMMER);
  await expect(seite.getByTestId('finished-standings'), 'Zustand C nennt Plätze 1 bis 3').toContainText(KAMMER, { timeout: 15_000 });

  // @LZ-038/@LZ-039: ein Eintrag nach dem Abschluss zählt nicht, wird aufbewahrt und gezeigt
  const letztes = (await fetchNikolausSpiele())[14];
  const vorherStand = `${String(letztes.score_a)}:${String(letztes.score_b)}`;
  const at = Date.now() - 1000;
  const spaet = await appendAsRole('owner', letztes.id, [eventOf('GOAL', at, at - 5000, { teamId: letztes.team_a_id })], { feldFreigeben: true });
  expect(spaet.results.map((r) => `${r.status}:${r.code ?? ''}`), 'nach dem Abschluss: zur Klärung, nicht angenommen (AFTER_FINISH)').toEqual(['review:AFTER_FINISH']);
  const danach = (await fetchNikolausSpiele())[14];
  expect(`${String(danach.score_a)}:${String(danach.score_b)}`, 'das Ergebnis ist unverändert').toBe(vorherStand);
  expect(await getRows<{ id: number }>(`late_entries?tournament_id=eq.${NIKOLAUS.tournamentId}&select=id`, 'nach dem Ende eingetroffen'), 'aufbewahrt').toHaveLength(1);
  await seite.reload();
  await expect(seite.getByTestId('late-entry'), 'Olli sieht den Eintrag „nach dem Ende eingetroffen“').toHaveCount(1, { timeout: 20_000 });
  await expect(seite.getByTestId('late-entry')).toContainText('zählt nicht');
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
  { id: 'N6c2', title: 'Turnier abschließen bei offener Gruppe: Liste „Gruppe noch nicht abgeschlossen“ mit Sprung zur Tabelle, kein Abschließen-Knopf, Turnier bleibt „Läuft“', scenarios: ['@LZ-010', '@LZ-013'], owner: 'R3-4 (B-33)', expectedFail: false, run: abschlussVerweigert },
  { id: 'N6d', title: 'Tabelle: Strafstoßschießen 4:3 für Otting über „Gleichstand entscheiden“ eintragen, Sieger steht vorn, Gruppe abgeschlossen; Maria (zweites Gerät) danach 5:4: nicht angenommen, Hinweis nennt Olli', scenarios: ['@ET-055', '@W2A-067', '@TM-046', '@W2A-060'], owner: 'Paket TB', expectedFail: false, run: strafstossEintragen },
  { id: 'N6e', title: 'Assistent: Reihenfolge bei Punktgleichheit für private Hallenturniere vorbelegt', scenarios: ['@W2A-046'], owner: 'Paket TB (TB-2)', expectedFail: false, run: vorbelegungPrivat },
  { id: 'N6f', title: 'Entscheidung öffentlich ohne Person, Zeit und Grund; Entscheidungsverlauf nicht anonym lesbar', scenarios: ['@W2A-072'], owner: 'Paket TB (TB-3\')', expectedFail: false, run: entscheidungNichtOeffentlich },
  { id: 'N7a', title: 'Gruppe abgeschlossen (mit der Entscheidung in N6d): kein Vorschlag mehr, „Gruppe wieder öffnen“, kein Zurücknehmen', scenarios: ['@TM-044', '@TM-046', '@TM-057', '@W2A-070'], owner: 'A-13c', expectedFail: false, run: gruppeAbschliessen },
  { id: 'N7a2', title: 'Korrektur nach dem Abschluss: Gruppe ohne Zutun erneut abgeschlossen, kein „Besetzung prüfen“, ein Verlaufseintrag', scenarios: ['@TM-071', '@TM-150'], owner: 'R2 PR 2 (A-15b)', expectedFail: false, run: neuAbschlussNachKorrektur },
  { id: 'N7b', title: 'Turnier abschließen: Dialog bereit ohne „Stand neu laden“, abgeschlossen und gesperrt, späte Einträge aufbewahrt', scenarios: ['@LZ-009', '@LZ-030', '@LZ-038', '@LZ-039'], befunde: ['C-ZUSTAND-ABGELEITET', 'C-E2E-N7B-SPALTE'], owner: 'R3-4 (B-33): erst nach grünem CI-Lauf auf expectedFail: false', expectedFail: true, run: turnierAbschliessen },
  { id: 'N7c', title: 'Endstand = abgeschlossene Tabelle, Plätze 1 bis 6', scenarios: ['@ET-022'], owner: 'A-19 / A-20 / B-23', expectedFail: true, run: endstand },
];

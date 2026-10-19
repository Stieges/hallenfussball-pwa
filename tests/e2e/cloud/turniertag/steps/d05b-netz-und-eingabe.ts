/**
 * D5b-D5d, D6b: Netz, Klärungsliste, Schnelleingabe und Update während eines Spiels (Plan (b)).
 * D5b und D5d sind grün (#281, #278); die übrigen sind expectedFail, jeder mit einer Soll-Wirkung, die der Besitzer baut.
 */
import { expect, type Page } from '@playwright/test';
import { expectPageAnchor, expectSollMarker, fetchTurniertagBracket, getRows, openTurniertagPath, TURNIERTAG_ID, type TurniertagMatch } from './shared';
import { newRoleContext, openCockpit, fetchEngineRows } from '../../engineHelpers';
import { serviceRest } from '../../restAsRole';
import { appendOwner, regularResultEvents } from './playViaRpc';
import { legeWegwerfKopieAn, momentaufnahme } from './wegwerfKopie';
import type { StepContext, TurniertagStep } from './types';

const kopieSpiele = (kopieId: string): Promise<TurniertagMatch[]> =>
  getRows<TurniertagMatch>(
    `matches?tournament_id=eq.${kopieId}&order=slot.asc,field.asc,id.asc&select=id,slot,field,phase,group_letter,team_a_id,team_b_id,slot_a_source,slot_b_source,match_status,decided_by,score_a,score_b,label`,
    'Spiele der Wegwerf-Kopie'
  );

/**
 * D5b: Netzwechsel in der Halle (WLAN mehrmals weg und wieder da, @FU-025/@FU-102): kein Fehler, und eine Änderung am Turnier
 * kommt danach ohne Neuladen in höchstens 10 s an. Läuft auf einer Wegwerf-Kopie des Turniertag-Cups: das Ergebnis, das die
 * Änderung auslöst, lässt sich im Turniertag-Cup nicht zurückholen.
 */
async function netzwechsel({ browser }: StepContext): Promise<void> {
  const vorher = await momentaufnahme();
  const kopie = await legeWegwerfKopieAn(browser, 'D5b');
  const { context, page } = await newRoleContext(browser, 'owner');
  try {
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    const gefunden = (await kopieSpiele(kopie.id)).find((m) => m.phase === 'groupStage' && m.team_a_id && m.team_b_id);
    if (!gefunden) {
      throw new Error('Die Kopie hat kein besetztes Gruppenspiel.');
    }
    const spiel = gefunden;
    await openTurniertagPath(page, '/schedule', kopie.id);
    await expectPageAnchor(page.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
    const kreis = page.locator(`[data-testid="match-circle-${spiel.id}"]`);
    await expect(kreis, 'Spiel in der Liste, noch ohne Ergebnis').toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 3; i++) {
      await context.setOffline(true);
      await page.waitForTimeout(400);
      await context.setOffline(false);
      await page.waitForTimeout(400);
    }
    // @FU-102: danach ändert sich das Turnier (Ergebnis über die Server-Funktion, wie ein zweites Gerät) -- ohne Neuladen sichtbar.
    const ereignisse = regularResultEvents(spiel, 1, 0);
    const antwort = await appendOwner(spiel.id, ereignisse);
    expect(antwort.results.map((r) => r.status), 'Ergebnis der Kopie angenommen').toEqual(ereignisse.map(() => 'accepted'));
    await expect(kreis, 'neuer Stand nach höchstens 10 s ohne Neuladen').toContainText(/1\s*:\s*0/, { timeout: 10000 });
    expect(fehler, 'kein Seitenfehler beim Netzwechsel').toEqual([]);
    await expect(page.locator('[data-testid="realtime-interrupted-hint"]'), 'keine Fehlermeldung zur Live-Verbindung').toHaveCount(0);
  } finally {
    await context.close();
    await kopie.entfernen();
  }
  expect(await momentaufnahme(), 'Turniertag-Cup unverändert').toEqual(vorher);
}

/** D5c: widersprüchliche Offline-Einträge zweier Geräte landen in der Klärungsliste (Besitzer A-35/B-50). */
async function klaerungsliste({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'review-list');
}

/**
 * Id des Spiels, das die Finalrunden-Tabelle des Spielplans mit Tore-Feldern zeigt. Die Tabelle zeigt heute nur das letzte
 * Spiel der Finalrunde (die übrigen stehen als Karten unter "Gruppenphase", ohne diese Felder); welches das ist, hängt vom
 * Seed ab und wird gelesen statt angenommen.
 */
async function spielDerFinalrundenTabelle(page: Page, finals: readonly TurniertagMatch[]): Promise<TurniertagMatch> {
  const eingaben = page.locator('[data-testid^="match-score-input-"][data-testid$="-home"]');
  await expect(eingaben.first(), 'Tore-Feld der Finalrunden-Tabelle').toBeVisible({ timeout: 15000 });
  const kennungen = await eingaben.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
  const spiel = finals.find((m) => kennungen.includes(`match-score-input-${m.id}-home`));
  if (!spiel) {
    throw new Error(`Kein Spiel der Finalrunde in der Tabelle (Felder: ${kennungen.join(', ')}).`);
  }
  return spiel;
}

/** Stand des Spiels am Server, ohne den Weg über die App: Ergebnis-Spalten und alle Engine-Zeilen. */
async function serverStand(spielId: string): Promise<{ tore: Array<number | null>; arten: string[] }> {
  const zeile = (await getRows<{ score_a: number | null; score_b: number | null }>(`matches?id=eq.${spielId}&select=score_a,score_b`, 'Spiel am Server'))[0];
  const zeilen = await fetchEngineRows(spielId);
  return { tore: [zeile?.score_a ?? null, zeile?.score_b ?? null], arten: zeilen.map((z) => z.type) };
}

/**
 * D5d: Schnelleingabe in der Finalrunden-Tabelle des Spielplans, zweistelliges Ergebnis (@FU-101, C-SCHNELLEINGABE-TASTENDRUCK;
 * behoben mit #278). Reihenfolge wie im Szenario: das Feld des Gastes zeigt schon 2, dann tippt Olli im Heim-Feld "1" und "0".
 * Bis zur Bestätigung steht am Server nichts (der alte Fehler hätte nach der "1" schon 1:2 gespeichert); danach genau ein
 * RESULT_ENTRY mit 10:2 und keine Korrektur.
 *
 * Läuft auf einer Wegwerf-Kopie des Turniertag-Cups: das Ergebnis lässt sich im Turniertag-Cup nicht zurückholen. Die Finalrunde
 * ist dort (wie im Turniertag-Cup an dieser Stelle) unbesetzt, die Schnelleingabe verlangt aber zwei Teams ("teamsMissing"); die
 * Kopie wird daher vorher mit zwei Teams besetzt. Rückbau: Browser schließen, Kopie als Ganzes löschen.
 */
async function schnelleingabe({ browser }: StepContext): Promise<void> {
  const vorher = await momentaufnahme();
  const kopie = await legeWegwerfKopieAn(browser, 'D5d');
  const { context, page } = await newRoleContext(browser, 'owner');
  try {
    const spiele = await kopieSpiele(kopie.id);
    const finals = spiele.filter((m) => m.phase !== 'groupStage');
    expect(finals.length, 'die Kopie hat die Finalrunde').toBe(4);
    const teams = await getRows<{ id: string }>(`teams?tournament_id=eq.${kopie.id}&select=id&order=id.asc`, 'Teams der Wegwerf-Kopie');
    expect(teams.length, 'die Kopie hat mindestens zwei Teams').toBeGreaterThanOrEqual(2);
    for (const final of finals) {
      const res = await serviceRest('PATCH', `matches?id=eq.${final.id}`, { team_a_id: teams[0].id, team_b_id: teams[1].id });
      expect(res.status, `Finalspiel in der Kopie besetzen: ${res.text}`).toBeLessThan(300);
    }
    await openTurniertagPath(page, '/schedule', kopie.id);
    await page.locator('[data-testid="filter-phase"]').selectOption({ label: 'Finalrunde' });
    await expectPageAnchor(page.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
    const spiel = await spielDerFinalrundenTabelle(page, finals);
    const heim = page.locator(`[data-testid="match-score-input-${spiel.id}-home"]`);
    const gast = page.locator(`[data-testid="match-score-input-${spiel.id}-away"]`);
    // Gegeben: das Feld des Gastes zeigt schon 2 (Fokus verlassen, das Heim-Feld ist noch leer: nichts wird gespeichert).
    await gast.pressSequentially('2');
    await heim.click();
    await page.waitForTimeout(1500);
    expect(await serverStand(spiel.id), 'nach "2" im Gast-Feld steht am Server nichts').toEqual({ tore: [null, null], arten: [] });
    // Wenn Olli im Heim-Feld "1" und dann "0" tippt ...
    await heim.pressSequentially('1');
    await heim.pressSequentially('0');
    await expect(heim, 'beide Ziffern bleiben stehen').toHaveValue('10', { timeout: 3000 });
    // ... speichert die App erst bei Bestätigung: der alte Fehler hätte hier schon 1:2 gespeichert.
    await page.waitForTimeout(2000);
    expect(await serverStand(spiel.id), 'vor Enter steht am Server nichts (nicht 1:2)').toEqual({ tore: [null, null], arten: [] });
    await heim.press('Enter');
    await expect.poll(async () => (await serverStand(spiel.id)).tore, { message: '10:2 ist gespeichert', timeout: 10000 }).toEqual([10, 2]);
    expect((await serverStand(spiel.id)).arten, 'genau ein Ergebnis-Eintrag, keine Korrektur').toEqual(['RESULT_ENTRY']);
    const eintrag = (await fetchEngineRows(spiel.id))[0];
    const tore = Object.values((eintrag.payload as { scores: Record<string, number> }).scores).sort((x, y) => x - y);
    expect(tore, 'Ergebnis-Eintrag: 10:2').toEqual([2, 10]);
  } finally {
    await context.close();
    await kopie.entfernen();
  }
  expect(await momentaufnahme(), 'Turniertag-Cup unverändert').toEqual(vorher);
}

/** D6b: eine neue App-Version kommt nicht mitten im Spiel, die Version ist sichtbar (Ü1.4, B-31). */
async function updateImSpiel({ asRole }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const ownerPage = await asRole('owner');
  await openCockpit(ownerPage, TURNIERTAG_ID, groupMatches[0].id);
  await expectPageAnchor(ownerPage.locator('[data-testid="team-name-home"]'), 'Cockpit');
  await expectSollMarker(ownerPage, 'app-version-label');
}

export const steps: readonly TurniertagStep[] = [
  { id: 'D5b', title: 'Netzwechsel in der Halle: Änderung kommt ohne Neuladen an, kein Fehler', scenarios: ['@FU-025', '@FU-102'], befunde: ['C-REALTIME-RESUBSCRIBE-WIRFT'], owner: 'Paket RS (Realtime-Neuabo, #281 geliefert)', expectedFail: false, run: netzwechsel },
  { id: 'D5c', title: 'Widersprüchliche Offline-Einträge zweier Geräte: Klärungsliste', scenarios: ['@FU-037', '@FU-038'], befunde: ['C-KLAERUNGSLISTE-OHNE-PAKET'], owner: 'A-35/B-50', expectedFail: true, run: klaerungsliste },
  { id: 'D5d', title: 'Schnelleingabe in der Finalrunden-Tabelle: zweistelliges Ergebnis 10:2', scenarios: ['@FU-101'], befunde: ['C-SCHNELLEINGABE-TASTENDRUCK'], owner: 'H-Rest Kleinfix (Schnelleingabe, #278 gebaut)', expectedFail: false, run: schnelleingabe },
];

/** Nach D6 (Halbzeit, Zeitstrafe). */
export const stepsNachHalbzeit: readonly TurniertagStep[] = [
  { id: 'D6b', title: 'Neue Version während eines Spiels: kein Update im Spiel, Version sichtbar', scenarios: [], owner: 'B-31 (Ü1.4)', expectedFail: true, run: updateImSpiel },
];

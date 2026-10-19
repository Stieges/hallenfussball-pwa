/**
 * D5b-D5d, D6b: Netz, Klärungsliste, Schnelleingabe und Update während eines Spiels (Plan (b)).
 * D5d ist grün (#278); die übrigen sind expectedFail, jeder mit einer Soll-Wirkung, die der Besitzer baut.
 */
import { expect, type Page } from '@playwright/test';
import { fetchTurniertagBracket, fetchTurniertagMatches, fetchTurniertagTeams, expectPageAnchor, expectSollMarker, getRows, openSpielplanFinalrunde, openTurniertagPath, TURNIERTAG_ID, vorbedingung, type TurniertagMatch } from './shared';
import { newRoleContext, openCockpit } from '../../engineHelpers';
import { serviceRest } from '../../restAsRole';
import type { StepContext, TurniertagStep } from './types';

/** D5b: Netzwechsel in der Halle (WLAN mehrmals weg und wieder da): kein Fehler, kein toter Kanal (@FU-025, C-REALTIME-RESUBSCRIBE-WIRFT). */
async function netzwechsel({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const { context, page } = await newRoleContext(browser, 'owner');
  try {
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await openCockpit(page, TURNIERTAG_ID, groupMatches[0].id);
    await expectPageAnchor(page.locator('[data-testid="team-name-home"]'), 'Cockpit');
    for (let i = 0; i < 3; i++) {
      await context.setOffline(true);
      await page.waitForTimeout(400);
      await context.setOffline(false);
      await page.waitForTimeout(400);
    }
    expect(fehler, 'kein Seitenfehler beim Netzwechsel').toEqual([]);
    await expect(page.locator('[data-testid="realtime-interrupted-hint"]')).toHaveCount(0, { timeout: 10000 });
    await expectSollMarker(page, 'realtime-channel-live');
  } finally {
    await context.close();
  }
}

/** D5c: widersprüchliche Offline-Einträge zweier Geräte landen in der Klärungsliste (Besitzer A-35/B-50). */
async function klaerungsliste({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await openTurniertagPath(ownerPage, '/admin/dashboard');
  await expectPageAnchor(ownerPage.getByText('Dashboard', { exact: true }).first(), 'Admin-Kategorie Dashboard');
  await expectSollMarker(ownerPage, 'review-list');
}

/** Spalten, die ein Direkteintrag (`append_match_events`) am Spiel verändert; Grundlage für das Zurücksetzen nach D5d. */
const EINGABE_SPALTEN = 'team_a_id,team_b_id,score_a,score_b,overtime_score_a,overtime_score_b,penalty_score_a,penalty_score_b,match_status,decided_by,timer_elapsed_seconds,timer_start_time,timer_paused_at,actual_start,actual_end,live_state,skipped_at,skipped_reason';

/**
 * Id des Spiels, das die Finalrunden-Tabelle des Spielplans mit Tore-Feldern zeigt. Die Tabelle zeigt heute nur das letzte
 * Spiel der Finalrunde (die übrigen stehen als Karten unter "Gruppenphase", ohne diese Felder); welches das ist, hängt vom
 * Seed ab und wird gelesen statt angenommen.
 */
async function spielDerFinalrundenTabelle(page: Page, finals: readonly TurniertagMatch[]): Promise<TurniertagMatch> {
  const eingaben = page.locator('[data-testid^="match-score-input-"][data-testid$="-home"]');
  await expect(eingaben.first(), 'Tore-Feld der Finalrunden-Tabelle').toBeVisible({ timeout: 10000 });
  const kennungen = await eingaben.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') ?? ''));
  const spiel = finals.find((m) => kennungen.includes(`match-score-input-${m.id}-home`));
  if (!spiel) {
    throw new Error(`Kein Spiel der Finalrunde in der Tabelle (Felder: ${kennungen.join(', ')}).`);
  }
  return spiel;
}

/**
 * D5d: Schnelleingabe in der Finalrunden-Tabelle des Spielplans, zweistelliges Ergebnis 10:2 ohne vorzeitiges Speichern
 * (@FU-101, C-SCHNELLEINGABE-TASTENDRUCK; behoben mit #278). Gespeichert wird erst mit Enter oder `blur()`.
 *
 * Ausgangszustand: Die Finalrunde ist an dieser Stelle noch nicht besetzt (D8 schließt die Gruppen erst später ab), und die
 * Schnelleingabe verlangt zwei Teams ("teamsMissing"). Der Schritt besetzt das Spiel der Tabelle daher für sich mit zwei
 * Gruppenteams und setzt es nach dem Prüfen auf den Stand davor zurück (Ereignisse des Spiels weg, Zeile wie vorher), damit
 * D8-D12 es unverändert vorfinden (D8/D9/D10 besetzen und spielen die Finalrunde später selbst).
 */
async function schnelleingabe({ asRole }: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const teams = await fetchTurniertagTeams();
  expect(teams.length, 'der Turniertag-Cup hat mindestens zwei Teams').toBeGreaterThanOrEqual(2);
  const suchSeite = await asRole('owner');
  await openSpielplanFinalrunde(suchSeite);
  await expectPageAnchor(suchSeite.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
  const spiel = await spielDerFinalrundenTabelle(suchSeite, finals);
  const vorher = (await getRows<Record<string, unknown>>(`matches?id=eq.${spiel.id}&select=${EINGABE_SPALTEN}`, 'Spiel vor D5d'))[0];
  try {
    await vorbedingung('Spiel der Finalrunden-Tabelle mit zwei Teams besetzen (wird danach zurückgesetzt)', async () => {
      const res = await serviceRest('PATCH', `matches?id=eq.${spiel.id}`, { team_a_id: teams[0].id, team_b_id: teams[1].id });
      expect(res.status, `Spiel besetzen: ${res.text}`).toBeLessThan(300);
    });
    // Neue Seite in eigenem Browser-Context: die erste hält den alten Stand (Local-First) im Zwischenspeicher.
    const ownerPage = await asRole('owner');
    await openSpielplanFinalrunde(ownerPage);
    const heim = ownerPage.locator(`[data-testid="match-score-input-${spiel.id}-home"]`);
    const gast = ownerPage.locator(`[data-testid="match-score-input-${spiel.id}-away"]`);
    await expect(heim, 'Tore-Feld Heim der Finalrunden-Tabelle').toBeVisible({ timeout: 10000 });
    await heim.pressSequentially('10');
    await expect(heim, 'beide Ziffern bleiben stehen, kein Speichern nach der ersten').toHaveValue('10', { timeout: 3000 });
    await gast.pressSequentially('2');
    await gast.press('Enter');
    await expect.poll(async () => {
      const m = (await fetchTurniertagMatches()).find((x) => x.id === spiel.id);
      return [m?.score_a, m?.score_b];
    }, { message: '10:2 ist gespeichert', timeout: 10000 }).toEqual([10, 2]);
  } finally {
    await serviceRest('DELETE', `match_events?match_id=eq.${spiel.id}`);
    const zurueck = await serviceRest('PATCH', `matches?id=eq.${spiel.id}`, vorher);
    expect(zurueck.status, `Spiel zurücksetzen: ${zurueck.text}`).toBeLessThan(300);
  }
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
  { id: 'D5b', title: 'Netzwechsel in der Halle: Realtime fängt sich, kein Fehler', scenarios: ['@FU-025'], befunde: ['C-REALTIME-RESUBSCRIBE-WIRFT'], owner: 'Paket RS (Realtime-Neuabo)', expectedFail: true, run: netzwechsel },
  { id: 'D5c', title: 'Widersprüchliche Offline-Einträge zweier Geräte: Klärungsliste', scenarios: ['@FU-037', '@FU-038'], befunde: ['C-KLAERUNGSLISTE-OHNE-PAKET'], owner: 'A-35/B-50', expectedFail: true, run: klaerungsliste },
  { id: 'D5d', title: 'Schnelleingabe in der Finalrunden-Tabelle: zweistelliges Ergebnis 10:2', scenarios: ['@FU-101'], befunde: ['C-SCHNELLEINGABE-TASTENDRUCK'], owner: 'H-Rest Kleinfix (Schnelleingabe, #278 gebaut)', expectedFail: false, run: schnelleingabe },
];

/** Nach D6 (Halbzeit, Zeitstrafe). */
export const stepsNachHalbzeit: readonly TurniertagStep[] = [
  { id: 'D6b', title: 'Neue Version während eines Spiels: kein Update im Spiel, Version sichtbar', scenarios: [], owner: 'B-31 (Ü1.4)', expectedFail: true, run: updateImSpiel },
];

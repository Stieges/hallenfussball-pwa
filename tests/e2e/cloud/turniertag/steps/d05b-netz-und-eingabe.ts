/**
 * D5b-D5d, D6b: Netz, Klärungsliste, Schnelleingabe und Update während eines Spiels (Plan (b)).
 * D5d ist grün (#278); die übrigen sind expectedFail, jeder mit einer Soll-Wirkung, die der Besitzer baut.
 */
import { expect } from '@playwright/test';
import { fetchTurniertagBracket, fetchTurniertagMatches, fetchTurniertagTeams, findFinalByLabel, expectPageAnchor, expectSollMarker, getRows, openSpielplanFinalrunde, openTurniertagPath, TURNIERTAG_ID, vorbedingung } from './shared';
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
 * D5d: Schnelleingabe in der Finalrunden-Tabelle des Spielplans, zweistelliges Ergebnis 10:2 ohne vorzeitiges Speichern
 * (@FU-101, C-SCHNELLEINGABE-TASTENDRUCK; behoben mit #278). Gespeichert wird erst mit Enter oder `blur()`.
 *
 * Ausgangszustand: Die Finalrunde ist an dieser Stelle noch nicht besetzt (D8 schließt die Gruppen erst später ab), und die
 * Schnelleingabe verlangt zwei Teams ("teamsMissing"). Der Schritt besetzt das Finale daher für sich mit zwei Gruppenteams
 * und setzt es nach dem Prüfen auf den Stand davor zurück (Ereignisse des Spiels weg, Zeile wie vorher), damit D8-D12 das
 * Finale unverändert vorfinden: D10 spielt es später regulär, D11/D10b lesen die Ergebnisse der Finalrunde.
 */
async function schnelleingabe({ asRole }: StepContext): Promise<void> {
  const { finals } = await fetchTurniertagBracket();
  const spiel = findFinalByLabel(finals, 'Finale');
  const vorher = (await getRows<Record<string, unknown>>(`matches?id=eq.${spiel.id}&select=${EINGABE_SPALTEN}`, 'Finale vor D5d'))[0];
  const teams = await fetchTurniertagTeams();
  expect(teams.length, 'der Turniertag-Cup hat mindestens zwei Teams').toBeGreaterThanOrEqual(2);
  try {
    await vorbedingung('Finale für die Schnelleingabe mit zwei Teams besetzen (wird danach zurückgesetzt)', async () => {
      const res = await serviceRest('PATCH', `matches?id=eq.${spiel.id}`, { team_a_id: teams[0].id, team_b_id: teams[1].id });
      expect(res.status, `Finale besetzen: ${res.text}`).toBeLessThan(300);
    });
    const ownerPage = await asRole('owner');
    await openSpielplanFinalrunde(ownerPage);
    await expectPageAnchor(ownerPage.locator('[data-testid="filter-phase"]'), 'Spielplan der Turnierleitung');
    const heim = ownerPage.locator(`[data-testid="match-score-input-${spiel.id}-home"]`);
    const gast = ownerPage.locator(`[data-testid="match-score-input-${spiel.id}-away"]`);
    // Die Liste rendert nur Zeilen im Umfeld des sichtbaren Bereichs: über die Seite scrollen, bis die Zeile des Finales steht.
    await expect(async () => {
      for (const anteil of [0, 0.4, 0.7, 1]) {
        await ownerPage.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), anteil);
        await ownerPage.waitForTimeout(250);
        if (await heim.count() > 0) {
          await heim.scrollIntoViewIfNeeded();
          return;
        }
      }
      throw new Error('Zeile des Finales nicht gerendert');
    }).toPass({ timeout: 20000 });
    await expect(heim, 'Tore-Feld Heim der Finalrunden-Tabelle').toBeVisible({ timeout: 5000 });
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
    expect(zurueck.status, `Finale zurücksetzen: ${zurueck.text}`).toBeLessThan(300);
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

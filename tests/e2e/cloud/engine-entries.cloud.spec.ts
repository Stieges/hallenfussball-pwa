/**
 * tests/e2e/cloud/engine-entries.cloud.spec.ts — Einträge über Geräte hinweg (A-23, übernimmt
 * C3b-3a §3). Jeder Test hat seinen eigenen Engine-Cup (`engineCups.ts`), prüft als erstes den
 * unverbrauchten Seed und stellt DB-Aussagen als "genau EINE neue Zeile gegenüber dem Seed-Stand"
 * (Typ + Ziel), nicht als "es gibt eine". Reihenfolge bei Neulade-Tests: UI-Aktion -> DB-Poll und
 * `data-pending="0"` beim handelnden Gerät -> erst danach `reload()` bzw. frisches Laden.
 * Nur `cloud-desktop` (Sidebar-Protokoll).
 */

import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import {
  appendAsRole,
  engineCupTarget,
  expectEngineMatchRunningUi,
  expectOutboxSettled,
  expectSeededEngineMatch,
  fetchEngineRows,
  fetchEventAuthorUserId,
  fetchUserIdByEmail,
  openCockpit,
  type AppendAsRoleEvent,
} from './engineHelpers';
import { fetchMatchRow } from './helpers';
import { E2E_USERS, engineCupIds, engineEventId, type EngineCupSlug } from './testData';
import { tippeKarte } from '../helpers/cockpitNeu';

function cup(slug: EngineCupSlug) {
  return { ids: engineCupIds(slug), target: engineCupTarget(slug) };
}

/** Genau EINE neue Engine-Zeile gegenüber dem Seed-Stand, mit Typ und (optional) Ziel. */
async function expectOneNewRow(matchId: string, seededRows: number, type: string, targetId?: string): Promise<string> {
  await expect.poll(async () => (await fetchEngineRows(matchId)).length, {
    message: `genau eine neue ${type}-Zeile`,
    timeout: 10000,
  }).toBe(seededRows + 1);
  const added = (await fetchEngineRows(matchId)).slice(seededRows);
  expect(added.map((row) => row.type)).toEqual([type]);
  if (targetId !== undefined) {
    expect(added[0].target_event_id).toBe(targetId);
  }
  return added[0].id;
}

function amendEvent(targetId: string, playerNumber: number): AppendAsRoleEvent {
  return { id: randomUUID(), type: 'AMEND', at: Date.now(), section: 1, clockMs: 0, teamId: null, targetId, payload: { playerNumber } };
}

test.describe('Engine-Einträge über Geräte', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Sidebar-Protokoll nur auf cloud-desktop.');
  });

  test('AMEND übersteht Neuladen: Nummer 7 -> 9 steht nach Neuladen bei Owner und frisch geladenem Helfer, Stand unverändert', async ({ asRole }) => {
    const { ids, target } = cup('AMEND');
    const seededRows = await expectSeededEngineMatch(target);
    const goalId = engineEventId('AMEND', 'goal-home');
    const ownerPage = await asRole('owner');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(ownerPage);

    await ownerPage.getByRole('button', { name: `TOR ${ids.homeTeamName} #7 bearbeiten` }).click();
    await ownerPage.locator('[data-testid="event-edit-number"]').fill('9');
    await ownerPage.locator('[data-testid="event-edit-save"]').click();

    await expectOneNewRow(ids.matchId, seededRows, 'AMEND', goalId);
    await expect(ownerPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: 10000 });

    await ownerPage.reload();
    await ownerPage.waitForLoadState('networkidle');
    const helperPage = await asRole('helper');
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    for (const page of [ownerPage, helperPage]) {
      await expect(page.getByText(`TOR ${ids.homeTeamName} #9`)).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1');
    }
  });

  test('@FU-003 L85 Zurücknehmen ist dauerhaft: helper nimmt das Tor des Owners zurück, Owner lädt neu und sieht 0:0 mit durchgestrichenem Eintrag', async ({ asRole }) => {
    const { ids, target } = cup('RETRACT');
    const seededRows = await expectSeededEngineMatch(target);
    const goalId = engineEventId('RETRACT', 'goal-home');
    const helperPage = await asRole('helper');
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(helperPage);
    await expect(helperPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1'); // Anker

    await helperPage.locator('[data-testid="match-undo-button"]').click();
    await expect(helperPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('0');

    const retractId = await expectOneNewRow(ids.matchId, seededRows, 'RETRACT', goalId);
    // Rollenbindung: der Autor der Rücknahme ist der Helfer, nicht der Owner.
    expect(await fetchEventAuthorUserId(retractId)).toBe(await fetchUserIdByEmail(E2E_USERS.helper.email));
    await expectOutboxSettled(helperPage);

    const ownerPage = await asRole('owner');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expect(ownerPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('0', { timeout: 15000 });
    await expect(ownerPage.locator('[data-testid="event-row-retracted"]')).toHaveCount(1);
    await expect(ownerPage.locator('[data-testid="event-retracted-mark"]')).toHaveText('zurückgenommen');
  });

  test('Helfer nach Abpfiff: gesetzte Nummer gesperrt, leere ergänzbar (App + DB)', async ({ asRole }) => {
    const { ids, target } = cup('HELPERAMEND');
    const seededRows = await expectSeededEngineMatch(target);
    const goalHomeId = engineEventId('HELPERAMEND', 'goal-home');
    const goalAwayId = engineEventId('HELPERAMEND', 'goal-away');
    const helperPage = await asRole('helper');
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expect(helperPage.locator('[data-testid="scoreboard-state"]')).toHaveText('Abgepfiffen', { timeout: 15000 });

    // App: gesetzte Nummer 7 ist für den Helfer gesperrt.
    await helperPage.getByRole('button', { name: `TOR ${ids.homeTeamName} #7 bearbeiten` }).click();
    await expect(helperPage.locator('[data-testid="event-edit-locked"]')).toHaveText('Korrektur nur durch die Turnierleitung');
    await helperPage.keyboard.press('Escape');

    // App: das Tor ohne Nummer lässt sich ergänzen, das Ergebnis bleibt 1:1.
    await helperPage.getByRole('button', { name: `TOR ${ids.awayTeamName} bearbeiten` }).click();
    await helperPage.locator('[data-testid="event-edit-number"]').fill('5');
    await helperPage.locator('[data-testid="event-edit-save"]').click();
    await expectOneNewRow(ids.matchId, seededRows, 'AMEND', goalAwayId);
    await expect(helperPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: 10000 });
    await helperPage.reload();
    await helperPage.waitForLoadState('networkidle');
    await expect(helperPage.getByText(`TOR ${ids.awayTeamName} #5`)).toBeVisible({ timeout: 15000 });
    await expect(helperPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1');
    await expect(helperPage.locator('[data-testid="scoreboard-box-rechts"]')).toHaveText('1');
    const row = await fetchMatchRow(ids.matchId);
    expect([row.score_a, row.score_b]).toEqual([1, 1]);

    // DB: der Server lehnt die Korrektur der gesetzten Nummer und die Rücknahme für den Helfer ab.
    const amendNr7 = await appendAsRole('helper', ids.matchId, [amendEvent(goalHomeId, 8)]);
    expect(amendNr7.results[0]).toMatchObject({ status: 'rejected', code: 'FORBIDDEN_ACTOR' });
    const retract = await appendAsRole('helper', ids.matchId, [
      { id: randomUUID(), type: 'RETRACT', at: Date.now(), section: 1, clockMs: 0, teamId: null, targetId: goalHomeId, payload: {} },
    ]);
    expect(retract.results[0].status).toBe('rejected');
    test.info().annotations.push({ type: 'Helfer-RETRACT nach Abpfiff', description: `Code ${retract.results[0].code}` });
    // Gegenbeispiel: dieselbe Korrektur als Owner wird angenommen.
    const asOwner = await appendAsRole('owner', ids.matchId, [amendEvent(goalHomeId, 8)]);
    expect(asOwner.results[0].status).toBe('accepted');
  });

  test('Helfer pfeift an (App + DB)', async ({ asRole }) => {
    const { ids, target } = cup('HELPERSTART');
    const seededRows = await expectSeededEngineMatch(target);
    const helperPage = await asRole('helper');
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await helperPage.locator('[data-testid="match-start-button"]').click();
    await expectEngineMatchRunningUi(helperPage);

    const startId = await expectOneNewRow(ids.matchId, seededRows, 'MATCH_START');
    expect(await fetchEventAuthorUserId(startId)).toBe(await fetchUserIdByEmail(E2E_USERS.helper.email));
    expect((await fetchMatchRow(ids.matchId)).match_status).toBe('running');
  });

  test('Gelb-Rot über zwei Geräte: Owner-Protokoll zeigt Gelb-Rot, DB genau eine YELLOW_RED_CARD-Zeile', async ({ asRole }) => {
    const { ids, target } = cup('GELBROT');
    const seededRows = await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    const helperPage = await asRole('helper');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(ownerPage);
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(helperPage);

    await tippeKarte(helperPage, 'home', 'Gelb-Rot', 4);

    // Gelb-Rot-spezifisch: Gelb-Rot-Symbol (geteilte Fläche) und Beschriftung in derselben Zeile, nicht das Rot-Symbol
    // (Karten-Farben nur für Karten, Oberfläche E: Symbol statt Emoji).
    const zeile = ownerPage.locator('span', { has: ownerPage.getByTestId('karten-symbol-YELLOW_RED') })
      .filter({ hasText: `Gelb-Rot ${ids.homeTeamName} #4` }).filter({ visible: true });
    await expect(zeile.first()).toBeVisible({ timeout: 5000 });
    await expect(zeile.first().getByTestId('karten-symbol-RED')).toHaveCount(0);
    const rowId = await expectOneNewRow(ids.matchId, seededRows, 'YELLOW_RED_CARD');
    expect(rowId).toBeTruthy();
    expect((await fetchEngineRows(ids.matchId)).filter((row) => row.type === 'RED_CARD')).toHaveLength(0);
  });
});

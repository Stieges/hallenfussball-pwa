/**
 * tests/e2e/cloud/two-devices.cloud.spec.ts — Zwei Geräte: Echtzeit ohne Neuladen.
 *
 * A-23 (übernimmt C3b-3a): Ergebnisse schreibt die App nur noch über Ereignisse
 * (`append_match_events`). Jeder schreibende Test hat deshalb sein EIGENES Turnier ("Engine-Cup",
 * `engineCups.ts`) mit genau einem Spiel, das der Seed per RPC angelegt hat -- keine gemeinsame
 * Fixture mehr, kein `serial`. Rückbau per Spalten-PATCH oder Soft-Delete gibt es nicht: ein
 * verbrauchter Cup braucht `npm run test:env:seed`, `expectSeededEngineMatch` meldet das als
 * ersten Schritt jedes Tests. Alle Tests navigieren mit `?matchId=` (kein stilles Umschalten) und
 * laufen nur auf `cloud-desktop`, damit Desktop und Mobil nicht denselben Cup benutzen.
 *
 * Bekannte Grenzen (kein Nachweis für diese Szenarien): Tor-Sichtbarkeit unter Hallen-WLAN
 * (300 ms, 5 % Verlust) -> C4a/C4b; Monitor <= 3 s -> C4b (C-MONPOLL); "Ohne Netz geht nichts
 * verloren" (10 s + Zeitstrafe) -> C4a, die 10 s deckt der F4-Unit-Test.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import {
  engineCupTarget,
  expectEngineMatchRunningUi,
  expectSeededEngineMatch,
  fetchEngineRows,
  fetchUserIdByEmail,
  newRoleContext,
  openCockpit,
  runningEngineTarget,
} from './engineHelpers';
import {
  enterGoal,
  enterTimePenaltyWithoutNumber,
  expectLegacyQueueKeysEmpty,
  fetchFailedMutationTypes,
  fetchMatchRow,
  fetchQueuedMutationTypes,
  fetchTeamIdByName,
  fetchTeamName,
  safeCleanup,
  setTeamName,
} from './helpers';
import {
  E2E_USERS,
  E2E_PUBLIC_CUP_ID,
  E2E_PUBLIC_CUP_MONITOR_ID,
  engineCupIds,
  type EngineCupSlug,
} from './testData';

const owner3sMs = 3000;

function cup(slug: EngineCupSlug) {
  return { ids: engineCupIds(slug), target: engineCupTarget(slug) };
}

test.describe('Zwei Geräte: Echtzeit ohne Neuladen', () => {
  // Playwright verlangt syntaktisch ein Destrukturierungs-Muster als erstes Argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop (kein gleichzeitiger Mobil-Lauf auf demselben Cup).');
  });

  test('Cup TOR: helper trägt Tor ein, owner sieht es im Cockpit innerhalb von 3s', async ({ asRole }) => {
    const { ids, target } = cup('TOR');
    await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    const helperPage = await asRole('helper');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(ownerPage);
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(helperPage);

    const ownerHomeScore = ownerPage.locator('[data-testid="scoreboard-box-links"]');
    await expect(ownerHomeScore).toHaveText('1');
    await enterGoal(helperPage, 'home');
    // Kein page.reload(): Timeout 3000 ms IST der Beweis "ohne Neuladen innerhalb von 3 s".
    await expect(ownerHomeScore).toHaveText('2', { timeout: owner3sMs });
  });

  test('Cup FINISH: helper beendet das Spiel, owner sieht BEENDET ohne Neuladen, genau eine MATCH_END-Zeile, keine gescheiterte SAVE_TOURNAMENT-Mutation (Task A1)', async ({ asRole }) => {
    const { ids, target } = cup('FINISH');
    const seededRows = await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    const helperPage = await asRole('helper');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(ownerPage);
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(helperPage);

    await helperPage.locator('[data-testid="match-finish-button"]').click();

    await expect(ownerPage.locator('[data-testid="scoreboard-state"]')).toHaveText('Abgepfiffen', { timeout: owner3sMs });
    await expect(ownerPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1');
    await expect(ownerPage.locator('[data-testid="scoreboard-box-rechts"]')).toHaveText('0');

    await expect.poll(async () => (await fetchEngineRows(ids.matchId)).filter((row) => row.type === 'MATCH_END').length, {
      message: 'genau eine MATCH_END-Zeile (manueller Abpfiff)',
      timeout: 5000,
    }).toBe(1);
    expect((await fetchEngineRows(ids.matchId)).length).toBe(seededRows + 1);
    const row = await fetchMatchRow(ids.matchId);
    expect([row.match_status, row.score_a, row.score_b]).toEqual(['finished', 1, 0]);

    // Regressionsschutz Task A1: kein gescheiterter voller Turnier-Save im Ausgang des Helfers.
    const helperUserId = await fetchUserIdByEmail(E2E_USERS.helper.email);
    expect(await fetchFailedMutationTypes(helperPage, helperUserId)).not.toContain('SAVE_TOURNAMENT');
    await expect.poll(() => fetchQueuedMutationTypes(helperPage, helperUserId), {
      message: 'mutation_queue_v1:<Konto> darf nach Spielende keine SAVE_TOURNAMENT-Mutation des Helfers enthalten',
      timeout: 2000,
    }).not.toContain('SAVE_TOURNAMENT');
    await expectLegacyQueueKeysEmpty(helperPage);
    // Nach dem Abpfiff zeigt der Helfer-Kopf kein sync-status mehr (Spiel beendet, nur ein Spiel im
    // Turnier): geprüft wird, dass nichts abgelehnt wurde -- die Annahme der MATCH_END-Zeile steht oben.
    await expect(helperPage.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
    // Hinweis: Das Cockpit nach dem Abpfiff des letzten Spiels zeigt seit Cockpit 2.5 die Tafel „Kein weiteres Spiel“ (behoben:
    // C-COCKPIT-LAEDT-NACH-ABPFIFF); die Aussage `data-pending="0"` beim Helfer steht im Test "Cup FINISHAUSGANG".
    // Beim Owner, dessen Cockpit „Abgepfiffen“ zeigt, gilt sie sofort:
    await expect(ownerPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: owner3sMs });
  });

  test('Cup FINISHAUSGANG: nach dem Abpfiff des letzten Spiels zeigt der Helfer-Ausgang data-pending="0" (C-COCKPIT-LAEDT-NACH-ABPFIFF)', async ({ asRole }) => {
    // Behoben mit Cockpit 2.5: Nach dem Abpfiff des LETZTEN Spiels steht die Tafel mit „Kein weiteres Spiel“ (@SL-054) statt „Spiel wird
    // geladen…“, und der SyncStatusIndicator in der Tafel zeigt den Ausgang des handelnden Geräts. Der Test erwartete bis dahin
    // einen Fehler (`test.fail`, Besitzer B-11); er läuft jetzt als normaler Test.
    const { ids, target } = cup('FINISHAUSGANG');
    await expectSeededEngineMatch(target);
    const helperPage = await asRole('helper');
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(helperPage);
    await helperPage.locator('[data-testid="match-finish-button"]').click();
    await expect.poll(async () => (await fetchEngineRows(ids.matchId)).filter((row) => row.type === 'MATCH_END').length, { timeout: 5000 }).toBe(1);
    await expect(helperPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '0', { timeout: 5000 });
  });

  test('Cup A2: owner speichert das Turnier mit veraltetem lokalen Stand, während helper ein Live-Spiel leitet: Toms Stand bleibt (Task A2)', async ({ asRole, browser }) => {
    const { ids, target } = cup('A2');
    await expectSeededEngineMatch(target);
    const originalTeamName = ids.awayTeamName;
    const newTeamName = `${originalTeamName} (A2 Test)`;
    const teamId = await fetchTeamIdByName(ids.tournamentId, originalTeamName);
    const { context: ownerContext, page: ownerPage } = await newRoleContext(browser, 'owner');
    ownerPage.on('dialog', (dialog) => { void dialog.accept(); });
    try {
      // Olli lädt die Teams-Seite VOR Toms Tor -- sein lokaler Stand kennt noch 1:0.
      await ownerPage.goto(`/#/tournament/${ids.tournamentId}/teams`);
      await ownerPage.waitForLoadState('networkidle');
      const teamCard = ownerPage.locator('[data-testid^="team-card-"]').filter({ hasText: originalTeamName });
      await expect(teamCard).toBeVisible({ timeout: 15000 });
      await ownerContext.setOffline(true);

      await teamCard.locator('[data-testid^="team-expand-toggle-"]').click();
      await teamCard.locator('[data-testid^="team-edit-button-"]').click();
      await teamCard.locator('[data-testid^="team-rename-input-"]').fill(newTeamName);
      await teamCard.locator('[data-testid^="team-rename-save-"]').click();

      const helperPage = await asRole('helper');
      await openCockpit(helperPage, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(helperPage);
      await enterGoal(helperPage, 'home');
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => row.score_a), {
        message: 'Toms Tor setzt den Zwischenspeicher score_a über die RPC auf 2',
        timeout: 10000,
      }).toBe(2);

      await ownerContext.setOffline(false);
      await expect.poll(() => fetchTeamName(teamId), {
        message: 'Der neue Teamname steht nach dem Reconnect in der DB',
        timeout: 15000,
      }).toBe(newTeamName);
      // DER KERNFIX: Ollis veralteter voller Save überschreibt Toms Live-Stand nicht.
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => row.score_a), { timeout: 5000 }).toBe(2);
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => row.match_status)).toBe('running');

      await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
      await expect(ownerPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('2', { timeout: 15000 });
    } finally {
      await safeCleanup('Owner-Context wieder online schalten (A2)', () => ownerContext.setOffline(false));
      await ownerContext.close();
      await safeCleanup('Teamname zurückbauen (A2)', () => setTeamName(teamId, originalTeamName));
    }
  });

  test('Public-Cup: owner trägt Tor ein, anonymer Monitor zeigt es ohne Reload (5s-Polling, kein Echtzeitpfad)', async ({ asRole, page: anonPage }) => {
    // R-3a-2: bleibt auf dem Public-Cup (der anonyme Monitor braucht ein öffentliches Turnier);
    // einziger Schreiber auf dem Engine-Laufspiel, Cockpit mit ?matchId=.
    const target = await runningEngineTarget(E2E_PUBLIC_CUP_ID, 'public-cup', 'Public-Cup');
    await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    await openCockpit(ownerPage, E2E_PUBLIC_CUP_ID, target.matchId);
    await expectEngineMatchRunningUi(ownerPage);

    await anonPage.goto(`/#/display/${E2E_PUBLIC_CUP_ID}/${E2E_PUBLIC_CUP_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');
    const monitorHomeBlock = anonPage.locator('[data-position="home"]');
    await expect(monitorHomeBlock).toBeVisible({ timeout: 15000 });
    const before = Number((await monitorHomeBlock.getAttribute('aria-label'))?.split(':')[1]?.trim());
    expect(Number.isFinite(before)).toBe(true);

    await enterGoal(ownerPage, 'home');
    // gemessen 7,0-7,9 s (5-s-Abfrage); Ziel <= 3 s verfehlt -> C-MONPOLL (C4b), Timeout nicht anfassen.
    await expect(monitorHomeBlock).toHaveAttribute('aria-label', `Heim: ${before + 1}`, { timeout: 12000 });
  });

  test('Cup NSTART: nie gestartetes Spiel lässt sich im Cockpit öffnen (C-NSTART)', async ({ asRole }) => {
    const { ids, target } = cup('NSTART');
    await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expect(ownerPage.getByText('Engine-Cup NSTART', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.locator('[data-testid="scoreboard-state"]')).toBeVisible({ timeout: 15000 });
    // Sichtbar, aber NICHT geklickt: das Spiel bleibt ungestartet.
    await expect(ownerPage.locator('[data-testid="match-start-button"]')).toBeVisible();
  });

  test('Cup UNDO: Rückgängig - der Eintrag bleibt auf beiden Geräten durchgestrichen sichtbar und zählt nicht mehr', async ({ asRole }) => {
    const { ids, target } = cup('UNDO');
    await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    const helperPage = await asRole('helper');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(ownerPage);
    await openCockpit(helperPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(helperPage);

    const helperHome = helperPage.locator('[data-testid="scoreboard-box-links"]');
    const ownerHome = ownerPage.locator('[data-testid="scoreboard-box-links"]');
    await enterGoal(helperPage, 'home');
    await expect(helperHome).toHaveText('2');
    await expect(ownerHome).toHaveText('2', { timeout: 5000 });

    await helperPage.locator('[data-testid="match-undo-button"]').click();
    await expect(helperHome).toHaveText('1');
    await expect(ownerHome).toHaveText('1', { timeout: 5000 });
    // Weg bleibt Rückgängig (G1a), nicht Löschen: der Eintrag steht durchgestrichen im Protokoll.
    await expect(ownerPage.locator('[data-testid="event-row-retracted"]')).toHaveCount(1, { timeout: 5000 });
    await expect(ownerPage.locator('[data-testid="event-retracted-mark"]')).toHaveText('zurückgenommen');
  });

  test('Cup SYNC: helper offline, zwei Tore - die Anzeige zeigt zwei wartende Einträge (C-SYNC)', async ({ browser }) => {
    const { ids, target } = cup('SYNC');
    await expectSeededEngineMatch(target);
    const { context, page } = await newRoleContext(browser, 'helper');
    try {
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      await context.setOffline(true);
      await enterGoal(page, 'home');
      await enterGoal(page, 'home');
      await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '2', { timeout: 5000 });
      await expect(page.locator('[data-testid="scoreboard-box-links"]')).toHaveText('3');
    } finally {
      await context.close();
    }
  });

  test('Cup REJECT: ein vom Server abgelehnter Eintrag ist sichtbar, zählt nicht, lässt sich mit "Verstanden" abhaken (C-SYNC Teil A)', async ({ asRole, browser }) => {
    const { ids, target } = cup('REJECT');
    const seededRows = await expectSeededEngineMatch(target);
    const { context: helperContext, page: helperPage } = await newRoleContext(browser, 'helper');
    try {
      await openCockpit(helperPage, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(helperPage);
      await helperContext.setOffline(true);
      await enterGoal(helperPage, 'home');
      // Anker: das Tor wartet im Ausgang, nichts ist abgelehnt.
      await expect(helperPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '1', { timeout: 5000 });
      await expect(helperPage.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);

      const ownerPage = await asRole('owner');
      await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(ownerPage);
      await ownerPage.locator('[data-testid="match-finish-button"]').click();
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => row.match_status), { timeout: 10000 }).toBe('finished');

      await helperContext.setOffline(false);
      await expect(helperPage.locator('[data-testid="sync-status-rejected"]')).toBeVisible({ timeout: 10000 });

      // Gegenbeispiel in der DB: das Tor des Helfers wurde NICHT übernommen (nur MATCH_END kam dazu).
      const rows = await fetchEngineRows(ids.matchId);
      expect(rows.length).toBe(seededRows + 1);
      expect(rows.filter((row) => row.type === 'GOAL')).toHaveLength(1);
      const row = await fetchMatchRow(ids.matchId);
      expect([row.score_a, row.score_b]).toEqual([1, 0]);

      await helperPage.locator('[data-testid="sync-status-rejected"]').click();
      await expect(helperPage.locator('[data-testid="outbox-rejected-panel"]')).toBeVisible();
      await expect(helperPage.locator('[data-testid="outbox-rejected-item"]')).toHaveCount(1);
      await helperPage.locator('[data-testid="outbox-rejected-dismiss"]').click();
      await expect(helperPage.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
      await expect(helperPage.locator('[data-testid="scoreboard-box-links"]')).toHaveText('1');
    } finally {
      await safeCleanup('Helfer-Context schließen (REJECT)', () => helperContext.close());
    }
  });

  test('@FU-002 Cup RECONNECT: helper offline, zwei Tore und eine Zeitstrafe - "3 Einträge warten", weiter eintragen, wieder online - beide Geräte zeigen nach 10 s denselben Stand', async ({ asRole, browser }) => {
    const { ids, target } = cup('RECONNECT');
    await expectSeededEngineMatch(target);
    const ownerPage = await asRole('owner');
    await openCockpit(ownerPage, ids.tournamentId, ids.matchId);
    await expectEngineMatchRunningUi(ownerPage);
    const { context, page: helperPage } = await newRoleContext(browser, 'helper');
    try {
      await openCockpit(helperPage, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(helperPage);
      await context.setOffline(true);
      await enterGoal(helperPage, 'home');
      await enterGoal(helperPage, 'home');
      await enterTimePenaltyWithoutNumber(helperPage, ids.awayTeamName);
      const helperStatus = helperPage.locator('[data-testid="sync-status"]');
      await expect(helperStatus).toHaveAttribute('data-pending', '3', { timeout: 5000 });
      await expect(helperStatus).toHaveAttribute('aria-label', /^3 Einträge warten/);
      // Das zweite Gerät sieht davon nichts, solange die Einträge warten.
      const penaltyRow = (page: Page) => page.locator('span', { hasText: /^⏱ 2 Min / });
      await expect(penaltyRow(ownerPage)).toHaveCount(0);
      // Ohne Unterbrechung weiter eintragen: ein Gegentor.
      await enterGoal(helperPage, 'away');
      await expect(helperStatus).toHaveAttribute('data-pending', '4', { timeout: 5000 });
      await context.setOffline(false);
      // Höchstens 10 s nach der Rückkehr des Netzes: beide Geräte zeigen denselben Stand (3:1) mit der Strafe.
      const deviceState = async (page: Page) => ({
        home: await page.locator('[data-testid="scoreboard-box-links"]').textContent(),
        away: await page.locator('[data-testid="scoreboard-box-rechts"]').textContent(),
        penalties: await penaltyRow(page).count(),
      });
      await expect
        .poll(async () => ({ helper: await deviceState(helperPage), owner: await deviceState(ownerPage) }), { timeout: 10000 })
        .toEqual({ helper: { home: '3', away: '1', penalties: 1 }, owner: { home: '3', away: '1', penalties: 1 } });
      await expect(helperStatus).toHaveAttribute('data-pending', '0', { timeout: 5000 });
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => [row.score_a, row.score_b]), { timeout: 5000 }).toEqual([3, 1]);
    } finally {
      await safeCleanup('Helfer-Context schließen (RECONNECT)', () => context.close());
    }
  });
});

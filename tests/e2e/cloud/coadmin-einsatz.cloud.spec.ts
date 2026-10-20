/**
 * tests/e2e/cloud/coadmin-einsatz.cloud.spec.ts -- CA-7 (Paket "Co-Admin einsatzfähig"): Zwei-Geräte-Nachweis gegen den
 * lokalen Stack. Setzt ALLE Migrationen voraus, auch `20261110_004_coadmin_einsatz.sql` (Co-Admin teilt online, liest
 * Lebenszeichen); ohne sie sind Z1, Z2 und Z3b rot (so gewollt, Mutationsprobe M1 des Plans).
 *
 * Szenarien: @BM-070 (Wer online teilen darf, Code bleibt), @ME-070 (Verbindungsstatus), @HE-085/-086/-087/-088 (Betreiber
 * trägt Co-Admin ein, Startseite, Austragen), @HE-062 (nie ohne Anfrage Mitglied), @AN-050 (Maria leitet weiter),
 * @FU-089 (Gegenrichtung: Marias Gerät folgt dem Stand der Cloud; Szenario-Vorschlag "Marias Tablet bleibt …", Kennung offen).
 *
 * Aufbau: jeder Fall legt über `coadminEinsatz.ts` eine EIGENE Kopie des Freigabe-Cup an (neue Ids, privat, Datum heute) und
 * räumt sie im `finally` ab -- unabhängig von anderen Dateien (publish-coadmin ändert den Freigabe-Cup selbst) und von der
 * Uhrzeit des Seeds (kein Engine-Spiel mit Zeitfenster). Nur cloud-desktop.
 *
 * Besitzer statt Befund bei Ungebautem: Z3 (Anzeige "Online" im Monitor-Editor) hängt an B-48b, Z6 (Gruppe abschließen,
 * Helfer-Anfrage zulassen) an A-16 -- dort `test.fail` bzw. `test.fixme` mit dem Besitzer im Titel.
 *
 * Fall Z5 benutzt die Betreiber-Vorlage wörtlich per `docker exec ... psql` im Datenbank-Container (Docker gibt es im
 * CI-Job `e2e-cloud`: der Stack läuft dort in Containern, `scripts/local-db-apply.sh` nutzt denselben Weg).
 */
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { expectEngineMatchRunningUi, fetchUserIdByEmail, newRoleContext, openCockpit } from './engineHelpers';
import { enterGoal, fetchFailedMutationTypes, fetchMatchRow, fetchQueuedMutationTypes, newFreshContext, readSessionAccessToken, safeCleanup } from './helpers';
import { restAsRole, serviceRest } from './restAsRole';
import { E2E_DRAFT_CUP_ID, E2E_LIVE_CUP_ID, E2E_USERS } from './testData';
import {
  addMember, cloneReleaseCup, coAdminRightsExpected, createAccount, cupRow, deleteAccount, deleteCup, localCopy, loginWithPassword,
  restWithToken, runVorlage, svc, type ClonedCup, type LocalCopy,
} from './coadminEinsatz';

/** Zeichenmenge des Servers (`generate_share_code`): kein 0, O, 1, I. */
const SERVER_CODE = /^[A-HJ-NP-Z2-9]{6}$/;


/** review-ca67 A4: nur die Teilen-Felder einer Turnier-Zeile. */
const sharingOf = (row: { is_public: boolean; share_code: string | null; share_code_created_at: string | null }) =>
  ({ is_public: row.is_public, share_code: row.share_code, share_code_created_at: row.share_code_created_at });

test.describe('CA-7 Co-Admin einsatzfähig (zwei Geräte, lokaler Stack)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopien je Fall, nur auf cloud-desktop.');
  });

  async function openVisibility(page: Page, cupId: string): Promise<void> {
    await page.goto(`/#/tournament/${cupId}/admin/visibility`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Turnier-Sichtbarkeit/ }).click(); // Sektion ist eingeklappt (Visibility/index.tsx)
  }

  /** Die Warteschlange des Geräts ist leer und nichts liegt im Dead-Letter (kein Rückfall-Eintrag, keine Störung). */
  async function expectQueueEmpty(page: Page, userId: string): Promise<void> {
    await expect.poll(() => fetchQueuedMutationTypes(page, userId), { timeout: 10000 }).toEqual([]);
    expect(await fetchFailedMutationTypes(page, userId)).toEqual([]);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Z1 / Z2: online teilen und zurücknehmen
  // ---------------------------------------------------------------------------------------------------------------
  test('@BM-070 @HE-085 Z1 Co-Admin teilt online: Server vergibt den Code im Serveralphabet, der Zuschauer-Link zeigt das Turnier, der Code bleibt beim erneuten Teilen', async ({ browser, page: anonymous }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('z1');
    const maria = await newRoleContext(browser, 'coadmin');
    try {
      const mariaId = await fetchUserIdByEmail(E2E_USERS.coadmin.email);
      const rpcCalls: string[] = [];
      const shareWrites: string[] = [];
      maria.page.on('request', (request) => {
        if (request.url().includes('/rpc/make_tournament_public')) { rpcCalls.push(request.method()); }
        if (request.method() === 'PATCH' && request.url().includes('/rest/v1/tournaments') && (request.postData() ?? '').includes('share_code')) { shareWrites.push(request.url()); }
      });
      expect(await cupRow(cup.id)).toMatchObject({ is_public: false, share_code: null }); // Vorbedingung

      await openVisibility(maria.page, cup.id);
      const radio = maria.page.getByRole('radio', { name: /Mit Link teilbar/ });
      await expect(radio).toBeEnabled({ timeout: 15000 });
      const response = maria.page.waitForResponse((r) => r.url().includes('/rpc/make_tournament_public'), { timeout: 15000 });
      await radio.click();
      expect((await response).status(), 'Serverpfad: die RPC nimmt die Co-Admin an').toBe(200);

      await expect.poll(async () => (await cupRow(cup.id)).is_public, { timeout: 10000 }).toBe(true);
      const shared = await cupRow(cup.id);
      expect(shared.share_code).toMatch(SERVER_CODE);
      expect(shared.share_code_created_at).not.toBeNull();
      expect(rpcCalls).toHaveLength(1);
      expect(shareWrites, 'kein Rückfall über ein direktes UPDATE').toEqual([]);
      await expectQueueEmpty(maria.page, mariaId);

      // Zuschauer: nur der Code, kein Konto
      await anonymous.goto(`/#/live/${shared.share_code}`);
      await anonymous.waitForLoadState('networkidle');
      await expect(anonymous.getByText(cup.title, { exact: true }).first()).toBeVisible({ timeout: 15000 });

      // Code bleibt beim erneuten Teilen (auch aus altem Stand, auch durch Olli): dieselbe Zeile, derselbe Zeitpunkt
      for (const role of ['coadmin', 'owner'] as const) {
        const again = await restAsRole(role, 'POST', 'rpc/make_tournament_public', { tournament_id: cup.id });
        expect(again.status, again.text).toBe(200);
        expect(JSON.stringify(again.json)).toContain(String(shared.share_code));
      }
      expect(await cupRow(cup.id)).toMatchObject({ share_code: shared.share_code, share_code_created_at: shared.share_code_created_at });
    } finally {
      await safeCleanup('Z1 Kopie löschen', () => deleteCup(cup.id));
      await maria.context.close();
    }
  });

  test('@BM-070 Z1 Gegenbeispiel Helfer: der Schalter fehlt, der Server lehnt das Teilen auch an der App vorbei ab, die Zeile bleibt unverändert', async ({ browser }) => {
    test.setTimeout(90_000);
    const cup = await cloneReleaseCup('z1h');
    const helper = await newRoleContext(browser, 'helper');
    try {
      await addMember(cup.id, await fetchUserIdByEmail(E2E_USERS.helper.email), 'collaborator', cup.ownerId);
      await helper.page.goto(`/#/tournament/${cup.id}/admin/visibility`);
      await helper.page.waitForLoadState('networkidle');
      await expect(helper.page.getByRole('radio', { name: /Mit Link teilbar/ })).toHaveCount(0);

      for (const target of [cup.id, E2E_LIVE_CUP_ID]) {
        const before = await cupRow(target);
        const refused = await restAsRole('helper', 'POST', 'rpc/make_tournament_public', { tournament_id: target });
        expect(refused.status, `Helfer darf ${target} nicht teilen`).toBeGreaterThanOrEqual(400);
        expect(refused.text).toContain('Not authorized');
        // nur die Teilen-Felder: andere Dateien ändern den Live-Cup parallel (Version, Ort) – review-ca67 A4
        expect(sharingOf(await cupRow(target))).toEqual(sharingOf(before));
      }
    } finally {
      await safeCleanup('Z1h Kopie löschen', () => deleteCup(cup.id));
      await helper.context.close();
    }
  });

  test('@BM-070 Z2 Co-Admin nimmt das Teilen zurück: der Zuschauer-Link zeigt danach "Turnier nicht gefunden"', async ({ browser, page: anonymous }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('z2');
    const maria = await newRoleContext(browser, 'coadmin');
    try {
      const code = 'ZWEITN';
      await svc('PATCH', `/rest/v1/tournaments?id=eq.${cup.id}`, { is_public: true, share_code: code, share_code_created_at: new Date().toISOString() });
      await anonymous.goto(`/#/live/${code}`);
      await anonymous.waitForLoadState('networkidle');
      await expect(anonymous.getByText(cup.title, { exact: true }).first()).toBeVisible({ timeout: 15000 }); // Vorbedingung: erreichbar

      await openVisibility(maria.page, cup.id);
      const privateRadio = maria.page.getByRole('radio', { name: /Privat/ });
      await expect(privateRadio).toBeEnabled({ timeout: 15000 });
      const response = maria.page.waitForResponse((r) => r.url().includes('/rpc/make_tournament_private'), { timeout: 15000 });
      await privateRadio.click();
      expect((await response).status()).toBeLessThan(300);
      await expect.poll(async () => (await cupRow(cup.id)).is_public, { timeout: 10000 }).toBe(false);
      expect((await cupRow(cup.id)).share_code).toBeNull();

      await anonymous.goto(`/#/live/${code}`);
      await anonymous.reload();
      await anonymous.waitForLoadState('networkidle');
      await expect(anonymous.getByText('Turnier nicht gefunden', { exact: true })).toBeVisible({ timeout: 15000 });
    } finally {
      await safeCleanup('Z2 Kopie löschen', () => deleteCup(cup.id));
      await maria.context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Z3: Verbindungsstatus der Monitore
  // ---------------------------------------------------------------------------------------------------------------
  test('@ME-070 Z3 Lebenszeichen: wer manageScreens hat, liest sie (Eigentümer, Co-Admin); Helfer und Fremde sehen keine Zeile', async () => {
    const cup = await cloneReleaseCup('z3b');
    const monitorId = randomUUID();
    try {
      // Das Lebenszeichen braucht eine Zeile in `monitors` (FK); die App schreibt sie noch nicht (Besitzer B-48b), also direkt.
      await svc('POST', '/rest/v1/monitors', [{ id: monitorId, tournament_id: cup.id, name: 'Z3b', type: 'schedule', config: {} }]);
      await svc('POST', '/rest/v1/monitor_heartbeats', [{ monitor_id: monitorId, tournament_id: cup.id, last_seen: new Date().toISOString(), slide_index: 0, cache_status: 'fresh' }]);
      await addMember(cup.id, await fetchUserIdByEmail(E2E_USERS.helper.email), 'collaborator', cup.ownerId);
      expect(await svc('GET', `/rest/v1/monitor_heartbeats?tournament_id=eq.${cup.id}&select=monitor_id`)).toHaveLength(1); // Vorbedingung

      const query = `monitor_heartbeats?tournament_id=eq.${cup.id}&select=monitor_id,last_seen`;
      for (const [role, rows] of [['owner', 1], ['coadmin', 1], ['helper', 0], ['stranger', 0]] as const) {
        const result = await restAsRole(role, 'GET', query);
        expect(result.status, role).toBe(200);
        expect(result.json, role).toHaveLength(rows);
      }
    } finally {
      await safeCleanup('Z3b Kopie löschen', () => deleteCup(cup.id));
    }
  });

  // B-48b (Besitzer): die App schreibt das Lebenszeichen noch nie in die Datenbank (`record_monitor_heartbeat` prüft die
  // verwaiste Tabelle `monitors`, die Monitore stehen im `config` des Turniers). Bis B-48b gebaut ist, ist dieser Fall
  // erwartet rot; wird er grün, muss `test.fail` fallen.
  test('@ME-070 Z3 Anzeige "Online" im Monitor-Editor bei Olli und Maria innerhalb von 40 s (Besitzer B-48b, Befund C-HEARTBEAT)', async ({ browser, page: anonymousMonitor }) => {
    test.fail(true, 'Besitzer B-48b: Lebenszeichen der Monitore kommen noch nicht in der Datenbank an.');
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('z3');
    const olli = await newRoleContext(browser, 'owner');
    const maria = await newRoleContext(browser, 'coadmin');
    try {
      await svc('PATCH', `/rest/v1/tournaments?id=eq.${cup.id}`, { is_public: true, share_code: 'DREIMN', share_code_created_at: new Date().toISOString() });
      await anonymousMonitor.goto(`/#/display/${cup.id}/${cup.monitorId}`);
      await anonymousMonitor.waitForLoadState('networkidle');
      for (const device of [olli.page, maria.page]) {
        await device.goto(`/#/tournament/${cup.id}/monitors`);
        await expect(device.getByText('Online', { exact: true })).toBeVisible({ timeout: 40000 });
      }
    } finally {
      await safeCleanup('Z3 Kopie löschen', () => deleteCup(cup.id));
      await olli.context.close();
      await maria.context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Z4: Marias Gerät bleibt über viele Änderungen von Olli auf dem Stand der Cloud
  // ---------------------------------------------------------------------------------------------------------------
  /** Marias bzw. Ollis lokale Kopie erfüllt `check` und trägt die Version der Cloud (höchstens 10 s, ein Abruf-Takt = 5 s). */
  async function expectDeviceFollowsCloud(page: Page, cup: ClonedCup, label: string, check: (copy: LocalCopy) => boolean): Promise<void> {
    await expect.poll(async () => {
      const copy = await localCopy(page, cup.id);
      const cloud = await cupRow(cup.id);
      return copy !== null && check(copy) && (copy.version ?? 1) === (cloud.version ?? 1);
    }, { message: label, timeout: 10000, intervals: [500] }).toBe(true);
  }

  /** Ort über die Oberfläche ändern (Einstellungen → "Metadaten bearbeiten"), danach zurück zum Spielplan. */
  async function editLocationInApp(page: Page, cup: ClonedCup, name: string): Promise<void> {
    await page.goto(`/#/tournament/${cup.id}/settings`);
    await page.waitForLoadState('networkidle');
    await page.getByText('Metadaten bearbeiten').click();
    await page.getByLabel(/^Veranstaltungsort/).fill(name); // per Beschriftung, nicht per Position (review-ca67 A4)
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect.poll(async () => (await cupRow(cup.id)).location_name, { timeout: 10000 }).toBe(name);
    await page.goto(`/#/tournament/${cup.id}/schedule`);
    await page.waitForLoadState('networkidle');
  }

  /** Ollis Voll-Speichern an der App vorbei: Änderung plus Versionszählung mit Versionsprüfung wie `SupabaseRepository.save`. */
  async function ollisFullSave(cup: ClonedCup, table: string, filter: string, change: Record<string, unknown>): Promise<void> {
    const version = (await cupRow(cup.id)).version ?? 1;
    const changed = await restAsRole('owner', 'PATCH', `${table}?${filter}`, change);
    expect(changed.status, changed.text).toBeLessThan(300);
    const bump = await restAsRole('owner', 'PATCH', `tournaments?id=eq.${cup.id}&version=eq.${version}`, { version: version + 1 });
    expect(bump.status, bump.text).toBeLessThan(300);
    expect(bump.json, 'Versionsprüfung trifft genau eine Zeile').toHaveLength(1);
  }

  test('@FU-089 Z4 Marias Gerät folgt fünf Änderungen von Olli mit der Cloud-Version, Maria speichert danach selbst und Olli sieht es, ohne Störung', async ({ browser }) => {
    test.setTimeout(240_000);
    const cup = await cloneReleaseCup('z4');
    const olli = await newRoleContext(browser, 'owner');
    const maria = await newRoleContext(browser, 'coadmin');
    try {
      const [mariaId, olliId] = [await fetchUserIdByEmail(E2E_USERS.coadmin.email), await fetchUserIdByEmail(E2E_USERS.owner.email)];
      const teamId = String((await svc('GET', `/rest/v1/teams?tournament_id=eq.${cup.id}&order=sort_order.asc&limit=1&select=id`))[0].id);
      for (const device of [olli.page, maria.page]) {
        await device.goto(`/#/tournament/${cup.id}/schedule`);
        await device.waitForLoadState('networkidle');
        await expect.poll(() => localCopy(device, cup.id), { timeout: 30000 }).not.toBeNull(); // beide haben die Kopie auf dem Gerät
      }

      // 1. über die App (Ollis Warteschlange sendet): Ort
      await editLocationInApp(olli.page, cup, 'Halle Z4-1');
      await expectDeviceFollowsCloud(maria.page, cup, 'Änderung 1 (Ort, App)', (c) => c.locationName === 'Halle Z4-1');
      // 2. Anstoßzeit des Spiels (Server zählt die Änderungszählung, nicht die Version)
      const versionBefore = (await cupRow(cup.id)).version;
      const kickoff = await restAsRole('owner', 'PATCH', `matches?id=eq.${cup.matchId}`, { scheduled_start: '17:11:00' });
      expect(kickoff.status, kickoff.text).toBeLessThan(300);
      expect((await cupRow(cup.id)).version, 'Anstoßzeit zählt die Version nicht').toBe(versionBefore);
      await expect(maria.page.getByText('17:11').first()).toBeVisible({ timeout: 10000 });
      await expectDeviceFollowsCloud(maria.page, cup, 'Änderung 2 (Anstoßzeit)', () => true);
      // 3. Teamname, 4. Ort, 5. Anstoßzeit noch einmal
      await ollisFullSave(cup, 'teams', `id=eq.${teamId}`, { name: 'CA7 Team Z4' });
      await expectDeviceFollowsCloud(maria.page, cup, 'Änderung 3 (Teamname)', (c) => c.teamNames.includes('CA7 Team Z4'));
      // 4. Ort wieder über die App: das Voll-Speichern der App schreibt immer auch die Teams (Realtime-Anstoß). Ein PATCH nur
      // auf `tournaments` (CI #312) ist kein Weg der App – die Tabelle ist nicht in der Realtime-Publikation (Befund
      // C-TURNIERZEILE-OHNE-ANSTOSS), Marias Gerät läse ihn erst beim nächsten Anstoß.
      await editLocationInApp(olli.page, cup, 'Halle Z4-4');
      await expectDeviceFollowsCloud(maria.page, cup, 'Änderung 4 (Ort, App)', (c) => c.locationName === 'Halle Z4-4');
      const kickoffAgain = await restAsRole('owner', 'PATCH', `matches?id=eq.${cup.matchId}`, { scheduled_start: '17:15:00' });
      expect(kickoffAgain.status, kickoffAgain.text).toBeLessThan(300);
      await expect(maria.page.getByText('17:15').first()).toBeVisible({ timeout: 10000 });
      await expectDeviceFollowsCloud(maria.page, cup, 'Änderung 5 (Anstoßzeit)', () => true);

      // Maria speichert selbst (über die App); Olli sieht es innerhalb von 10 s; nichts bleibt hängen, nichts wird abgelehnt
      await editLocationInApp(maria.page, cup, 'Marias Halle');
      await expectDeviceFollowsCloud(maria.page, cup, 'Marias eigenes Gerät nach dem Speichern', (c) => c.locationName === 'Marias Halle');
      await expectDeviceFollowsCloud(olli.page, cup, 'Ollis Gerät sieht Marias Änderung', (c) => c.locationName === 'Marias Halle');
      for (const [device, id] of [[maria.page, mariaId], [olli.page, olliId]] as const) {
        await expectQueueEmpty(device, id);
        await expect(device.getByTestId('sync-status-rejected')).toHaveCount(0);
      }
    } finally {
      await safeCleanup('Z4 Kopie löschen', () => deleteCup(cup.id));
      await olli.context.close();
      await maria.context.close();
    }
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Z5: Betreiber-Ablauf Ende zu Ende (Vorlage wörtlich), Z6: Rechte für "Maria leitet weiter"
  // ---------------------------------------------------------------------------------------------------------------
  const cardOf = (id: string): string => `[data-testid="tournament-card-${id}"]`;

  /** Karte suchen, auch wenn ihr Abschnitt zugeklappt ist. */
  async function expectCard(page: Page, id: string): Promise<void> {
    await expect(page.locator('[data-testid="section-draft"]')).toBeVisible({ timeout: 15000 });
    // je Abschnitt nur der Kopf (erstes [aria-expanded]); die „Aktionen“-Knöpfe der Karten tragen ebenfalls aria-expanded (CI #312)
    for (const section of await page.locator('[data-testid^="section-"]').all()) {
      const toggle = section.locator('[aria-expanded]').first();
      if ((await toggle.getAttribute('aria-expanded')) === 'false') { await toggle.click(); }
    }
    await expect(page.locator(cardOf(id))).toBeVisible({ timeout: 15000 });
  }

  /** Text der Seite "Nicht gefunden" (Überschrift, Meldung, Knopf) -- der Block, der für ein unbekanntes Turnier erscheint. */
  async function notFoundPageText(page: Page, hash: string): Promise<string> {
    await page.goto(hash);
    await page.waitForLoadState('networkidle');
    const heading = page.getByText(/nicht gefunden/i).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    return heading.locator('xpath=..').innerText();
  }

  test('@HE-086 @HE-085 @HE-088 @HE-087 @HE-062 @AN-050 Z5 Betreiber trägt Maria per Vorlage ein: vorher unsichtbar, danach Karte "Co-Admin", Eintragen und Olli sieht es, Kopie getrennt, Austragen sperrt das offene Gerät', async ({ browser }) => {
    test.setTimeout(300_000);
    const original = await cloneReleaseCup('z5-original', { withCoAdmin: false });
    const kopie = await cloneReleaseCup('z5-kopie', { withCoAdmin: false }); // Kopie fürs Proben: ohne Mitglieder (tournamentCopy.ts)
    const email = `maria.${randomUUID().slice(0, 8)}@example.invalid`;
    const device = await newFreshContext(browser);
    const olli = await newRoleContext(browser, 'owner');
    let mariaId: string | null = null;
    try {
      mariaId = await createAccount(email, 'Maria');
      const id = mariaId;
      // Anker: Marias Startseite lädt (Entwurf-Cup), sonst wäre "Karte fehlt" schon vor dem Laden wahr
      await addMember(E2E_DRAFT_CUP_ID, id, 'co-admin', original.ownerId);

      // Block 0 vorher: Konto da, bestätigt, keine Gerätesitzung, nicht eingetragen
      const before = runVorlage('0', original.id, email);
      expect(before.status, before.stderr).toBe(0);
      expect(before.rows).toHaveLength(1);
      expect([before.rows[0][0], before.rows[0][1], before.rows[0][3], before.rows[0][5], before.rows[0][6]]).toEqual([original.id, original.title, id, 'f', '']);

      // @HE-086: angemeldet, aber nicht eingetragen -> dieselbe Seite wie bei einem Turnier, das es nicht gibt; nicht auf der Startseite
      await loginWithPassword(device.page, email);
      const unknown = await notFoundPageText(device.page, `/#/tournament/${randomUUID()}/schedule`);
      const hidden = await notFoundPageText(device.page, `/#/tournament/${original.id}/schedule`);
      expect(hidden).toBe(unknown);
      expect(hidden).not.toContain(original.title);
      await device.page.goto('/#/');
      await expect(device.page.locator('[data-testid="section-draft"]')).toBeVisible({ timeout: 15000 });
      await expect(device.page.locator(cardOf(original.id))).toHaveCount(0);

      // @HE-062 Gegenprobe: Olli trägt Maria über die Schnittstelle ein (ohne ihre Anfrage) -> die Datenbank lehnt ab
      const refused = await restAsRole('owner', 'POST', 'tournament_collaborators', {
        tournament_id: kopie.id, user_id: id, role: 'co-admin', invited_by: original.ownerId, accepted_at: new Date().toISOString(),
      });
      expect(refused.status, refused.text).toBeGreaterThanOrEqual(400);
      expect(await svc('GET', `/rest/v1/tournament_collaborators?tournament_id=eq.${kopie.id}&user_id=eq.${id}&select=id`)).toHaveLength(0);

      // Vorlage: eintragen, wiederholen ändert nichts, prüfen
      const entered = runVorlage('1', original.id, email);
      expect(entered.status, entered.stderr).toBe(0);
      expect(entered.stderr).toContain(`Eingetragen: ${id}`);
      const again = runVorlage('1', original.id, email);
      expect(again.status, again.stderr).toBe(0);
      expect(again.stderr).toContain('Schon eingetragen');
      expect(runVorlage('2a', original.id, email).rows).toEqual([['co-admin', 't', 't', 't']]);
      const { all, granted } = coAdminRightsExpected();
      const rights = runVorlage('2b', original.id, email).rows;
      expect(rights.map((row) => [row[1], row[2] === 't'])).toEqual(all.map((right) => [right, granted.has(right)]));
      expect(rights.every((row) => row[0] === id)).toBe(true);

      // @HE-085/@HE-088: nach dem Neuladen steht die Karte "Co-Admin" auf der Startseite, Maria öffnet das Turnier
      await device.page.reload();
      await expectCard(device.page, original.id);
      await expect(device.page.locator(`[data-testid="tournament-role-${original.id}"]`)).toHaveText('Co-Admin');
      await device.page.locator(cardOf(original.id)).click();
      await expect(device.page).toHaveURL(new RegExp(original.id), { timeout: 15000 });
      await expect(device.page.getByText(original.title).first()).toBeVisible({ timeout: 15000 });

      // Olli hat den Spielplan offen; Maria ändert die Anstoßzeit (manageSchedule, mit ihrem eigenen Schlüssel) und trägt ein Ergebnis ein
      await olli.page.goto(`/#/tournament/${original.id}/schedule`);
      await olli.page.waitForLoadState('networkidle');
      const token = await readSessionAccessToken(device.page);
      expect(token).not.toBeNull();
      const moved = await restWithToken(String(token), 'PATCH', `matches?id=eq.${original.matchId}`, { scheduled_start: '17:23:00' });
      expect(moved.status, moved.text).toBeLessThan(300);
      expect(moved.json).toHaveLength(1);
      await expect(olli.page.getByText('17:23').first()).toBeVisible({ timeout: 10000 });

      await openCockpit(device.page, original.id, original.matchId);
      await device.page.locator('[data-testid="match-start-button"]').click();
      await expectEngineMatchRunningUi(device.page);
      await enterGoal(device.page, 'home');
      await expect.poll(() => fetchMatchRow(original.matchId).then((row) => [row.score_a, row.score_b]), { timeout: 15000 }).toEqual([1, 0]);
      await expect(olli.page.locator(`[data-testid="match-circle-${original.matchId}"]`)).toContainText('1:0', { timeout: 10000 });

      // Kopie fürs Proben: Maria hat dort keinen Zugang, bis der Betreiber sie dort ebenfalls einträgt (@HE-085 "Aber")
      expect(await restWithToken(String(token), 'GET', `tournaments?id=eq.${kopie.id}&select=id`)).toMatchObject({ status: 200, json: [] });
      const kopieUrl = `/#/tournament/${kopie.id}/schedule`;
      expect(await notFoundPageText(device.page, kopieUrl)).toBe(unknown);
      expect(runVorlage('1', kopie.id, email).status).toBe(0);
      await device.page.goto(kopieUrl);
      await device.page.reload();
      await expect(device.page.getByText(kopie.title).first()).toBeVisible({ timeout: 15000 });

      // @HE-087: Betreiber trägt Maria aus dem Original aus; das schon offene Gerät kann nichts mehr eintragen.
      // Zwei gültige Ergebnisse (review-ca67 A4): der Tor-Knopf ist schon weg (Rechte neu gelesen) – oder Maria tippt, und das
      // Gerät zeigt „nicht übernommen“ bzw. nach mindestens 10 s noch „wartet“. Der kurze „wartet“-Zustand direkt nach dem
      // Tippen zählt nicht. In beiden Fällen bleibt der Spielstand am Server über die ganze Frist 1:0.
      await openCockpit(device.page, original.id, original.matchId);
      await expectEngineMatchRunningUi(device.page);
      const austragen = runVorlage('3', original.id, email);
      expect(austragen.status, austragen.stderr).toBe(0);
      expect(austragen.rows).toHaveLength(1);
      if (await device.page.getByTestId('goal-button-home').isVisible()) {
        await enterGoal(device.page, 'home');
        const getippt = Date.now();
        await expect.poll(async () => {
          if (await device.page.getByTestId('sync-status-rejected').count() > 0) { return 'nicht übernommen'; }
          const wartet = await device.page.getByTestId('engine-outbox-waiting').count() > 0;
          return wartet && Date.now() - getippt >= 10_000 ? 'wartet' : 'offen';
        }, { message: 'der Server übernimmt das Tor nicht, das Gerät zeigt es', timeout: 25000, intervals: [1000] }).not.toBe('offen');
      }
      for (let blick = 0; blick < 5; blick++) { // über eine Frist stabil, nicht nur ein Blick direkt nach dem Tippen
        expect((await fetchMatchRow(original.matchId)).score_a, 'Server hat das zweite Tor nicht übernommen').toBe(1);
        await device.page.waitForTimeout(1000);
      }

      // nach dem Neuladen: Karte weg (auch nicht als "nur lokales" Turnier), die Kopie bleibt; Konto und frühere Einträge bleiben
      await device.page.goto('/#/');
      await device.page.reload();
      await expectCard(device.page, kopie.id);
      await expect(device.page.locator(cardOf(original.id))).toHaveCount(0);
      expect(await svc('GET', `/rest/v1/profiles?id=eq.${id}&select=id`)).toHaveLength(1);
      expect((await svc('GET', `/rest/v1/match_event_authors?tournament_id=eq.${original.id}&user_id=eq.${id}&select=event_id`)).length).toBeGreaterThanOrEqual(1);
    } finally {
      await safeCleanup('Z5 Kopien löschen', async () => { await deleteCup(original.id); await deleteCup(kopie.id); });
      const id = mariaId;
      if (id !== null) {
        await safeCleanup('Z5 Anker-Mitgliedschaft entfernen', async () => { await svc('DELETE', `/rest/v1/tournament_collaborators?tournament_id=eq.${E2E_DRAFT_CUP_ID}&user_id=eq.${id}`); });
        await safeCleanup('Z5 Konto löschen', () => deleteAccount(id));
      }
      await device.context.close();
      await olli.context.close();
    }
  });

  test('@AN-050 Z6 Maria leitet weiter: nach dem Eintrag hat sie die Rechte, Gruppe abzuschließen (manageLifecycle) und Helfer zuzulassen (manageHelpers), nie das Turnier zu löschen', async ({ browser }) => {
    test.setTimeout(120_000);
    const cup = await cloneReleaseCup('z6', { withCoAdmin: false });
    const email = `maria.${randomUUID().slice(0, 8)}@example.invalid`;
    const device = await newFreshContext(browser);
    let mariaId: string | null = null;
    try {
      mariaId = await createAccount(email, 'Maria');
      expect(runVorlage('1', cup.id, email).status).toBe(0);
      await loginWithPassword(device.page, email); // frisches Gerät, Passwort
      const token = String(await readSessionAccessToken(device.page));
      for (const [right, expected] of [['manageLifecycle', true], ['manageHelpers', true], ['leadMatches', true], ['correctEvents', true], ['deleteTournament', false], ['manageMembers', false]] as const) {
        const answer = await restWithToken(token, 'POST', 'rpc/has_tournament_permission', { p_tournament_id: cup.id, p_permission: right });
        expect(answer.status, answer.text).toBe(200);
        expect(answer.json, right).toBe(expected);
      }
      const eigen = await serviceRest('GET', `tournament_collaborators?tournament_id=eq.${cup.id}&select=role`);
      expect(eigen.json).toEqual([{ role: 'co-admin' }]);
    } finally {
      await safeCleanup('Z6 Kopie löschen', () => deleteCup(cup.id));
      const id = mariaId;
      if (id !== null) { await safeCleanup('Z6 Konto löschen', () => deleteAccount(id)); }
      await device.context.close();
    }
  });

  // A-16 (Besitzer): die Oberfläche für "Helfer-Anfrage zulassen" und das Abschließen einer Gruppe auf Marias Tablet gibt es
  // erst mit dem Helfer-Beitritt; bis dahin belegt Z6 oben die Rechte am Server.
  test.fixme('@AN-050 Z6 Maria schließt eine Gruppe ab und lässt eine Helfer-Anfrage zu (Oberfläche, Besitzer A-16)', async () => {
    // Gegeben Maria ist Co-Admin und meldet sich auf einem frischen Gerät an
    // Wenn sie eine Gruppe abschließt und eine Helfer-Anfrage zulässt
    // Dann gelingt beides ohne Olli
  });
});

/**
 * tests/e2e/cloud/abmelden-geraete.cloud.spec.ts -- A-07d3: Abmelden, andere Geräte abmelden,
 * Konto-Trennung (Ende-zu-Ende gegen den lokalen Stack, zwei Browser-Kontexte = zwei Geräte).
 *
 * Szenarien:
 *   @AN-023 Abmelden am Handy, Tablet bleibt   (docs/anforderungen/2026-10-02_anmelden.md)
 *   @AN-024 Andere Geräte abmelden             (ebd.)
 *   @FU-006 Wartende Einträge unter fremdem Konto nicht übertragen
 *           (docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md)
 *
 * Je Fall ein EIGENES Konto (Eigentümer des Cups ABMELDEN1 / 2 / 3: `abmelden`, `abmeldenAn024`,
 * `abmeldenFu006`, siehe `E2E_ABMELDEN_OWNER`). „Auf allen anderen Geräten abmelden“ beendet jede
 * andere Sitzung desselben Kontos. Teilten sich die Fälle ein Konto, könnte der eine Fall die
 * Sitzung des anderen beenden. Die Fälle laufen nacheinander (serial), ein Cup je Fall. Ein
 * verbrauchter Cup braucht `npm run test:env:seed`. Wartezeiten nur über Ereignisse
 * (`expect`/`expect.poll`), kein `sleep`.
 *
 * Retries: Die serielle Gruppe setzt `retries: 0` (siehe `test.describe.configure` unten). Scheitert
 * ein Fall, wird er nicht wiederholt, sondern der erste echte Fehler bleibt sichtbar. Eine Wiederholung
 * der Gruppe scheitert ohnehin an „Seed verbraucht“. Neuer Lauf braucht neuen Seed.
 *
 * Abgrenzung (Lücken-Tabelle): Wartende Einträge beim Weg „von einem anderen Gerät abgemeldet“
 * (`remoteSignOut` meldet lokal ohne Warnung ab, der Ausgang bleibt) sind durch die Unit-Tests aus
 * A-07d2 abgedeckt (`AuthContext.remoteSignOut.test.tsx`), nicht durch diese Spec. Der Weg „eigenes
 * Abmelden mit wartendem Eintrag“ ist hier Ende-zu-Ende geprüft (@FU-006).
 */

import { test, expect } from './fixtures';
import {
  engineCupTarget,
  expectEngineMatchRunningUi,
  expectOutboxSettled,
  expectSeededEngineMatch,
  fetchEngineRows,
  openCockpit,
  simulateWakeFromSleep,
} from './engineHelpers';
import {
  countTournamentsByTitle,
  enterGoal,
  fetchAuthUserStatus,
  loginAsRole,
  logoutOtherDevicesViaUi,
  logoutViaUiConfirmingWarning,
  newFreshContext,
  readSessionAccessToken,
  seedGuestTournament,
} from './helpers';
import { E2E_STRANGER_CUP_ID, engineCupIds } from './testData';

const SIGNED_OUT_ELSEWHERE_TEXT = 'Du wurdest von einem anderen Gerät aus abgemeldet';
const GUEST_TOURNAMENT_TITLE = 'Probelauf';

// Keine Wiederholung: Die Cups sind nach einem Lauf verbraucht (Seed-Stand). Eine Wiederholung scheitert
// sicher an „Seed verbraucht“ und verdeckt nur den ersten, echten Fehler.
test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('Abmelden und andere Geräte', () => {
  // Playwright verlangt syntaktisch ein Destrukturierungs-Muster als erstes Argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Abmelde-Cups nur auf cloud-desktop (je Fall ein Konto und ein Cup, serielle Fälle).');
  });

  test('@AN-023 Handy meldet ab, Tablet bleibt angemeldet und trägt weiter ein', async ({ browser }) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('ABMELDEN1');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('ABMELDEN1'));
    const handy = await newFreshContext(browser);
    const tablet = await newFreshContext(browser);
    try {
      await loginAsRole(handy.page, 'abmelden');
      await loginAsRole(tablet.page, 'abmelden');
      for (const { page } of [handy, tablet]) {
        await openCockpit(page, ids.tournamentId, ids.matchId);
        await expectEngineMatchRunningUi(page);
        await expectOutboxSettled(page);
      }
      const tabletToken = await readSessionAccessToken(tablet.page);
      const handyToken = await readSessionAccessToken(handy.page);
      if (!tabletToken || !handyToken) {
        throw new Error('Beide Geräte müssen eine Sitzung haben (sb-*-auth-token fehlt).');
      }
      expect(await fetchAuthUserStatus(handyToken)).toBe(200);

      // Kontrolle (Gegenbeispiel 1): auch ohne Abmelden trägt das Tablet ein -> Zeile in der DB.
      await enterGoal(tablet.page, 'home');
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 10000 }).toBe(baseRows + 1);

      // Handy: ein Eintrag wartet (Übertragung abgefangen), dann abmelden mit Warnung.
      await handy.page.route('**/rest/v1/rpc/append_match_events', (route) => route.abort('internetdisconnected'));
      await enterGoal(handy.page, 'away');
      await expect(handy.page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '1', { timeout: 5000 });
      await logoutViaUiConfirmingWarning(handy.page, 1);

      // Handy wirklich abgemeldet: lokal kein Zugang mehr, auch nach Neuladen; serverseitig Sitzung beendet.
      expect(await readSessionAccessToken(handy.page)).toBeNull();
      await handy.page.unroute('**/rest/v1/rpc/append_match_events');
      await handy.page.reload();
      await handy.page.waitForLoadState('networkidle');
      await expect(handy.page.locator('[data-testid="auth-avatar-button"]')).toHaveCount(0);
      expect(await fetchAuthUserStatus(handyToken)).toBe(403);
      // Das wartende Handy-Tor ist nicht in der DB (kein Konto, kein Senden).
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows + 1);

      // Tablet bleibt: Sitzung gilt am Server, nach Rückkehr in den Vordergrund weiter angemeldet
      // ohne Hinweis, und das nächste Tor kommt in der DB an (Pflichtprüfung des echten Wegs).
      expect(await fetchAuthUserStatus(tabletToken)).toBe(200);
      await simulateWakeFromSleep(tablet.page);
      await expect(tablet.page.locator('[data-testid="auth-avatar-button"]')).toBeVisible();
      await expect(tablet.page.locator('[data-testid="signed-out-elsewhere"]')).toHaveCount(0);
      await enterGoal(tablet.page, 'away');
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 10000 }).toBe(baseRows + 2);
      await expectOutboxSettled(tablet.page);
    } finally {
      await handy.context.close();
      await tablet.context.close();
    }
  });

  test('@AN-024 Tablet meldet alle anderen Geräte ab: Laptop sieht Hinweis, keine Konto-Daten; Tablet bleibt', async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('ABMELDEN2');
    await expectSeededEngineMatch(engineCupTarget('ABMELDEN2'));
    const laptop = await newFreshContext(browser);
    const tablet = await newFreshContext(browser);
    try {
      // Laptop: erst als Gast ein Probelauf-Turnier, dann anmelden. Es darf NICHT in die Cloud wandern.
      await laptop.page.goto('/#/');
      await laptop.page.waitForLoadState('networkidle');
      const guestId = await seedGuestTournament(laptop.page, GUEST_TOURNAMENT_TITLE);
      const guestCard = laptop.page.locator(`[data-testid="tournament-card-${guestId}"]`);
      // Vorbedingung: das Probelauf-Turnier ist im Gastmodus wirklich da (sonst wäre „nicht hochgeladen“ leer).
      await expect(guestCard).toBeVisible({ timeout: 15000 });
      await loginAsRole(laptop.page, 'abmeldenAn024');
      await laptop.page.goto('/#/');
      await laptop.page.waitForLoadState('networkidle');
      await expect(laptop.page.locator(`[data-testid="tournament-card-${ids.tournamentId}"]`)).toBeVisible({ timeout: 15000 });
      // Keine automatische Gast-Migration: nicht in der DB, und unter dem Konto auch nicht gezeigt.
      expect(await countTournamentsByTitle(GUEST_TOURNAMENT_TITLE)).toBe(0);
      await expect(guestCard).toHaveCount(0);
      // Gegenbeispiel zur späteren Prüfung: das Konto-Turnier öffnen, Titel sichtbar. So entsteht auf dem
      // Laptop die lokale Kopie, die nach der fremden Abmeldung verborgen sein muss (A-07e).
      await laptop.page.goto(`/#/tournament/${ids.tournamentId}`);
      await expect(laptop.page.getByText('Engine-Cup ABMELDEN2').first()).toBeVisible({ timeout: 15000 });
      await laptop.page.goto('/#/');
      await expect(laptop.page.locator(`[data-testid="tournament-card-${ids.tournamentId}"]`)).toBeVisible({ timeout: 15000 });

      // Tablet: anmelden (zweites Gerät), Gegenbeispiel vorab: sieht seine Turniere.
      await loginAsRole(tablet.page, 'abmeldenAn024');
      await tablet.page.goto('/#/');
      await expect(tablet.page.locator(`[data-testid="tournament-card-${ids.tournamentId}"]`)).toBeVisible({ timeout: 15000 });

      const laptopToken = await readSessionAccessToken(laptop.page);
      const tabletToken = await readSessionAccessToken(tablet.page);
      if (!laptopToken || !tabletToken) {
        throw new Error('Beide Geräte müssen vor „andere abmelden“ eine Sitzung haben.');
      }
      expect(await fetchAuthUserStatus(laptopToken)).toBe(200);
      await logoutOtherDevicesViaUi(tablet.page);
      // Serverseitig: Laptop-Sitzung beendet, Tablet-Sitzung gilt weiter.
      expect(await fetchAuthUserStatus(laptopToken)).toBe(403);
      expect(await fetchAuthUserStatus(tabletToken)).toBe(200);

      // Laptop steht auf dem Dashboard und kommt in den Vordergrund: Hinweis genau dort, ohne Navigation.
      await expect(laptop.page).toHaveURL(/#\/$/);
      await simulateWakeFromSleep(laptop.page);
      const notice = laptop.page.locator('[data-testid="signed-out-elsewhere"]');
      await expect(notice).toBeVisible({ timeout: 15000 });
      await expect(notice).toContainText(SIGNED_OUT_ELSEWHERE_TEXT);
      await expect(laptop.page).toHaveURL(/#\/$/);
      await expect(laptop.page.locator('[data-testid="auth-avatar-button"]')).toHaveCount(0);

      // Keine Konto-Inhalte mehr: Turnierliste ohne die Abmelde-Cups, direkter Aufruf zeigt nichts davon.
      // Nur der Cup dieses Kontos (ABMELDEN2) war vorher sichtbar; die Cups anderer Konten waren es nie.
      await expect(laptop.page.locator(`[data-testid="tournament-card-${ids.tournamentId}"]`)).toHaveCount(0);
      await laptop.page.goto(`/#/tournament/${ids.tournamentId}`);
      // Erst auf den Endzustand warten (das Laden aus dem lokalen Speicher erzeugt keinen Netzverkehr,
      // `networkidle` reicht nicht): „Lade Turnier…“ weg und „Turnier nicht gefunden“ da.
      await expect(laptop.page.getByText('Turnier nicht gefunden', { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(laptop.page.getByText('Lade Turnier')).toHaveCount(0);
      await expect(laptop.page.getByText('Engine-Cup ABMELDEN2')).toHaveCount(0);
      await expect(laptop.page.getByText('Heim ABMELDEN2')).toHaveCount(0);
      await expect(laptop.page.locator('[data-testid="auth-avatar-button"]')).toHaveCount(0);

      // Beobachtung (nicht als Pflicht-Assertion, Befund C-MONITOR-LOKAL-ROH): was zeigt die Monitor-Seite?
      await laptop.page.goto(`/#/display/${ids.tournamentId}/beobachtung`);
      await laptop.page.waitForLoadState('networkidle');
      await laptop.page.getByText('Lade...').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
      const monitorText = (await laptop.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
      testInfo.annotations.push({ type: 'Beobachtung Monitor nach Abmelden', description: monitorText });
      await testInfo.attach('monitor-nach-abmelden', { body: await laptop.page.screenshot(), contentType: 'image/png' });

      // Das Probelauf-Turnier ist auch jetzt nicht in der Cloud.
      expect(await countTournamentsByTitle(GUEST_TOURNAMENT_TITLE)).toBe(0);

      // Tablet bleibt: nach Vordergrund weiter angemeldet, Turniere sichtbar, kein Hinweis.
      await tablet.page.goto('/#/');
      await simulateWakeFromSleep(tablet.page);
      await expect.poll(() => readSessionAccessToken(tablet.page), { timeout: 10000, message: 'Tablet behält seine Sitzung' }).not.toBeNull();
      await expect(tablet.page.locator('[data-testid="auth-avatar-button"]')).toBeVisible();
      await expect(tablet.page.locator(`[data-testid="tournament-card-${ids.tournamentId}"]`)).toBeVisible({ timeout: 15000 });
      await expect(tablet.page.locator('[data-testid="signed-out-elsewhere"]')).toHaveCount(0);
    } finally {
      await laptop.context.close();
      await tablet.context.close();
    }
  });

  test('@FU-006 wartender Eintrag von Konto A wird unter Konto B nicht übertragen, unter A schon', async ({ browser }) => {
    test.setTimeout(180_000);
    const ids = engineCupIds('ABMELDEN3');
    const baseRows = await expectSeededEngineMatch(engineCupTarget('ABMELDEN3'));
    const { context, page } = await newFreshContext(browser);
    try {
      await loginAsRole(page, 'abmeldenFu006');
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      await expectOutboxSettled(page);

      // Offline drei Tore eintragen (3 Einträge warten, @FU-006), offline abmelden: Warnung „3 Einträge noch nicht übertragen“.
      await context.setOffline(true);
      for (let i = 0; i < 3; i++) {
        await enterGoal(page, 'home');
      }
      await expect(page.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '3', { timeout: 5000 });
      await logoutViaUiConfirmingWarning(page, 3);
      await context.setOffline(false);

      // Konto B meldet sich auf demselben Gerät an: der Eintrag von A geht nicht raus.
      await loginAsRole(page, 'stranger');
      await page.goto('/#/');
      await expect(page.locator(`[data-testid="tournament-card-${E2E_STRANGER_CUP_ID}"]`)).toBeVisible({ timeout: 15000 });
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
      // Die DB-Zeile allein beweist die Wache nicht: B hat auf ABMELDEN3 ohnehin keine Rechte, die RPC
      // würde ablehnen. Der Nachweis der Wache sind (1) B meldet sich ohne Warnung ab (für B wartet nichts)
      // und (2) die spätere Übertragung unter A (Eintrag noch da, kommt an).
      expect((await fetchEngineRows(ids.matchId)).length).toBe(baseRows);
      // Für B wartet nichts: kein „Eintrag noch nicht übertragen“ beim Abmelden (A's Eintrag gehört B nicht).
      await page.locator('[data-testid="auth-avatar-button"]').click();
      await page.locator('[data-testid="auth-logout-button"]').click();
      await expect.poll(() => readSessionAccessToken(page), { timeout: 10000, message: 'B meldet sich ohne Warnung ab' }).toBeNull();
      await expect(page.locator('[data-testid="logout-warning-dialog"]')).toHaveCount(0);

      // Konto A meldet sich wieder an: die 3 Einträge sind noch da und kommen jetzt in der DB an.
      await loginAsRole(page, 'abmeldenFu006');
      await openCockpit(page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(page);
      await expect.poll(async () => (await fetchEngineRows(ids.matchId)).length, { timeout: 20000 }).toBe(baseRows + 3);
      await expectOutboxSettled(page);
    } finally {
      await context.close();
    }
  });
});

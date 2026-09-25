/**
 * tests/e2e/cloud/two-devices.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 3. Abschluss-Review-Fixrunde (`final-review.md`, I2/Ruling AG,
 * `.superpowers/sdd/2026-09-24-testumgebung/final-fix-brief.md`) hat Test 2 und den ehemaligen
 * Test 4 grundlegend überarbeitet -- Details in den jeweiligen Testkommentaren unten.
 *
 * Drei Kontexte gleichzeitig (eigene Browser-Contexts, siehe `asRole()`/`browser.newContext()`):
 * helper (Kontext A) trägt ein Tor ein, owner (Kontext B, Cockpit) und ein anonymer Monitor
 * (Kontext C) sehen es ohne Neuladen -- alle Assertions pollen den DOM (`expect(...).toHaveText`),
 * es wird nie `page.reload()` aufgerufen.
 *
 * ABWEICHUNG vom Brief-Wortlaut (bewusst, siehe Report "Bedenken"): Der Brief beschreibt EIN
 * Tor, das gleichzeitig von helper eingetragen UND vom Monitor gesehen wird. `testData.ts`
 * (Task T2) gibt helper aber NUR eine Mitgliedschaft im Live-Cup -- keine im Public-Cup, dessen
 * Monitor-Route der Brief für Kontext C verlangt ("Monitor-Route des Public-Cup"). Ein Tor kann
 * strukturell nicht gleichzeitig in zwei verschiedenen Turnieren stehen. Diese Datei prüft
 * deshalb ZWEI getrennte, aber gleichwertige Echtzeit-Nachweise:
 *   1. Live-Cup: helper trägt das Tor ein, owner sieht es im selben Cockpit (Brief-Kern).
 *   2. Public-Cup: owner trägt ein Tor ein (einzige Rolle mit Zugriff auf beide Turniere), der
 *      anonyme Monitor (Kontext C) sieht es -- das ist der Teil des Briefs, der die
 *      Monitor-Route (`/display/:tournamentId/:monitorId`, mit Echtzeit-Subscription, ANDERS als
 *      `/live/:shareCode` aus `public-view.cloud.spec.ts`) tatsächlich beweist.
 * Für den Monitor selbst: der Seed-Monitor hatte `slides: []` (T2) -- ein `live`-Slide auf Feld 1
 * wurde ergänzt (`testData.ts#E2E_PUBLIC_CUP_MONITOR_ID`, `scripts/e2e-seed.ts`), sonst zeigt die
 * Route nur "keine Slides konfiguriert", nie das laufende Spiel.
 *
 * ZWEI ECHTE App-Fehler (nicht im Brief als "bekannt" gelistet, per Konsole-/Postgres-
 * Fehlermeldung reproduziert, siehe die T4-Reports UND `final-review.md`):
 *   A) Torereignisse erreichen `match_events` nie: `MatchExecutionService.recordGoal()`
 *      (`src/core/services/MatchExecutionService.ts:227`) erzeugt `event.id` als
 *      `"${matchId}-goal-${Date.now()}-${random}"` -- kein UUID. `mapMatchEventToSupabase()`
 *      (`src/core/repositories/liveMatchMappers.ts:136`) reicht `event.id` unverändert als
 *      `id`-Spalte an `match_events` durch, die `uuid NOT NULL` ist. Postgres lehnt jeden Insert
 *      ab: `invalid input syntax for type uuid: "…-goal-…"`. Betrifft JEDES über die Oberfläche
 *      eingetragene Tor, online wie offline. Die `matches`-ZEILE selbst (Score-Spalten) wird davon
 *      NICHT verhindert -- die Aktualisierung läuft VOR dem Events-Insert und schlägt unabhängig
 *      davon durch (siehe Test 1, seit Ruling W grün).
 *   B) Ein Spiel zum ERSTEN Mal zu laden (nie zuvor initialisiert, kein direkter DB-Bypass wie
 *      beim Seed) schlägt fehl: `STATUS_TO_DB.NOT_STARTED` (`liveMatchMappers.ts:42`) ist
 *      `'not_started'`, die DB-CHECK-Constraint `matches_match_status_check` erlaubt aber nur
 *      `'scheduled' | 'waiting' | 'running' | 'paused' | 'finished' | 'skipped'` -- Postgres 23514
 *      bei jedem allerersten `MatchExecutionService.initializeMatch()`-Lauf für ein Spiel
 *      ("C-NSTART", eigener Test unten seit Ruling AG).
 *
 * Fixrunde 1 (Ruling W): Die lokale Realtime-Publikation (`supabase_realtime`) war LEER --
 * `scripts/local-db-apply.sh` setzt sie jetzt idempotent auf dieselben vier Tabellen wie die
 * Produktion. Damit erreicht die `matches`-Zeilen-Aktualisierung aus Test 1 (Score, NICHT
 * blockiert von Fehler A) den Owner tatsächlich in Echtzeit -- Test 1 ist seitdem GRÜN.
 *
 * Ruling AG (final-fix-brief.md, I2): Der Seed setzt seitdem EIN Public-Cup-Spiel direkt auf
 * `matchStatus: 'running'` (wie beim Live-Cup, DIREKT per Service-Role, NIE über
 * `initializeMatch()` -- siehe `scripts/e2e-seed.ts`, Abschnitt "Public-Cup",
 * `testData.ts#E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE`). Test 2 (unten) trifft Fehler B dadurch
 * NICHT MEHR -- der Monitor-Echtzeit-Nachweis (Verifikation #6 des Plans) läuft jetzt WIRKLICH,
 * statt an einem vorgelagerten Bruchpunkt zu enden. Fehler B selbst bleibt real (jedes andere,
 * nie initialisierte Public-Cup-Spiel trifft ihn weiterhin) -- dafür gibt es jetzt einen eigenen,
 * kleinen Test ("C-NSTART" unten), der GENAU diesen Bruchpunkt isoliert und nichts anderes prüft.
 *
 * Fixrunde 1 (Nebenbefund beim Reproduzierbarkeits-Lauf, kein nummerierter Punkt, analog zum
 * M10-Fund in `public-view.cloud.spec.ts`): Der Live-Cup hat laut Seed GENAU EIN laufendes
 * Spiel. Test 1 und Test 3 ändern beide dessen Score, UND `cloud-desktop`/`cloud-mobile` laufen
 * `fullyParallel` gleichzeitig -- ohne Serialisierung interferieren bis zu vier parallele
 * Instanzen (2 Tests × 2 Projekte) mit demselben Datensatz (beobachtet: Test 3 scheiterte auf
 * `cloud-desktop` an einer Vorbedingung, weil `cloud-mobile`s Instanz zeitgleich denselben Score
 * veränderte). `test.describe.configure({ mode: 'serial' })` serialisiert ALLE Tests dieser Datei
 * INNERHALB eines Projekt-Laufs; `test.skip` beschränkt die Datei zusätzlich auf `cloud-desktop`
 * -- es gäbe sonst zwei GLEICHZEITIGE serielle Ketten (je Projekt eine) auf demselben Turnier.
 *
 * Fixrunde 2 (N4): Test 4 ("helper geht offline...", vorher eine eigene Datei
 * `offline.cloud.spec.ts`) wurde Teil DIESER `describe`-Gruppe statt einer eigenen Datei --
 * beide Dateien änderten bereits denselben Datensatz (das eine laufende Live-Cup-Spiel) und
 * brauchten deshalb ohnehin dieselbe Serialisierung.
 *
 * Ruling AG (final-fix-brief.md, I2): Der ehemalige Test 4 ist jetzt ZWEI Tests --
 * "Sync-Anzeige" (Test 5, `test.fail()` wegen C-SYNC) und "Offline-Tore kommen nach Reconnect an"
 * (Test 6, hängt NICHT von der -- kaputten -- Sync-Anzeige ab). Details in den jeweiligen
 * Testkommentaren.
 */

import { test, expect } from './fixtures';
import { AUTH_DIR } from './fixtures';
import {
  ensureMatchRunning,
  enterGoal,
  fetchRunningMatchId,
  fetchUntouchedMatchId,
  forceMatchRunning,
  resetRunningMatchScore,
  safeCleanup,
} from './helpers';
import {
  E2E_LIVE_CUP_ID,
  E2E_PUBLIC_CUP_ID,
  E2E_PUBLIC_CUP_MONITOR_ID,
  E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE,
  E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE,
} from './testData';
import path from 'node:path';

test.describe('Zwei Geräte: Echtzeit ohne Neuladen', () => {
  test.describe.configure({ mode: 'serial' });

  // Playwright verlangt syntaktisch ein Destrukturierungs-Muster als erstes Argument, auch wenn
  // keine Fixture gebraucht wird.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.includes('desktop'),
      'Live-Cup/Public-Cup haben je nur EIN laufendes Spiel, gemeinsam mit anderen Tests dieser Datei -- nur auf einem Projekt ausgeführt, siehe Kopfkommentar.'
    );
  });

  test('Live-Cup: helper trägt Tor ein, owner sieht es im Cockpit innerhalb von 3s', async ({ asRole }) => {
    try {
      const ownerPage = await asRole('owner');
      const helperPage = await asRole('helper');

      await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);

      await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await helperPage.waitForLoadState('networkidle');
      await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });

      const ownerHomeScore = ownerPage.locator('[data-testid="score-home"]');
      const before = Number(await ownerHomeScore.textContent());
      expect(Number.isFinite(before)).toBe(true);

      await enterGoal(helperPage, 'home');

      // Kein page.reload() -- expect() pollt den DOM selbst. Timeout=3000 IST der Beweis "ohne
      // Neuladen innerhalb von 3s" (Fundament-Zielgröße).
      await expect(ownerHomeScore).toHaveText(String(before + 1), { timeout: 3000 });
    } finally {
      // I6: Rückbau -- sonst koppelt dieser Test mit Test 6 (ehemals offline.cloud.spec.ts,
      // dasselbe laufende Live-Cup-Spiel) und mit sich selbst über aufeinanderfolgende Läufe
      // hinweg. N8: Konstante statt literaler `1, 0`. N16: `safeCleanup()` statt direktem Aufruf
      // -- ein scheiternder Rückbau darf die eigentliche Fehlermeldung dieses Tests nicht
      // verdecken (siehe `helpers.ts#safeCleanup`).
      await safeCleanup('Live-Cup Score zurücksetzen (Test 1)', () =>
        resetRunningMatchScore(
          E2E_LIVE_CUP_ID,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });

  /**
   * Ruling AG (final-fix-brief.md, I2): Der Seed setzt dieses Public-Cup-Spiel jetzt DIREKT auf
   * `running` (wie beim Live-Cup, siehe Kopfkommentar) -- `ensureMatchRunning()` ist hier nur
   * noch ein Beleg (Badge sichtbar, Pause-Button schon da, kein Start-Klick nötig), NICHT mehr
   * der Bruchpunkt selbst. Fehler B (C-NSTART) bleibt real, aber isoliert im eigenen Test unten
   * -- dieser Test hier prüft jetzt WIRKLICH den Echtzeit-Pfad des Monitors (Verifikation #6 des
   * Plans), vorher kam er nie so weit.
   *
   * Timeout 8000ms statt der 3000ms aus Test 1 (Live-Cup, Cockpit-zu-Cockpit): empirisch drei
   * stabile Läufe (final-fix-report.md) zeigen, dass die Monitor-Route ("/display/...") den
   * Score-Push konsistent nach ca. 4-5s zeigt, nie erst nach einem Reload -- spürbar langsamer als
   * der Cockpit-Pfad, aber echtes Realtime, kein Timeout-Zufallstreffer. Naheliegende Ursache
   * (nicht weiter verfolgt, bereits bekannter, dokumentierter Produktivbefund): der
   * `monitor:heartbeat`-Fehler in der Konsole bei jedem Lauf ("monitor/tournament mismatch or not
   * visible", siehe MEMORY.md "Heartbeat-Pipeline nie funktional").
   */
  test('Public-Cup: owner trägt Tor ein, anonymer Monitor sieht es in Echtzeit ohne Reload', async ({
    asRole,
    page: anonPage,
  }) => {
    try {
      const ownerPage = await asRole('owner');

      await ownerPage.goto(`/#/tournament/${E2E_PUBLIC_CUP_ID}/live`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);

      await anonPage.goto(`/#/display/${E2E_PUBLIC_CUP_ID}/${E2E_PUBLIC_CUP_MONITOR_ID}`);
      await anonPage.waitForLoadState('networkidle');

      const monitorHomeBlock = anonPage.locator('[data-position="home"]');
      await expect(monitorHomeBlock).toBeVisible({ timeout: 15000 });
      const beforeLabel = await monitorHomeBlock.getAttribute('aria-label'); // "Heim: <score>"
      const before = Number(beforeLabel?.split(':')[1]?.trim());
      expect(Number.isFinite(before)).toBe(true);

      await enterGoal(ownerPage, 'home');

      // Kein page.reload() -- expect() pollt den DOM selbst, siehe Timeout-Begründung oben.
      await expect(monitorHomeBlock).toHaveAttribute('aria-label', `Heim: ${before + 1}`, { timeout: 8000 });
    } finally {
      // I6/N8/N16, analog zu Test 1 -- derselbe Public-Cup-Score darf nicht zwischen Läufen
      // driften.
      await safeCleanup('Public-Cup Score zurücksetzen (Test 2)', () =>
        resetRunningMatchScore(
          E2E_PUBLIC_CUP_ID,
          E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });

  /**
   * Ruling AG (final-fix-brief.md, I2): eigener, kleiner Test für Fehler B ("C-NSTART") --
   * isoliert vom Echtzeit-Nachweis oben (Test 2), der seit Ruling AG das seed-`running`-Spiel
   * belegt, NICHT mehr diesen Bruchpunkt.
   *
   * Direktnavigation mit `?matchId=` (`TournamentManagementScreen.tsx#matchIdFromUrl`,
   * `fetchUntouchedMatchId()`) statt einer Dropdown-Auswahl: Ein manueller Wechsel über das
   * `<select>` löst bei einem bereits laufenden Spiel einen Bestätigungsdialog aus
   * (`ManagementTab.tsx#handleMatchSelectionChange`) -- reine UI-Interaktions-Komplexität, die mit
   * Fehler B selbst nichts zu tun hat. Der `?matchId=`-Pfad (`ManagementTab.tsx#initialMatchId`-
   * Effekt) setzt die Auswahl dagegen direkt und beendet ein laufendes Spiel ohne Dialog -- exakt
   * der Navigationsweg, über den auch "Zum Cockpit" aus dem Spielplan verlinkt. Nebeneffekt: das
   * seed-`running`-Spiel wird dabei ggf. beendet -- `forceMatchRunning()` im `finally` stellt es
   * unabhängig vom beobachteten Status wieder her (per ID, nicht per Status-Filter).
   */
  test('Public-Cup: nie initialisiertes Spiel starten scheitert (C-NSTART)', async ({ asRole }) => {
    const runningMatchId = await fetchRunningMatchId(E2E_PUBLIC_CUP_ID);
    const untouchedMatchId = await fetchUntouchedMatchId(E2E_PUBLIC_CUP_ID);

    try {
      const ownerPage = await asRole('owner');

      await ownerPage.goto(`/#/tournament/${E2E_PUBLIC_CUP_ID}/live?matchId=${untouchedMatchId}`);
      await ownerPage.waitForLoadState('networkidle');

      // Positiver Anker: die Route ist angekommen (Turniertitel sichtbar) -- NICHT
      // `match-status-badge`, das ist bereits Teil von Fehler B selbst (siehe final-review.md, C1
      // im Vorgänger-Review sowie der ursprüngliche Anker-Kommentar unter Test 2 oben).
      await expect(ownerPage.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });

      // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- alles oben (Route erreicht, das
      // nie gestartete Spiel ausgewählt) ist ein echter Vorgang, kein fälschlich "erwarteter"
      // Fehlschlag.
      test.fail();

      await expect(ownerPage.locator('[data-testid="match-status-badge"]')).toBeVisible({ timeout: 15000 });
    } finally {
      await safeCleanup('Public-Cup Running-Match wiederherstellen (C-NSTART)', () =>
        forceMatchRunning(
          runningMatchId,
          E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_PUBLIC_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });

  test('Ereignis löschen (Rückgängig): verschwindet überall', async ({ asRole }) => {
    try {
      const ownerPage = await asRole('owner');
      const helperPage = await asRole('helper');

      await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);

      await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await helperPage.waitForLoadState('networkidle');
      await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });

      const helperHomeScore = helperPage.locator('[data-testid="score-home"]');
      const ownerHomeScore = ownerPage.locator('[data-testid="score-home"]');
      const before = Number(await helperHomeScore.textContent());
      expect(Number.isFinite(before)).toBe(true); // I4: Guard.

      await enterGoal(helperPage, 'home');
      await expect(helperHomeScore).toHaveText(String(before + 1));
      // Owner muss den Zuwachs erst gesehen haben, bevor "Rückgängig" sinnvoll geprüft werden
      // kann -- seit Ruling W (Realtime-Fix) zuverlässig grün (siehe Test 1).
      await expect(ownerHomeScore).toHaveText(String(before + 1), { timeout: 5000 });

      // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- alles oben ist jetzt ein echter
      // Fehlschlag. Beobachtete Fehlermeldung (siehe Report): NICHT "Owner sieht das Tor nie"
      // (das war vor Ruling W der Fall) -- "Rückgängig" wirkt nicht einmal LOKAL beim helper
      // selbst (score-home bleibt auf dem erhöhten Wert stehen). Wahrscheinliche Ursache: der
      // nie persistierte Event (Fehler A) wird durch die jetzt funktionierende Realtime-
      // Aktualisierung der `matches`-Zeile aus dem lokalen `liveMatches`-Zustand verdrängt, bevor
      // "Rückgängig" (das das LETZTE Ereignis im lokalen Array sucht) es findet -- ein
      // Ereignis-Diff-Rückbau Richtung Cloud (bekannte Brief-Abweichung,
      // docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md) wurde dadurch nie
      // erreicht.
      test.fail();

      await helperPage.locator('[data-testid="match-undo-button"]').click();
      await expect(helperHomeScore).toHaveText(String(before));
      await expect(ownerHomeScore).toHaveText(String(before), { timeout: 5000 });
    } finally {
      // I6: Rückbau, unabhängig vom Ausgang. N8: Konstante statt literaler `1, 0`. N16:
      // `safeCleanup()`, s. Test 1.
      await safeCleanup('Live-Cup Score zurücksetzen (Test 3, Ereignis löschen)', () =>
        resetRunningMatchScore(
          E2E_LIVE_CUP_ID,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });

  /**
   * Ruling AG (final-fix-brief.md, I2): HÄLFTE 1 des ehemaligen Test 4 -- NUR die
   * Sync-Anzeige (`sync-status`), isoliert von der eigentlichen Frage "kommen die Tore nach
   * Reconnect an" (Test 6 unten). `showSyncStatus` wird der `AdminHeader` nirgends übergeben
   * (C-SYNC, unverändert seit dem ursprünglichen T4-Fund) -- das Element wird nie gerendert,
   * `toBeVisible()` läuft deshalb in ein Timeout statt einen echten Attribut-Mismatch.
   *
   * KEIN positiver Anker zwischen "offline schalten" und `test.fail()` (anders als eine
   * Zwischenfassung dieses Tests): der naheliegende Kandidat "`score-home` zeigt lokal schon
   * `before+2`" ist selbst NICHT verifiziert grün -- empirisch bleibt `score-home` beim helper
   * während `context.setOffline(true)` unverändert (5s Timeout, `final-fix-report.md`), ein neuer,
   * eigenständiger Befund neben C-SYNC. Ein Anker auf einer selbst nicht bestätigten Aussage wäre
   * kein echter Anker (I4) -- der letzte GESICHERTE Zustand vor `test.fail()` bleibt deshalb "Match
   * läuft, helper sieht das Cockpit" (vor dem Offline-Schalten).
   */
  test('helper geht offline, trägt zwei Tore ein: Sync-Anzeige (C-SYNC)', async ({ asRole, browser }) => {
    let helperContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
      const ownerPage = await asRole('owner');
      await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);

      // Eigener Context für helper (statt asRole()): braucht direkten Zugriff auf `context()`, um
      // `setOffline(true)` aufzurufen -- asRole() gibt nur die Page zurück. M3: `AUTH_DIR` aus
      // `fixtures.ts` statt eines zweiten, literal duplizierten Pfads.
      helperContext = await browser.newContext({
        storageState: path.join(AUTH_DIR, 'helper.json'),
      });
      const helperPage = await helperContext.newPage();
      await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await helperPage.waitForLoadState('networkidle');
      // Positiver Anker (letzter GESICHERTER Zustand, siehe Kommentar oben).
      await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });

      await helperContext.setOffline(true);
      await enterGoal(helperPage, 'home');
      await enterGoal(helperPage, 'home');

      // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- `sync-status` wird nirgends
      // gerendert (C-SYNC).
      test.fail();

      await expect(helperPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '2', {
        timeout: 5000,
      });
    } finally {
      if (helperContext) {
        await helperContext.close();
      }
      // I6: Rückbau -- offline eingetragene Tore werden nie synchronisiert (dieser Test geht nie
      // online), der Live-Cup-Score bleibt also unverändert. Trotzdem `safeCleanup()`, falls sich
      // das künftig ändert (z. B. nach einem Fundament-Fix).
      await safeCleanup('Live-Cup Score zurücksetzen (Test 5, Sync-Anzeige)', () =>
        resetRunningMatchScore(
          E2E_LIVE_CUP_ID,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });

  /**
   * Ruling AG (final-fix-brief.md, I2): HÄLFTE 2 des ehemaligen Test 4 -- die eigentliche Frage
   * "kommen zwei offline eingetragene Tore nach dem Reconnect beim Eigentümer an", OHNE über die
   * (kaputte) Sync-Anzeige zu warten (Test 5 oben deckt die separat ab). Statt `waitForSync()`
   * (das selbst `sync-status` voraussetzt und deshalb hier nie funktionieren würde) wartet dieser
   * Test direkt auf das eigentlich interessierende Signal -- den Score beim Owner --, mit einem
   * großzügigen Timeout für den Sync-Zyklus nach dem Reconnect.
   */
  test('helper geht offline, trägt zwei Tore ein, geht online -- owner sieht beide (ohne Sync-Anzeige)', async ({
    asRole,
    browser,
  }) => {
    let helperContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
      const ownerPage = await asRole('owner');
      await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);
      const ownerHomeScore = ownerPage.locator('[data-testid="score-home"]');
      const before = Number(await ownerHomeScore.textContent());
      expect(Number.isFinite(before)).toBe(true); // I4: Guard, ein NaN darf nie als "erwartet rot" durchgehen.

      helperContext = await browser.newContext({
        storageState: path.join(AUTH_DIR, 'helper.json'),
      });
      const helperPage = await helperContext.newPage();
      await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await helperPage.waitForLoadState('networkidle');
      await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });
      const helperHomeScore = helperPage.locator('[data-testid="score-home"]');

      await helperContext.setOffline(true);
      await enterGoal(helperPage, 'home');
      await enterGoal(helperPage, 'home');

      await helperContext.setOffline(false);

      // KEIN waitForSync() (das braucht `sync-status`, siehe Kopfkommentar) -- Playwrights
      // eigenes Polling in `expect(...).toHaveText()` übernimmt das Warten auf den Sync-Zyklus
      // nach dem Reconnect direkt am eigentlich interessierenden Signal. Timeout großzügiger als
      // bei den Online-Tests (3-5s) -- der Reconnect selbst braucht zusätzliche Zeit
      // (Netzwerk-Event, MutationQueue-Flush), bevor die erste PATCH/Realtime-Runde überhaupt
      // startet. Geprüft bei BEIDEN Seiten (helper UND owner) -- helper selbst bekommt sein
      // eigenes Tor beim Reconnect ggf. auch erst über denselben Sync-Zyklus zu sehen (siehe
      // Report: `score-home` bleibt beim helper WÄHREND offline unverändert, s. Test 5).
      await expect(helperHomeScore).toHaveText(String(before + 2), { timeout: 15000 });
      await expect(ownerHomeScore).toHaveText(String(before + 2), { timeout: 15000 });
    } finally {
      if (helperContext) {
        await helperContext.close();
      }
      // I6: Rückbau -- falls doch etwas durchschrieb, darf der Live-Cup-Score nicht dauerhaft
      // verändert bleiben. N8: Konstante statt `1, 0`. N16: `safeCleanup()`, s. Test 1.
      await safeCleanup('Live-Cup Score zurücksetzen (Test 6, Reconnect)', () =>
        resetRunningMatchScore(
          E2E_LIVE_CUP_ID,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });
});

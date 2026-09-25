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
 * deshalb ZWEI getrennte Nachweise „ohne Neuladen“ (Cockpit per Echtzeit, Monitor per Abfrage):
 *   1. Live-Cup: helper trägt das Tor ein, owner sieht es im selben Cockpit (Brief-Kern).
 *   2. Public-Cup: owner trägt ein Tor ein (einzige Rolle mit Zugriff auf beide Turniere), der
 *      anonyme Monitor (Kontext C) sieht es -- das ist der Teil des Briefs, der die
 *      Monitor-Route (`/display/:tournamentId/:monitorId`, Spielstand heute per 5-s-Abfrage, siehe C-MONPOLL; ANDERS als
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
  fetchFailedMutationTypes,
  fetchMatchEventIds,
  fetchRunningMatchId,
  fetchUntouchedMatchId,
  forceMatchRunning,
  resetRunningMatchScore,
  safeCleanup,
  softDeleteMatchEvents,
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
   * Task A1 (Sofortschutz, `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A1-brief.md`):
   * Vorher (`useMatchExecution.ts#handleFinish`) lud die App nach Spielende das ganze Turnier neu
   * und schrieb es per vollem `TournamentService.updateTournament` zurück -- für einen Helfer
   * (Rolle `collaborator`, kein `tournamentSettings`-Recht) trifft das per RLS 0 Zeilen →
   * `OptimisticLockError` → nach 5 Versuchen Dead-Letter in `mutation_queue_failed_v1`. Der Fix
   * ersetzt diesen Pfad durch ein rein lokales State-Update (`useTournamentManager().applyRemote`,
   * `useMatchExecution.ts#UseMatchExecutionProps.onLocalTournamentUpdate`) -- der Spielstand selbst
   * ist längst über `MatchExecutionService.persistFinalResult` (Match-Pfad, per `writeMatchData`
   * erlaubt) persistiert.
   */
  test('Helfer beendet das laufende Live-Cup-Spiel: owner sieht das Endergebnis ohne Neuladen, keine gescheiterte SAVE_TOURNAMENT-Mutation (Task A1)', async ({ asRole }) => {
    const runningMatchId = await fetchRunningMatchId(E2E_LIVE_CUP_ID);
    // I6/N16: Baseline VOR dem Finish -- finishMatch() legt ein neues STATUS_CHANGE-Ereignis an,
    // das im finally-Block gezielt zurückgebaut wird (siehe fetchMatchEventIds()-Kommentar).
    const eventIdsBeforeFinish = await fetchMatchEventIds(runningMatchId);
    try {
      const ownerPage = await asRole('owner');
      const helperPage = await asRole('helper');

      // Owner NAVIGIERT explizit mit `?matchId=` auf das laufende Spiel (wie der C-NSTART-Test
      // unten, `ManagementTab.tsx#initialMatchId`-Effekt) -- pinnt `selectedMatchId` fest auf
      // dieses Spiel. Ohne diesen Pin würde `currentMatchData` (ManagementTab.tsx, Auto-Wahl "das
      // laufende Spiel ODER das erste ohne Ergebnis") automatisch auf das NÄCHSTE, noch nicht
      // gestartete Spiel umschalten, sobald dieses Spiel den Status FINISHED erreicht -- das
      // Status-Badge würde dann ein ANDERES Spiel zeigen, nicht mehr das gerade beendete (in einem
      // Testlauf beobachtet: Badge sprang auf "NICHT GESTARTET" statt "BEENDET"). Der Pin macht
      // die Prüfung robust gegen dieses (gewollte) Auto-Advance-Verhalten der App.
      await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live?matchId=${runningMatchId}`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);

      await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await helperPage.waitForLoadState('networkidle');
      await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });

      await helperPage.locator('[data-testid="match-finish-button"]').click();

      // Kein page.reload() -- expect() pollt den DOM selbst. Timeout=3000 IST der Beweis "ohne
      // Neuladen innerhalb von 3s" (Fundament-Zielgröße, wie Test 1 oben). Erfordert den
      // SupabaseLiveMatchRepository-Fix aus diesem Task (siehe Kommentar dort,
      // `subscribe()`/`isMatchActive`) -- ohne ihn behandelte der Realtime-Kanal die
      // Spielende-Aktualisierung wie eine Löschung, das Owner-Cockpit blieb bei "LÄUFT" hängen.
      await expect(ownerPage.locator('[data-testid="match-status-badge"]')).toHaveText('BEENDET', { timeout: 3000 });

      // Kein gescheiterter Turnier-Save im Dead-Letter des Helfers -- der eigentliche Beweis
      // dieses Tasks (vorher: OptimisticLockError → Dead-Letter, siehe Kopfkommentar).
      const failedTypes = await fetchFailedMutationTypes(helperPage);
      expect(failedTypes).not.toContain('SAVE_TOURNAMENT');
    } finally {
      // Rückbau: Spiel wieder laufend setzen, wie im C-NSTART-Test unten -- sonst koppelt dieser
      // Test mit allen anderen Tests dieser Datei, die dasselbe laufende Live-Cup-Spiel brauchen.
      await safeCleanup('Live-Cup Spiel wieder laufend setzen (Helfer beendet Spiel, Task A1)', () =>
        forceMatchRunning(
          runningMatchId,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
      // I6/N16: das vom Finish angelegte STATUS_CHANGE-Ereignis gezielt zurückbauen (Diff gegen
      // die Baseline oben) -- sonst bleibt es mit einem hohen timestamp_seconds stehen und
      // verfälscht "letztes Ereignis" für den nächsten Test dieser Datei ("Ereignis löschen",
      // beobachtet: Rückgängig traf das alte Finish-Ereignis statt des neuen Tors).
      await safeCleanup('Live-Cup Finish-Ereignis zurückbauen (Helfer beendet Spiel, Task A1)', async () => {
        const eventIdsAfterFinish = await fetchMatchEventIds(runningMatchId);
        const newEventIds = eventIdsAfterFinish.filter((id) => !eventIdsBeforeFinish.includes(id));
        await softDeleteMatchEvents(newEventIds);
      });
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
   * Nach-Review (final-rereview.md, I-N1): Dieser Test beweist "ohne Reload", NICHT "in
   * Echtzeit" -- der Monitor liest den Spielstand nur aus `tournament.matches`
   * (`MonitorDisplayPage.tsx#toLiveMatch` -> `LiveMatchDisplay.tsx` -> `ScoreBlock.tsx`, alles
   * gespeist über `loadData()`), und `loadData()` läuft AUSSCHLIESSLICH per `setInterval`
   * (`MonitorDisplayPage.tsx:1116-1121`), nie per Realtime-Subscription. Der Seed-Monitor hat
   * `performanceMode: 'auto'`, das ergibt hier `high`, also einen 5000ms-Takt
   * (`src/types/monitor.ts:43`). `useLiveMatches` treibt auf dem Monitor nur die Tor-Animation
   * (hängt an `match_events`, wo wegen Fehler A oben nichts ankommt) -- für den Spielstand selbst
   * gibt es keinen Echtzeitpfad. Die gemessenen 7,0-7,9s (final-fix-report.md, drei stabile
   * Läufe) passen genau zum 5s-Poll-Takt plus Verarbeitungszeit -- NICHT "ca. 4-5s", wie eine
   * frühere Fassung dieses Kommentars widersprüchlich behauptete.
   *
   * Das Fundament-Ziel "<= 3s" (wie Test 1, Live-Cup Cockpit-zu-Cockpit, das per Echtzeit-
   * Publikation auf `matches` tatsächlich unter 3s bleibt) ist für den Monitor-Spielstand damit
   * NICHT erreicht -- eigener Befund C-MONPOLL ("Monitor-Spielstand nur per 5s-Polling, verfehlt
   * das 3s-Ziel"). Timeout bleibt bei 8000ms: knapp über dem 5s-Takt plus Verarbeitungszeit, aber
   * nah an den gemessenen 7,9s -- ein langsamerer CI-Runner kann diesen Test dadurch flaky
   * machen (bekanntes Restrisiko, festgehalten statt stillschweigend vergrößert, siehe
   * final-rereview.md).
   */
  test('Public-Cup: owner trägt Tor ein, anonymer Monitor zeigt es ohne Reload (5s-Polling, kein Echtzeitpfad)', async ({
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
      await expect(monitorHomeBlock).toHaveAttribute('aria-label', `Heim: ${before + 1}`, { timeout: 12000 }); // gemessen 7,0–7,9 s (5-s-Abfrage), Puffer gegen Wackeln; Ziel ≤ 3 s verfehlt → C-MONPOLL
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
  test('Public-Cup: nie initialisiertes Spiel lässt sich im Cockpit öffnen (C-NSTART, behoben mit #201)', async ({ asRole }) => {
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

      // C-NSTART ist mit PR #201 behoben (NOT_STARTED wird als 'scheduled' geschrieben): das
      // Spiel lässt sich initialisieren, das Status-Badge erscheint. Vorher test.fail().
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

      // C-UNDO war eine Folge von C-EVID (Ereignisse erreichten die Cloud nie) und ist mit
      // PR #201 behoben: Rückgängig wirkt lokal und beim Eigentümer. Vorher test.fail().

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

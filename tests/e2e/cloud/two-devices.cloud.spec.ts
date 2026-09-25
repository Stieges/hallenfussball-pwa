/**
 * tests/e2e/cloud/two-devices.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 3.
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
 * ZWEI ECHTE, während T4 BELEGTE Fehler (nicht im Brief als "bekannt" gelistet, per Konsole-/
 * Postgres-Fehlermeldung reproduziert, siehe Report):
 *   A) Torereignisse erreichen `match_events` nie: `MatchExecutionService.recordGoal()`
 *      (`src/core/services/MatchExecutionService.ts:227`) erzeugt `event.id` als
 *      `"${matchId}-goal-${Date.now()}-${random}"` -- kein UUID. `mapMatchEventToSupabase()`
 *      (`src/core/repositories/liveMatchMappers.ts:136`) reicht `event.id` unverändert als
 *      `id`-Spalte an `match_events` durch, die `uuid NOT NULL` ist. Postgres lehnt jeden Insert
 *      ab: `invalid input syntax for type uuid: "…-goal-…"`. Betrifft JEDES Tor, online wie
 *      offline. Die `matches`-ZEILE selbst (Score-Spalten) wird davon NICHT verhindert -- die
 *      Aktualisierung läuft VOR dem Events-Insert und schlägt unabhängig davon durch (siehe
 *      Test 1 unten, seit Ruling W grün).
 *   B) Ein Spiel zum ERSTEN Mal zu laden (nie zuvor initialisiert) schlägt fehl:
 *      `STATUS_TO_DB.NOT_STARTED` (`liveMatchMappers.ts:42`) ist `'not_started'`, die
 *      DB-CHECK-Constraint `matches_match_status_check` erlaubt aber nur `'scheduled' | 'waiting'
 *      | 'running' | 'paused' | 'finished' | 'skipped'` -- Postgres 23514 bei jedem allerersten
 *      `MatchExecutionService.initializeMatch()`-Lauf für ein Spiel. Der Live-Cup-Testlauf im
 *      Seed umgeht das (die Seed schreibt `match_status='running'` direkt, nie über
 *      `initializeMatch`); jedes frische, noch nie geladene Spiel (hier: alle verbleibenden
 *      Public-Cup-Spiele) trifft den Fehler zuverlässig.
 *
 * Fixrunde 1 (Ruling W): Die lokale Realtime-Publikation (`supabase_realtime`) war LEER --
 * `scripts/local-db-apply.sh` setzt sie jetzt idempotent auf dieselben vier Tabellen wie die
 * Produktion. Damit erreicht die `matches`-Zeilen-Aktualisierung aus Test 1 (Score, NICHT
 * blockiert von Fehler A) den Owner tatsächlich in Echtzeit -- Test 1 ist seitdem GRÜN, `test.fail()`
 * dort entfernt (vorher fälschlich als "erwarteter" Fehlschlag verbucht, siehe Report). Test 2
 * bleibt rot (Fehler B, unabhängig von Realtime). Test 3 bleibt rot, aber aus einem genaueren,
 * jetzt tatsächlich beobachteten Grund (siehe dort).
 *
 * Fixrunde 1 (Nebenbefund beim Reproduzierbarkeits-Lauf, kein nummerierter Punkt, analog zum
 * M10-Fund in `public-view.cloud.spec.ts`): Der Live-Cup hat laut Seed GENAU EIN laufendes
 * Spiel. Test 1 und Test 3 ändern beide dessen Score, UND `cloud-desktop`/`cloud-mobile` laufen
 * `fullyParallel` gleichzeitig -- ohne Serialisierung interferieren bis zu vier parallele
 * Instanzen (2 Tests × 2 Projekte) mit demselben Datensatz (beobachtet: Test 3 scheiterte auf
 * `cloud-desktop` an einer Vorbedingung, weil `cloud-mobile`s Instanz zeitgleich denselben Score
 * veränderte). `test.describe.configure({ mode: 'serial' })` serialisiert die vier Tests (N15,
 * Fixrunde 3: korrigiert -- waren zum Zeitpunkt dieses Nebenbefunds noch drei, seit N4/Fixrunde 2
 * ist der ehemalige Offline-Test als vierter Test Teil derselben Gruppe, siehe dort)
 * INNERHALB eines Projekt-Laufs; `test.skip` beschränkt die Datei zusätzlich auf `cloud-desktop`
 * -- es gäbe sonst zwei GLEICHZEITIGE serielle Ketten (je Projekt eine) auf demselben Turnier.
 * Anders als bei `public-view.cloud.spec.ts` (zwei unabhängige, per Projekt wählbare Spiele) hat
 * der Live-Cup nur EIN laufendes Spiel -- kein Offset möglich, ohne den Seed künstlich um ein
 * zweites laufendes Spiel zu erweitern (out of scope für diese Fixrunde).
 *
 * Fixrunde 2 (N4): Test 4 ("helper geht offline...", vorher eine eigene Datei
 * `offline.cloud.spec.ts`, Spec 4 des Briefs) ist jetzt Teil DIESER `describe`-Gruppe statt einer
 * eigenen Datei. Begründung für "dieselbe Datei/dasselbe describe" statt einer
 * Playwright-Projekt-Abhängigkeit (`dependencies` in `playwright.config.ts`): beide Dateien
 * änderten bereits VOR diesem Fix denselben Datensatz (das eine laufende Live-Cup-Spiel, siehe
 * "Nebenbefund" oben) und mussten deshalb schon vorher unabhängig voneinander per
 * `test.skip(!testInfo.project.name.includes('desktop'))` auf `cloud-desktop` beschränkt werden
 * -- reiner Zufall der Ausführungsreihenfolge zwischen zwei Dateien war nie eine echte
 * Serialisierung, nur zwei getrennte Einzelsperren auf dieselbe Ressource, die sich weiterhin
 * gegenseitig überholen konnten (Playwright ordnet Dateien nicht alphabetisch, `offline` vor
 * `two-devices` ist keine Garantie). Eine Projekt-Abhängigkeit würde zwei GANZE Projekte
 * verketten (overkill für eine einzelne Datei, und `cloud-desktop`/`cloud-mobile` sind bereits
 * über `cloud-setup` verkettet, siehe `playwright.config.ts`) und würde am eigentlichen Problem
 * nichts ändern -- die vier Tests bräuchten innerhalb ihres Projekts weiterhin `serial`, sonst
 * liefe `fullyParallel` sie trotzdem gegeneinander. `test.describe.configure({ mode: 'serial' })`
 * (bereits vorhanden) serialisiert dagegen ALLE vier Tests inklusive des ehemaligen
 * Offline-Tests in einer einzigen, garantierten Reihenfolge -- exakt das, was gebraucht wird.
 */

import { test, expect } from './fixtures';
import { AUTH_DIR } from './fixtures';
import { ensureMatchRunning, enterGoal, resetRunningMatchScore, safeCleanup, waitForSync } from './helpers';
import {
  E2E_LIVE_CUP_ID,
  E2E_PUBLIC_CUP_ID,
  E2E_PUBLIC_CUP_MONITOR_ID,
  E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE,
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
      'Live-Cup hat nur EIN laufendes Spiel, gemeinsam mit anderen Tests dieser Datei -- nur auf einem Projekt ausgeführt, siehe Kopfkommentar.'
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
      // I6: Rückbau -- sonst koppelt dieser Test mit Test 4 (ehemals offline.cloud.spec.ts,
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

  test('Public-Cup: owner trägt Tor ein, anonymer Monitor sieht es innerhalb von 3s', async ({ asRole, page: anonPage }) => {
    const ownerPage = await asRole('owner');

    await ownerPage.goto(`/#/tournament/${E2E_PUBLIC_CUP_ID}/live`);
    await ownerPage.waitForLoadState('networkidle');

    // N5(3): positiver Seiten-Anker VOR test.fail() -- beweist, dass die Navigation zur
    // Live-Cockpit-Route des Public-Cup tatsächlich ankam (Titel sichtbar), bevor der bekannte
    // Bruchpunkt (Fehler B) greift. WICHTIG: der Anker darf NICHT `match-status-badge` prüfen --
    // das ist genau die erste Zeile in `ensureMatchRunning()` (`helpers.ts:129`) und damit
    // bereits TEIL von Fehler B selbst (empirisch geprüft: die Public-Cup-Route zeigt "Keine
    // Spiele auf diesem Feld vorhanden" + KEIN `match-status-badge`, weil die
    // Automatik-Auswahl kein noch nie initialisiertes Spiel anzeigen kann -- ein Anker auf
    // `match-status-badge` würde den Bruchpunkt selbst VOR `test.fail()` ziehen und ihn dadurch
    // fälschlich zu einem "unerwarteten" statt einem "erwarteten" Fehlschlag machen). Der
    // Turniertitel dagegen lädt unabhängig von der Spielauswahl.
    await expect(ownerPage.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- `ensureMatchRunning` ist hier der
    // Bruchpunkt selbst (Fehler B: ein noch nie initialisiertes Spiel lässt sich nicht starten),
    // es gibt also keine vorgelagerte "echte" Vorbedingung mehr zu isolieren.
    test.fail();

    await ensureMatchRunning(ownerPage);

    await anonPage.goto(`/#/display/${E2E_PUBLIC_CUP_ID}/${E2E_PUBLIC_CUP_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');

    const monitorHomeBlock = anonPage.locator('[data-position="home"]');
    await expect(monitorHomeBlock).toBeVisible({ timeout: 15000 });
    const beforeLabel = await monitorHomeBlock.getAttribute('aria-label'); // "Heim: <score>"
    const before = Number(beforeLabel?.split(':')[1]?.trim());
    expect(Number.isFinite(before)).toBe(true);

    await enterGoal(ownerPage, 'home');

    await expect(monitorHomeBlock).toHaveAttribute('aria-label', `Heim: ${before + 1}`, { timeout: 3000 });
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

  test('helper geht offline, trägt zwei Tore ein, geht online -- owner sieht beide', async ({ asRole, browser }) => {
    // Fixrunde 2 (N4): vorher eine eigene Datei (`offline.cloud.spec.ts`, Brief-Spec 4), jetzt
    // Test 4 dieser `describe`-Gruppe -- siehe Kopfkommentar für die Begründung. Der
    // Projekt-Skip (`!testInfo.project.name.includes('desktop')`) läuft jetzt über das
    // gemeinsame `beforeEach` oben, keine eigene Prüfung mehr nötig.
    let helperContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
      const ownerPage = await asRole('owner');
      await ownerPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await ownerPage.waitForLoadState('networkidle');
      await ensureMatchRunning(ownerPage);
      const ownerHomeScore = ownerPage.locator('[data-testid="score-home"]');
      const before = Number(await ownerHomeScore.textContent());
      expect(Number.isFinite(before)).toBe(true); // I4: Guard, ein NaN darf nie als "erwartet rot" durchgehen.

      // Eigener Context für helper (statt asRole()): braucht direkten Zugriff auf `context()`, um
      // `setOffline(true)` aufzurufen -- asRole() gibt nur die Page zurück. M3: `AUTH_DIR` aus
      // `fixtures.ts` statt eines zweiten, literal duplizierten Pfads.
      helperContext = await browser.newContext({
        storageState: path.join(AUTH_DIR, 'helper.json'),
      });
      const helperPage = await helperContext.newPage();
      await helperPage.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/live`);
      await helperPage.waitForLoadState('networkidle');
      await expect(helperPage.locator('[data-testid="match-pause-button"]')).toBeVisible({ timeout: 15000 });
      const helperHomeScore = helperPage.locator('[data-testid="score-home"]');

      // I4: test.fail() direkt vor dem bekannten Bruchpunkt (Offline schalten + erstes Tor) --
      // alles oben (Match läuft, helper sieht das Cockpit) ist ein ECHTER Fehlschlag, kein
      // fälschlich "erwarteter".
      test.fail();

      await helperContext.setOffline(true);

      await enterGoal(helperPage, 'home');
      await enterGoal(helperPage, 'home');

      // Gewolltes Verhalten: beide Tore stehen lokal als "ausstehend" -- sync-status zeigt 2
      // ausstehende Einträge (Brief). Strukturell nicht nachweisbar (Grund 2, Brief Abschnitt 3
      // -- `showSyncStatus` wird der `AdminHeader` nirgends übergeben), aber die Erwartung bleibt
      // formuliert.
      await expect(helperPage.locator('[data-testid="sync-status"]')).toHaveAttribute('data-pending', '2', {
        timeout: 5000,
      });
      await expect(helperHomeScore).toHaveText(String(before + 2));

      await helperContext.setOffline(false);
      await waitForSync(helperPage);

      await expect(ownerHomeScore).toHaveText(String(before + 2), { timeout: 5000 });
    } finally {
      // M3: Context-Schluss IMMER, auch beim erwarteten Fehlschlag (vorher nie erreicht).
      if (helperContext) {
        await helperContext.close();
      }
      // I6: Rückbau -- falls doch etwas durchschrieb (z.B. nach einem künftigen Fundament-Fix),
      // darf der Live-Cup-Score nicht dauerhaft verändert bleiben. N8: Konstante statt `1, 0`.
      // N16: `safeCleanup()`, s. Test 1.
      await safeCleanup('Live-Cup Score zurücksetzen (Test 4, ehem. offline)', () =>
        resetRunningMatchScore(
          E2E_LIVE_CUP_ID,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.home,
          E2E_LIVE_CUP_RUNNING_MATCH_SEED_SCORE.away
        )
      );
    }
  });
});

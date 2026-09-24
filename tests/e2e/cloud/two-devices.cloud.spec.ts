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
 * ZWEI ECHTE, während dieser Arbeit BELEGTE Fehler (nicht im Brief als "bekannt" gelistet, per
 * Konsole-/Postgres-Fehlermeldung reproduziert, siehe Report):
 *   A) Torereignisse erreichen die DB nie: `MatchExecutionService.recordGoal()`
 *      (`src/core/services/MatchExecutionService.ts:227`) erzeugt `event.id` als
 *      `"${matchId}-goal-${Date.now()}-${random}"` -- kein UUID. `mapMatchEventToSupabase()`
 *      (`src/core/repositories/liveMatchMappers.ts:136`) reicht `event.id` unverändert als
 *      `id`-Spalte an `match_events` durch, die `uuid NOT NULL` ist. Postgres lehnt jeden Insert
 *      ab: `invalid input syntax for type uuid: "…-goal-…"`. Betrifft JEDES Tor, online wie
 *      offline -- nicht nur den im Brief genannten Offline-Fall.
 *   B) Ein Spiel zum ERSTEN Mal zu laden (nie zuvor initialisiert) schlägt fehl:
 *      `STATUS_TO_DB.NOT_STARTED` (`liveMatchMappers.ts:42`) ist `'not_started'`, die
 *      DB-CHECK-Constraint `matches_match_status_check` erlaubt aber nur `'scheduled' | 'waiting'
 *      | 'running' | 'paused' | 'finished' | 'skipped'` -- Postgres 23514 bei jedem allerersten
 *      `MatchExecutionService.initializeMatch()`-Lauf für ein Spiel. Der Live-Cup-Testlauf im
 *      Seed umgeht das (die Seed schreibt `match_status='running'` direkt, nie über
 *      `initializeMatch`); jedes frische, noch nie geladene Spiel (hier: alle verbleibenden
 *      Public-Cup-Spiele) trifft den Fehler zuverlässig (2/2 Reproduktionen).
 */

import { test, expect } from './fixtures';
import { ensureMatchRunning, enterGoal } from './helpers';
import { E2E_LIVE_CUP_ID, E2E_PUBLIC_CUP_ID, E2E_PUBLIC_CUP_MONITOR_ID } from './testData';

test.describe('Zwei Geräte: Echtzeit ohne Neuladen', () => {
  test('Live-Cup: helper trägt Tor ein, owner sieht es im Cockpit innerhalb von 3s', async ({ asRole }) => {
    // Belegter Fehler A (siehe Kopfkommentar) -- Torereignis erreicht die DB nicht, der Owner
    // sieht den Zuwachs deshalb nicht. Gewolltes Verhalten unten unverändert formuliert.
    test.fail();

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
  });

  test('Public-Cup: owner trägt Tor ein, anonymer Monitor sieht es innerhalb von 3s', async ({ asRole, page: anonPage }) => {
    // Belegter Fehler B (siehe Kopfkommentar) -- jedes noch nie geladene Public-Cup-Spiel kann
    // heute gar nicht erst initialisiert werden (Postgres 23514 bei match_status='not_started').
    test.fail();

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

    await expect(monitorHomeBlock).toHaveAttribute('aria-label', `Heim: ${before + 1}`, { timeout: 3000 });
  });

  test('Ereignis löschen (Rückgängig): verschwindet überall', async ({ asRole }) => {
    // Belegter Fehler A greift schon VOR dem eigentlichen "Rückgängig"-Schritt (der Owner sieht
    // das ursprüngliche Tor nie) -- UND die im Brief als bekannt gelistete Abweichung
    // (`liveMatchMappers.ts` -- additiver Event-Diff, kein Löschen Richtung Cloud, siehe
    // `docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md`) greift danach
    // ebenfalls. Gewolltes Verhalten unten unverändert formuliert.
    test.fail();

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

    await enterGoal(helperPage, 'home');
    await expect(helperHomeScore).toHaveText(String(before + 1));
    // Owner muss den Zuwachs erst gesehen haben, bevor "Rückgängig" sinnvoll geprüft werden kann.
    await expect(ownerHomeScore).toHaveText(String(before + 1), { timeout: 5000 });

    // "Rückgängig" (match-undo-button): entfernt das letzte Ereignis lokal.
    await helperPage.locator('[data-testid="match-undo-button"]').click();
    await expect(helperHomeScore).toHaveText(String(before));
    await expect(ownerHomeScore).toHaveText(String(before), { timeout: 5000 });
  });
});

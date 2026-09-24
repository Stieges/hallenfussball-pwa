/**
 * tests/e2e/cloud/offline.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 4.
 *
 * Brief: helper geht offline und trägt zwei Tore ein; Sync-Status zeigt ausstehende Einträge;
 * helper geht online, `waitForSync`, owner sieht beide. **Voraussichtlich `test.fail()`, wegen
 * Direktschreibung. Belegen.**
 *
 * Belegt (siehe Report für die vollständige beobachtete Fehlermeldung):
 *   1. `src/core/contexts/RepositoryContext.tsx:85` -- `liveMatchRepository` ist bei einer echten
 *      Cloud-Session immer `SupabaseLiveMatchRepository` direkt (NICHT durch `OfflineRepository`/
 *      die MutationQueue gewrappt, anders als `tournamentRepository` zwei Zeilen darüber). Ein
 *      Tor scheitert offline deshalb sofort am Netzwerkfehler, landet NIE in einer Warteschlange.
 *   2. `sync-status` (`SyncStatusBar`, Task T3) wird nirgends erreichbar gerendert: `AdminHeader`
 *      bekommt `showSyncStatus`/`tournamentId` an KEINER der beiden Aufrufstellen in
 *      `TournamentAdminCenter.tsx` übergeben (`showSyncStatus` defaultet auf `false`,
 *      `src/features/tournament-admin/components/AdminHeader.tsx:126`) -- der Schritt "Sync-Status
 *      zeigt ausstehende Einträge" ist damit strukturell nicht nachweisbar, unabhängig von 1.
 *   3. Zusätzlich (siehe `two-devices.cloud.spec.ts`-Kopfkommentar, Fehler A): selbst ein ONLINE
 *      eingetragenes Tor erreicht `match_events` nicht (ungültige UUID). Betrifft diesen Test
 *      indirekt -- sobald helper wieder online ist, würde ein etwaiger Sync (gäbe es ihn) am
 *      selben Fehler scheitern.
 *
 * Fixrunde 1 (Nebenbefund, dieselbe Ursache wie in `two-devices.cloud.spec.ts` dokumentiert):
 * dieser Test liest/nutzt dasselbe einzige laufende Live-Cup-Spiel -- nur auf `cloud-desktop`
 * ausgeführt, damit er nicht mit einer gleichzeitigen `cloud-mobile`-Instanz um denselben
 * Datensatz konkurriert.
 */

import { test, expect } from './fixtures';
import { AUTH_DIR } from './fixtures';
import { ensureMatchRunning, enterGoal, waitForSync, resetRunningMatchScore } from './helpers';
import { E2E_LIVE_CUP_ID } from './testData';
import path from 'node:path';

test('helper geht offline, trägt zwei Tore ein, geht online -- owner sieht beide', async ({ asRole, browser }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes('desktop'),
    'Live-Cup hat nur EIN laufendes Spiel, gemeinsam mit two-devices.cloud.spec.ts -- nur auf einem Projekt ausgeführt.'
  );
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
    // ausstehende Einträge (Brief). Strukturell nicht nachweisbar (Grund 2 oben), aber die
    // Erwartung bleibt formuliert.
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
    // darf der Live-Cup-Score nicht dauerhaft verändert bleiben (koppelt sonst mit
    // `two-devices.cloud.spec.ts`, das dasselbe laufende Spiel nutzt).
    await resetRunningMatchScore(E2E_LIVE_CUP_ID, 1, 0);
  }
});

/**
 * tests/e2e/cloud/publish-coadmin.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 6.
 *
 * Fixrunde 2 (N3, Ruling AA): prüft jetzt ein EIGENES, fünftes Testturnier ("Freigabe-Cup"),
 * NICHT mehr den Entwurf-Cup -- der T2-Brief verlangt den Entwurf-Cup wörtlich als "Entwurf,
 * privat, ohne `publishedAt`" (`task-T2-brief.md`), Fixrunde 1 hatte ihm `publishedAt` gegeben,
 * um die Veröffentlichen-RPC prüfbar zu machen (ging über Ruling V hinaus, kein Ruling dafür,
 * vom Re-Review als N3 beanstandet). Der Freigabe-Cup (`scripts/e2e-seed.ts`) trägt seitdem
 * genau den Zustand, den dieser Test braucht: veröffentlicht (`publishedAt` gesetzt), privat
 * (`is_public=false`), coadmin als Co-Admin, ein Sponsor + ein Monitor mit `sponsor`-Slide.
 *
 * I1: Die Sektion "🔒 Turnier-Sichtbarkeit" ist eine `CollapsibleSection` OHNE `defaultOpen`
 * (`Visibility/index.tsx:654`) -- muss vor jeder Interaktion aufgeklappt werden.
 * N5(2): Zusätzliche Vorbedingung -- der Radio "🔗 Mit Link teilbar" muss `toBeEnabled()` sein
 * (beweist, dass `isDraft` NICHT greift, weil `publishedAt` gesetzt ist -- ohne diesen Beweis
 * bewirkt der folgende Klick nichts, `handleMakePublic()` bricht in der App früh ab, und das
 * I1-Muster käme durch die Hintertür zurück, siehe `Visibility/index.tsx:703`).
 * I6/N16: `finally` setzt `is_public`/`share_code` immer zurück, per `safeCleanup()` (s. dort) --
 * ein scheiternder Rückbau darf die eigentliche Testmeldung nicht verdecken, muss aber laut
 * geloggt werden, damit ein verschmutzter Zustand nicht unbemerkt in den nächsten Lauf geht.
 * Ruling AB: läuft NUR auf `cloud-desktop` -- der Freigabe-Cup hat genau EINE Zeile, die dieser
 * Test per Service-Role ändert; `cloud-mobile` würde denselben Datensatz gleichzeitig ändern
 * (dieselbe Race-Klasse wie bei `two-devices`/`offline`, siehe dort).
 *
 * Fixrunde 2 (N5(4)/N11) + Fixrunde 3 (N15, KORRIGIERT -- vorherige Fassung war fehlformuliert):
 * Der Ablauf am Freigabe-Cup ist grün, nicht `test.fail()`. Mechanismus (vier unabhängige
 * Nachweise, siehe Report):
 *   1. Die RPC `make_tournament_public()` (`supabase/migrations/00000000000000_baseline_live_
 *      schema.sql:373-430`) prüft `owner_id = auth.uid()` und lehnt jeden Nicht-Eigentümer ab
 *      ("Not authorized to modify this tournament") -- per direktem RPC-Aufruf MIT coadmins JWT
 *      reproduziert (curl, außerhalb dieses Tests, siehe Report). Das ist der bekannte Befund N1
 *      AUS DEM BRIEF (`task-T4-brief.md`, Spec 6: "Die Veröffentlichen-RPC verlangt heute den
 *      Eigentümer, der Co-Admin nutzt einen Offline-Fallback (bekannter Befund N1)") -- NICHT
 *      dieselbe Nummerierung wie die N-Befunde der Review-Fixrunden, reiner Namenszufall.
 *   2. `OfflineRepository.makeTournamentPublic()` (`OfflineRepository.ts:691-730`) fängt genau
 *      diesen Fehler ab (Konsole: "Cloud makeTournamentPublic failed, using local."), erzeugt
 *      lokal einen Share-Code UND reiht `UPDATE_TOURNAMENT_METADATA` in die `MutationQueue` ein.
 *   3. Der Queue-Prozessor ruft dafür NICHT die RPC auf, sondern
 *      `SupabaseRepository.updateTournamentMetadata()` (`SupabaseRepository.ts:113-138`) -- ein
 *      GEWÖHNLICHES `UPDATE` auf `is_public`/`share_code`, ohne den Eigentümer-Check der RPC,
 *      nur durch die normale RLS-UPDATE-Policy auf `tournaments` geschützt. coadmin hat
 *      `tournamentSettings` -- laut `rolePermissions.json` (Zeile 8) ausdrücklich "Turnier-
 *      einstellungen ändern (inkl. veröffentlichen)". Die Policy lässt das UPDATE deshalb ZU
 *      GEWOLLT zu, nicht versehentlich. Per direktem `PATCH .../rest/v1/tournaments` MIT coadmins
 *      JWT reproduziert (curl, außerhalb dieses Tests): gelingt.
 *   4. Läuft der Client online (dieser Test, kein `context.setOffline()`), verarbeitet die
 *      MutationQueue den Eintrag praktisch sofort -- der Effekt landet zuverlässig, deterministisch
 *      VOR dem `expect.poll()`-Timeout in der DB.
 * N15: KEINE "Autorisierungslücke" (frühere Fassung dieses Kommentars und des Reports waren hier
 * fehlformuliert) -- dass ein Co-Admin ein bereits freigegebenes Turnier veröffentlichen kann, ist
 * GEWOLLTES Verhalten (`tournamentSettings` deckt das laut Rechte-Katalog ausdrücklich ab).
 * INKONSISTENT ist NUR, dass die RPC selbst enger ist als die eigentliche Rechte-Absicht
 * (owner-only statt tournamentSettings) -- genau der bekannte Befund N1 aus dem Brief oben, der
 * im Folge-PR "Helfer beendet Spiel" gelöst wird (dort wird die RPC vermutlich auf
 * `has_tournament_permission(..., 'tournamentSettings')` umgestellt). Sobald das passiert, läuft
 * dieser Test über den RPC-Pfad grün, nicht mehr über den Fallback -- der Testtitel behauptet
 * deshalb bewusst NUR das Endergebnis (Sichtbarkeit erreicht die DB, Link funktioniert), nicht den
 * heutigen internen Mechanismus, der sich mit dem Folge-PR ändert.
 *
 * Fixrunde 3 (N13, Important): der bisherige Positivtest bewies nur `is_public=true` und den
 * Monitor per TURNIER-ID -- das ist NICHT derselbe Pfad, den ein echter Zuschauer nutzt (der hat
 * nur den Share-Code, keine Turnier-ID). Gerade auf dem Fallback-Pfad erzeugt der KLIENT den
 * Share-Code (`LocalStorageRepository.generateLocalShareCode`) -- die wahrscheinlichste
 * Bruchstelle, falls sich das je ändert (z. B. im N1-Folge-PR). Jetzt zusätzlich geprüft: `share_
 * code` ist vor dem Klick NULL, nach dem Klick auf `^[A-Z0-9]{6}$` geprüft, UND ein anonymer
 * Aufruf von `/#/live/<code>` (derselbe Weg wie `public-view.cloud.spec.ts`) zeigt "Freigabe-Cup".
 *
 * Fixrunde 3 (N17, Minor): Negativkontrolle vor dem Klick -- der anonyme Monitor-Aufruf zeigt
 * VORHER `[data-testid="monitor-error-message"]` mit "Turnier nicht gefunden" (RLS lässt den
 * privaten Freigabe-Cup nicht durch, `MonitorDisplayPage.tsx:1061-1065`), NICHT den Sponsor.
 * Ohne diesen Vorher-Zustand wäre nicht belegt, dass der Sponsor NACHHER wegen der Freigabe
 * erscheint (könnte z.B. auch unabhängig von `is_public` sichtbar sein).
 */

import { test, expect } from './fixtures';
import { getLocalServiceRoleClient, safeCleanup } from './helpers';
import { E2E_RELEASE_CUP_ID, E2E_RELEASE_CUP_MONITOR_ID, E2E_RELEASE_CUP_SPONSOR_NAME, E2E_RELEASE_CUP_TITLE } from './testData';

/** Liest `is_public`/`share_code` des Freigabe-Cup direkt aus der DB (Service-Role, umgeht RLS). */
async function getReleaseCupVisibility(): Promise<{ isPublic: boolean; shareCode: string | null }> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${E2E_RELEASE_CUP_ID}&select=is_public,share_code`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`tournaments-Abfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ is_public: boolean; share_code: string | null }>;
  if (rows.length === 0) {
    throw new Error(`Freigabe-Cup (${E2E_RELEASE_CUP_ID}) nicht gefunden.`);
  }
  return { isPublic: rows[0].is_public, shareCode: rows[0].share_code };
}

/** I6: setzt den Freigabe-Cup auf den Seed-Ausgangszustand zurück (privat, kein Share-Code). */
async function resetReleaseCupToPrivate(): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${E2E_RELEASE_CUP_ID}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ is_public: false, share_code: null }),
  });
  if (!res.ok) {
    throw new Error(`Zurücksetzen des Freigabe-Cup fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
}

test('coadmin macht den Freigabe-Cup öffentlich -- Sichtbarkeit, Share-Code und Sponsor/Monitor sind danach für einen anonymen Betrachter erreichbar', async ({ asRole, page: anonPage }, testInfo) => {
  // Ruling AB: Freigabe-Cup hat genau eine DB-Zeile, die dieser Test per Service-Role ändert --
  // nur auf einem Projekt, sonst Race mit einer gleichzeitigen zweiten Instanz (wie bei
  // two-devices/offline, siehe deren Kopfkommentare).
  test.skip(
    !testInfo.project.name.includes('desktop'),
    'Freigabe-Cup hat nur EINE Zeile, die dieser Test per Service-Role ändert -- nur auf einem Projekt ausgeführt.'
  );

  try {
    // Vorbedingung 1: Freigabe-Cup ist laut Seed privat, ohne Share-Code.
    const before = await getReleaseCupVisibility();
    expect(before.isPublic).toBe(false);
    // N13: Vorbedingung -- kein Share-Code vorhanden. Ohne diese Prüfung könnte ein Seed-Rest
    // (z.B. aus einem vorherigen, nicht sauber zurückgebauten Lauf) den nachfolgenden
    // Format-/Erreichbarkeits-Nachweis fälschlich "bestehen" lassen, ohne dass dieser Testlauf
    // selbst je etwas erzeugt hätte.
    expect(before.shareCode).toBeNull();

    // N17: Negativkontrolle -- der Monitor ist VOR der Freigabe für einen anonymen Betrachter
    // nicht erreichbar (RLS lässt den privaten Freigabe-Cup nicht durch), zeigt also insbesondere
    // NICHT den Sponsor. Ohne diesen Vorher-Zustand wäre der Nachher-Nachweis unten (Sponsor
    // sichtbar) kein Beleg dafür, dass GENAU die Freigabe den Unterschied macht.
    await anonPage.goto(`/#/display/${E2E_RELEASE_CUP_ID}/${E2E_RELEASE_CUP_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');
    await expect(anonPage.locator('[data-testid="monitor-error-message"]')).toContainText('Turnier nicht gefunden', {
      timeout: 15000,
    });
    await expect(anonPage.getByText(E2E_RELEASE_CUP_SPONSOR_NAME)).toHaveCount(0);

    const page = await asRole('coadmin');
    await page.goto(`/#/tournament/${E2E_RELEASE_CUP_ID}/admin/visibility`);
    await page.waitForLoadState('networkidle');

    // I1: Sektion ist standardmäßig eingeklappt -- aufklappen, bevor die Radios gesucht werden.
    await page.getByRole('button', { name: /Turnier-Sichtbarkeit/ }).click();

    // Vorbedingung 2: "🔒 Privat" sichtbar (Sektion korrekt offen).
    await expect(page.getByText('🔒 Privat', { exact: true })).toBeVisible({ timeout: 15000 });

    // N5(2): Vorbedingung 3 -- der Radio "Mit Link teilbar" ist BEDIENBAR. Das beweist, dass
    // `isDraft` nicht greift (Freigabe-Cup hat `publishedAt`, anders als der Entwurf-Cup) --
    // ohne diesen Beweis wäre der folgende Klick ein No-Op (`Visibility/index.tsx:703`,
    // `if (!isUpdating && !isDraft && ...)`), und der Test würde aus dem FALSCHEN Grund grün.
    // Das `<label>` umschließt das `<input type="radio">` (siehe Visibility/index.tsx) --
    // `getByRole('radio', { name })` bindet darüber an das Element, `disabled` sitzt direkt am
    // `<input>`.
    const shareableRadioInput = page.getByRole('radio', { name: /Mit Link teilbar/ });
    await expect(shareableRadioInput).toBeEnabled({ timeout: 15000 });

    await shareableRadioInput.click();

    // Der DB-Zustand (Service-Role, RLS-unabhängig) ist der einzig verlässliche Beweis -- die
    // Oberfläche zeigt lokal-optimistisch Erfolg, unabhängig davon, ob/wie die Cloud reagiert.
    // Tatsächlicher Mechanismus (s. Kopfkommentar): die RPC lehnt coadmin ab, der
    // Offline-Fallback-Pfad (MutationQueue → `updateTournamentMetadata`, nur durch die normale
    // RLS-Policy geschützt) erreicht die DB trotzdem.
    await expect.poll(() => getReleaseCupVisibility().then((v) => v.isPublic), { timeout: 5000 }).toBe(true);

    // N13: der eigentliche Nachweis, dass ein ZUSCHAUER (nur Share-Code, keine Turnier-ID) den
    // Freigabe-Cup jetzt erreicht -- nicht nur, dass die `is_public`-Spalte stimmt.
    const after = await getReleaseCupVisibility();
    expect(after.shareCode).toMatch(/^[A-Z0-9]{6}$/);
    await anonPage.goto(`/#/live/${after.shareCode}`);
    await anonPage.waitForLoadState('networkidle');
    await expect(anonPage.getByText(E2E_RELEASE_CUP_TITLE, { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // "Sponsor und Monitor folgen" (Brief): derselbe anonyme Monitor-Aufruf wie in der
    // Negativkontrolle oben zeigt jetzt den Sponsor-Slide -- vorher (N17) explizit nicht.
    await anonPage.goto(`/#/display/${E2E_RELEASE_CUP_ID}/${E2E_RELEASE_CUP_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');
    await expect(anonPage.getByText(E2E_RELEASE_CUP_SPONSOR_NAME)).toBeVisible({ timeout: 15000 });
  } finally {
    // I6/N16: unabhängig vom Ausgang zurücksetzen, per `safeCleanup()` (s. Kopfkommentar).
    await safeCleanup('Freigabe-Cup zurücksetzen (privat, kein Share-Code)', resetReleaseCupToPrivate);
  }
});

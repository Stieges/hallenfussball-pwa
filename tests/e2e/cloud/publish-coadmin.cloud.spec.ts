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
 * I6: `finally` setzt `is_public`/`share_code` immer zurück.
 * Ruling AB: läuft NUR auf `cloud-desktop` -- der Freigabe-Cup hat genau EINE Zeile, die dieser
 * Test per Service-Role ändert; `cloud-mobile` würde denselben Datensatz gleichzeitig ändern
 * (dieselbe Race-Klasse wie bei `two-devices`/`offline`, siehe dort).
 *
 * Fixrunde 2 (N5(4)/N11, ECHTER BEFUND -- korrigiert eine falsche Annahme aus Fixrunde 1):
 * Fixrunde 1 nahm an (und Fixrunde 1 dieses Tests markierte entsprechend `test.fail()`), dass die
 * Sichtbarkeitsänderung eines Co-Admin die DB NICHT erreicht ("N1"). Am neuen, eigens dafür
 * gebauten Freigabe-Cup (Ruling AA) zeigt sich: das stimmt nur TEILWEISE. Belegt (vier
 * unabhängige Nachweise, siehe unten):
 *   1. Die RPC `make_tournament_public()` (`supabase/migrations/00000000000000_baseline_live_
 *      schema.sql:373-430`) prüft `owner_id = auth.uid()` und lehnt jeden Nicht-Eigentümer ab
 *      ("Not authorized to modify this tournament") -- per direktem RPC-Aufruf MIT coadmins JWT
 *      reproduziert (curl, außerhalb dieses Tests, siehe Report).
 *   2. `OfflineRepository.makeTournamentPublic()` (`OfflineRepository.ts:691-730`) fängt genau
 *      diesen Fehler ab (Konsole: "Cloud makeTournamentPublic failed, using local."), schreibt
 *      lokal UND reiht `UPDATE_TOURNAMENT_METADATA` in die `MutationQueue` ein.
 *   3. Der Queue-Prozessor ruft dafür NICHT die RPC auf, sondern
 *      `SupabaseRepository.updateTournamentMetadata()` (`SupabaseRepository.ts:113-138`) -- ein
 *      GEWÖHNLICHES `UPDATE` auf `is_public`/`share_code`, ohne den Eigentümer-Check der RPC,
 *      nur durch die normale RLS-UPDATE-Policy auf `tournaments` geschützt. coadmin hat
 *      `tournamentSettings` (`rolePermissions.json`) -- die Policy lässt das UPDATE zu. Per
 *      direktem `PATCH .../rest/v1/tournaments` MIT coadmins JWT reproduziert (curl, außerhalb
 *      dieses Tests): gelingt.
 *   4. Läuft der Client online (dieser Test, kein `context.setOffline()`), verarbeitet die
 *      MutationQueue den Eintrag praktisch sofort -- der Effekt landet zuverlässig, deterministisch
 *      (4/4 Wiederholungen bei der Entwicklung dieses Fixes, Laufzeit je ~2,7s) VOR dem
 *      `expect.poll()`-Timeout in der DB.
 * Ergebnis: die im T4-Brief als "N1" erwartete Blockade gilt NUR für den RPC-Pfad selbst, NICHT
 * für den Gesamtablauf der App (Owner-only-RPC + Offline-Fallback zusammen) -- der Co-Admin
 * erreicht sein Ziel am Ende trotzdem, nur über einen anderen internen Pfad als den, der die
 * eigentliche Eigentümer-Prüfung durchsetzen sollte. Sponsor und Monitor folgen danach
 * tatsächlich (geprüft unten). Das ist eine mögliche Autorisierungslücke (die RPC-Absicherung
 * wird durch den Fallback-Pfad wirkungslos) -- siehe Report "Bedenken", nicht Teil dieser
 * Fixrunde zu beheben (Testverhalten muss die REALE App abbilden, nicht eine angenommene).
 * `test.fail()` wäre hier deshalb IRREFÜHREND (ein `test.fail()`, das zuverlässig NICHT
 * fehlschlägt, ist kein Nachweis mehr, sondern nur noch Störgeräusch, riskiert zudem einen
 * "Expected to fail, but passed"-CI-Fehlschlag) -- entfernt, Test ist jetzt eine echte,
 * grüne Positiv-Prüfung des tatsächlichen Endergebnisses.
 */

import { test, expect } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { E2E_RELEASE_CUP_ID, E2E_RELEASE_CUP_MONITOR_ID, E2E_RELEASE_CUP_SPONSOR_NAME } from './testData';

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

test('coadmin macht den Freigabe-Cup öffentlich -- Owner-only-RPC lehnt ab, der Offline-Fallback erreicht die DB trotzdem, Sponsor/Monitor folgen', async ({ asRole, page: anonPage }, testInfo) => {
  // Ruling AB: Freigabe-Cup hat genau eine DB-Zeile, die dieser Test per Service-Role ändert --
  // nur auf einem Projekt, sonst Race mit einer gleichzeitigen zweiten Instanz (wie bei
  // two-devices/offline, siehe deren Kopfkommentare).
  test.skip(
    !testInfo.project.name.includes('desktop'),
    'Freigabe-Cup hat nur EINE Zeile, die dieser Test per Service-Role ändert -- nur auf einem Projekt ausgeführt.'
  );

  try {
    // Vorbedingung 1: Freigabe-Cup ist laut Seed privat.
    const before = await getReleaseCupVisibility();
    expect(before.isPublic).toBe(false);

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

    // "Sponsor und Monitor folgen" (Brief): ein anonymer Monitor-Aufruf zeigt den Sponsor-Slide.
    await anonPage.goto(`/#/display/${E2E_RELEASE_CUP_ID}/${E2E_RELEASE_CUP_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');
    await expect(anonPage.getByText(E2E_RELEASE_CUP_SPONSOR_NAME)).toBeVisible({ timeout: 15000 });
  } finally {
    // I6: unabhängig vom Ausgang zurücksetzen -- der Freigabe-Cup muss für nachfolgende Läufe
    // wieder privat sein.
    await resetReleaseCupToPrivate();
  }
});

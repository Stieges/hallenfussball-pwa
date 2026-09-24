/**
 * tests/e2e/cloud/publish-coadmin.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 6.
 *
 * Fixrunde 1 (I1/I2, Ruling V): prüft jetzt das Brief-Szenario wörtlich -- "coadmin
 * veröffentlicht den Entwurf-Cup", inklusive "Sponsor und Monitor folgen" -- statt einer
 * Ausweich-Konstruktion am Live-Cup. `scripts/e2e-seed.ts` trägt coadmin seitdem als Co-Admin
 * des Entwurf-Cup ein (minimale, begründete Seed-Ergänzung, siehe dortiger Kommentar) und gibt
 * dem Entwurf-Cup `publishedAt` (sonst blockiert `VisibilityCategory`s `isDraft`-Gate die ganze
 * Sichtbarkeits-Sektion -- disabled-Radios, `handleMakePublic()` bricht früh ab -- das hätte
 * diesen Test unabhängig von N1 nie die eigentliche RPC erreichen lassen, siehe I1) sowie einen
 * Sponsor + Monitor mit `sponsor`-Slide, damit "Sponsor und Monitor folgen" konkret prüfbar ist.
 *
 * I1: Die Sektion "🔒 Turnier-Sichtbarkeit" ist eine `CollapsibleSection` OHNE `defaultOpen`
 * (`Visibility/index.tsx:654`) -- muss vor jeder Interaktion aufgeklappt werden.
 * I4: `test.fail()` steht direkt vor dem bekannten Bruchpunkt (dem Klick, der die RPC auslöst),
 * NICHT am Anfang -- alles davor (Vorbedingungen: privat, Sektion aufklappbar) ist damit ein
 * ECHTER Fehlschlag, kein fälschlich "erwarteter".
 * I6: `finally` setzt `is_public`/`share_code` zurück, falls der RPC-Aufruf wider Erwarten (N1
 * behoben) doch durchläuft -- sonst bliebe der Entwurf-Cup dauerhaft öffentlich und würde
 * `public-view.cloud.spec.ts` ("Entwurf-Cup ... nicht erreichbar") aus einem späteren Lauf heraus
 * koppeln.
 */

import { test, expect } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { E2E_DRAFT_CUP_ID, E2E_DRAFT_CUP_MONITOR_ID, E2E_DRAFT_CUP_SPONSOR_NAME } from './testData';

/** Liest `is_public`/`share_code` des Entwurf-Cup direkt aus der DB (Service-Role, umgeht RLS). */
async function getDraftCupVisibility(): Promise<{ isPublic: boolean; shareCode: string | null }> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${E2E_DRAFT_CUP_ID}&select=is_public,share_code`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`tournaments-Abfrage fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ is_public: boolean; share_code: string | null }>;
  if (rows.length === 0) {
    throw new Error(`Entwurf-Cup (${E2E_DRAFT_CUP_ID}) nicht gefunden.`);
  }
  return { isPublic: rows[0].is_public, shareCode: rows[0].share_code };
}

/** I6: setzt den Entwurf-Cup auf den Seed-Ausgangszustand zurück (privat, kein Share-Code). */
async function resetDraftCupToPrivate(): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${E2E_DRAFT_CUP_ID}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ is_public: false, share_code: null }),
  });
  if (!res.ok) {
    throw new Error(`Zurücksetzen des Entwurf-Cup fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
}

test('coadmin veröffentlicht den Entwurf-Cup -- Sichtbarkeit erreicht die DB nicht, Sponsor/Monitor folgen deshalb nicht (N1, belegt)', async ({ asRole, page: anonPage }) => {
  try {
    // Vorbedingung 1: Entwurf-Cup ist laut Seed privat.
    const before = await getDraftCupVisibility();
    expect(before.isPublic).toBe(false);

    const page = await asRole('coadmin');
    await page.goto(`/#/tournament/${E2E_DRAFT_CUP_ID}/admin/visibility`);
    await page.waitForLoadState('networkidle');

    // I1: Sektion ist standardmäßig eingeklappt -- aufklappen, bevor "🔒 Privat" gesucht wird.
    await page.getByRole('button', { name: /Turnier-Sichtbarkeit/ }).click();

    // Vorbedingung 2: "🔒 Privat" tatsächlich sichtbar (Sektion korrekt offen, isDraft-Gate
    // greift NICHT -- publishedAt ist gesetzt, siehe Seed-Kommentar).
    await expect(page.getByText('🔒 Privat', { exact: true })).toBeVisible({ timeout: 15000 });

    // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- alles oben ist ein echter
    // Fehlschlag, kein fälschlich "erwarteter". Bekannter Befund N1 (Brief): die
    // Veröffentlichen-RPC `make_tournament_public` verlangt heute den Eigentümer
    // (`auth.uid() = owner_id`), der Co-Admin nutzt den Offline-Fallback
    // (`src/core/repositories/OfflineRepository.ts:691-730`, `makeTournamentPublic()`).
    // Gewolltes Verhalten (co-admin hat `tournamentSettings`, siehe `rolePermissions.json`):
    // die Änderung landet in der DB, Sponsor und Monitor sind danach für einen anonymen
    // Monitor-Aufruf erreichbar. Heute nicht der Fall.
    test.fail();

    await page.getByText('🔗 Mit Link teilbar', { exact: true }).click();

    // Der DB-Zustand (Service-Role, RLS-unabhängig) ist der einzig verlässliche Beweis -- die
    // Oberfläche kann durch den Offline-Fallback fälschlich Erfolg anzeigen (lokaler Zustand),
    // ohne dass sich an der Cloud etwas geändert hat.
    await expect.poll(() => getDraftCupVisibility().then((v) => v.isPublic), { timeout: 5000 }).toBe(true);

    // "Sponsor und Monitor folgen" (Brief): ein anonymer Monitor-Aufruf zeigt den Sponsor-Slide
    // -- NUR erreichbar, wenn der Entwurf-Cup tatsächlich öffentlich ist (dieselbe RLS wie für
    // die Turnier-Zeile selbst, Sponsor/Monitor liegen im selben `config`-JSON, keine eigene
    // Sichtbarkeits-Spalte).
    await anonPage.goto(`/#/display/${E2E_DRAFT_CUP_ID}/${E2E_DRAFT_CUP_MONITOR_ID}`);
    await anonPage.waitForLoadState('networkidle');
    await expect(anonPage.getByText(E2E_DRAFT_CUP_SPONSOR_NAME)).toBeVisible({ timeout: 15000 });
  } finally {
    // I6: unabhängig vom Ausgang zurücksetzen -- ein (heute unerwarteter) erfolgreicher Lauf
    // darf den Entwurf-Cup nicht dauerhaft öffentlich machen (koppelt sonst mit
    // `public-view.cloud.spec.ts`, siehe Kopfkommentar).
    await resetDraftCupToPrivate();
  }
});

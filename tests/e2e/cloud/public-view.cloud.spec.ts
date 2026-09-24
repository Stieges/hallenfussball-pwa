/**
 * tests/e2e/cloud/public-view.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 5.
 */

import { test, expect } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import {
  E2E_LIVE_CUP_ID,
  E2E_PUBLIC_CUP_ID,
  E2E_DRAFT_CUP_ID,
  E2E_PUBLIC_CUP_SHARE_CODE,
} from './testData';

// =============================================================================
// Direkter REST-Zugriff für den letzten Testfall ("Ein Tor, das owner einträgt") -- NUR für
// diesen einen Testfall: die eigentliche Bedienung läuft in den anderen T4-Specs
// (`two-devices.cloud.spec.ts`) durch die Oberfläche -- hier geht es NICHT um den Bedienweg,
// sondern ausschließlich darum, ob die öffentliche Ansicht eine bereits vorhandene
// Ergebnisänderung ohne Neuladen zeigt (Z1). Ein direktes Service-Role-Update umgeht bewusst
// `MatchExecutionService.initializeMatch()` (siehe `two-devices.cloud.spec.ts`-Kopfkommentar,
// Fehler B -- ein frisches Public-Cup-Spiel ließe sich über die Oberfläche derzeit gar nicht
// erst starten, das würde diesen von Z1 unabhängigen Test verfälschen).
// Fixrunde 1 (M1): `getLocalServiceRoleClient()` statt eigener `execSync`-Kopie.
//
// Fixrunde 1 (Review-Fund während der Fehlermeldungs-Erhebung, kein nummerierter Punkt): dieser
// Test läuft `fullyParallel` gleichzeitig als `cloud-desktop` UND `cloud-mobile` -- ohne
// `offset` griffen beide Projekt-Instanzen auf DASSELBE beendete Spiel zu (Seed hat genau zwei),
// eine Instanz sah dadurch gelegentlich die Änderung DER ANDEREN Instanz und der eigentlich
// erwartete `test.fail()` wurde fälschlich grün ("Expected to fail, but passed", beobachtet auf
// cloud-mobile bei gleichzeitigem Lauf mit cloud-desktop, 1/1 Reproduktion). `offset` wählt je
// Projekt ein ANDERES der zwei beendeten Spiele.
// =============================================================================

async function bumpFinishedMatchScore(
  tournamentId: string,
  offset: 0 | 1
): Promise<{ matchId: string; oldScoreA: number; newScoreA: number }> {
  const { url, headers } = getLocalServiceRoleClient();

  const listRes = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.finished&select=id,score_a&order=id&limit=2`,
    { headers }
  );
  if (!listRes.ok) {
    throw new Error(`Matches-Abfrage fehlgeschlagen: ${listRes.status} ${await listRes.text()}`);
  }
  const rows = (await listRes.json()) as Array<{ id: string; score_a: number }>;
  if (rows.length <= offset) {
    throw new Error(`Kein beendetes Spiel mit Offset ${offset} in Turnier ${tournamentId} gefunden (${rows.length} gefunden).`);
  }
  const { id: matchId, score_a: oldScoreA } = rows[offset];
  const newScoreA = oldScoreA + 1;

  const patchRes = await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ score_a: newScoreA }),
  });
  if (!patchRes.ok) {
    throw new Error(`Score-Update fehlgeschlagen: ${patchRes.status} ${await patchRes.text()}`);
  }
  return { matchId, oldScoreA, newScoreA };
}

/** I6: setzt den per Service-Role geänderten Spielstand auf den Seed-Ausgangswert zurück. */
async function restoreMatchScore(matchId: string, scoreA: number): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ score_a: scoreA }),
  });
  if (!res.ok) {
    throw new Error(`Zurücksetzen des Spielstands fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
}

// =============================================================================
// TESTS
// =============================================================================

test.describe('Public-View', () => {
  test('anonym zeigt /#/live/E2EPUB den Public-Cup mit Ergebnissen', async ({ page }) => {
    await page.goto(`/#/live/${E2E_PUBLIC_CUP_SHARE_CODE}`);
    await page.waitForLoadState('networkidle');

    // Sichtbarer Turniername (siehe smoke.spec.ts -- .first(), zwei <h1> im DOM je Breakpoint).
    await expect(page.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    // Ergebnisse: der Seed markiert zwei Public-Cup-Spiele als 2:0 beendet (scripts/e2e-seed.ts,
    // "einige Ergebnisse") -- mindestens EIN "2:0" muss irgendwo SICHTBAR auf der Seite stehen.
    // `.first()` allein reicht nicht: wie beim Turniernamen liegen je Breakpoint mehrere Kopien
    // im DOM, nur eine ist per CSS sichtbar -- unter cloud-mobile war ausgerechnet die per
    // DOM-Reihenfolge erste ausgeblendet (beobachtet, siehe Report). Der `:visible`-Filter wählt
    // zuverlässig eine tatsächlich sichtbare Kopie. `exact: true` (M10) vermeidet einen
    // Teilstring-Treffer wie "12:00".
    await expect(page.getByText('2:0', { exact: true }).filter({ visible: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('Entwurf-Cup und Live-Cup (privat) sind per Direktlink nicht erreichbar', async ({ page }) => {
    // Beide haben laut Seed keinen share_code (T2) -- der einzige Direktlink ist die
    // ID-Route /#/public/:tournamentId (PublicTournamentViewScreen, versucht Share-Code-Format
    // ZUERST, fällt dann auf `repo.get(tournamentId)` zurück -- RLS lässt anonym nur
    // `is_public=true`-Turniere durch). Der Entwurf-Cup hat seit Fixrunde 1 zwar `publishedAt`
    // (siehe Seed-Kommentar, I2/Ruling V), aber weiterhin `is_public=false` -- dieser Test bleibt
    // davon unberührt.
    await page.goto(`/#/public/${E2E_DRAFT_CUP_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Turnier nicht gefunden')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Entwurf-Cup', { exact: true })).toHaveCount(0);

    await page.goto(`/#/public/${E2E_LIVE_CUP_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Turnier nicht gefunden')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Live-Cup', { exact: true })).toHaveCount(0);
  });

  test('Ein Tor, das owner einträgt, erscheint ohne Neuladen', async ({ page }, testInfo) => {
    let matchId: string | null = null;
    let oldScoreA = 0;
    try {
      await page.goto(`/#/live/${E2E_PUBLIC_CUP_SHARE_CODE}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });

      // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- die Vorbedingung oben (Seite
      // zeigt den Public-Cup) ist ein echter Fehlschlag, kein fälschlich "erwarteter". Bekannte
      // Abweichung (Brief, Katalog-Schnitt Z1, docs/anforderungen/
      // 2026-09-24_zielbild-einzelturnier.md): PublicTournamentViewScreen lädt das Turnier NUR
      // einmalig beim Mount (ein `useEffect` mit `[tournamentId]`-Deps, keine Polling-/
      // Realtime-Subscription, src/screens/PublicTournamentViewScreen.tsx) -- eine
      // Ergebnisänderung erscheint nie ohne Neuladen.
      test.fail();

      // offset: cloud-desktop und cloud-mobile laufen `fullyParallel` -- jedes Projekt ändert
      // ein ANDERES der zwei beendeten Public-Cup-Spiele (siehe Kommentar an der Funktion).
      const offset = testInfo.project.name.includes('mobile') ? 1 : 0;
      const bumped = await bumpFinishedMatchScore(E2E_PUBLIC_CUP_ID, offset);
      matchId = bumped.matchId;
      oldScoreA = bumped.oldScoreA;

      // I3: derselbe `:visible`-Filter wie oben -- ohne ihn kann dieser Test auf cloud-mobile
      // NIE grün werden (falscher DOM-Treffer), selbst wenn Z1 behoben wird.
      await expect(
        page.getByText(`${bumped.newScoreA}:0`, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible({ timeout: 3000 });
    } finally {
      // I6: Service-Role-Änderung IMMER zurückbauen, unabhängig vom Testausgang.
      if (matchId) {
        await restoreMatchScore(matchId, oldScoreA);
      }
    }
  });
});

/**
 * tests/e2e/cloud/public-view.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 5.
 */

import { execSync } from 'node:child_process';
import { test, expect } from './fixtures';
import {
  E2E_LIVE_CUP_ID,
  E2E_PUBLIC_CUP_ID,
  E2E_DRAFT_CUP_ID,
  E2E_PUBLIC_CUP_SHARE_CODE,
} from './testData';

// =============================================================================
// Direkter REST-Zugriff für den letzten Testfall ("Ein Tor, das owner einträgt") -- die
// Service-Role-Quelle wie `scripts/e2e-seed.ts`/`scripts/lib/localSupabaseStatus.ts`, hier per
// eigenem `execSync`, weil dieser Spec unter Playwright läuft (kein `tsx`-Node-Kontext).
// NUR für diesen einen Testfall: die eigentliche Bedienung läuft in den anderen T4-Specs
// (`two-devices.cloud.spec.ts`) durch die Oberfläche -- hier geht es NICHT um den Bedienweg,
// sondern ausschließlich darum, ob die öffentliche Ansicht eine bereits vorhandene
// Ergebnisänderung ohne Neuladen zeigt (Z1). Ein direktes Service-Role-Update umgeht bewusst
// `MatchExecutionService.initializeMatch()` (siehe `two-devices.cloud.spec.ts`-Kopfkommentar,
// Fehler B -- ein frisches Public-Cup-Spiel ließe sich über die Oberfläche derzeit gar nicht
// erst starten, das würde diesen von Z1 unabhängigen Test verfälschen).
// =============================================================================

interface LocalServiceRole {
  url: string;
  serviceRoleKey: string;
}

function getLocalServiceRole(): LocalServiceRole {
  const raw = execSync('supabase status -o json', { encoding: 'utf8' });
  const status = JSON.parse(raw) as Record<string, unknown>;
  const url = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (typeof url !== 'string' || typeof serviceRoleKey !== 'string') {
    throw new Error('`supabase status -o json` liefert kein API_URL/SERVICE_ROLE_KEY -- läuft der lokale Stack?');
  }
  return { url, serviceRoleKey };
}

async function bumpFirstFinishedMatchScore(tournamentId: string): Promise<{ matchId: string; newScoreA: number }> {
  const { url, serviceRoleKey } = getLocalServiceRole();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  const listRes = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.finished&select=id,score_a&order=id&limit=1`,
    { headers }
  );
  if (!listRes.ok) {
    throw new Error(`Matches-Abfrage fehlgeschlagen: ${listRes.status} ${await listRes.text()}`);
  }
  const rows = (await listRes.json()) as Array<{ id: string; score_a: number }>;
  if (rows.length === 0) {
    throw new Error(`Kein beendetes Spiel in Turnier ${tournamentId} gefunden.`);
  }
  const { id: matchId, score_a: scoreA } = rows[0];
  const newScoreA = scoreA + 1;

  const patchRes = await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ score_a: newScoreA }),
  });
  if (!patchRes.ok) {
    throw new Error(`Score-Update fehlgeschlagen: ${patchRes.status} ${await patchRes.text()}`);
  }
  return { matchId, newScoreA };
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
    // "einige Ergebnisse") -- mindestens EIN "2:0" muss irgendwo auf der Seite stehen.
    await expect(page.getByText('2:0').first()).toBeVisible({ timeout: 15000 });
  });

  test('Entwurf-Cup und Live-Cup (privat) sind per Direktlink nicht erreichbar', async ({ page }) => {
    // Beide haben laut Seed keinen share_code (T2) -- der einzige Direktlink ist die
    // ID-Route /#/public/:tournamentId (PublicTournamentViewScreen, versucht Share-Code-Format
    // ZUERST, fällt dann auf `repo.get(tournamentId)` zurück -- RLS lässt anonym nur
    // `is_public=true`-Turniere durch).
    await page.goto(`/#/public/${E2E_DRAFT_CUP_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Turnier nicht gefunden')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Entwurf-Cup', { exact: true })).toHaveCount(0);

    await page.goto(`/#/public/${E2E_LIVE_CUP_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Turnier nicht gefunden')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Live-Cup', { exact: true })).toHaveCount(0);
  });

  test('Ein Tor, das owner einträgt, erscheint ohne Neuladen', async ({ page }) => {
    // Bekannte Abweichung (Brief, Katalog-Schnitt Z1, docs/anforderungen/
    // 2026-09-24_zielbild-einzelturnier.md): PublicTournamentViewScreen lädt das Turnier NUR
    // einmalig beim Mount (ein `useEffect` mit `[tournamentId]`-Deps, keine Polling-/
    // Realtime-Subscription, src/screens/PublicTournamentViewScreen.tsx) -- eine
    // Ergebnisänderung erscheint nie ohne Neuladen.
    test.fail();

    await page.goto(`/#/live/${E2E_PUBLIC_CUP_SHARE_CODE}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const { newScoreA } = await bumpFirstFinishedMatchScore(E2E_PUBLIC_CUP_ID);

    await expect(page.getByText(`${newScoreA}:0`).first()).toBeVisible({ timeout: 3000 });
  });
});

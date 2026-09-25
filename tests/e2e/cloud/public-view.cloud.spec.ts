/**
 * tests/e2e/cloud/public-view.cloud.spec.ts — Task T4 (`.superpowers/sdd/2026-09-24-testumgebung/
 * task-T4-brief.md`), Spec 5.
 */

import { test, expect } from './fixtures';
import { getLocalServiceRoleClient, safeCleanup } from './helpers';
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
// Fixrunde 2 (N1, Ruling AB): Der Fixrunde-1-"Offset" (je Projekt ein anderes Spiel) behob das
// beobachtete Falsch-Grün NICHT -- beide beendeten Public-Cup-Spiele stehen im Seed auf 2:0, ein
// `getByText('<score>:0')` ohne Bindung an EIN bestimmtes Spiel findet immer irgendein
// passendes Ergebnis, auch das der jeweils ANDEREN, gleichzeitig laufenden Projekt-Instanz.
// Zwei unabhängige Fixes: (a) dieser Test läuft jetzt NUR auf `cloud-desktop` (wie
// `two-devices`/`offline`/`publish-coadmin`) -- keine zweite, gleichzeitige Instanz mehr, die
// denselben Datensatz ändert. (b) Der Zielwert ist nicht mehr "+1" (2:0 -> 3:0, ein Wert, der
// im Seed bereits zweimal vorkommt), sondern ein Wert, der in KEINEM Public-Cup-Spiel vorkommen
// kann (`97`), UND die Prüfung ist an die Zeile DES GEÄNDERTEN SPIELS gebunden (`role="row"` +
// `aria-label` mit beiden Team-Namen, `MatchCardDesktop.tsx:218-219`), nicht an einen freien
// Text irgendwo auf der Seite. `role="row"` ist NUR die Desktop-Kartenvariante (Mobile nutzt
// `role="article"`, `MatchCard.tsx:230`) -- exakt EIN Treffer, kein `:visible`-Filter nötig.
// =============================================================================

/** Ziel-Heimtore für Test 3 -- kann in keinem Public-Cup-Spiel natürlich vorkommen (N1). */
const UNIQUE_TARGET_SCORE_A = 97;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface FinishedMatchWithTeams {
  matchId: string;
  oldScoreA: number;
  homeTeamName: string;
  awayTeamName: string;
}

/**
 * Liest das erste beendete Public-Cup-Spiel INKLUSIVE der Team-Namen (für die Zeilen-Bindung).
 *
 * Empirisch geprüft (per Probe-Test gegen die echte Seite, siehe Report): der Public-Cup-Seed
 * (`scripts/e2e-seed.ts`, bestehender Zustand, nicht Teil dieser Fixrunde) lässt `matches.
 * team_a_id`/`team_b_id` NULL, weil `mapMatchToSupabase()` (`supabaseMappers.ts:191`) das
 * Domain-Feld `match.teamA` fälschlich als TEAM-NAMEN behandelt (`teamNameToId.get(match.teamA)`)
 * -- der Schedule-Generator befüllt `match.teamA` aber mit der Team-ID (`originalTeamA`,
 * `scripts/e2e-seed.ts:601` `teamA: scheduledMatch.originalTeamA`). Die ID landet deshalb in
 * `team_a_placeholder`/`team_b_placeholder` STATT in `team_a_id`/`team_b_id` (leer). Beim
 * Rück-Lesen wird `team_a_placeholder` genauso in `match.teamA`/`originalTeamA` zurückgespiegelt
 * (`supabaseMappers.ts:124-126`) -- und `getTeamForDisplay()` (`GroupStageSchedule.tsx:392`)
 * löst `match.originalTeamA` GENAUSO gegen `tournament.teams` auf, egal ob der Wert ursprünglich
 * aus `team_a_id` ODER `team_a_placeholder` kam. Deshalb zeigt die UI trotzdem die echten
 * Team-Namen ("Public Bären" statt der rohen ID) -- diese Funktion bildet das nach: BEIDE Felder
 * (`team_a_id` UND `team_a_placeholder`) werden als mögliche Team-ID versucht, nicht nur
 * `team_a_id`. Eine naive Fassung (nur `team_a_id`, `team_a_placeholder` als literaler
 * Namens-Fallback) wurde per Probe widerlegt: sie hätte an die ROHE UUID statt an "Public Bären"
 * gebunden, der Row-Locator hätte nie etwas gefunden (in Fixrunde 2 selbst beobachtet, siehe
 * Report).
 */
async function getFirstFinishedMatchWithTeams(tournamentId: string): Promise<FinishedMatchWithTeams> {
  const { url, headers } = getLocalServiceRoleClient();

  const listRes = await fetch(
    `${url}/rest/v1/matches?tournament_id=eq.${tournamentId}&match_status=eq.finished&select=id,score_a,team_a_id,team_b_id,team_a_placeholder,team_b_placeholder&order=id&limit=1`,
    { headers }
  );
  if (!listRes.ok) {
    throw new Error(`Matches-Abfrage fehlgeschlagen: ${listRes.status} ${await listRes.text()}`);
  }
  const rows = (await listRes.json()) as Array<{
    id: string;
    score_a: number;
    team_a_id: string | null;
    team_b_id: string | null;
    team_a_placeholder: string | null;
    team_b_placeholder: string | null;
  }>;
  if (rows.length === 0) {
    throw new Error(`Kein beendetes Spiel in Turnier ${tournamentId} gefunden.`);
  }
  const { id: matchId, score_a: oldScoreA, team_a_id: teamAId, team_b_id: teamBId, team_a_placeholder: teamAPlaceholder, team_b_placeholder: teamBPlaceholder } = rows[0];

  // Beide möglichen ID-Quellen versuchen (siehe Kommentar oben) -- `team_a_id` zuerst, falls die
  // App das je wieder korrekt befüllt, sonst `team_a_placeholder`.
  const candidateIds = [teamAId, teamBId, teamAPlaceholder, teamBPlaceholder].filter(
    (id): id is string => id !== null
  );
  const teamNameById = new Map<string, string>();
  if (candidateIds.length > 0) {
    const teamsRes = await fetch(`${url}/rest/v1/teams?id=in.(${candidateIds.join(',')})&select=id,name`, { headers });
    if (!teamsRes.ok) {
      throw new Error(`Teams-Abfrage fehlgeschlagen: ${teamsRes.status} ${await teamsRes.text()}`);
    }
    const teamRows = (await teamsRes.json()) as Array<{ id: string; name: string }>;
    for (const t of teamRows) {
      teamNameById.set(t.id, t.name);
    }
  }

  // N14 (Fixrunde 3): KEIN stiller Rückfall mehr auf den rohen Platzhalter-STRING (vorher
  // `?? placeholder`) -- das hätte bei einem künftigen Fix an `mapMatchToSupabase()` (der die
  // ID-Verwechslung oben behebt) oder einer geänderten Übersetzung STILL einen falschen "Namen"
  // (eine rohe UUID) statt eines echten Team-Namens geliefert, ohne dass diese Funktion selbst
  // das bemerkt hätte -- der Fehler wäre erst indirekt sichtbar geworden, wenn der Row-Locator
  // unten nichts findet, und das läge NACH `test.fail()` (s. dort), also fälschlich als
  // "erwartet rot" durchgegangen (die eigentliche Absicherung dagegen ist ohnehin schon die
  // Vorbedingungsprüfung dort). `resolve()` liefert jetzt NUR einen Namen, der tatsächlich in
  // `teams` gefunden wurde -- sonst `undefined`, und der Aufrufer unten wirft dann selbst (siehe
  // `if (!homeTeamName || !awayTeamName)`).
  const resolve = (id: string | null, placeholder: string | null): string | undefined =>
    (id ? teamNameById.get(id) : undefined) ?? (placeholder ? teamNameById.get(placeholder) : undefined);

  const homeTeamName = resolve(teamAId, teamAPlaceholder);
  const awayTeamName = resolve(teamBId, teamBPlaceholder);
  if (!homeTeamName || !awayTeamName) {
    throw new Error(
      `Team-Namen für Spiel ${matchId} nicht auflösbar (teamAId=${teamAId}, teamBId=${teamBId}, ` +
      `teamAPlaceholder=${teamAPlaceholder}, teamBPlaceholder=${teamBPlaceholder}).`
    );
  }

  return { matchId, oldScoreA, homeTeamName, awayTeamName };
}

async function setMatchScoreA(matchId: string, scoreA: number): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/matches?id=eq.${matchId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ score_a: scoreA }),
  });
  if (!res.ok) {
    throw new Error(`Score-Update fehlgeschlagen (Match ${matchId}, score_a=${scoreA}): ${res.status} ${await res.text()}`);
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
    // Teilstring-Treffer wie "12:00". Dieser Test bleibt bewusst frei-textlich und auf beiden
    // Projekten -- er behauptet nur "irgendein Ergebnis ist sichtbar", ändert selbst nichts, und
    // ist deshalb von der Race-Problematik aus Test 3 nicht betroffen (siehe Kopfkommentar).
    await expect(page.getByText('2:0', { exact: true }).filter({ visible: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('Entwurf-Cup und Live-Cup (privat) sind per Direktlink nicht erreichbar', async ({ page }) => {
    // Beide haben laut Seed keinen share_code (T2) -- der einzige Direktlink ist die
    // ID-Route /#/public/:tournamentId (PublicTournamentViewScreen, versucht Share-Code-Format
    // ZUERST, fällt dann auf `repo.get(tournamentId)` zurück -- RLS lässt anonym nur
    // `is_public=true`-Turniere durch). Fixrunde 2 (N3): der Entwurf-Cup ist wieder ein reiner
    // Entwurf (kein `publishedAt`, Ruling AA) -- dieser Test bleibt davon unberührt, er prüfte
    // ohnehin nur `is_public=false`.
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
    // Ruling AB: nur auf cloud-desktop -- dieser Test ändert per Service-Role EINE Zeile im
    // Public-Cup; eine gleichzeitige zweite Projekt-Instanz (cloud-mobile) würde entweder
    // dieselbe Zeile treffen (Konflikt) oder ihre eigene Vorbedingung ("2:0 sichtbar", Test 1
    // oben) durch den fremden Zwischenzustand gefährden. Siehe Kopfkommentar (N1).
    test.skip(
      !testInfo.project.name.includes('desktop'),
      'Ändert per Service-Role eine Public-Cup-Zeile -- nur auf einem Projekt ausgeführt, siehe Kopfkommentar (N1).'
    );

    let matchInfo: FinishedMatchWithTeams | null = null;
    try {
      await page.goto(`/#/live/${E2E_PUBLIC_CUP_SHARE_CODE}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });

      matchInfo = await getFirstFinishedMatchWithTeams(E2E_PUBLIC_CUP_ID);

      // N1: an die Zeile DES GEÄNDERTEN SPIELS gebunden (role="row" + beide Team-Namen im
      // aria-label), nicht an freien Text -- UND ein Zielwert, der in keinem anderen
      // Public-Cup-Spiel vorkommen kann.
      const matchRow = page.getByRole('row', {
        name: new RegExp(`${escapeRegExp(matchInfo.homeTeamName)}.*${escapeRegExp(matchInfo.awayTeamName)}`, 'i'),
      });

      // N14 (Fixrunde 3): Zeilenbindung UND Ausgangszustand VOR dem PATCH beweisen -- nicht erst
      // nach `test.fail()`. Fände der Zeilen-Locator NACH `test.fail()` nichts (z.B. weil eine
      // geänderte aria-label-Übersetzung, ein Fix an `mapMatchToSupabase()` oder ein anderer,
      // hier nicht vorgesehener Grund die Bindung bricht), würde das fälschlich als "erwartet
      // rot" (Z1) durchgehen, statt als kaputte Testinfrastruktur aufzufallen -- genau der Fehler,
      // den der Implementer beim ersten Entwurf selbst erlebt hat (nur eine einmalige Probe deckte
      // ihn auf, der Test selbst schützte nicht davor, siehe Report).
      await expect(matchRow).toBeVisible({ timeout: 15000 });
      await expect(matchRow.getByText('2:0', { exact: true })).toBeVisible({ timeout: 15000 });

      // N5(1): PATCH steht VOR test.fail() -- ein scheiternder PATCH ist ein echter Fehlschlag,
      // kein fälschlich "erwarteter".
      await setMatchScoreA(matchInfo.matchId, UNIQUE_TARGET_SCORE_A);

      // I4: test.fail() direkt vor dem bekannten Bruchpunkt -- die Vorbedingungen oben (Seite
      // zeigt den Public-Cup, Zeile gefunden, Ausgangs-Score gesehen, PATCH erfolgreich) sind
      // jetzt echte Fehlschläge. Bekannte Abweichung (Brief, Katalog-Schnitt Z1, docs/anforderungen/
      // 2026-09-24_zielbild-einzelturnier.md): PublicTournamentViewScreen lädt das Turnier NUR
      // einmalig beim Mount (ein `useEffect` mit `[tournamentId]`-Deps, keine Polling-/
      // Realtime-Subscription, src/screens/PublicTournamentViewScreen.tsx) -- eine
      // Ergebnisänderung erscheint nie ohne Neuladen.
      test.fail();

      await expect(matchRow.getByText(`${UNIQUE_TARGET_SCORE_A}:0`, { exact: true })).toBeVisible({ timeout: 3000 });
    } finally {
      // I6: Service-Role-Änderung IMMER zurückbauen, unabhängig vom Testausgang. N16 (Fixrunde 3):
      // `safeCleanup()` -- ein scheiternder Rückbau darf die eigentliche Z1-Fehlermeldung dieses
      // Tests nicht verdecken (siehe `helpers.ts#safeCleanup`).
      if (matchInfo) {
        const info = matchInfo;
        await safeCleanup('Public-Cup Score zurücksetzen', () => setMatchScoreA(info.matchId, info.oldScoreA));
      }
    }
  });
});

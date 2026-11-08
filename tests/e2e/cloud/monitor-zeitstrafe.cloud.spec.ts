/**
 * tests/e2e/cloud/monitor-zeitstrafe.cloud.spec.ts — Zeitstrafe am Monitor und auf der Zuschauer-Seite über die ECHTE
 * Server-Antwort (@ZM-180-Muster: jeder Übertragungsweg wird über `public_payload` geprüft, nicht über Testdaten im Client).
 *
 * Olli (angemeldet) trägt im Cockpit eine Zeitstrafe für die Rückennummer 5 des Gastteams ein; ein NICHT angemeldeter
 * Hallenmonitor (Live-Folie Feld 1) und die Zuschauer-Seite am Handy (390 × 844) folgen ohne Neuladen.
 * - @ZM-182: am Kasten des Gastteams ein Kreis mit „5“, der Ring nimmt mit der Spielzeit ab; angehaltene Uhr → grauer Ring.
 * - @ZM-184: auf der Zuschauer-Seite beim Gastteam „Zeitstrafe #5 · m:ss“, die Restzeit zählt herunter.
 * - @ZM-183: „Ereignisse je Spiel“ aus bzw. Kindermodus → an keinem Kasten ein Kreis, kein Hinweis; wieder an → Kreis zurück.
 * - Der Eintrag trägt die Dauer der Regel (`durationSeconds` 120): Grundlage der Restzeit ohne öffentliche Spielregel.
 * - Zeitstrafe endet beim Gegentor (Befund C-ZEITSTRAFE-GEGENTOR-FEHLT): der Eintrag trägt auch die Regel (`endsOnGoal`), die
 *   öffentliche Antwort gibt sie als `ends_on_goal` weiter (Migration 20261124_001).
 *   @ZM-194: Live-Stand aus → weder Kreis noch Hinweis (die Tore fehlen, das Strafende wäre nicht ableitbar).
 *   @ZM-192 / @W2A-013 / @SL-030: Tor für das Heimteam → der Kreis verschwindet am Monitor, der Hinweis auf der Zuschauer-Seite
 *   auch, das Cockpit zeigt „darf sich ergänzen“. @SL-044: Tor zurückgenommen → der Kreis läuft mit der Restzeit weiter.
 * Frist wie monitor-sofort (F6): CI 2 s, lokal 1 s – für das Erscheinen nach dem Eintrag; Schalter wirken über die nächste
 * Abfrage (großzügiger Takt).
 */
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectSeededEngineMatch, fetchEngineRows, newRoleContext, openCockpit } from './engineHelpers';
import { getLocalServiceRoleClient } from './helpers';
import { serviceRest } from './restAsRole';
import { E2E_MONZEITSTRAFE_MONITOR_ID, E2E_MONZEITSTRAFE_SHARE_CODE, engineCupIds } from './testData';
import { schliesseTorAuswahl, wartePicker } from '../helpers/cockpitNeu';

/** F6: CI prüft 2 s, lokal 1 s (Sofort-Kanal); +500 ms Puffer wie monitor-sofort. */
const FRIST_MS = (process.env.CI ? 2_000 : 1_000) + 500;
/** Schalter des Turniers: erreichen Monitor und Zuschauer-Seite über Signal bzw. den 10-Sekunden-Takt. */
const SCHALTER_MS = 20_000;

async function patchConfig(tournamentId: string, change: Record<string, unknown>): Promise<void> {
  const row = await serviceRest('GET', `tournaments?id=eq.${tournamentId}&select=config`);
  const [current] = row.json as Array<{ config: Record<string, unknown> | null }>;
  const res = await serviceRest('PATCH', `tournaments?id=eq.${tournamentId}`, { config: { ...(current.config ?? {}), ...change } });
  expect(res.status, res.text).toBeLessThan(300);
}

async function anonymerMonitor(context: BrowserContext, tournamentId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/display/${tournamentId}/${E2E_MONZEITSTRAFE_MONITOR_ID}`);
  await expect(page.locator('[data-position="home"]').first()).toBeVisible({ timeout: 15_000 });
  return page;
}

async function zuschauerSeite(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/live/${E2E_MONZEITSTRAFE_SHARE_CODE}`);
  // Die sichtbare Spielkarte ist ein Artikel; weitere [data-match-card]-Knoten der Seite sind verborgen
  await expect(page.getByRole('article').first()).toBeVisible({ timeout: 15_000 });
  return page;
}

interface OeffentlichesEreignis { type: string; team_id: string; clock_ms?: number; number?: number; duration_seconds?: number; ends_on_goal?: boolean }

/** Die Ereignisse des Spiels, wie der Server sie Zuschauern ausliefert (`public_tournament`, ohne Anmeldung, nur der öffentliche Schlüssel). */
async function oeffentlicheEreignisse(matchId: string): Promise<OeffentlichesEreignis[]> {
  const { url, anonKey } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/rpc/public_tournament`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ share_code: E2E_MONZEITSTRAFE_SHARE_CODE, since_version: null }),
  });
  expect(res.status).toBe(200);
  const antwort = await res.json() as { matches?: Array<{ id: string; events?: OeffentlichesEreignis[] }> };
  return antwort.matches?.find((m) => m.id === matchId)?.events ?? [];
}

const sekunden = (text: string | null): number => {
  const m = /(\d+):(\d{2})/.exec(text ?? '');
  if (m === null) { throw new Error(`keine Restzeit in „${text ?? ''}“`); }
  return Number(m[1]) * 60 + Number(m[2]);
};

test.describe('Zeitstrafe am Monitor und auf der Zuschauer-Seite (echte Server-Antwort)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop (kein gleichzeitiger Mobil-Lauf auf demselben Cup).');
  });

  test('@ZM-182 @ZM-184 @ZM-183 @ZM-192 Zeitstrafe #5: Kreis am Monitor, Restzeit beim Team; Schalter aus und Kindermodus verbergen sie', async ({ browser }) => {
    test.setTimeout(180_000);
    const ids = engineCupIds('MONZEITSTRAFE');
    await expectSeededEngineMatch(engineCupTarget('MONZEITSTRAFE'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext(); // nicht angemeldet
    const handy = await browser.newContext({ viewport: { width: 390, height: 844 } }); // nicht angemeldet
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(olli.page);
      const monitor = await anonymerMonitor(halle, ids.tournamentId);
      const zuschauer = await zuschauerSeite(handy);
      const kreisGast = monitor.locator('[data-testid="live-penalties-away"] [data-zeitstrafe]');
      const hinweisGast = zuschauer.getByTestId(`match-time-penalty-${ids.matchId}-away`).filter({ visible: true });
      // Gegenbeispiel vorab: ohne Strafe kein Kreis und kein Hinweis
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0);
      await expect(zuschauer.getByTestId(`match-time-penalty-${ids.matchId}-home`).filter({ visible: true })).toHaveCount(0);

      // Wenn Olli im Cockpit eine Zeitstrafe für die Rückennummer 5 des Gastteams einträgt
      await olli.page.getByTestId('penalty-button-away').click();
      await wartePicker(olli.page);
      await olli.page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
      await expect(olli.page.getByTestId('number-picker')).toBeHidden();

      // Dann zeigt der Monitor am Kasten des Gastteams einen Kreis mit „5“ (@ZM-182), innerhalb der Frist
      await expect(kreisGast).toHaveCount(1, { timeout: FRIST_MS });
      await expect(kreisGast).toHaveText('5');
      await expect(monitor.locator('[data-testid="live-penalties-home"]')).toHaveCount(0);
      // Und die Zuschauer-Seite beim Gastteam „Zeitstrafe #5 · m:ss“ (@ZM-184)
      await expect(hinweisGast).toHaveText(/^Zeitstrafe #5 · [12]:\d{2}$/, { timeout: SCHALTER_MS });

      // Der Eintrag trägt die Dauer der Regel (2 Minuten): Monitor und Zuschauer rechnen damit
      const strafen = (await fetchEngineRows(ids.matchId)).filter((row) => row.type === 'TIME_PENALTY');
      expect(strafen.map((row) => [row.payload.playerNumber, row.payload.durationSeconds])).toEqual([[5, 120]]);
      // Und die Regel „endet bei Gegentor“ (Vorgabe an) steht im Eintrag; die öffentliche Antwort gibt sie weiter
      expect(strafen.map((row) => row.payload.endsOnGoal)).toEqual([true]);

      // Der Ring nimmt mit der Spielzeit ab, die Restzeit auf der Zuschauer-Seite zählt herunter
      const anteilVorher = Number(await kreisGast.getAttribute('data-anteil'));
      const restVorher = sekunden(await hinweisGast.textContent());
      await expect.poll(async () => Number(await kreisGast.getAttribute('data-anteil')), { timeout: 5_000 }).toBeLessThan(anteilVorher);
      await expect.poll(async () => sekunden(await hinweisGast.textContent()), { timeout: 5_000 }).toBeLessThan(restVorher);
      await expect(kreisGast).toHaveAttribute('data-steht', 'false');

      // @ZM-192: Olli hält die Uhr an → grauer Ring, der Ring steht; Weiter → läuft wieder
      await olli.page.getByTestId('match-pause-button').click();
      await expect(kreisGast).toHaveAttribute('data-steht', 'true', { timeout: FRIST_MS });
      await olli.page.getByRole('button', { name: 'Weiter' }).click();
      await expect(kreisGast).toHaveAttribute('data-steht', 'false', { timeout: FRIST_MS });

      // @ZM-183: „Ereignisse je Spiel“ aus → an keinem Kasten ein Kreis, kein Hinweis beim Team
      await patchConfig(ids.tournamentId, { publicEvents: false });
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0, { timeout: SCHALTER_MS });
      await expect(hinweisGast).toHaveCount(0, { timeout: SCHALTER_MS });

      // Ereignisse wieder an → der Kreis ist zurück (erst dann sagt „kein Kreis“ im Kindermodus etwas aus)
      await patchConfig(ids.tournamentId, { publicEvents: true });
      await expect(kreisGast).toHaveCount(1, { timeout: SCHALTER_MS });

      // @ZM-183: Kindermodus (Ereignisse bleiben an) → der Kreis verschwindet wieder, kein Hinweis beim Team
      await patchConfig(ids.tournamentId, { hideScoresForPublic: true });
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0, { timeout: SCHALTER_MS });
      await expect(hinweisGast).toHaveCount(0, { timeout: SCHALTER_MS });

      // Gegenprobe: wieder normal → der Kreis ist zurück (der Schalter war die Ursache, die Strafe läuft noch)
      await patchConfig(ids.tournamentId, { hideScoresForPublic: false });
      await expect(kreisGast).toHaveCount(1, { timeout: SCHALTER_MS });
      await expect(hinweisGast).toHaveText(/^Zeitstrafe #5 · \d:\d{2}$/, { timeout: SCHALTER_MS });

      // @ZM-194: Live-Stand aus (Ereignisse an) → die Tore fehlen in der Antwort: weder Kreis noch Hinweis; das Cockpit zeigt die Strafe weiter
      await patchConfig(ids.tournamentId, { publicLiveScore: false });
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0, { timeout: SCHALTER_MS });
      await expect(hinweisGast).toHaveCount(0, { timeout: SCHALTER_MS });
      await expect(olli.page.getByTestId('strafen-spalte').or(olli.page.getByTestId('scoreboard')).getByText(/#5/).first()).toBeVisible();
      await patchConfig(ids.tournamentId, { publicLiveScore: true });
      await expect(kreisGast).toHaveCount(1, { timeout: SCHALTER_MS });

      // @ZM-192 @W2A-013 @SL-030: Olli trägt ein Tor für das Heimteam ein → der Kreis verschwindet, der Hinweis auch
      await olli.page.getByTestId('goal-button-home').click();
      await schliesseTorAuswahl(olli.page);
      await expect(kreisGast).toHaveCount(0, { timeout: FRIST_MS });
      await expect(hinweisGast).toHaveCount(0, { timeout: SCHALTER_MS });
      // Das Cockpit zeigt, dass sich das Gastteam ergänzen darf
      await expect(olli.page.getByTestId('team-ergaenzen-away')).toHaveText('darf sich ergänzen');
      // @ZM-180: die ECHTE Server-Antwort trägt Strafe (mit Regel) und Tor – nicht Testdaten im Client
      const ereignisse = await oeffentlicheEreignisse(ids.matchId);
      // Der Seed bringt ein Tor des Heimteams VOR der Strafe mit (es beendet sie nicht); danach Strafe und das neue Tor
      expect(ereignisse.map((e) => [e.type, e.team_id === ids.homeTeamId ? 'home' : 'away'])).toEqual([['GOAL', 'home'], ['TIME_PENALTY', 'away'], ['GOAL', 'home']]);
      const [seedTor, strafeNr5, torNachher] = ereignisse;
      expect(strafeNr5).toMatchObject({ duration_seconds: 120, ends_on_goal: true, number: 5 });
      expect(seedTor.clock_ms ?? 0).toBeLessThanOrEqual(strafeNr5.clock_ms ?? 0);
      expect(torNachher.clock_ms).toBeGreaterThan(strafeNr5.clock_ms ?? 0);

      // @SL-044: Tor zurückgenommen → die Strafe läuft mit ihrer Restzeit weiter: Kreis zurück, Hinweis im Cockpit weg
      await olli.page.getByTestId('match-undo-button').click();
      await expect(kreisGast).toHaveCount(1, { timeout: FRIST_MS });
      await expect(olli.page.getByTestId('team-ergaenzen-away')).toHaveCount(0);
    } finally {
      await olli.context.close();
      await halle.close();
      await handy.close();
    }
  });
});

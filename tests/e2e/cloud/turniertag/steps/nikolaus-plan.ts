/**
 * N1, N2, N5: der Spielplan des Nikolaus-Turniers (Meilenstein M-S, Prüfschritt 1). Der Plan stammt aus dem echten Generator (Runden-Spielplan,
 * Eröffnung „guest-opening“); die Schritte lesen ihn aus der Cloud und aus der Oberfläche der Turnierleitung. Alle Schritte hier rühren das
 * Hauptturnier nicht an. N5 (Zeitplan vor dem ersten Anpfiff vorziehen) läuft auf dem Zwilling des Turniers: das Hauptturnier braucht Spiel 1 für N3/N4.
 *
 * Ohne Szenario bleibt „Spielplan zeigt Runden“ (M-S Schritt 1): die Oberfläche kennt keine Runden, die Szenarien @W4-029 bis @W4-031 beschreiben
 * nur die Eigenschaften des Plans (Gleichstand nach jeder Runde, Heim/Gast, Abstand).
 */
import { expect, type Page } from '@playwright/test';
import { E2E_NIKOLAUS_CUPS, E2E_NIKOLAUS_HOST_TEAM_NAMES } from '../../testData';
import { expectPageAnchor, expectSollMarker } from './shared';
import { fetchNikolausSpiele, ladeSpielplan, openNikolausPath, paarung, type NikolausMatch } from './nikolaus-shared';
import type { StepContext, TurniertagStep } from './types';

const ZWILLING = E2E_NIKOLAUS_CUPS.zeitplan;

/** Spiele je Team nach den ersten `bis` Spielen. */
function spieleJeTeam(spiele: readonly NikolausMatch[], bis: number): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const spiel of spiele.slice(0, bis)) {
    for (const id of [spiel.team_a_id, spiel.team_b_id]) {
      zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
    }
  }
  return zaehler;
}

/** N1a: nach Spiel 3, 6, 9, 12 und 15 haben alle Teams gleich viele Spiele, nie hat eines mehr als ein Spiel mehr als ein anderes (@W4-029). */
async function rundenGleichstand(): Promise<void> {
  const { spiele } = await ladeSpielplan();
  for (const bis of [3, 6, 9, 12, 15]) {
    const zaehler = spieleJeTeam(spiele, bis);
    expect(zaehler.size, `nach Spiel ${bis} haben alle sechs Teams gespielt`).toBe(6);
    expect(new Set(zaehler.values()).size, `nach Spiel ${bis} haben alle gleich viele Spiele`).toBe(1);
  }
  for (let bis = 1; bis <= 15; bis++) {
    const werte = [...spieleJeTeam(spiele, bis).values()];
    expect(werte.length === 6 ? Math.max(...werte) - Math.min(...werte) : 1, `nach Spiel ${bis} höchstens 1 Spiel Unterschied`).toBeLessThanOrEqual(1);
  }
}

/** N1b: jedes Team hat 2 oder 3 Heimspiele und ist nie dreimal hintereinander Heim- oder Gastmannschaft (@W4-030). */
async function heimGastWechsel(): Promise<void> {
  const { spiele, namen } = await ladeSpielplan();
  for (const [teamId, name] of namen) {
    const seiten = spiele
      .filter((s) => s.team_a_id === teamId || s.team_b_id === teamId)
      .map((s) => (s.team_a_id === teamId ? 'H' : 'G'))
      .join('');
    const heim = [...seiten].filter((seite) => seite === 'H').length;
    expect([2, 3], `${name}: ${seiten}`).toContain(heim);
    expect(seiten, name).not.toMatch(/HHH|GGG/);
  }
}

/** N1c: zwischen zwei Spielen desselben Teams liegt mindestens ein Spiel, so wie der DFB-Schlüssel für 6 Teams es verlangt (@W4-031). */
async function abstand(): Promise<void> {
  const { spiele, namen } = await ladeSpielplan();
  for (const [teamId, name] of namen) {
    const nummern = spiele.flatMap((s, i) => (s.team_a_id === teamId || s.team_b_id === teamId ? [i] : []));
    expect(nummern, `${name} spielt fünfmal`).toHaveLength(5);
    for (let i = 1; i < nummern.length; i++) {
      expect(nummern[i] - nummern[i - 1] - 1, `${name}: Spiele zwischen Spiel ${nummern[i - 1] + 1} und ${nummern[i] + 1}`).toBeGreaterThanOrEqual(1);
    }
  }
}

/** Uhrzeit und „<Heim> gegen <Gast>“ der Zeilen im Spielplan, nach Uhrzeit sortiert (die Spielnummer der Beschriftung ist nicht verlässlich: `match_number` fehlt, C-FINALRUNDE-REIHENFOLGE). */
async function zeilenImSpielplan(seite: Page): Promise<string[]> {
  const gesehen = new Map<string, string>();
  await expect(async () => {
    for (const bruchteil of [0, 0.5, 1]) {
      await seite.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), bruchteil);
      await seite.waitForTimeout(200);
      const zeilen = await seite.getByRole('row').evaluateAll((els) =>
        els.map((el) => ({ label: el.getAttribute('aria-label') ?? '', text: (el as HTMLElement).innerText.trim() }))
      );
      for (const { label, text } of zeilen) {
        const treffer = /^Spiel \d+: (.+)$/.exec(label);
        const zeit = /^(\d{2}:\d{2})/.exec(text)?.[1];
        if (treffer && zeit) {
          gesehen.set(zeit, treffer[1]);
        }
      }
    }
    expect(gesehen.size).toBe(15);
  }).toPass({ timeout: 20000 });
  return [...gesehen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([zeit, text]) => `${zeit} ${text}`);
}

/** N2a: Spiel 1 ist eine Waging-Mannschaft als Heimmannschaft gegen einen Gast, das Vereinsduell liegt in Runde 2 (Spiel 4 bis 6); die Oberfläche zeigt denselben Plan (@W4-027, @W4-033). */
async function eroeffnungWaging({ asRole }: StepContext): Promise<void> {
  const { spiele, namen } = await ladeSpielplan();
  const [rot, blau] = E2E_NIKOLAUS_HOST_TEAM_NAMES;
  const heim = namen.get(spiele[0].team_a_id) ?? '';
  const gast = namen.get(spiele[0].team_b_id) ?? '';
  expect([rot, blau], `Spiel 1: ${heim} gegen ${gast}`).toContain(heim);
  expect([rot, blau], 'Spiel 1 ist gegen einen Gast').not.toContain(gast);
  const duell = spiele.flatMap((s, i) => ([rot, blau].includes(namen.get(s.team_a_id) as never) && [rot, blau].includes(namen.get(s.team_b_id) as never) ? [i + 1] : []));
  expect(duell, 'das Vereinsduell liegt in Runde 2 (Spiel 4 bis 6)').toHaveLength(1);
  expect(duell[0]).toBeGreaterThanOrEqual(4);
  expect(duell[0]).toBeLessThanOrEqual(6);

  const ownerPage = await asRole('owner');
  await openNikolausPath(ownerPage, '/schedule');
  await expectPageAnchor(ownerPage.getByRole('button', { name: 'Spielplan bearbeiten' }), 'Spielplan der Turnierleitung');
  expect(await zeilenImSpielplan(ownerPage), 'der Spielplan der Turnierleitung zeigt den Plan der Cloud').toEqual(spiele.map((s) => `${(s.scheduled_start ?? '').slice(0, 5)} ${paarung(s, namen)}`));
}

/** N2b: im Assistenten markiert die Turnierleitung „TSV Waging rot“ als „Mannschaft des Veranstalters“ (@W4-034). */
async function markierungImAssistenten({ asRole }: StepContext): Promise<void> {
  const ownerPage = await asRole('owner');
  await ownerPage.goto('/#/tournament/new?step=5');
  await ownerPage.waitForLoadState('networkidle');
  await expectPageAnchor(ownerPage.getByTestId('wizard-add-team'), 'Assistent, Schritt Teams');
  await expectSollMarker(ownerPage, 'wizard-team-host-checkbox');
}

/**
 * N5: vor dem ersten Anpfiff (Zwilling des Turniers, kein Spiel angepfiffen) zieht die Turnierleitung den ganzen Zeitplan um 15 Minuten vor.
 * Zuschauer-Seite und Hallenmonitor liegen offen: sie zeigen es ohne Neuladen innerhalb von 10 Sekunden, Spiel 1 mit „ursprünglich 16:30“
 * (@ZP-089, @ZP-090). Die Warnung „Spiel 1 beginnt in 5 Minuten“ hängt an der Uhrzeit 16:10 und ist nicht Teil dieses Schritts.
 */
async function zeitplanVorziehen({ asRole, browser }: StepContext): Promise<void> {
  const { spiele } = await ladeSpielplan(ZWILLING);
  expect(spiele.map((s) => s.actual_start), 'im Zwilling ist noch kein Spiel angepfiffen').toEqual(spiele.map(() => null));
  const zuschauerKontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const zuschauer = await zuschauerKontext.newPage();
  await zuschauer.goto(`/#/live/${ZWILLING.shareCode}`);
  await expectPageAnchor(zuschauer.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite des Zwillings');
  const monitor = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await monitor.goto(`/#/display/${ZWILLING.tournamentId}/${ZWILLING.monitorId}`);

  const ownerPage = await asRole('owner');
  await openNikolausPath(ownerPage, '/schedule', ZWILLING);
  await expectPageAnchor(ownerPage.getByRole('button', { name: 'Spielplan bearbeiten' }), 'Spielplan der Turnierleitung');
  await expectSollMarker(ownerPage, 'schedule-shift-button');
  await ownerPage.getByTestId('schedule-shift-button').click();
  await expect(ownerPage.getByText('Spiel 1 beginnt um 16:15 statt 16:30 · 15 Spiele rücken 15 Minuten vor · neues Ende 18:45')).toBeVisible({ timeout: 5000 });
  await ownerPage.getByRole('button', { name: 'Übernehmen' }).click();
  await expect.poll(async () => (await fetchNikolausSpiele(ZWILLING)).map((s) => s.scheduled_start), { timeout: 10000 }).toEqual(
    spiele.map((_, i) => `${String(16 + Math.floor((15 + i * 10) / 60)).padStart(2, '0')}:${String((15 + i * 10) % 60).padStart(2, '0')}:00`)
  );
  const zeile1 = zuschauer.locator('[role="row"]', { hasText: 'TSV Waging rot' }).first();
  await expect(zeile1, 'Zuschauer-Seite ohne Neuladen: Spiel 1 um 16:15, ursprünglich 16:30').toContainText(/16:15[\s\S]*ursprünglich 16:30/, { timeout: 10000 });
  await expect(monitor.locator('body'), 'Hallenmonitor: Nächstes Spiel 16:15').toContainText(/Nächstes Spiel[\s\S]*16:15/, { timeout: 10000 });
}

export const steps: readonly TurniertagStep[] = [
  { id: 'N1a', title: 'Spielplan in Runden: nach jeder Runde gleich viele Spiele', scenarios: ['@W4-029'], owner: 'Runden-Spielplan (gebaut, #290)', expectedFail: false, run: rundenGleichstand },
  { id: 'N1b', title: 'Spielplan: kein Team dreimal hintereinander Heim oder Gast', scenarios: ['@W4-030'], owner: 'Runden-Spielplan (gebaut, #290)', expectedFail: false, run: heimGastWechsel },
  { id: 'N1c', title: 'Spielplan: Abstand zwischen zwei Spielen eines Teams wie im DFB-Schlüssel', scenarios: ['@W4-031'], owner: 'Runden-Spielplan (gebaut, #290)', expectedFail: false, run: abstand },
  { id: 'N2a', title: 'Eröffnung: Waging als Heim gegen Gast, Vereinsduell in Runde 2', scenarios: ['@W4-027', '@W4-033'], owner: 'Runden-Spielplan (gebaut, #290)', expectedFail: false, run: eroeffnungWaging },
  { id: 'N2b', title: 'Assistent: Mannschaft des Veranstalters markieren', scenarios: ['@W4-034'], owner: 'Assistent Veranstalter-Markierung (W4-034)', expectedFail: true, run: markierungImAssistenten },
  { id: 'N5', title: 'Zeitplan vor dem ersten Anpfiff um 15 Minuten vorziehen, Zuschauer und Monitor ohne Neuladen', scenarios: ['@ZP-089', '@ZP-090'], owner: 'B-26 / B-27', expectedFail: true, run: zeitplanVorziehen },
];

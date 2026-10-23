/**
 * Spiel beenden und Ergebnis eintragen im Spielplan (20261110_009, Review A3), T2-UI (b), offline (Gast, lokale Engine;
 * Vorbild spielplan-strafstoss.spec.ts). Zwei Seiten im selben Browser: Seite A ist das Cockpit (Olli hat Spiel 1
 * angepfiffen), Seite B der Spielplan. Die Engine-Kopien teilen sich IndexedDB und BroadcastChannel.
 *  - @FU-112: Rückfrage wörtlich, „Nein“ ändert nichts, „Ja“ → beendet; die Tafel im Cockpit zeigt „Ende – eingetragen im
 *    Spielplan“ statt einer gespielten Zeit.
 *  - @FU-114: nach abgelaufener Spielzeit (Uhr der Seite vorgestellt) „Spielzeit abgelaufen – jetzt mit 2:2 beenden?“.
 *  - @FU-118: im laufenden Strafstoßschießen „Strafstoßschießen läuft – im Cockpit zu Ende bringen“.
 *  - @FU-117 / Review H3: ohne Netz (`setOffline`) bekommt ein GAST die Rückfrage trotzdem (nur lokal, nichts kann verspätet
 *    gesendet werden). „Geht nur mit Netz“ gilt für Konten mit Server und ist dort per Vitest belegt
 *    (useScheduleResultEntry.spielBeenden.test.tsx); der Weg mit Konto braucht den lokalen Stack mit _005/_009 (Cloud-Spec).
 *  - visual:metrics der Rückfrage bei 375 px (messeSeite aus `npm run visual:metrics`, HART-Grenzwerte): 0 HART-Befunde.
 * Läuft nur im Projekt `desktop` (setzt die Fenstergröße für die Messung selbst).
 */
import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../helpers/test-fixtures';
import { abpfiffHalten } from '../helpers/abpfiff';
// @ts-expect-error – .mjs ohne Typen; die echte Messfunktion von `npm run visual:metrics`
import { messeSeite } from '../../../scripts/visual-metrics/browser-messung.mjs';

const TOURNAMENT = 'spiel-beenden-offline';
const NORD = '00000000-0000-4000-8000-0000000009b1';
const SUED = '00000000-0000-4000-8000-0000000009b2';
const WEST = '00000000-0000-4000-8000-0000000009b3';
const OST = '00000000-0000-4000-8000-0000000009b4';
const HF1 = '00000000-0000-4000-8000-0000000009a1';

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Gruppenturnier (Spiele erzeugt die App, 10 Minuten in einem Abschnitt) bzw. nur ein Halbfinale (K.-o., Strafstoß). */
function turnier(art: 'gruppe' | 'ko'): Record<string, unknown> {
  const date = tomorrow();
  const basis = {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1,
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2, finalRoundDuration: 10,
    placementLogic: ['points', 'goalDifference', 'goalsFor'],
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Nord', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    teams: [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: WEST, name: 'TSV West' }, { id: OST, name: 'SC Ost' }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  if (art === 'gruppe') {
    return { ...basis, groupSystem: 'roundRobin', finals: { enabled: false }, matches: [] };
  }
  return {
    ...basis, groupSystem: 'groupsAndFinals', finals: { enabled: true }, finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
    matches: [{
      id: HF1, round: 1, field: 1, phase: 'semifinal', label: 'Halbfinale 1', teamA: NORD, teamB: SUED,
      slotA: { kind: 'team', teamId: NORD }, slotB: { kind: 'team', teamId: SUED },
      matchStatus: 'scheduled', scheduledTime: `${date}T10:00:00.000Z`, time: '10:00',
    }],
  };
}

/** Seite A: Cockpit des Turniers, Spiel 1 angepfiffen. */
async function anpfiff(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${TOURNAMENT}`);
  await page.getByText('Live').first().click({ force: true });
  await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('match-start-button').click();
  await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
}

/**
 * Gruppenspiel im Spielplan: Zeile von Spiel 1 antippen (läuft → Live-Info), „Spiel beenden und Ergebnis eintragen“ wählen,
 * Stand mit den Toren-Knöpfen setzen und speichern (@FU-112: „wählt … und trägt 3:1 ein“).
 */
async function beendenImSpielplan(plan: Page, heim: number, gast: number): Promise<void> {
  const zeile = plan.getByRole('row', { name: /^Spiel 1:/ });
  await expect(zeile).toBeVisible({ timeout: 15_000 });
  await zeile.click();
  // Der Klick-außerhalb-Hörer der Karte ist erst 100 ms nach dem Aufklappen scharf. Ein Mensch tippt später; ohne diese
  // Pause klickt Playwright vorher und der Test bliebe auch mit dem alten Fehler (@FU-112: Eingabe klappt sofort zu) grün.
  await plan.waitForTimeout(300);
  await plan.getByTestId('end-and-enter-btn').filter({ visible: true }).first().click();
  const expand = plan.getByTestId('quick-score-expand').filter({ visible: true }).first();
  await expect(expand).toBeVisible();
  const plus = expand.getByRole('button', { name: /Tor hinzufügen/ });
  for (let i = 0; i < heim; i++) { await plus.nth(0).click(); }
  for (let i = 0; i < gast; i++) { await plus.nth(1).click(); }
  await expand.getByTestId('quick-score-save-btn').click();
}

/** Seite B öffnen und das Spiel im Spielplan beenden. */
async function spielplanEintrag(context: BrowserContext, heim: number, gast: number): Promise<Page> {
  const plan = await context.newPage();
  await plan.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  await plan.waitForLoadState('networkidle');
  await beendenImSpielplan(plan, heim, gast);
  return plan;
}

/** K.-o.-Spiel (Finalrunde): die Eingabefelder der Karte bzw. Tabelle (die ersten zwei gehören zum Halbfinale 1). */
async function finalEintrag(context: BrowserContext, heim: number, gast: number): Promise<Page> {
  const plan = await context.newPage();
  await plan.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  await plan.waitForLoadState('networkidle');
  const felder = plan.getByRole('spinbutton').filter({ visible: true });
  await expect(felder.first()).toBeVisible({ timeout: 15_000 });
  await felder.nth(0).fill(String(heim));
  await felder.nth(1).fill(String(gast));
  await felder.nth(1).press('Enter');
  return plan;
}

interface Grenzwert { id: string; typ: string; wert: unknown; geltung: string[]; typJeArt?: Record<string, string> }
const GW = JSON.parse(readFileSync(join(process.cwd(), 'scripts/visual-metrics/grenzwerte.json'), 'utf8')) as { grenzwerte: Grenzwert[] };

/** HART-Befunde von `messeSeite` (App-Modus, wie schnelleingabe-hinweis-fu104.spec.ts). */
async function hartBefunde(page: Page, art: string): Promise<string[]> {
  const g: Record<string, unknown> = {};
  const hart = new Set<string>();
  for (const e of GW.grenzwerte) {
    if (!e.geltung.includes(art) || e.id.startsWith('gate.') || e.id.startsWith('langtext.') || e.id.startsWith('monitor.') || e.id.startsWith('overscan.')) { continue; }
    g[e.id] = e.wert;
    if ((e.typJeArt?.[art] ?? e.typ) === 'HART') { hart.add(e.id); }
  }
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const m: { befunde: { metrik: string; selektor: string; ist: string }[] } = await page.evaluate(messeSeite, {
    art, g, randPx: 0, monitorSchrift: null, ebuPruefen: false, extraInhalte: [],
    primarySelektor: '[data-primary], [data-variant="primary"]',
  });
  return m.befunde.filter((b) => hart.has(b.metrik)).map((b) => `${b.metrik} ${b.selektor} ${b.ist}`);
}

test.describe('Spiel beenden und Ergebnis eintragen im Spielplan (offline, Gast)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'zwei Seiten, setzt Fenstergröße selbst');
  });

  test('@FU-112 Rückfrage wörtlich, „Nein“ ändert nichts, „Ja“ beendet; Tafel „Ende – eingetragen im Spielplan“', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier('gruppe')] });
    await anpfiff(page);
    const plan = await spielplanEintrag(context, 3, 1);

    const frage = plan.getByTestId('result-entry-end-message');
    await expect(frage).toHaveText(/^Spiel 1 läuft noch – Uhr zeigt \d{1,2}:\d{2} Restzeit\. Jetzt mit 3:1 beenden\?$/, { timeout: 10_000 });
    await expect(plan.getByRole('heading', { name: 'Spiel beenden und Ergebnis eintragen' })).toBeVisible();
    await plan.getByTestId('confirm-dialog-cancel').click();
    await expect(frage).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live'); // läuft unverändert weiter

    // Nochmal, diesmal „Ja“
    await beendenImSpielplan(plan, 3, 1);
    await expect(frage).toBeVisible({ timeout: 10_000 });
    await plan.getByTestId('confirm-dialog-confirm').click();
    await expect(frage).toHaveCount(0);

    // Cockpit (Seite A): Ende, kein „Gespielt …“, sondern der Weg
    await expect(page.getByText('Ende – eingetragen im Spielplan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('scoreboard-state')).toContainText('Ende');
    await expect(page.getByTestId('scoreboard-clock-rest')).toHaveCount(0);
  });

  test('@FU-114 Spielzeit abgelaufen ohne Abpfiff: „Spielzeit abgelaufen – jetzt mit 2:2 beenden?“', async ({ page, context, seedIndexedDB }) => {
    await page.clock.install();
    await seedIndexedDB({ tournaments: [turnier('gruppe')] });
    await anpfiff(page);
    await page.close(); // das Cockpit ist weg (Abpfiff vergessen), die Uhr läuft im Spiel weiter
    const plan = await context.newPage();
    await plan.clock.fastForward('12:00');
    await plan.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await plan.waitForLoadState('networkidle');
    await beendenImSpielplan(plan, 2, 2);
    await expect(plan.getByTestId('result-entry-end-message')).toHaveText('Spielzeit abgelaufen – jetzt mit 2:2 beenden?', { timeout: 10_000 });
    await plan.getByTestId('confirm-dialog-confirm').click();
    await expect(plan.getByTestId('result-entry-end-message')).toHaveCount(0);
  });

  test('@FU-117 Review H3: Gast ohne Netz bekommt die Rückfrage trotzdem (nur lokal); visual:metrics bei 375 px ohne HART', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier('gruppe')] });
    await anpfiff(page);
    const plan = await context.newPage();
    await plan.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await plan.waitForLoadState('networkidle');
    await context.setOffline(true); // nach dem Laden (der Dev-Server liefert die Seite nur mit Netz)
    await beendenImSpielplan(plan, 3, 1);
    const frage = plan.getByTestId('result-entry-end-message');
    await expect(frage).toBeVisible({ timeout: 10_000 });
    await expect(plan.getByText('Geht nur mit Netz')).toHaveCount(0);

    await plan.setViewportSize({ width: 375, height: 667 });
    await expect(frage).toBeVisible();
    expect(await hartBefunde(plan, 'handy')).toEqual([]);
    expect(await plan.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const ja = await plan.getByTestId('confirm-dialog-confirm').boundingBox();
    expect(ja?.height ?? 0).toBeGreaterThanOrEqual(44);
    await test.info().attach('rueckfrage-375', { body: await plan.screenshot(), contentType: 'image/png' });
    await plan.getByTestId('confirm-dialog-cancel').click();
    await context.setOffline(false);
  });

  test('@FU-118 im laufenden Strafstoßschießen: „Strafstoßschießen läuft – im Cockpit zu Ende bringen“', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier('ko')] });
    await anpfiff(page);
    // Abpfiff halten (Rückfrage „Beenden“), 0:0 im K.-o. mit Regel „Strafstoßschießen“ → Strafstoßschießen
    await abpfiffHalten(page);
    await expect(page.getByTestId('scoreboard-clock')).toContainText(/Schüsse|Strafstoß/, { timeout: 10_000 });

    const plan = await finalEintrag(context, 1, 1);
    await expect(plan.getByText('Strafstoßschießen läuft – im Cockpit zu Ende bringen')).toBeVisible({ timeout: 10_000 });
    await expect(plan.getByTestId('result-entry-end-message')).toHaveCount(0);
  });
});
